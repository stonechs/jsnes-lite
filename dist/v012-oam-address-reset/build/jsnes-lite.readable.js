document.open();document.write("<!doctype html><html lang=zh-CN><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"><title>JSNES lite</title><style>body{margin:0;background:#111;color:#ddd;font:14px system-ui;color-scheme:dark}main{min-height:100dvh;display:grid;align-content:center;justify-items:center;gap:6px}nav{display:flex;align-items:center;gap:6px}input{max-width:52vw}button{font:inherit;padding:5px 10px}canvas{width:min(calc(100vw - 24px),calc((100dvh - 112px)*16/15));background:#000;image-rendering:pixelated}small,output{max-width:94vw;overflow-wrap:anywhere;text-align:center}main:fullscreen{width:100%;background:#111}</style><main><nav><input id=rom type=file accept=.nes,.7z aria-label=\"选择 ROM\"><button id=mute aria-pressed=false>静音</button><button id=full>全屏</button></nav><canvas id=screen width=256 height=240></canvas><small>方向键移动 · Z/B X/A · 空格/Select Enter/Start · F/全屏</small><small>支持 Mapper 0–4、30（UNROM-512）</small><output id=status>选择 .nes / .7z</output></main>");document.close();
var B,O,i,joy1Read,joy1StrobeState,joy2Read,joy2StrobeState,joypadLastWrite,memory_read,memory_write,totalCycles,x;
// Jsnes-lite API
// ==============

// This file exposes six functions that help handle the inputs and outputs of the emulator:
// - NES.start({rom, save, frame, audio})
// - NES.reset()
// - NES.frame()
// - NES.keydown(button)
// - NES.keyup(button)
var NES = {
  
  // Emulator globals
  loop: null,
  fps: 60.098,
  frameTime: 1000 / 60.098,
  nextFrameAt: 0,
  cpu_cycles: 0,
  
  // ROM globals
  mapper: 0,
  mapper30Battery: false,
  mirroring: 0,
  prg: [],
  chr: [],
  
  // Graphics globals
  frameCtx: null,
  frameData: null,
  frameBuffer: null,
  frameBuffer8: null,
  frameBuffer32: null,
  
  // Audio globals
  leftSamples: [],
  rightSamples: [],
  currentSample: 0,
  sampleRate: 44100,
  cyclesToHalt: 0,
  
  // Single controller
  controller: null,
  
  // Mapper globals
  prg_0_bank: 0,
  prg_1_bank: 1,
  chr_bank: 0,
  mirroring_backup: 0,
  
  // Init the emulator with the rom (binary string), optional save file, and the game canvas
  init: ({rom, save, frame}) => {

    // Reset emulator
    NES.reset();
    
    // Parse ROM
    NES.parse(rom);
    
    // Load ROM's content in memory according to current mapper
    NES.load();
    
    // Init display
    NES.frameCtx = frame.getContext("2d");
    NES.frameData = NES.frameCtx.getImageData(0, 0, 256, 240);
    NES.frameBuffer = new ArrayBuffer(256 * 240 * 4);
    NES.frameBuffer8 = new Uint8Array(NES.frameBuffer);
    NES.frameBuffer32 = new Uint32Array(NES.frameBuffer);
// Init the only controller
    NES.controller = new Controller();
    
  },
  
  // Play
  play: () => {
    NES.pause();
    apu_playing = true;
    apu_origin=apu_context.currentTime+.04-apu_time/1789773;
    if(apu_context) apu_context.resume();
    NES.nextFrameAt = performance.now();
    NES.loop = setTimeout(NES.next_frame, 0);
  },
  
  next_frame: () => {
    if(NES.loop === null)return;
    NES.frame();
    NES.nextFrameAt += NES.frameTime;
    var now = performance.now();
    if(now - NES.nextFrameAt > 3 * NES.frameTime) NES.nextFrameAt = now;
    NES.loop = setTimeout(NES.next_frame, Math.max(0, NES.nextFrameAt - now));
  },
  // Pause
  pause: () => {
    clearTimeout(NES.loop);
    NES.loop = null;
    apu_playing = false;
    apu_silence();
    apu_flush();
  },

  // Reset
  reset: () => {
    
    // Stop 60 fps loop (if any)
    NES.pause();
    
    // Reset CPU, PPU, APU
    cpu_reset();
    ppu_reset();
    apu_reset();
    // Soft reset restores cartridge registers while preserving its PRG-RAM.
    if(NES.prg.length) mapper_reset();
    
    // Send reset interrupt to the CPU
    interrupt_requested = 2;
    
    NES.cyclesToHalt = 0;
    
    //NES.cpu_cycles = 0;
  },

  // Render a new frame
  frame: () => {
    
    
    var cycles;
    totalCycles = 0;
    endFrame = 0;
    
    // Repeatedly execute CPU instructions until the frame is fully rendered
    while(!endFrame){
      cycles=emulate();
      apu_clock(cycles);
      for (i = cycles; i--;) {
        cpu_tick();
      }
    }
    apu_flush();
  },
  
  keydown: button => {
    NES.controller.keydown(button);
  },

  keyup: button => {
    NES.controller.keyup(button);
  },
  
  //haltCycles: (cycles) => {
  //  NES.cyclesToHalt += cycles;
  //}
}

;
// iNES 1.0 loader. NES 2.0/submappers are explicitly rejected.
NES.parse=data=>{
  if(data.length<16||data[0]!==78||data[1]!==69||data[2]!==83||data[3]!==26||!data[4])throw new Error('ROM');
  if((data[7]&12)===8)throw new Error('NES2');
  var offset=16+((data[6]&4)?512:0);
  if(data.length<offset+data[4]*16384+data[5]*8192)throw new Error('EOF');
  NES.mapper=(data[6]>>4)|(data[7]&240);
  NES.mapper30Battery=NES.mapper===30&&!!(data[6]&2);
  NES.fourScreen=!!(data[6]&8);
  NES.headerMirroring=NES.mirroring=NES.fourScreen?2:(data[6]&1)?0:1;
  NES.chrRAM=data[5]===0;
  NES.prg=[];
  for(var bank=0;bank<data[4];bank++){
    NES.prg.push(data.slice(offset,offset+16384));offset+=16384;
  }
  NES.chr=[];
  for(bank=0;bank<data[5];bank++){
    NES.chr.push(data.slice(offset,offset+8192));offset+=8192;
  }
  if(NES.chrRAM)for(bank=0;bank<(NES.mapper===30?4:1);bank++)NES.chr.push(new Uint8Array(8192));
};

;
// CPU
// ===

// Resources:
// - https://wiki.nesdev.com/w/index.php/CPU_unofficial_opcodes
// - https://wiki.nesdev.com/w/index.php/Status_flags
// - http://wiki.nesdev.com/w/index.php/CPU_interrupts
// - https://wiki.nesdev.com/w/index.php/Stack
// - https://www.masswerk.at/6502/6502_instruction_set.html
// - https://problemkaputt.de/everynes.htm#cpu65xxmicroprocessor
// - https://www.npmjs.com/package/dict-tempering
// - http://www.6502.org/tutorials/vflag.html
// - https://retrocomputing.stackexchange.com/questions/145
// - http://forum.6502.org/viewtopic.php?f=8&t=6370

var
cpu_mem,
interrupt_requested,
nmi_delay = -1,
clk = 0,

// Reset the CPU
cpu_reset = () => {
    
  // CPU internal memory (64KB)
  cpu_mem = [];
  clk = 0;
  nmi_delay = -1;
},

// Clock 1 CPU cycle
// During this time, 3 PPU cycles and 1 APU cycle take place
cpu_tick = () => {
  clk++;
  ppu_tick();
  ppu_tick();
  ppu_tick();
  //apu_tick();
},

// Emulates a single CPU instruction or interrupt, returns the number of cycles
emulate = () => {

  // Approximate the PPU-to-CPU NMI delay by one instruction, allowing a
  // nearby $2002 read to cancel the pending edge.
  if(nmi_delay === 0){
    nmi_delay = -1;
    if(!interrupt_requested) interrupt_requested = 1;
  }else if(nmi_delay > 0) nmi_delay--;

  // Execute the requested interrupt, if any
  if(interrupt_requested){
    
    // 1: NMI
    // 2: Reset
    // 3: IRQ
    op(interrupt_requested);
    
    // Reset interrupt requested flag
    interrupt_requested = 0;
  }

  // Or execute next instruction
  else if((mapper_irq || apu_irq_pending()) && !I) {
    // Cartridge IRQ is level-sensitive; polling must not discard a masked IRQ.
    op(3);
  }
  else {
    op();
  }
  
  // Return the number of cycles spent
  return c;
}

;
// Memory manager
// ==============

// This file handles the CPU's memory accesses
// It assumes that the memory has been initialized (see CPU_reset())
// Reading and writing at specific addresses makes the CPU able to communicate with other parts of the emulator (PPU, APU, controllers, mapper)

// Resources:
// - https://problemkaputt.de/everynes.htm#memorymaps
// - https://problemkaputt.de/everynes.htm#iomap
// - https://wiki.nesdev.com/w/index.php/cpu_memory_map

//  CPU memory map (64KB):

//  +-------------+-------+-------------------------------------------------------+
//  | Address     | Size  | Use                                                   |
//  +-------------+-------+-------------------------------------------------------+
//  | $0000-$07FF | 2KB   | 2KB internal RAM:                                     |
//  | $0000-$00FF | 256B  | - Zero page                                           |
//  | $0100-$01FF | 256B  | - Stack                                               |
//  | $0200-$07FF | 1.5KB | - General purpose                                     |
//  +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - -+
//  | $0800-$0FFF | 2KB   | Mirror of $0000-$07FF                                 |
//  | $1000-$17FF | 2KB   | Mirror of $0000-$07FF                                 |
//  | $1800-$1FFF | 2KB   | Mirror of $0000-$07FF                                 |
//  +-------------+-------+-------------------------------------------------------+
//  | $2000-$2007 | 8B    | PPU I/O registers:                                    |
//  | 2000        | 1B    | PPU Control Register 1                   (Write-only) |
//  | 2001        | 1B    | PPU Control Register 2                   (Write-only) |
//  | 2002        | 1B    | PPU Status Register                       (Read-only) |
//  | 2003        | 1B    | SPR-RAM Address Register                 (Write-only) |
//  | 2004        | 1B    | SPR-RAM Data Register                    (Read/write) |
//  | 2005        | 1B    | PPU Background Scrolling Offset   (Write-only, twice) |
//  | 2006        | 1B    | VRAM Address Register             (Write-only, twice) |
//  | 2007        | 1B    | VRAM Read/Write Data Register            (Read/write) |
//  +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - -+
//  | $2008-$3FFF | 8184B | Mirrors of $2000-$2007 (every 8 bytes)                |
//  +-------------+-------+-------------------------------------------------------+
//  | $4000-$4017 | 24B   | APU I/O registers:                                    |
//  | 4000        | 1B    | APU Channel 1 (Rectangle) Volume/Decay        (Write) |
//  | 4001        | 1B    | APU Channel 1 (Rectangle) Sweep               (Write) |
//  | 4002        | 1B    | APU Channel 1 (Rectangle) Frequency           (Write) |
//  | 4003        | 1B    | APU Channel 1 (Rectangle) Length              (Write) |
//  | 4004        | 1B    | APU Channel 2 (Rectangle) Volume/Decay        (Write) |
//  | 4005        | 1B    | APU Channel 2 (Rectangle) Sweep               (Write) |
//  | 4006        | 1B    | APU Channel 2 (Rectangle) Frequency           (Write) |
//  | 4007        | 1B    | APU Channel 2 (Rectangle) Length              (Write) |
//  | 4008        | 1B    | APU Channel 3 (Triangle) Linear Counter       (Write) |
//  | 4009        | 1B    | N/A                                                   |
//  | 400A        | 1B    | APU Channel 3 (Triangle) Frequency            (Write) |
//  | 400B        | 1B    | APU Channel 3 (Triangle) Length               (Write) |
//  | 400C        | 1B    | APU Channel 4 (Noise) Volume/Decay            (Write) |
//  | 400D        | 1B    | N/A                                                   |
//  | 400E        | 1B    | APU Channel 4 (Noise) Frequency               (Write) |
//  | 400F        | 1B    | APU Channel 4 (Noise) Length                  (Write) |
//  | 4010        | 1B    | APU Channel 5 (DMC) Play mode & DMA frequency (Write) |
//  | 4011        | 1B    | APU Channel 5 (DMC) Delta counter load        (Write) |
//  | 4012        | 1B    | APU Channel 5 (DMC) Address load              (Write) |
//  | 4013        | 1B    | APU Channel 5 (DMC) Length                    (Write) |
//  +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - -+
//  | 4014        | 1B    | SPR-RAM DMA Register                          (Write) |
//  +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - -+
//  | 4015        | 1B    | DMC/IRQ/length status/channel enable     (Read/write) |
//  +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - -+
//  | 4016        | 1B    | Joypad #1                                (Read/write) |
//  | 4017        | 1B    | Joypad #2 / APU SOFTCLK                  (Read/write) |
//  +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - -+
//  | $4018-$401F | 8B    | APU I/O test registers (disabled)                     |
//  +-------------+-------+-------------------------------------------------------+
//  | $4020-$FFFF | 48KB  | Cartridge space:                                      |
//  | $4020-$5FFF | 8160B | - Expansion ROM (some mappers add extra ROM/RAM here) |
//  | $6000-$7FFF | 8KB   | - PRG-RAM (if any)                                    |
//  | $7000-$71FF | 512B  | - trainer (if any)                                    |
//  | $8000-$BFFF | 16KB  | - PRG-ROM low page                                    |
//  | $C000-$FFFF | 16KB  | - PRG-ROM high page, including:                       |
//  | $FFFA-$FFFB | 2B    |   * NMI vector                                        |
//  | $FFFC-$FFFD | 2B    |   * Reset vector                                      |
//  | $FFFE-$FFFF | 2B    |   * IRQ/BRK vector                                    |
//  +-------------+-------+-------------------------------------------------------+


// Read a 8-byte value in memory
memory_read = address => {
  
  // Wrap around ($0000-$FFFF)
  address &= 0xFFFF;
  
  // Handle RAM mirrors ($0000-$07FF + $0800-$1FFF)
  if(address < 0x2000) address &= 0x7FF;
  
  // PPU registers ($2000-$2007) + mirrors ($2008-$3FFF)
  else if(address < 0x4000){
    
    // Mirroring
    address &= 0x2007;

    // $2002: PPU Status Register
    if(address == 0x2002) return get_PPUSTATUS(); 

    // $2004: Sprite Memory read
    else if(address == 0x2004) return get_OAMDATA(); 
    
    // $2007: VRAM read
    else if(address == 0x2007) return get_PPUDATA(); 
  }
  
  // Sound and I/O registers ($4000-$401F)
  else if(address < 0x4020){
    
    // $4015: Sound channel enable, DMC Status
    if(address == 0x4015){
      return get_4015();
    }

    // $4016: Joystick 1 + Strobe
    else if(address == 0x4016) return joy1Read();

    // $4017: Joystick 2 + Strobe
    else if(address == 0x4017) return joy2Read();
  }
  
  // PRG-ROM
  else if(address >= 0x8000) return mapper_prg_read(address);
  else if(address >= 0x6000) return mapper_ram_enabled ? mapper_ram[address - 0x6000] : 0;
  
  // Simply read in memory
  return cpu_mem[address] || 0;
},

// Write a 8-bit value in memory
memory_write = (address, value) => {
  
  // Wrap around ($0000-$FFFF)
  address &= 0xFFFF;
  
  // Handle RAM mirrors ($0000-$07FF + $0800-$1FFF)
  if(address < 0x2000) address &= 0x7FF;
  
  // PPU registers ($2000-$2007) + mirrors ($2008-$3FFF)
  else if(address < 0x4000){
    
    address &= 0x2007;
    
    // $2000: PPU Control register 1 (write-only)
    if(address == 0x2000) set_PPUCTRL(value);

    // $2001: PPU Control register 2 (write-only)
    else if(address == 0x2001) set_PPUMASK(value);

    // $2003: Set Sprite RAM address (write-only)
    else if(address == 0x2003) set_OAMADDR(value);

    // $2004: Write to Sprite RAM
    else if(address == 0x2004) set_OAMDATA(value);

    // $2005: Screen Scroll offsets (write-only)
    else if(address == 0x2005) set_PPUSCROLL(value);

    // $2006: Set VRAM address (write-only)
    else if(address == 0x2006) set_PPUADDR(value);

    // $2007: Write to VRAM
    else if(address == 0x2007) set_PPUDATA(value);
  }
  
  // Compact APU register dispatch.
  else if(address < 0x4010) apu_write(address,value);
  // I/O registers ($4014-$401F)
  else if(address < 0x4020){
    
    // $4014: Sprite Memory DMA Access
    if(address == 0x4014) set_OAMDMA(value);

    // $4015: Sound Channel Switch, DMC Status
    else if(address == 0x4015) {
      set_4015(value);
    }

    // $4016: Joystick 1 + Strobe
    else if(address == 0x4016){
      if((value & 1) === 0 && (joypadLastWrite & 1) === 1){
        joy1StrobeState = 0;
        joy2StrobeState = 0;
      }
      joypadLastWrite = value;
    }

    // $4017: Sound channel frame sequencer:
    else if(address == 0x4017){
      set_4017(value);
    }
  }

  // Write to persistent RAM (save slot)
  else if(address >= 0x6000 && address < 0x8000) {
    if(mapper_ram_enabled && !mapper_ram_protect) mapper_ram[address - 0x6000] = value;
    return;
  }
  
  // Simply write in memory, if not in PRG-ROM (necessary?)
  if(address < 0x8000){
    cpu_mem[address] = value;
  }
  
  // Inform the Mapper that a write has been made in memory
  mapper_write(address, value);
}

;
// Cartridge adapters, adapted to jsnes-lite from JSNES 2.1.0 (Apache-2.0).
// Reference commit: b8a45d088e922b6abcd87c4eb1b7237919e9d3d2.
// PRG pages: 8 KiB; CHR pages: 1 KiB. Tables also support banked CHR-RAM.
var mapper_prg=[],mapper_chr=[],mapper_ram,mapper_irq=0,
    mapper_ram_enabled=1,mapper_ram_protect=0,
    mmc1_shift=16,mmc1_control=12,mmc1_chr0=0,mmc1_chr1=0,
    mmc1_prg=0,mmc1_last_write=-2,
    mmc3_select=0,mmc3_registers=[],mmc3_counter=0,mmc3_latch=0,
    mmc3_reload=0,mmc3_enabled=0,mmc3_a12=0,mmc3_low_since=0;

// Map consecutive pages, wrapping within the actual cartridge size.
var mapper_map_prg=(slot,bank,count)=>{
  for(var index=0;index<count;index++) mapper_prg[slot+index]=(bank+index)%(NES.prg.length*2);
};
var mapper_map_chr=(slot,bank,count)=>{
  for(var index=0;index<count;index++) mapper_chr[slot+index]=(bank+index)%(NES.chr.length*8);
};
var mapper_prg_read=address=>{
  var bank=mapper_prg[(address-0x8000)>>13];
  return NES.prg[bank>>1][((bank&1)<<13)|(address&0x1fff)];
};
var mapper_chr_read=address=>{
  var bank=mapper_chr[address>>10];
  return NES.chr[bank>>3][((bank&7)<<10)|(address&1023)];
};
var mapper_chr_write=(address,value)=>{
  if(NES.chrRAM){
    var bank=mapper_chr[address>>10];
    NES.chr[bank>>3][((bank&7)<<10)|(address&1023)]=value;
  }
};

// MMC1: 32/16 KiB PRG, 8/4 KiB CHR and both single-screen nametable pages.
// SUROM: CHR0 bit 4 selects the upper 256 KiB on a 512 KiB CHR-RAM cart.
var mmc1_sync=()=>{
  NES.mirroring=[3,4,0,1][mmc1_control&3];
  mapper_ram_enabled=!(mmc1_prg&16);
  var outer=NES.chrRAM&&NES.prg.length>16?mmc1_chr0&16:0;
  var last=Math.min(15,NES.prg.length-1),mode=(mmc1_control>>2)&3;
  if(mode<2) mapper_map_prg(0,(outer|(mmc1_prg&14))*2,4);
  else if(mode===2){
    mapper_map_prg(0,outer*2,2);
    mapper_map_prg(2,(outer|(mmc1_prg&15))*2,2);
  }else{
    mapper_map_prg(0,(outer|(mmc1_prg&15))*2,2);
    mapper_map_prg(2,(outer|last)*2,2);
  }
  if(mmc1_control&16){
    mapper_map_chr(0,mmc1_chr0*4,4);
    mapper_map_chr(4,mmc1_chr1*4,4);
  }else mapper_map_chr(0,(mmc1_chr0&30)*4,8);
};

// MMC3: two 2 KiB CHR pairs, four 1 KiB CHR pages, two switchable PRG pages.
// Mode changes immediately remap all registers, even before another data write.
var mmc3_sync=()=>{
  var registers=mmc3_registers,swap=(mmc3_select&128)?4:0;
  mapper_map_chr(swap,registers[0]&254,2);
  mapper_map_chr(swap+2,registers[1]&254,2);
  for(var index=0;index<4;index++) mapper_map_chr((swap^4)+index,registers[index+2],1);
  var fixed=NES.prg.length*2-2;
  mapper_map_prg(0,(mmc3_select&64)?fixed:registers[6]&63,1);
  mapper_map_prg(1,registers[7]&63,1);
  mapper_map_prg(2,(mmc3_select&64)?registers[6]&63:fixed,1);
  mapper_map_prg(3,fixed+1,1);
};

// MMC3B/C reload/decrement semantics. IRQ stays asserted until $E000 ack.
var mapper_clock_irq=()=>{
  if(NES.mapper!==4)return;
  if(mmc3_counter===0||mmc3_reload)mmc3_counter=mmc3_latch;
  else mmc3_counter--;
  mmc3_reload=0;
  if(mmc3_counter===0&&mmc3_enabled)mapper_irq=1;
};
// Observe CPU-driven PPUADDR/PPUDATA edges, not background renderer CHR reads.
// A12 must remain low for >=8 PPU clocks before a rising edge qualifies.
var mapper_ppu_address=address=>{
  if(NES.mapper!==4)return;
  var high=(address>>12)&1,time=(clk+c)*3;
  if(!high&&mmc3_a12)mmc3_low_since=time;
  if(high&&!mmc3_a12&&time-mmc3_low_since>=8)mapper_clock_irq();
  mmc3_a12=high;
};
// Like JSNES, clock once per rendered scanline. This core does not have a
// dot-exact PPU fetch pipeline; special A12/rendering timings remain approximate.
var mapper_scanline=()=>{
  if(NES.mapper===4&&(PPUMASK_b||PPUMASK_s))mapper_clock_irq();
};
var mapper_reset=()=>{
  mapper_irq=mmc3_counter=mmc3_latch=mmc3_reload=mmc3_enabled=0;
  mmc3_a12=mmc3_low_since=0;
  mapper_ram_enabled=1;mapper_ram_protect=0;
  NES.mirroring=NES.headerMirroring;
  mapper_map_prg(0,0,4);
  if(NES.mapper!==0&&NES.mapper!==3)mapper_map_prg(2,NES.prg.length*2-2,2);
  mapper_map_chr(0,0,8);
  if(NES.mapper===1){
    mmc1_shift=16;mmc1_control=12;
    mmc1_chr0=mmc1_chr1=mmc1_prg=0;mmc1_last_write=-2;mmc1_sync();
  }else if(NES.mapper===4){
    mmc3_select=0;mmc3_registers=[0,2,4,5,6,7,0,1];mmc3_sync();
  }
};
NES.load=()=>{
  if(![0,1,2,3,4,30].includes(NES.mapper))throw new Error('Map'+NES.mapper);
  mapper_ram=new Uint8Array(8192);
  mapper_reset();
};
var mapper_write=(address,value)=>{
  if(address<0x8000)return;
  value&=255;
  if(NES.mapper===1){
    // Consecutive-cycle serial writes after the first are ignored (CPU RMW).
    var cycle=clk+c,previous=mmc1_last_write;
    mmc1_last_write=cycle;
    if(cycle===previous+1)return;
    if(value&128){mmc1_shift=16;mmc1_control|=12;mmc1_sync();return}
    var complete=mmc1_shift&1;
    mmc1_shift=(mmc1_shift>>1)|((value&1)<<4);
    if(complete){
      switch((address>>13)&3){
        case 0:mmc1_control=mmc1_shift;break;
        case 1:mmc1_chr0=mmc1_shift;break;
        case 2:mmc1_chr1=mmc1_shift;break;
        case 3:mmc1_prg=mmc1_shift;break;
      }
      mmc1_shift=16;mmc1_sync();
    }
  }else if(NES.mapper===2)mapper_map_prg(0,value*2,2);
  else if(NES.mapper===3)mapper_map_chr(0,value*8,8);
  else if(NES.mapper===4){
    switch(address&0xe001){
      case 0x8000:mmc3_select=value;mmc3_sync();break;
      case 0x8001:mmc3_registers[mmc3_select&7]=value;mmc3_sync();break;
      case 0xa000:if(!NES.fourScreen)NES.mirroring=value&1;break;
      case 0xa001:mapper_ram_enabled=(value>>7)&1;mapper_ram_protect=(value>>6)&1;break;
      case 0xc000:mmc3_latch=value;break;
      case 0xc001:mmc3_counter=0;mmc3_reload=1;break;
      case 0xe000:mmc3_enabled=mapper_irq=0;break;
      case 0xe001:mmc3_enabled=1;break;
    }
  }else if(NES.mapper===30&&address>=(NES.mapper30Battery?0xc000:0x8000)){
    // UNROM-512: switch a 16 KiB PRG bank, an 8 KiB CHR-RAM bank, and
    // optionally select lower single-screen mirroring. iNES battery-backed
    // images reserve $8000-$BFFF writes for flash commands, so their bank
    // register is decoded only at $C000-$FFFF. Non-flash boards have bus
    // conflicts between the ROM data and the value written by the CPU.
    var bankValue=NES.mapper30Battery?value:(value&mapper_prg_read(address));
    mapper_map_prg(0,(bankValue&31)*2,2);
    mapper_map_chr(0,((bankValue>>5)&3)*8,8);
    if(!NES.fourScreen)NES.mirroring=(bankValue&128)?3:NES.headerMirroring;
  }
};

;
var Controller = function(){
  this.state = new Array(8);
  for(var i = 0; i < this.state.length; i++){
    this.state[i] = 0x40;
  }
};

joy1StrobeState = 0
joy2StrobeState = 0

Controller.BUTTON_A = 0;
Controller.BUTTON_B = 1;
Controller.BUTTON_SELECT = 2;
Controller.BUTTON_START = 3;
Controller.BUTTON_UP = 4;
Controller.BUTTON_DOWN = 5;
Controller.BUTTON_LEFT = 6;
Controller.BUTTON_RIGHT = 7;

Controller.prototype = {
  keydown: function(key){
    this.state[key] = 0x41;
  },

  keyup: function(key){
    this.state[key] = 0x40;
  }
};


joy1Read = function(){
  var ret;

  switch (joy1StrobeState){
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      ret = NES.controller.state[joy1StrobeState];
      break;
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
    case 17:
    case 18:
      ret = 0;
      break;
    case 19:
      ret = 1;
      break;
    default:
      ret = 0;
  }

  joy1StrobeState++;
  if(joy1StrobeState === 24){
    joy1StrobeState = 0;
  }

  return ret;
},

// Unconnected second port: keep the existing idle serial response only.
joy2Read = function(){
  var index = joy2StrobeState;
  joy2StrobeState = (index + 1) % 24;
  return index < 8 ? 0x40 : index === 19 ? 1 : 0;
}

;
// mini 6502 CPU simulator
// =======================

// Globals
// -------

// Registers
A =           // accumulator
X =           // X
Y =           // Y
S = 0,        // stack pointer (also called SP)
PC = 0x8000,  // program counter (address of next instruction)
P = 0x24,     // status register (flags on bytes 0-7: C=0, Z=0, I=1, D=0, B=0, 1, V=0, N=0)

// Other globals
t =          // temp var
o =          // opcode value
a =          // operand address
p =          // operand value
c = 0,       // cycle counter

// Helpers
// -------

// Read/write a byte in memory. Costs 1 cycle
// These functions handle mirrors, persistent save slots, and Mapper-specific features like bank switches
r = v => (c++, memory_read(v)),
w = (v, w) => (c++, memory_write(v, w)),

// Update N and Z status flags:
// - The value v is clamped on 8 bits and returned
// - The Zero flag (bit 1 of P) is set if v is zero, otherwise it's cleared
// - The Negative flag (bit 7 of P) is set if byte 7 of v is 1, otherwise it's cleared
F = v => (
  Z = (v &= 255) < 1,
  N = v >> 7,
  v
),

// Update the flags values according to the status register P
f = v => (
  C = v & 1,
  Z = (v>>1) & 1,
  I = (v>>2) & 1,
  D = (v>>3) & 1,
  B = (v>>4) & 1,
  V = (v>>6) & 1,
  N = v>>7
),

// Set all flags on load
f(P = 0x24),

// Push on Stack
// Write at address $100 + S, decrement S, wrap it between $00 and $FF
h = v => (
  w(256 + S--, v),
  S &= 255
),

// Pull from stack
// Increment S, wrap it between $00 and $FF, read at address $100 + S
g = v => r(256 + (S = (255 & (S+1)))),

// Instructions
// ============

// The code below creates a function for each valid opcode supported by the CPU.
// When a function is called:
// - PC represents the current opcode's address
// - o is the opcode's value
// - a equals PC+1
// - p is the value stored at the address PC+1
// - c (the cycle counter) equals 2 because two memory reads have already been done (o and p)
O = [...Array(255)].map((t,o) =>
  Function(

    (

      // Addressing modes
      // ----------------

      // Some opcodes require an address in memory
      // This address can be computed in 11 different ways
      // The 10 main ones are implemented here, the 11th is included in the last instruction (JMP ind)
      // The order and implementations below are optimized for a better gzip compression

      // "0": Immediate:
      // The target address is PC+1, already stored in a
      // Opcode size: 2 bytes
      // Cycles total: 2
      // Cycles addr.: -1 (1 cycle is removed because the first p fetch is redundant, the instruction has to read it again)
      // Cycles opc. : 1
      "c--,PC++;"

      // "1": Relative:
      // (only used for branching)
      // The target address (between PC-128 and PC+127) = PC + signed offset stored in p
      // Opcode size: 2 bytes
      // Cycles total: 2 (no branch) / 3 (branch on same page) / 4 (branch on another page)
      // Cycles addr.: 0
      // Cycles opc. : 0-2
      + "a=a+p-256*(p>>7),PC++;"

      // "2": Indexed indirect X
      // The target address is absolute and stored at a zero page address which is stored at PC + 1 + X
      // Opcode size: 2 bytes
      // Cycles total: 6 (read or write)
      // Cycles addr.: 3
      // Cycles opc. : 1
      + "a=r(p+X&255)+256*r(p+X+1&255),PC++,c++;"

      // "3": Indirect indexed Y
      // The target address is absolute and stored at a zero page address which is stored at PC+1, then Y is added to it
      // Opcode size: 2 bytes
      // Cycles total: 5* (read) / 6 (write)
      // Cycles addr.: 2-3
      // Cycles opc. : 0-1
      // * Cross-page read (if address and address + Y are on different pages) costs 1 extra cycle
      + "a=r(p)+256*r(p+1&255)+Y,c+=a-Y>>8<a>>8||o>>4==9,PC++;"

      // "4": Zero page X
      // The target address is equal to zero page address (stored at PC+1) + X, wrapping between $00 and $FF
      // Opcode size: 2 bytes
      // Cycles total: 3 (BIT) / 4 (read or write) / 6 (read + write)
      // Cycles addr.: 1
      // Cycles opc. : 0-2
      + "a=r(a)+X&255,PC++;"

      // "5": Zero page Y
      // The target address is equal to zero page address (stored at PC+1) + Y, wrapping between $00 and $FF
      // Opcode size: 2 bytes
      // Cycles total: 4 (read or write)
      // Cycles addr.: 1
      // Cycles opc. : 1
      + "a=r(a)+Y&255,PC++;"

      // "6": Zero page
      // The target address (between $00 and $FF) is stored in p
      // Opcode size: 2 bytes
      // Cycles total: 3 (read or write) / 5 (read + write)
      // Cycles addr.: 0
      // Cycles opc. : 1-3
      + "a=p,PC++;"

      // "7": Absolute
      // The target address is stored at PC+1 (low byte) and PC+2 (high byte)
      // Opcode size: 3 bytes
      // Cycles total: 3 (JMP) / 4 (read or write) / 6 (read + write or JSR)
      // Cycles addr.: 1
      // Cycles opc. : 0-3
      + "a=p+256*r(PC+=2);"

      // "8": Absolute Y
      // The target address is equal to absolute address (stored at PC+1 and PC+2) + Y
      // Opcode size: 3 bytes
      // Cycles total: 4* (read) / 5 (write)
      // Cycles addr.: 1-2
      // Cycles opc. : 0-2
      // * Cross-page read (if address and address + Y are on different pages) costs 1 extra cycle
      + "t=p+256*r(PC+=2),c+=t>>8<t+Y>>8||o>>4==9,a=t+Y;"

      // "9": Absolute X
      // The target address is equal to absolute address (stored at PC+1 and PC+2) + X
      // Opcode size: 3 bytes
      // Cycles total: 4* (read) / 5 (write) / 7 (read + write)
      // Cycles addr.: 1-2
      // Cycles opc. : 0-4
      // * Cross-page read (if address and address + X are on different pages) costs 1 extra cycle
      + "t=p+256*r(PC+=2),c+=t>>8<t+X>>8||o>>4==9||(15&o)>13,a=t+X"

      // "Z": implicit or Accumulator
      // The target is either a flag or a CPU register (no need to compute an address)
      // (When a "Z" is read, the generated JavaScript code will just contain "undefined;")
      // Opcode size: 1 byte (no need to increment PC)
      // Cycles total: 2-7
      // Cycles addr.: 0
      // Cycles opc. : 0-5
      + ""

    // Make an array from this string
    ).split(";")

    // Fetch the right addressing mode for the current opcode (ignore illegal opcode where o % 4 == 3):
    // (The string below is optomized for compression: the illegal opcodes are assigned characters that create extra repetitions)
    [
      (
         "020666Z0Z77713Z444Z8Z999"
        +"720666Z0Z77713Z444Z8Z999"
        +"Z20666Z0Z77713Z444Z8Z999"
        +"Z20666Z0Z77713Z444Z8Z999"
        +"020666Z0Z77713Z445Z8Z998"
        +"020666Z0Z77713Z445Z8Z998"
        +"020666Z0Z77713Z444Z8Z999"
        +"020666Z0Z77713Z444Z8Z999"
      )[o-(o>>2)]
    ]

    // Separator
    + ";"

    // Instructions
    // ------------

    // There are 56 official instructions, performing operations in memory and/or in the registers
    // Some instructions use extra cycles:
    // *  : cross-page when fetching the address costs 1 extra cycle
    // ** : Same-page branch (PC+2>>8 == a>>8) costs 1 extra cycle. Cross-page branch costs 2 extra cycles
    // ***: Instructions that read, modify and write a value in memory (+ JSR/RTI/RTS/PLA/PLP) cost 1 to 2 extra cycles
    // The order and implementations below are also optimized for a better gzip compression
    // Also, some instructions were splitted in two if they target either the memory or the Accumulator register (ROR, ROL, LSR, ASL)

    + (
    
      // " ": TXS (transfer X to stack pointer)
      // Stack pointer = X
      // Addressing:   imp
      // Opcode:       9A
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      "S=X;"
      
      // "!": CPX (compare memory and X)
      // N, Z and C are set with the result of X minus a byte in memory
      // Flag C is set if there's no borrow
      // Addressings:  imm, zpg, abs
      // Opcodes:      E0,  E4,  EC
      // Cycles total: 2,   3,   4
      // Cycles addr.: -1,  0,   1
      // Cycles opc. : 1,   1,   1
      + "p=r(a),C=X-p>=0,F(X-p);"

      // '"': CPY (compare memory and Y)
      // N, Z and C are set with the result of Y minus a byte in memory
      // Flag C is set if there's no borrow
      // Addressings:  imm, zpg, abs
      // Opcodes:      C0,  C4,  CC
      // Cycles total: 2,   3,   4
      // Cycles addr.: -1,  0,   1
      // Cycles opc. : 1,   1,   1
      + "p=r(a),C=Y-p>=0,F(Y-p);"

      // "#": ASL (shift left)
      // A byte in memory is left shifted. Flags: N, Z, C
      // The shifted-out bit 7 is saved in C
      // Addressings:  zpg, zpgX, abs, absX
      // Opcodes:      06,  16,   0E,  1E
      // Cycles total: 5,   6,    6,   7
      // Cycles addr.: 0,   1,    1,   2
      // Cycles opc. : 3,   3,    3,   3 (***)
      + "p=r(a),C=p>>7,w(a,F(2*p)),c++;"

      // "$": ROL A (rotate left accumulator)
      // Rotate left A. Same as left shift but C flag is put into bit 0. Flags: N, Z, C
      // The shifted-out bit 7 is saved in C
      // Addressing:   A
      // Opcode:       2A
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "C=A>>7,A=F(2*A+(1&P));"

      // "%": ROL (rotate left)
      // Rotate left a byte in memory. Same as left shift but C flag is put into bit 0. Flags: N, Z, C
      // The shifted-out bit 7 is saved in C
      // Addressings:  zpg, zpgX, abs, absX
      // Opcodes:      26,  36,   2E,  3E
      // Cycles total: 5,   6,    6,   7
      // Cycles addr.: 0,   1,    1,   2
      // Cycles opc. : 3,   3,    3,   3 (***)
      + "p=r(a),C=p>>7,w(a,F(2*p+(1&P))),c++;"

      // "&": LSR A (shift right accumulator)
      // A is shifted right. Flags: N, Z, C
      // The shifted-out bit 0 is saved in C
      // Addressing:   A
      // Opcode:       4A
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "C=1&A,A=F(A>>1);"

      // "'": LSR (shift right)
      // A byte in memory is shifted right. Flags: N, Z, C
      // The shifted-out bit 0 is saved in C
      // Addressings:  zpg, zpgX, abs, absX
      // Opcodes:      46,  56,   4E,  5E
      // Cycles total: 5,   6,    6,   7
      // Cycles addr.: 0,   1,    1,   2
      // Cycles opc. : 3,   3,    3,   3 (***)
      + "p=r(a),C=1&p,w(a,F(p>>1)),c++;"

      // "(": DEX (decrement X)
      // X is decremented. Flags: N, Z
      // Addressing:   imp
      // Opcode:       CA
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "X=F(X-1);"

      // ")": BIT (test bits in memory)
      // N and V = bits 7 and 6 of operand. Z is set if operand AND A is not zero. Flags: N, Z, V
      // Addressings:  zpg, abs
      // Opcodes:      24,   2C
      // Cycles total: 3,    4
      // Cycles addr.: 0,    1
      // Cycles opc. : 1,    1
      + "p=r(a),F(p&A),N=p>>7&1,V=p>>6&1;"

      // "*": ROR A (rotate right accumulator)
      // Rotate right A. Same as right shift but C flag is put into bit 7. Flags: N, Z, C
      // The shifted-out bit 0 is saved in C
      // Addressing:   A
      // Opcode:       6A
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "C=1&A,A=F((A>>1)+128*(1&P));"

      // "+": INC (increment memory)
      // A byte in memory is incremented. Flags: N, Z
      // Addressings:  zpg, zpgX, abs, absX
      // Opcodes:      E6,  F6,   EE,  FE
      // Cycles total: 5,   6,    6,   7
      // Cycles addr.: 0,   1,    1,   2
      // Cycles opc. : 3,   3,    3,   3 (***)
      + "w(a,F(r(a)+1)),c++;"

      // ",": INX (increment X)
      // X is incremented. Flags: N, Z
      // Addressing:   imp
      // Opcode:       E8
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "X=F(X+1);"

      // "-": DEY (decrement Y)
      // Y is decremented. Flags: N, Z
      // Addressing:   imp
      // Opcode:       88
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "Y=F(Y-1);"

      // ".": INY (increment Y)
      // Y is incremented. Flags: N, Z
      // Addressing:   imp
      // Opcode:       C8
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "Y=F(Y+1);"

      // "/": LDY (load Y with memory)
      // Y = a byte from memory. Flags: N, Z
      // Addressings:  imm, zpg, zpgX, abs, absX
      // Opcodes:      A0,  A4,  B4,   AC,  BC
      // Cycles total: 2,   3,   4,    4,   4*
      // Cycles addr.: -1,  0,   1,    1,   1*
      // Cycles opc. : 1,   1,   1,    1,   1
      + "Y=F(r(a));"

      // 0: ROR (rotate right)
      // Rotate right a byte in memory. Same as left shift but C flag is put into bit 7. Flags: N, Z, C
      // The shifted-out bit 0 is saved in C
      // Addressings:  zpg, zpgX, abs, absX
      // Opcodes:      66,  76,   6E,  7E
      // Cycles total: 5,   6,    6,   7
      // Cycles addr.: 0,   1,    1,   2
      // Cycles opc. : 3,   3,    3,   3 (***)
      + "p=r(a),C=1&p,w(a,F((p>>1)+128*(1&P))),c++;"

      // "1": CLC (clear carry flag)
      // C is set to 0
      // Addressing:   imp
      // Opcode:       18
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "C=0;"

      // "2": SEI (set interrupt disable flag)
      // I is set to 1
      // Addressing:   imp
      // Opcode:       78
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "I=1;"

      // "3": CLD (clear decimal flag)
      // D is set to 0
      // Addressing:   imp
      // Opcode:       D8
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "D=0;"

      // "4": CLI (clear interrupt disable flag)
      // I is set to 0
      // Addressing:   imp
      // Opcode:       58
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "I=0;"

      // "5": LDA (load accumulator with memory)
      // A = a byte from memory. Flags: N, Z
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      A9,  A5,  B5,   AD,  BD,   B9,   A1,   B1
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "A=F(r(a));"

      // "6": AND: (AND memory and accumulator)
      // A = A AND a byte in memory. Flags: N, Z
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      29,  25,  35,   2D,  3D,   39,   21,   31
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "A=F(r(a)&A);"
      
      // "7": CMP (compare memory and accumulator)
      // N, Z and C are set with the result of A - a byte in memory
      // Flag C is set if there's no borrow
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      C9,  C5,  D5,   CD,  DD,   D9,   C1,   D1
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "p=r(a),C=A-p>=0,F(A-p);"

      // "8": SBC (subtract from accumulator with carry)
      // A = A - a byte from memory - (1 - Carry). Flags: N, Z, C, V
      // Flag C is set if there's no borrow
      // Flag V is set if the subtraction is incorrectly considered positive
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      E9,  E5,  F5,   ED,  FD,   F9,   E1,   F1
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "p=r(a),t=A+C-1-p,V=!!(128&(A^p))&&!!(128&(A^t)),C=t>=0,A=F(t);"

      // "9": ADC (add to accumulator with carry)
      // A = A + a byte in memory + Carry. Flags: N, Z, C, V
      // Flag C is set if there's a carry
      // Flag V is set if the sum of two positive numbers is incorrectly considered negative
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      69,  65,  75,   6D,  7D,   79,   61,   71
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "p=r(a),t=A+C+p,V=!(128&(A^p))&&!!(128&(A^t)),C=t>255,A=F(t);"
      
      // ":": BCS (branch on carry set)
      // PC = address if C is 1
      // Addressing:   rel 
      // Opcode:       B0
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "C&&(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // ";": BMI (branch on minus)
      // PC = address if N is 1
      // Addressing:   rel 
      // Opcode:       30
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "N&&(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // "<": BEQ (branch if equal)
      // PC = address if Z is 0
      // Addressing:   rel 
      // Opcode:       F0
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "Z&&(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // "=": BPL (branch on plus)
      // PC = address if N is 0
      // Addressing:   rel 
      // Opcode:       10
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "N||(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // ">": BVS (branch on overflow set)
      // PC = address if V is 1
      // Addressing:   rel 
      // Opcode:       70
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "V&&(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // "?": BNE (branch if not equal)
      // PC = address if Z is 1
      // Addressing:   rel 
      // Opcode:       D0
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "Z||(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // "@": BVC (branch on overflow clear)
      // PC = address if V is 0
      // Addressing:   rel 
      // Opcode:       50
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "V||(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // "A": LDX (load X with memory)
      // X = a byte from memory. Flags: N, Z
      // Addressings:  imm, zpg, zpgY, abs, absY
      // Opcodes:      A2,  A6,  B6,   AE,  BE
      // Cycles total: 2,   3,   4,    4,   4*
      // Cycles addr.: -1,  0,   1,    1,   1*
      // Cycles opc. : 1,   1,   1,    1,   1
      + "X=F(r(a));"
      
      // "B": EOR (exclusive-or memory and accumulator)
      // A = A XOR a byte in memory. Flags: N, Z
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      49,  45,  55,   4D,  5D,   59,   41,   51
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "A=F(r(a)^A);"
      
      // "C": DEC (decrement memory)
      // A byte in memory is decremented. Flags: N, Z
      // Addressings:  zpg, zpgX, abs, absX
      // Opcodes:      C6,  D6,   CE,  DE
      // Cycles total: 5,   6,    6,   7
      // Cycles addr.: 0,   1,    1,   2
      // Cycles opc. : 3,   3,    3,   3 (***)
      + "w(a,F((r(a)-1)&255)),c++;"
      
      // "D": ASL A (shift left accumulator)
      // A is left shifted. Flags: N, Z, C
      // The shifted-out bit 7 is saved in C
      // Addressing:   A
      // Opcode:       0A
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "C=A>>7,A=F(2*A);"
      
      // "E": JSR (jump to subroutine)
      // Push PC + 2, PC = absolute address
      // Addressing:   abs
      // Opcode:       20
      // Cycles total: 6
      // Cycles addr.: 1
      // Cycles opc. : 3 (***)
      + "h(PC>>8),h(255&PC),PC=a-1,c++;"
      
      // "F": SEC (set carry flag)
      // C is set to 1
      // Addressing:   imp
      // Opcode:       38
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "C=1;"
      
      // "G": SED (set decomal flag)
      // D is set to 1
      // Addressing:   imp
      // Opcode:       F8
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "D=1;"
      
      // "H": CLV (clear overflow flag)
      // V is set to 0
      // Addressing:   imp
      // Opcode:       B8
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "V=0;"
      
      // "I": ORA (OR memory and accumulator)
      // A = A OR a byte in memory. Flags: N, Z. 
      // Addressings:  imm, zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      09,  05,  15,   0D,  1D,   19,   01,   11
      // Cycles total: 2,   3,   4,    4,   4*,   4*,   6,    5*
      // Cycles addr.: -1,  0,   1,    1,   1*,   1*    3,    3*
      // Cycles opc. : 1,   1,   1,    1,   1,    1,    1,    1
      + "A=F(r(a)|A);"
      
      // "J": PHA (push accumulator)
      // Push A
      // Addressing:   imp
      // Opcode:       48
      // Cycles total: 3
      // Cycles addr.: 0
      // Cycles opc. : 1
      + "h(A);"
      
      // "K": PHP (push processor status)
      // Push P with B flag set to 1
      // Addressing:   imp
      // Opcode:       08
      // Cycles total: 3
      // Cycles addr.: 0
      // Cycles opc. : 1
      + "h(P|16);"
      
      // "L": PLA (pull accumulator)
      // Pull A. Flags: N, Z.
      // Addressing:   imp
      // Opcode:       68
      // Cycles total: 4 (*** 1 extra cycle according to nestest)
      // Cycles addr.: 0
      // Cycles opc. : 1
      + "A=F(g()),c++;"
      
      // "M": PLP (pull processor status)
      // Pull P and set all flags
      // (According to nestest, the B flag stays at 0) 
      // Addressing:   imp
      // Opcode:       28
      // Cycles total: 4 (*** 1 extra cycle according to nestest)
      // Cycles addr.: 0
      // Cycles opc. : 1
      + "f(g()&239),c++;"
      
      // "N": RTI (return from interrupt)
      // Pull P, set all flags, pull PC
      // Addressing:   imp
      // Opcode:       40
      // Cycles total: 6
      // Cycles addr.: 0
      // Cycles opc. : 4 (***)
      + "f(g()),PC=g()+256*g()-1,c++;"
      
      // "O": BCC (branch on carry clear)
      // PC = address if C is 0
      // Addressing:   rel 
      // Opcode:       90
      // Cycles total: 2**
      // Cycles addr.: 0
      // Cycles opc. : 0**
      + "C||(c+=1+(a>>8!=PC+1>>8),PC=a);"
      
      // "P": BRK (force break)
      // Interrupt, push PC+2 (PC+1 is a padding byte), push P with B flag set to 1, set I to 1
      // This is equivalent to an IRQ interrupt with another value of P pushed on the stack:
      // "h(PC>>8),h(255&PC),h(P|16),I=1,PC=r(65534)+256*r(65535)-1;"
      // Addressing:   imp
      // Opcode:       00
      // Cycles total: 7
      // Cycles addr.: 0
      // Cycles opc. : 5
      //+ 
      + "op(3,1);"
      
      // "Q": TAY (transfer accumulator to Y)
      // Y = A. Flags: N, Z
      // Addressing:   imp
      // Opcode:       A8
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "Y=F(A);"
      
      // "R": STA (store accumulator)
      // A is copied in memory
      // Addressings:  zpg, zpgX, abs, absX, absY, indX, indY
      // Opcodes:      85,  95,   8D,  9D,   99,   81,   91
      // Cycles total: 3,   4,    4,   5,    5,    6,    6
      // Cycles addr.: 0,   1,    1,   2,    2     3,    2
      // Cycles opc. : 1,   1,    1,   1,    1,    1,    1
      + "w(a,A);"
      
      // "S": STX (store X)
      // X is copied in memory
      // Addressings:  zpg, zpgY, abs
      // Opcodes:      86,  96,   8E
      // Cycles total: 3,   4,    4
      // Cycles addr.: 0,   1,    1
      // Cycles opc. : 1,   1,    1
      + "w(a,X);"
      
      // "T": TSX (transfer stack pointer to X)
      // X = S. Flags: N, Z
      // Addressing:   imp
      // Opcode:       BA
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "X=F(S);"
      
      // "U": TAX (transfer accumulator to X)
      // X = A. Flags: N, Z
      // Addressing:   imp
      // Opcode:       AA
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "X=F(A);"
      
      // "V": STY (store Y)
      // Y is copied in memory
      // Addressings:  zpg, zpgX, abs
      // Opcodes:      84,  94,   8C
      // Cycles total: 3,   4,    4
      // Cycles addr.: 0,   1,    1
      // Cycles opc. : 1,   1,    1
      + "w(a,Y);"
      
      // "W": TYA (transfer Y to accumulator)
      // A = Y. Flags: N, Z
      // Addressing:   imp
      // Opcode:       98
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "A=F(Y);"
      
      // "X": TXA (transfer X to accumulator)
      // A = X. Flags: N, Z
      // Addressing:   imp
      // Opcode:       8A
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + "A=F(X);"
      
      // "Y": RTS (return from subroutine)
      // Pull and increment PC
      // Addressing:   imp
      // Opcode:       60
      // Cycles total: 6
      // Cycles addr.: 0
      // Cycles opc. : 0 (***)
      + "PC=g()+256*g(c+=2);"
      
      // "Z": JMP (jump to new location)
      // Set a new value to PC
      // Addressings:  abs
      // Opcodes:      4C
      // Cycles total: 3
      // Cycles addr.: 1
      // Cycles opc. : 0
      + "PC=a-1;"
      
      // "[" JMP indirect
      // Jump to an address stored anywhere in memory. The address of this address is stored after the opcode
      // Hardware bug: if the indirect address falls on a page boundary ($xxFF), it will wrap and fetch the low byte in the same page ($xx00)
      // Addressing:   ind
      // Opcodes:      6C
      // Cycles total: 5
      // Cycles addr.: 3
      // Cycles opc. : 2
      + "PC=r(a)+256*r(a+1-256*((a&255)==255))-1"

      // "z": NOP (no operation)
      // (When a "z" is read, the generated JavaScript code will just contain "undefined;")
      // Addressing:   imp
      // Opcode:       EA
      // Cycles total: 2
      // Cycles addr.: 0
      // Cycles opc. : 0
      + ""

    // Make an array from this string
    ).split(";")

    // Fetch the right instruction for the current opcode (ignore every illegal opcode where o % 4 == 3):
    // (The string below is optomized for compression: all the illegal opcodes are assigned characters that allow extra repetition)
    [
       (
         `PI#PI#KIDPI#=I#PI#1IDPI#`
        +`E6%)6%M6$)6%;6%E6%F6%E6%`
        +`NB'NB'JB&ZB'@B'NB'4B'NB'`
        +`Y90Y90L9*[90>90Y90290Y90`
        +`VRSVRS-zXVRSORSVRSWR VRS`
        +`/5A/5AQ5U/5A:5A/5AH5T/5A`
        +`"7C"7C.7("7C?7C"7C37C"7C`
        +`!8+!8+,8z!8+<8+!8+G8+!8+`
      )[o - (o >> 2)].charCodeAt() - 32
    ]
  )
);

// Emulation
// ---------

// If an interrupt (v = 1/2/3) is specified, it's executed
// Otherwise, execute the next opcode at the address pointed by the PC register
// z means BRK opcode (similar to IRQ, but with a slightly different P pushed on the stack)
op = (v, z) => (

  // - Reset cycle counter
  // - Fetch opcode at address PC (costs 1 cycle), save it in o
  // - Increment PC, save it in a
  // - Fetch the byte at address a (costs 1 cycle), save it in p
  c = 0,
  o = r(PC),
  p = r(a = PC+1),

  // Execute an interrupt if v is set
  v ? (

    // 1: NMI:
    // Push PC and P with B flag set to 0, then set I to 1,
    // then jump to address stored at $FFFA-$FFFB
    // This costs 7 cycles
    // On NES, it is triggered at the beginning of VBlank if bit 7 of PPU register $2000 is set, otherwise it's skipped and only costs 2 cycles

    // 2: Reset:
    // Push PC and P with B flag set to 0, then set I to 1,
    // then jump to address stored at $FFFC-$FFFD
    // This resets c and costs 8 cycles
    // On NES, this also resets the PPU

    // 3: IRQ/BRK:
    // Push PC and P with B flag set to 0 (IRQ) or 1 (BRK), then set I to 1,
    // then jump to address stored at $FFFE-$FFFF
    // This costs 7 cycles

    // Only execute NMI if VBlank (bit 7 of $2000) is set
    (v > 1 || r(0x2000) >> 7)
    
    // Only execute IRQ if I is not set
    && (v < 3 || !I)
    
    && (
      (
        (v - 2) 
        ? (h(PC >> 8), h(255 & PC), h(z ? (P|16) : (239 & P))) // NMI/IRQ/BRK
        : (S = (S-3) & 255) // Reset
      ),

      I = 1,
      PC = r(65528 + v * 2) + 256 * r(65528 + v * 2 + 1)
    )
  )

  // Or execute the next instruction:
  : (
    o && O[o](),
    PC++,
    PC &= 0xFFFF
  ),

  // Update status register P according to the new flags values
  P = C + Z*2 + I*4 + D*8 + B*16 + 32 + V*64 + N*128
)
;
// Compact hybrid APU: native tonal oscillators, precomputed LFSR loops,
// CPU-clocked control units; DMC sound removed. NTSC, instruction-level timing.
var apu_context=null,apu_master=null,apu_muted=false,apu_nodes=[],apu_gains=[],apu_waves=[],
    apu_playing=false,apu_origin=0,apu_time=0,
    apu_channels=[],apu_step_times=[7457,14913,22371,29829,37281],apu_enabled=0,apu_mode=0,apu_step=0,apu_base=0,apu_frame_irq=false,
    apu_inhibit=false,apu_noise_period=[4,8,16,32,64,96,128,160,202,254,380,508,762,1016,2034,4068],
    apu_lengths=[10,254,20,2,40,4,80,6,160,8,60,10,14,12,26,14,12,16,24,18,48,20,96,22,192,24,72,26,16,28,32,30];
function apu_reset(){
  if(!apu_context){
    apu_context=new AudioContext();
    apu_master=new GainNode(apu_context,{gain:apu_muted?0:1});apu_master.connect(apu_context.destination);
    for(var duty of [.125,.25,.5,.75]){
      var real=new Float32Array(33),imag=new Float32Array(33);
      for(var k=1;k<33;k++){real[k]=Math.sin(2*Math.PI*k*duty)/k;imag[k]=(1-Math.cos(2*Math.PI*k*duty))/k;}
      apu_waves.push(apu_context.createPeriodicWave(real,imag));
    }
    for(var ch=0;ch<5;ch++){
      var gain=new GainNode(apu_context,{gain:0}),node;
      if(ch<3)node=new OscillatorNode(apu_context,{type:ch===2?'triangle':'square',frequency:0});
      else{
        // Runtime-generated data adds RAM, not embedded sample bytes.
        var size=ch===3?32767:93,buffer=apu_context.createBuffer(1,size,44100),data=buffer.getChannelData(0),shift=1;
        for(var j=0;j<size;j++){data[j]=(shift&1)?1:-1;shift=(shift>>1)|(((shift^(shift>>(ch===3?1:6)))&1)<<14);}
        node=apu_context.createBufferSource();node.buffer=buffer;node.loop=true;
      }
      node.connect(gain).connect(apu_master);node.start();apu_nodes.push(node);apu_gains.push(gain);
    }
  }
  apu_silence();apu_time=apu_base=apu_step=apu_mode=0;
  apu_enabled=0;apu_frame_irq=apu_inhibit=false;
  apu_channels=Array.from({length:4},()=>({control:0,timer:0,length:0,env:0,divider:0,restart:false,sweep:0,sweepDivider:0,sweepReload:false,linear:0,reload:false}));
}
function apu_silence(){
  if(apu_context)for(var gain of apu_gains){gain.gain.cancelScheduledValues(apu_context.currentTime);gain.gain.setTargetAtTime(0,apu_context.currentTime,.002);}
}
function apu_irq_pending(){return apu_frame_irq;}
function apu_target(ch){var s=apu_channels[ch],delta=s.timer>>(s.sweep&7);return s.timer+((s.sweep&8)?-delta-(ch===0?1:0):delta);}
function apu_quarter(){
  for(var ch of [0,1,3]){var s=apu_channels[ch],period=s.control&15;
    if(s.restart){s.restart=false;s.env=15;s.divider=period;}
    else if(s.divider)s.divider--;
    else{s.divider=period;if(s.env)s.env--;else if(s.control&32)s.env=15;}
  }
  var t=apu_channels[2];if(t.reload)t.linear=t.control&127;else if(t.linear)t.linear--;if(!(t.control&128))t.reload=false;
}
function apu_half(){
  for(var ch=0;ch<4;ch++){var s=apu_channels[ch];if(s.length&&!(s.control&(ch===2?128:32)))s.length--;
    if(ch<2){var target=apu_target(ch);if(!s.sweepDivider&&(s.sweep&128)&&(s.sweep&7)&&s.timer>=8&&target>=0&&target<=2047)s.timer=target;
      if(!s.sweepDivider||s.sweepReload){s.sweepDivider=(s.sweep>>4)&7;s.sweepReload=false;}else s.sweepDivider--;
    }
  }
}
function apu_clock(cycles){
  var end=apu_time+cycles;
  while(apu_time<end){
    var seq=apu_base+apu_step_times[apu_step];
    var next=Math.min(end,seq);apu_time=next;
    if(next===seq){
      if(apu_step!==3||!apu_mode)apu_quarter();
      if(apu_step===1||apu_step===(apu_mode?4:3))apu_half();
      if(!apu_mode&&apu_step===3&&!apu_inhibit)apu_frame_irq=true;
      apu_step++;if(apu_step===(apu_mode?5:4)){apu_base+=apu_mode?37282:29830;apu_step=0;}
      apu_render();
    }

  }
}
function apu_render(){
  if(!apu_context||!apu_channels.length)return;
  var when=apu_playing?Math.max(apu_context.currentTime+.002,apu_origin+apu_time/1789773):apu_context.currentTime;
  for(var ch=0;ch<4;ch++){
    var s=apu_channels[ch],volume=(s.control&16)?(s.control&15):s.env;
    if(ch===2)volume=s.linear?15:0;
    if(!apu_playing||!s.length)volume=0;
    if(ch<2&&(s.timer<8||apu_target(ch)>2047))volume=0;
    if(ch<3){
      if(ch<2&&s.wave!==(s.control>>6)){s.wave=s.control>>6;apu_nodes[ch].setPeriodicWave(apu_waves[s.wave]);}
      apu_nodes[ch].frequency.setValueAtTime(Math.min(apu_context.sampleRate/2,1789773/((ch===2?32:16)*(s.timer+1))),when);
      apu_gains[ch].gain.setTargetAtTime(volume/15*.08,when,.001);
    }else for(var mode=0;mode<2;mode++){
      apu_nodes[3+mode].playbackRate.setValueAtTime(1789773/(apu_noise_period[s.timer]*44100),when);
      apu_gains[3+mode].gain.setTargetAtTime((mode===((s.sweep>>7)&1)?volume/15*.035:0),when,.001);
    }
  }
}
function apu_flush(){
  if(!apu_context)return;
  if(apu_playing){
    // Recover from an exhausted lookahead. Future frames resume a common clock.
    if(apu_origin+apu_time/1789773<apu_context.currentTime)apu_origin=apu_context.currentTime+.04-apu_time/1789773;

  }
  apu_render();
}
function get_4015(){var result=apu_channels.reduce((v,s,ch)=>v|(s.length?1<<ch:0),0)|(apu_frame_irq?64:0);apu_frame_irq=false;return result;}
function set_4015(value){
  apu_enabled=value&15;for(var ch=0;ch<4;ch++)if(!(value&(1<<ch)))apu_channels[ch].length=0;

}
function set_4017(value){apu_mode=value>>7;apu_inhibit=!!(value&64);if(apu_inhibit)apu_frame_irq=false;apu_base=apu_time;apu_step=0;if(apu_mode){apu_quarter();apu_half();}}
function apu_write(address,value){
  var ch=(address>>2)&3,s=apu_channels[ch],reg=address&3;
  if(reg===0)s.control=value;
  if(reg===1){s.sweep=value;s.sweepReload=true;}
  if(reg===2){if(ch===3){s.timer=value&15;s.sweep=value&128;}else s.timer=(s.timer&1792)|value;}
  if(reg===3){if(ch!==3)s.timer=(s.timer&255)|((value&7)<<8);if(apu_enabled&(1<<ch))s.length=apu_lengths[value>>3];s.restart=s.reload=true;}
}

;
// PPU
// ===

// Resources:
// - https://wiki.nesdev.com/w/index.php/PPU (+ subpages)
// - https://problemkaputt.de/everynes.htm#pictureprocessingunitppu
// - https://austinmorlan.com/posts/nes_rendering_overview/
// - https://www.gridbugs.org/zelda-screen-transitions-are-undefined-behaviour/
// - https://www.youtube.com/watch?v=wfrNnwJrujw
// - https://gist.githubusercontent.com/adamveld12/d0398717145a2c8dedab/raw/750246a2b4ee4bb722c2b5bb5e6ba997cdf74661/spec.md
// - https://emulation.gametechwiki.com/index.php/Famicom_Color_Palette
// - http://forums.nesdev.com/viewtopic.php?t=19259
// - http://forums.nesdev.com/viewtopic.php?t=8214
// - https://www.youtube.com/watch?v=wt73KPS_23w

// PPU memory map (64KB):

// +-------------+-------+-----------------------------------------------------------+
// | Address     | Size  | Use                                                       |
// +-------------+-------+-----------------------------------------------------------+
// | $0000-$1FFF | 8KB   | Cartridge space (CHR-ROM or CHR-RAM):                     |
// | $0000-$0FFF | 4KB   | Pattern Table 0 (256 tiles) "left page"                   |
// | $1000-$1FFF | 4KB   | Pattern Table 1 (256 tiles) "right page"                  |
// +-------------+-------+-----------------------------------------------------------+
// | $2000-$2FFF | 4KB   | VRAM (2KB in the NES, 2KB in the cartridge or mirrored):  |
// | $2000-$23BF | 960B  | Name Table 0                                              |
// | $23C0-$23FF | 24B   | Attribute Table 0                                         |
// | $2400-$27BF | 960B  | Name Table 1                                              |
// | $27C0-$27FF | 24B   | Attribute Table 1                                         |
// | $2800-$2BBF | 960B  | Name Table 2                                              |
// | $2BC0-$2BFF | 24B   | Attribute Table 2                                         |
// | $2C00-$2FBF | 960B  | Name Table 3                                              |
// | $2FC0-$2FFF | 24B   | Attribute Table 3                                         |
// +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
// | $3000-$3EFF | 3840B | Mirror of $2000-$2EFF (never used by the PPU)             |
// +-------------+-------+-----------------------------------------------------------+
// | $3F00-$3F1F | 32B   | Palettes:                                                 |
// | $3F00       | 1B    | Universal background color                                |
// | $3F01-$3F03 | 3B    | Background palette 0                                      |
// | $3F04       | 1B    | Universal bg color replaces it except in forced blanking  |
// | $3F05-$3F07 | 3B    | Background palette 1                                      |
// | $3F08       | 1B    | Universal bg color replaces it except in forced blanking  |
// | $3F09-$3F0B | 3B    | Background palette 2                                      |
// | $3F0C       | 1B    | Universal bg color replaces it except in forced blanking  |
// | $3F0D-$3F0F | 3B    | Background palette 3                                      |
// | $3F10       | 1B    | Mirror of $3F00                                           |
// | $3F11-$3F13 | 3B    | Sprite palette 0                                          |
// | $3F14       | 1B    | N/A (mirror of $3F04)                                     |
// | $3F15-$3F17 | 3B    | Sprite palette 1                                          |
// | $3F18       | 1B    | N/A (mirror of $3F08)                                     |
// | $3F19-$3F1B | 3B    | Sprite palette 2                                          |
// | $3F1C       | 1B    | N/A (mirror of $3F0C)                                     |
// | $3F1D-$3F1F | 3B    | Sprite palette 3                                          |
// +- - - - - - -+- - - -+- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+
// | $3F20-$3FFF | 224B  | Mirrors of $3F00-$3F1F                                    |
// +-------------+-------+-----------------------------------------------------------+
// | $4000-$FFFF | 48KB  | Mirrors of $0000-$3FFF                                    |
// +-------------+-------+-----------------------------------------------------------+

// OAM Memory (256 bytes):

// +-------------+-------+-----------------------------------------------------------+
// | Address     | Size  | Use                                                       |
// +-------------+-------+-----------------------------------------------------------+
// | $00-$FF     | 256B  | Sprites properties (4 bytes for each)                     |
// +-------------+-------+-----------------------------------------------------------+

// Rendering beam for each frame (one pixel for each PPU tick):

//         x=0                 x=256               x=340
//      ---+-------------------+-------------------+
//  y=0    | visible area      | Horizontal blank  |
//         | (this is rendered | (prepare sprites  |
//  y=239  | on the screen)    | for the next      |
//  y=239  |                   | scanline)         |
//      ---+-------------------+-------------------+
//  y=240  | idle scanline                         |
//      ---+---------------------------------------+
//  y=241  | vertical blanking (idle)              |
//         | - 20 scanlines long on NTSC consoles  |
//  y=260  | - 70 scanlines on PAL consoles        |
//      ---+-------------------------------------+-+
//  y=261  | pre-render scanline                 |*|
//  or -1 -+-------------------------------------+-+

// Globals
// -------

var
t,
o,
scanline,
dot,
PPU_mem,
OAM,
vramPixelBuffer,
V_yyy,
V_NN,
V_YYYYY,
V_XXXXX,
T_yyy,
T_NN,
T_YYYYY,
T_XXXXX,
xxx, 
scroll_x,
scroll_y,
PPUDATA_read_buffer,
PPUSTATUS_O,
PPUSTATUS_S,
PPUSTATUS_V,
PPU_NMI_OUTPUT,
latch,
PPUCTRL_V,
PPUCTRL_H,
PPUCTRL_B,
PPUCTRL_S,
PPUCTRL_I,
PPUMASK_s,
PPUMASK_b,
OAMADDR,
PPUADDR,
endFrame,

  
// System palette
// An array of 64 RGB colors, inspired by the 3DS VC palette, stored in AABBGGRR format.
systemPalette = (
    "777812a0090470810a00a007024040050130531000000000"+
    "bbbe70e32f08b0b50e02d04c0780900a0390880111000000"+
    "ffffb3f95f8af7fb7f67f39f3bf1d84d49f5de0333000000"+
    "ffffeafdcfcdfcfdcfbbfadfaefafebfacfbff9888000000"
  )
  .match(/.../g)
  .map(c => +("0xff" + c[0] + c[0] + c[1] + c[1] + c[2] + c[2])),

// Reset the PPU
ppu_reset = () => {

  // Reset PPU memory (64KB) and OAM memory (256b)
  PPU_mem = [];
  OAM = [];
  OAMADDR = 0;
  
  // Coordinates of the current pixel
  scanline =  // Y between 0 and 261 on NTSC (or 311 on PAL)
  dot =       // X between 0 and 340 (on scanline 261, alternate between 239 and 240 if background rendering is enabled)
  
  // PPU scrolling is handled via two 15-bit registers called V and T
  // In these registers:
  // - bits 0-4 (XXXXX) represent the coarse X scrolling
  // - bits 5-9 (YYYYY) represent the coarse Y scrolling
  // - bits 10-11 (NN) represent the nametable where the scrolling starts
  // - bits 12-14 (yyy) represent the fine Y scrolling
  // The fine X scrolling (xxx) is stored separately
  // The effective X scrolling is equal to: (NN & 0b1) * 256 + XXXXX * 8 + xxx
  // The effective Y scrolling is equal to: (NN >> 1) * 240 + YYYYY * 8 + yyy
  
  // V: value of scroll on the next scanline (V = 0yyyNNYYYYYXXXXX)
  V_yyy = 
  V_NN = 
  V_YYYYY = 
  V_XXXXX = 
  
  // T: value of scroll on current scanline (T = 0yyyNNYYYYYXXXXX)
  T_yyy = 
  T_NN = 
  T_YYYYY = 
  T_XXXXX = 

  // Fine X scroll (xxx, also called w)
  xxx = 
  
  // Effective PPU scroll
  scroll_x = 
  scroll_y = 
  
  // PPU Status register
  PPUSTATUS_O =
  PPUSTATUS_S =
  PPUSTATUS_V =
  
  // PPU latch (also called w)
  // It's toggled between 0 and 1 every time PPUSCROLL or PPUADDR get written, and reset to 0 when PPUSTATUS is read
  latch = 0;
  PPU_NMI_OUTPUT = 0;

  // Reset PPUCTRL and PPUMASK registers
  set_PPUCTRL(0);
  set_PPUMASK(0);
},

// Memory access
// -------------

// Handle address mirrorings
mirrorAddress = address => {
  address &= 0x3FFF;
  if(address >= 0x3F00){
    address = 0x3F00 | (address & 31);
    if((address & 0x13) === 0x10) address -= 16;
    return address;
  }
  if(address >= 0x3000) address -= 0x1000;
  if(address >= 0x2000){
    var page = (address >> 10) & 3;
    if(NES.mirroring === 0) page &= 1;
    else if(NES.mirroring === 1) page >>= 1;
    else if(NES.mirroring === 3) page = 0;
    else if(NES.mirroring === 4) page = 1;
    address = 0x2000 | (page << 10) | (address & 1023);
  }
  return address;
},

// Read a byte in memory
ppu_read = address => {
  address &= 0x3FFF;
  
  // $0000-$1FFF: CHR-ROM/RAM
  if(address < 0x2000){
    return mapper_chr_read(address);
  }

  // $3F04, $3F08, $3F0C: mirrors of $3F00 (universal background color) except during forced blanking (TODO)
  if((address & 0xFFF3) == 0x3F00) address = 0x3F00;
      
  return PPU_mem[mirrorAddress(address)] || 0;
},

// PPU I/O registers
// -----------------

// TODO: move all this in memory.js

// NMI is an edge on PPUCTRL.7 AND PPUSTATUS.7. A status read or a control
// change can cancel an edge that has not yet reached the CPU.
ppu_update_nmi = () => {
  var output = PPUCTRL_V && PPUSTATUS_V;
  if(output && !PPU_NMI_OUTPUT) nmi_delay = 1;
  else if(!output && PPU_NMI_OUTPUT && nmi_delay >= 0) nmi_delay = -1;
  PPU_NMI_OUTPUT = output;
},

// The CPU can read/write at the following addresses in memory to interact with the PPU

// $2000 (write): set PPU Control Register 1 (PPUCTRL)
set_PPUCTRL = value => {
  PPUCTRL_V = (value >> 7) & 1;   // bit 7: trigger a NMI on VBlank
  //PPUCTRL_P = (value >> 6) & 1  // bit 6: external pin controlling backdrop color (ignored here)
  PPUCTRL_H = (value >> 5) & 1;   // bit 5: sprite size (0: 8x8, 1: 8x16)
  PPUCTRL_B = (value >> 4) & 1;   // bit 4: background pattern table (0: $0000, 1: $1000)
  PPUCTRL_S = (value >> 3) & 1;   // bit 3: sprite pattern table (0: $0000, 1: $1000, ignored in 8x16 mode)
  PPUCTRL_I = (value >> 2) & 1;   // bit 2: VRAM address increment after reading/writing in PPUDATA (0: 1, 1: 32)
  T_NN = value & 0b11;            // bits 0-1: update nametable bits in scroll register T
  ppu_update_nmi();
},

// $2001 (write): set PPU Control Register 2 (PPUMASK)
set_PPUMASK = value => {
  //PPUMASK_RGB = (value >> 5) & 7; // Bits 5-7: red/green/blue emphasis on NTSC, red/blue/green on PAL (ignored here)
  PPUMASK_s = (value >> 4) & 1;     // Bit 4: show sprites
  PPUMASK_b = (value >> 3) & 1;     // Bit 3: show background
  //PPUMASK_M = (value >> 2) & 1;   // Bit 2: show sprites on leftmost 8px-wide column (ignored here)
  //PPUMASK_m = (value >> 1) & 1;   // Bit 1: show background on leftmost 8px-wide column (ignored here)
  //PPUMASK_G = value & 1;          // Bit 0: greyscale (all colors are ANDed with $30; ignored here)
},

// $2002 (read): get PPU Status Register (PPUSTATUS)
get_PPUSTATUS = () => {
  
  // Update status
  t = cpu_mem[0x2002] = 
    // 0 +                // Bits 0-4: copy of last 5 bits written to a PPU register (can be ignored)
    (PPUSTATUS_O << 5)    // Bit 5 (O): Sprite overflow (set during sprite evaluation if more than 8 sprites in next scanline, cleared at pre-render line, buggy on the NES)
    + (PPUSTATUS_S << 6)  // Bit 6 (S): Sprite 0 hit (set when an opaque pixel from sprite 0 overlaps an opaque pixel of the background if both displays are enabled, cleared at pre-render line)
    + (PPUSTATUS_V << 7); // Bit 7 (V): VBlank (set at line 241, cleared after reading PPUSTATUS and at pre-render line)
  
  // Reset PPUSCROLL/PPUADDR latch
  latch = 0;
  
  // Reset VBlank
  PPUSTATUS_V = 0;
  ppu_update_nmi();

  // Return status (without the resets)
  return t;
},

// $2003 (write): set SPR-RAM Address Register (OAMADDR)
set_OAMADDR = address => {
  OAMADDR = address;
},

// $2004h (read/write): SPR-RAM Data Register (OAMDATA, address must be set first). Not readable on Famicom
get_OAMDATA = () => {
  return OAM[OAMADDR];
},

set_OAMDATA = value => {
  OAM[OAMADDR] = value;
  OAMADDR++;
  OAMADDR %= 0x100;
},

// $2005 (write twice: vertical, then horizontal): PPU Background Scrolling Offset (PPUSCROLL)
set_PPUSCROLL = value => {

  // Latch equals 1: second write, update vertical scroll
  // If value is between 240 and 255, it becomes negative (-16 to -1) and the rendering gets glitchy (ignored here)
  if(latch){
    
    // Update Y bits of scroll register T (YYYYYyyy = value)
    T_YYYYY = value >> 3;
    T_yyy = value & 0b111;
  }
  
  // Latch equals 0: first write, update horizontal scroll
  else {
    
    // Update X bits of scroll register T (XXXXXxxx = value)
    T_XXXXX = value >> 3;
    xxx = value & 0b111;
  }
  
  // Toggle latch
  latch ^= 1;
},

// $2006 (write twice): VRAM Address Register (PPUADDR)
set_PPUADDR = value => {
  var secondWrite = latch;
  
  // Latch equals 1: second write, set low byte of address and update X and Y scrolling
  if(latch) {
    
    PPUADDR += value;
    
    // Update X and Y bits of scroll register T (YYYXXXXX)
    T_YYYYY += (value >> 5); // read the three low bits of YYYYY
    T_XXXXX = value & 0b11111;
    
    // Copy T in V, containing the scroll values to be used in the next scanline
    V_yyy = T_yyy;
    V_YYYYY = T_YYYYY;
    V_XXXXX = T_XXXXX;
    V_NN = T_NN;
  }
  // Latch equals 0: first write, set high byte of address and update Y scrolling
  else {
    
    PPUADDR = value << 8;
    
    // Update Y bits of scroll register T (00yyNNYY)
    T_yyy = (value >> 4) & 0b11;   // only bits 0 and 1 of yyy are set. Bit 2 is corrupted to 0
    T_NN = (value >> 2) & 0b11;
    T_YYYYY = (value & 0b11) << 3; // read the two high bits of YYYYY
  }
  
  // Toggle latch
  latch ^= 1;
  if(secondWrite) mapper_ppu_address(PPUADDR);
},

// $2007h (read/write): VRAM Data Register (PPUDATA, an address must be set using PPUADDR before accessing this)

// Write
set_PPUDATA = value => {
  PPUADDR &= 0x3FFF;
  mapper_ppu_address(PPUADDR);
  
  // $0000-$1FFF: CHR-ROM/RAM
  if(PPUADDR < 0x2000){
    mapper_chr_write(PPUADDR, value);
  }
  
  PPU_mem[mirrorAddress(PPUADDR)] = value;
  
  // increment address (1 or 32 depending on bit 2 of PPUCTRL)
  PPUADDR += PPUCTRL_I ? 32 : 1;
  mapper_ppu_address(PPUADDR);
},

// Read
get_PPUDATA = () => {
  PPUADDR &= 0x3FFF;
  mapper_ppu_address(PPUADDR);
  
  // PPUADDR between $0000 and $3EFF: buffered read
  // Each read fills a 1-byte buffer and returns the value previously stored in that buffer
  if(PPUADDR <= 0x3F00){
    t = PPUDATA_read_buffer;
    PPUDATA_read_buffer = ppu_read(PPUADDR);
  }
  
  // PPUADDR higher than $3EFF: direct read
  else {
    t = ppu_read(PPUADDR);
  }
  
  // increment address (1 or 32 depending on bit 2 of PPUCTRL)
  PPUADDR += PPUCTRL_I === 1 ? 32 : 1; 
  mapper_ppu_address(PPUADDR);
  
  return t;
},

// $4014: (write): copy a 256-byte page of CPU memory into the OAM memory (OAMDMA)
set_OAMDMA = value => {
  for(var i = 0; i < 256; i++){
    OAM[(OAMADDR + i) & 255] = memory_read(value * 0x100 + i);
  }
  
  // Consume 513 CPU cycles
  // (or 514 cycles when the current CPU cycle is odd. Ignored here)
  for(i = 0; i < 513; i++){
    apu_clock(1);
    cpu_tick();
  }
  //NES.haltCycles(513)
},

// Rendering
// ---------

// Background:
// The data stored in VRAM represents a 512*480px background, separated in four 256*240px screens
// Each screen can contain 32*30 tiles, and each tile measures 8*8px and can use a 4-color palette
// For each screen, a nametable in VRAM tells which tiles to draw, and an attribute table tells which palettes to use
// Attributes hold four 2-bit values, each of these values indicates which background subpalette to use for a given tile
//
// Attribute table for a given nametable (8*8 attributes):
//
//        0  1  2  3  4  5  6  7
//      +--+--+--+--+--+--+--+--+
// 2xC0 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xC8 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xD0 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xD8 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xE0 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xE8 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xF0 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
// 2xF8 |  |  |  |  |  |  |  |  |
//      +--+--+--+--+--+--+--+--+
//
//  One attribute:    /    \  
//                  /       \
//                /          \
//              /             \
//            /                \
//
//           bits 0-1   bits 2-3
//          +-------------------+
//          |  Tile   |  Tile   |
//          |         |         |
//          |  X, Y   |  X+1, Y |
//          |---------+---------|
//          |  Tile   |   Tile  |
//          |         |         |
//          |  X, Y+1 | X+1,Y+1 |
//          +-------------------+
//           bits 4-5   bits 6-7
//
//
// Generate one background line and sprite-priority pixels
// The line number (y) is a value vetween 0 and 480
drawBackgroundLine = y => {
  
  
  var i, j, X, Y, nametable, bits, pixel, tileLow, tileHigh, tileColors;
  tileColors = new Array(4);
  
  // Reset pixel buffer
  vramPixelBuffer = [];

  // Y tile coordinate (0-60)
  Y = ~~(y/8); 

  // For each tile of the scanline (X tile coordinate between 0 and 64):
  for(X = 64; X--;){
    
    // Get the nametable address in PPU memory:
    // $2000-$23BF: top left screen
    // $2400-$27BF: top right screen
    // $2800-$2BBF: bottom left screen
    // $2C00-$2FBF: bottom right screen
    nametable = 0x2000 + (0x800 * (Y > 29)) + (0x400 * (X > 31));
    
    // Get the attribute table address in PPU memory:
    // $23C0-$23FF: top left screen
    // $27C0-$27FF: top right screen
    // $2BC0-$2BFF: bottom left screen
    // $2FC0-$2FFF: bottom right screen
    // attributetable = nametable + 0x3C0;
    
    // Get the attribute byte for the group including the current tile:
    // attribute_X = (X % 32) >> 2; // 0-7
    // attribute_Y = (Y % 30) >> 2; // 0-7
    // attribute = ppu_read(attributetable + attribute_Y * 8 + attribute_X);
    
    // Get the attribute's 2-bit value for the current title:
    // bits_X = ((X % 32) >> 1) & 1; // 0-1
    // bits_Y = ((Y % 30) >> 1) & 1; // 0-1
    // bits = ((attribute >> (4 * bits_Y + 2 * bits_X)) & 0b11); // 0-3
    
    // Golfed here:
    bits = (
      ppu_read(nametable + 0x3C0 + ((Y % 30) >> 2) * 8 + ((X % 32) >> 2))
      >> 
      (
        4 * (((Y % 30) >> 1) & 1)
        + 
        2 * (((X % 32) >> 1) & 1)
      )
    ) & 0b11;

    // Get the subpalette represented by these bits:
    // Background palette is stored at $3F00-$3F0F (16 colors, 4 subpalette of 4 colors)
    // The values stored in the palettes are indexes of the 64 system colors (systemPalette)
    // The first color of each subpalette is ignored (*), the value at $3F00 (universal background color) is used instead
    // (*) during forced blanking (background & sprites disabled), if PPUADDR points to a subpalette's color 0, this color is used as universal background color (TODO)
    /*colors = [
      systemPalette[ppu_read(0x3F00 + bits * 4)],  // universal background color
      systemPalette[ppu_read(0x3F00 + bits * 4 + 1)],  // color 1 of current subpalette
      systemPalette[ppu_read(0x3F00 + bits * 4 + 2)],  // color 2 of current subpalette
      systemPalette[ppu_read(0x3F00 + bits * 4 + 3)],  // color 3 of current subpalette
    ];*/
    
    // Get the tile's address:
    // The bit B of PPUCTRL tells if the tile's graphics are stored in the first or second CHR-ROM bank ($0000-$0FFF or $1000-$1FFF)
    // The tile's index within the current CHR-ROM bank is stored in the nametable
    // tile = PPUCTRL_B * 0x1000 + ppu_read(nametable + (Y % 30) * 32 + (X % 32))
    
    // Get the pixels values:
    // The pixels of each tile are encoded on 2 bits
    // The value of a pixel (0-3) corresponds to a color from the current subpalette
    // Each tile is stored on 16 bytes, the first 8 bytes represent the "high bit" of each pixel, and the last 8 bytes the "low bit"
    
    // Let x and y be the coordinates of the pixels to draw inside the current tile (x = 0-7, y = 0-7)
    y %= 8;
    // These reads are constant for all eight pixels of the tile row. Keeping
    // them outside the pixel loop leaves more main-thread time for APU output.
    t = PPUCTRL_B * 0x1000 + ppu_read(nametable + (Y % 30) * 32 + (X % 32)) * 16 + y;
    tileLow = ppu_read(t) || 0;
    tileHigh = ppu_read(t + 8) || 0;
    for(i = 0; i < 4; i++) tileColors[i] = systemPalette[ppu_read(0x3F00 + bits * 4 + i)];
    for(x = 8; x--;){
      
      // The current line of 8 pixels is encoded on 2 bytes:
      // byte1 = ppu_read(tile * 16 + y);
      // byte2 = ppu_read(tile * 16 + y + 8);
      
      // And the current pixel's value is encoded as:
      // pixel = ((byte2 >> (7 - x)) & 1) * 2 + ((byte1 >> (7 - x)) & 1);
      
      // If the pixel's value is 0, the pixel is considered transparent and the universal background color is rendered
      // But if it's opaque (non-zero), its color is stored in the current line's pixel buffer
      // This buffer will be useful to render the sprites either in the front or behind the background tiles
      
      // Golfed here:
      if(pixel = ((tileHigh >> (7 - x)) & 1) * 2 + ((tileLow >> (7 - x)) & 1)){
        vramPixelBuffer[X * 8 + x] = tileColors[pixel];
      }
      
    }
  }
},

// Screen:
// Backround rendering and sprite rendering can be enabled or disabled using bits b and s of PPUMASK
// Background pixels are stored in a buffer using drawBackgroundLine()
// Up to 64 sprites can be drawn on screen, either on the foreground or behind the background tiles
// Sprites are drawn from front to back (sprite 0 to sprite 63) and can overlap
// A background sprite can overlap a foreground sprite, in that case it behaves like a clipping mask (ex: SMB's mushroom coming out of a question block)
// Sprites can measure 8*8px or 8*16px (if bit H of PPUCTRL is set)
// If 8*16px sprites are enabled, two consecutive tiles from the CHR-ROM are drawn on screen (the first one on top, the second one on bottom) with the same palette
// Contrary to background tiles:
// - sprites tiles use a dedicated sprite color palette ($3F10-$3F1F), divided in 4 subpalettes
// - the first color of each subpalette is always "transparent"
// - sprites can be flipped horizontally and/or vertically
// As soon as an opaque pixel of the sprite 0 overlaps an opaque pixel of the background, a "sprite 0 hit" is detected (bit S of PPUSTATUS is set)

// Each sprite is encoded on 4 bytes in the OAM memory:
// Byte 0: Y coordinate
// Byte 1: 
//  * 8x8 mode: tile index in current tile bank
//  * 8x16 mode: bit 0 = tile bank / bits 1-7 = top tile index
// Byte 2:
//  * bits 0-1: palette (4-7)
//  * bits 2-4: always 0
//  * bit 5: priority (0: in front of the background, 1: behind the background)
//  * bit 6: X flip
//  * bit 7: Y flip
// Byte 3: X coordinate

// Render one final scanline on screen (background + sprites):
// The scanline number (y) is a value vetween 0 and 240
drawScanline = y => {
  
  var i, x, scanlineSprites, spriteScanlineAddress, bits, pixel;

  // Find which sprites are present in the current scanline:
  // Reset the list
  scanlineSprites = [];
  
  // Loop on all the sprites
  for(i = 0; i < 64; i++){
    
    // If the current scanline is between the top of the sprite and its bottom (8px or 16px lower, depending on bit H of PPUCTRL)
    if(y >= OAM[i * 4] && y < OAM[i * 4] + (PPUCTRL_H ? 16 : 8)){
      
      // If more than 8 sprites are found, set overflow flag (bit 0 of PPUSTATUS) and stop checking
      if(scanlineSprites.length == 8) {
        PPUSTATUS_O = 1;
        break;
      }
      
      // Else, the sprite is visible in the current scanline. Add it to the list
      scanlineSprites.push(i);
    }
  }
  
  // Draw the scanline's pixels:
  for(x = 0; x < 256; x++){
    
    // Draw background tiles if background rendering is enabled
    // Use universal background color if no background tile is present
    // X and Y scrolling are applied when fetching the pixels values inside the background pixel buffer
    if(PPUMASK_b){
      NES.frameBuffer32[y * 256 + x] = vramPixelBuffer[(x + scroll_x) % 512] || systemPalette[ppu_read(mirrorAddress(0x3F00))];
    }
    
    // Then, for each sprite from back to front:
    for(i = scanlineSprites.length - 1; i >= 0; i--){
      
      // If this sprite is present at this pixel (if x is between the left column and right column of the sprite)
      if(x >= OAM[scanlineSprites[i] * 4 + 3] && x < OAM[scanlineSprites[i] * 4 + 3] + 8){
        
        // Retrieve the sprite's subpalette (bits 0-1 of byte 2 of sprite i in OAM memory)
        bits = OAM[scanlineSprites[i] * 4 + 2] & 0b11;
        /*colors = [
          ,                                               // transparent
          systemPalette[PPU_mem[0x3F10 + bits * 4 + 1]],  // color 1 of current subpalette
          systemPalette[PPU_mem[0x3F10 + bits * 4 + 2]],  // color 2 of current subpalette
          systemPalette[PPU_mem[0x3F10 + bits * 4 + 3]],  // color 3 of current subpalette
        ];*/
        
        // Retrieve the address of the current sprite's scanline in CHR-ROM:
        t = scanlineSprites[i] * 4;
        o = OAM[t];
        spriteScanlineAddress =
        
          // CHR-ROM bank
          (
            PPUCTRL_H
            
            // 8*16
            ? (OAM[t + 1] & 1)
            
            // 8*8
            : PPUCTRL_S
          ) * 0x1000
          
          // Tile
          + (OAM[t + 1] & (0xFF - PPUCTRL_H)) * 16
          
          // Scanline
          + (OAM[t + 2] & 0b10000000
            
            // Y flip
            ? (7 - y + o + 8 * ((y < o + 8 && PPUCTRL_H) + PPUCTRL_H))

            // No Y flip
            : (8 + y - o - 8 * (y < o + 8))
          );

        // Get pixel position within the sprite scanline
        t = x - OAM[scanlineSprites[i] * 4 + 3];
        
        // Handle horizontal flip
        o = (OAM[scanlineSprites[i] * 4 + 2] & 0b1000000) ? t : 7 - t;
        
        // Get current pixel value, and check if it's opaque (value: 1, 2 or 3)
        if(pixel = ((ppu_read(spriteScanlineAddress + 8) >> o) & 1) * 2 + ((ppu_read(spriteScanlineAddress) >> o) & 1)){
          
          // If sprite rendering is enabled, draw it on the current frame
          // But if priority bit is 1 and background rendering is enabled: let the background tile's pixel displayed on top if it's opaque
          // TODO: fix excitebike black sprite 0 that shows up behind background 
          if(((!((OAM[scanlineSprites[i] * 4 + 2] & 0b100000) && vramPixelBuffer[(x + scroll_x) % 512])) || !PPUMASK_b) && PPUMASK_s){
            NES.frameBuffer32[y * 256 + x] = systemPalette[PPU_mem[0x3F10 + bits * 4 + pixel]];
          }
          
          // Sprite 0 hit detection
          if(scanlineSprites[i] === 0 && !PPUSTATUS_S && vramPixelBuffer[(x + scroll_x) % 512] && PPUMASK_s && PPUMASK_b){
            PPUSTATUS_S = 1;
          }
        }
      }
    }
  }
},

// Clock
// -----

// Clock one PPU cycle
ppu_tick = () => {
  
  dot++;
  // One rendering clock on visible/pre-render lines, when rendering is enabled.
  if(dot === 260 && (scanline < 240 || scanline === 261)) mapper_scanline();
  
  // The PPU renders one dot (one pixel) per cycle
  // At the end of each scanline (341 dots), a new scanline starts
  // The screen is complete when 240 scanlines are rendered
  if(dot > 340){

    dot = 0;
    scanline++;
    
    // Update scroll
    V_XXXXX = T_XXXXX;
    V_NN = (V_NN & 0b10) + (T_NN & 0b01);
    
    // Visible scanlines (0-239)
    if(scanline < 240){
      drawBackgroundLine((scanline + scroll_y) % 480);
      drawScanline(scanline);
      // Sprite evaluation resets OAMADDR for the next scanline on the NES.
      if(PPUMASK_s || PPUMASK_b) OAMADDR = 0;
      
      // Update scroll
      scroll_x = (V_NN & 0b1) * 256 + V_XXXXX * 8 + xxx;
      

    }
    
    // VBlank starts at scanline 241 (a NMI interrupt is triggered, and the frame is displayed on the canvas)
    else if(scanline == 240){
      
      // VBlank flag
      PPUSTATUS_V = 1;
      ppu_update_nmi();
      
      // Output frameBuffer on canvas
      NES.frameData.data.set(NES.frameBuffer8);
      NES.frameCtx.putImageData(NES.frameData, 0, 0);
    

    }
    
    // VBlank ends at the pre-render scanline, and PPUSTATUS is reset
    else if(scanline == 260){
      PPUSTATUS_O =
      PPUSTATUS_S =
      PPUSTATUS_V = 0;
      ppu_update_nmi();
    }
    
    // When the pre-render scanline is completed, a new frame starts
    else if(scanline == 261){
      scanline = -1;
      endFrame = 1;
      
      // Update scroll
      V_YYYYY = T_YYYYY;
      V_yyy = T_yyy;
      V_NN = (V_NN & 0b01) + (T_NN & 0b10);
      scroll_y = (V_NN >> 1) * 240 + V_YYYYY * 8 + V_yyy;
    }
  }
}

;
// Compact LZMA1 raw decoder. Flat SDK probability layout, whole output as dictionary.
// State-machine layout informed by Ilya Kurdyukov's micro-lzmadec reference.
// Input: raw range-coded bytes, 5-byte LZMA properties, known output byte count.
function decodeLzma(packed,properties,size,context){
  archiveCheck(properties?.length===5&&properties[0]<225,'Prop');archiveCheck(size>=0&&size<=MAX_BLOCK,'Size');
  var prop=properties[0],lc=prop%9,lp=Math.floor(prop/9)%5,pb=Math.floor(prop/45),
      dictionary=Math.max(4096,new DataView(properties.buffer,properties.byteOffset,5).getUint32(1,true)),
      probs=context?.probs||new Uint16Array(1846+768*2**(lc+lp)).fill(1024),out=context?.out||new Uint8Array(size),
      input=0,pos=context?.pos||0,dictBase=context?.base||0,end=pos+size,range=4294967295,code=0,
      state=context?.state||0,rep0=context?.rep0||1,rep1=context?.rep1||1,rep2=context?.rep2||1,rep3=context?.rep3||1;
  function read(){archiveCheck(input<packed.length,'EOF');return packed[input++];}
  function normalize(){if(range<16777216){range=(range*256)>>>0;code=(code*256+read())>>>0;}}
  function bit(index){
    normalize();var p=probs[index],bound=(range>>>11)*p;
    if(code<bound){range=bound;probs[index]=p+((2048-p)>>>5);return 0;}
    range=(range-bound)>>>0;code=(code-bound)>>>0;probs[index]=p-(p>>>5);return 1;
  }
  function tree(base,bits,reverse){var node=1,value=0;for(var i=0;i<bits;i++){var b=bit(base+node);node=node*2+b;value|=b<<i;}return reverse?value:node-2**bits;}
  function length(base,position){
    if(!bit(base))return tree(base+2+position*8,3,false);
    if(!bit(base+1))return 8+tree(base+130+position*8,3,false);
    return 16+tree(base+258,8,false);
  }
  archiveCheck(read()===0);for(var i=0;i<4;i++)code=(code*256+read())>>>0;
  while(pos<end){
    var position=(pos-dictBase)&((1<<pb)-1),len,distance;
    if(!bit(state*16+position)){
      var base=1846+768*((((pos-dictBase)&((1<<lp)-1))<<lc)+((pos>dictBase?out[pos-1]:0)>>(8-lc))),node=1,
          offset=state>=7?256:0,match=offset?out[pos-rep0]:0;
      while(node<256){match*=2;var b=bit(base+offset+(match&offset)+node);node=node*2+b;offset&=b?match:~match;}
      out[pos++]=node-256;state=state<4?0:state<10?state-3:state-6;
      continue;
    }
    if(!bit(192+state)){
      rep3=rep2;rep2=rep1;rep1=rep0;
      len=length(818,position)+2;
      var slot=tree(432+Math.min(len-2,3)*64,6,false);
      distance=slot;
      if(slot>3){
        var bits=(slot>>1)-1;distance=(2+(slot&1))*2**bits;
        if(slot<14)distance+=tree(687+distance-slot,bits,true);
        else{
          var direct=0;for(var n=bits-4;n>0;n--){normalize();range>>>=1;var b=code>=range?1:0;if(b)code=(code-range)>>>0;direct=direct*2+b;}
          distance+=direct*16+tree(802,4,true);
        }
      }
      rep0=distance+1;state=state<7?7:10;
    }else{
      if(!bit(204+state)){
        if(!bit(240+state*16+position)){
          archiveCheck(rep0<=pos-dictBase&&rep0<=dictionary,'Data');out[pos]=out[pos-rep0];pos++;state=state<7?9:11;continue;
        }
      }else{
        if(!bit(216+state))distance=rep1;
        else{if(!bit(228+state))distance=rep2;else{distance=rep3;rep3=rep2;}rep2=rep1;}
        rep1=rep0;rep0=distance;
      }
      len=length(1332,position)+2;state=state<7?8:11;
    }
    archiveCheck(rep0>0&&rep0<=pos-dictBase&&rep0<=dictionary&&len<=end-pos,'Data');
    for(;len--;pos++)out[pos]=out[pos-rep0];
  }
  if(context){normalize();archiveCheck(input===packed.length&&code===0,'Data');Object.assign(context,{pos,probs,state,rep0,rep1,rep2,rep3});}
  return out;
}

// LZMA2 shares the compact LZMA core; only its chunk/reset framing is new.
function decodeLzma2(packed,properties,size){
  archiveCheck(properties?.length===1&&properties[0]<=40,'Prop');archiveCheck(size>=0&&size<=MAX_BLOCK,'Size');
  var property=properties[0],dictionary=property===40?4294967295:(2+(property&1))*2**(11+(property>>1)),
      props=new Uint8Array(5),r=new ArchiveReader(packed),context={out:new Uint8Array(size),pos:0,base:0},need=224;
  new DataView(props.buffer).setUint32(1,dictionary,true);
  function word(){return r.readByte()*256+r.readByte();}
  for(;;){
    var control=r.readByte();if(!control)break;
    if(control===1||control>=224)context.base=context.pos;
    if(control<128){
      archiveCheck(control===1||control===2&&need!==224,'Data');if(control===1)need=192;
      var count=word()+1;archiveCheck(count<=size-context.pos,'Data');context.out.set(r.take(count),context.pos);context.pos+=count;
    }else{
      archiveCheck(control>=need,'Data');need=0;
      count=(control&31)*65536+word()+1;var length=word()+1;
      if(control>=192){props[0]=r.readByte();archiveCheck(props[0]<225&&props[0]%9+Math.floor(props[0]/9)%5<=4,'Prop');}
      if(control>=160){context.probs=null;context.state=0;context.rep0=context.rep1=context.rep2=context.rep3=1;}
      archiveCheck(count<=size-context.pos,'Data');decodeLzma(r.take(length),props,count,context);
    }
  }
  archiveCheck(context.pos===size&&r.pos===packed.length,'Data');return context.out;
}

function unpackFolder(bytes,folder){
  archiveCheck(folder.size<=MAX_BLOCK,'Size');archiveCheck(folder.start<=bytes.length&&folder.packed<=bytes.length-folder.start,'EOF');
  var packed=bytes.subarray(folder.start,folder.start+folder.packed);
  return (folder.method==='3.1.1'?decodeLzma:decodeLzma2)(packed,folder.properties,folder.size);
}
var MAX_ROM=16<<20,MAX_BLOCK=MAX_ROM;
function archiveCheck(ok,reason='Fmt'){if(!ok)throw Error(reason);}
class ArchiveReader{
  constructor(bytes){this.bytes=bytes;this.pos=0;}
  readByte(){archiveCheck(this.pos<this.bytes.length,'EOF');return this.bytes[this.pos++];}
  take(n){archiveCheck(n>=0&&n<=this.bytes.length-this.pos,'EOF');this.pos+=n;return this.bytes.subarray(this.pos-n,this.pos);}
  fixed(n){var v=0;for(var i=0;i<n;i++)v+=this.readByte()*256**i;archiveCheck(Number.isSafeInteger(v),'Size');return v;}
  number(){var first=this.readByte(),v=0;for(var i=0,mask=128;i<8;i++,mask>>=1){if(!(first&mask)){v+=(first&(mask-1))*256**i;archiveCheck(Number.isSafeInteger(v),'Size');return v;}v+=this.readByte()*256**i;}archiveCheck(Number.isSafeInteger(v),'Size');return v;}
  expect(n){archiveCheck(this.readByte()===n);}
  skipDigest(n=1){var all=this.readByte();archiveCheck(all<=1);var defined=n&&(all||this.readByte()&128);if(defined)this.take(4);return !!defined;}
}
function readStreams(r){
  r.expect(6);var f={start:32+r.number()};r.expect(1);r.expect(9);f.packed=r.number();
  var tag=r.readByte();if(tag===10){r.skipDigest();tag=r.readByte();}archiveCheck(tag===0);
  r.expect(7);r.expect(11);archiveCheck(r.number()===1,'Multi');r.expect(0);r.expect(1);
  var flags=r.readByte();archiveCheck(!(flags&208));f.method=Array.from(r.take(flags&15)).join('.');
  archiveCheck(f.method==='3.1.1'||f.method==='33','Codec');f.properties=flags&32?r.take(r.number()):null;
  var inherited=false;r.expect(12);f.size=r.number();tag=r.readByte();if(tag===10){inherited=r.skipDigest();tag=r.readByte();}archiveCheck(tag===0);
  tag=r.readByte();if(tag===8){
    tag=r.readByte();if(tag===13){archiveCheck(r.number()===1,'Multi');tag=r.readByte();}
    if(tag===9)tag=r.readByte();
    if(tag===10){r.skipDigest(!inherited);tag=r.readByte();}
    archiveCheck(tag===0);tag=r.readByte();
  }
  archiveCheck(tag===0);return f;
}
function readSevenZip(bytes){
  archiveCheck(bytes.length>=32,'EOF');
  var start=new ArchiveReader(bytes);start.take(6);start.expect(0);start.readByte();start.take(4);
  var offset=32+start.fixed(8),size=start.fixed(8);archiveCheck(size<=MAX_BLOCK,'Size');archiveCheck(offset+size<=bytes.length,'EOF');
  var header=bytes.subarray(offset,offset+size);var r=new ArchiveReader(header),tag=r.readByte();
  if(tag===23){var encoded=readStreams(r);archiveCheck(r.pos===r.bytes.length);r=new ArchiveReader(unpackFolder(bytes,encoded));tag=r.readByte();}
  archiveCheck(tag===1);tag=r.readByte();if(tag===2){while(r.readByte()!==0)r.take(r.number());tag=r.readByte();}
  archiveCheck(tag!==5&&tag!==0,'Empty');archiveCheck(tag===4);var folder=readStreams(r);r.expect(5);archiveCheck(r.number()===1,'Multi');
  while((tag=r.readByte())!==0){var value=r.take(r.number());if(tag===14)archiveCheck(value.length===1&&!(value[0]&128),'Empty');}
  r.expect(0);archiveCheck(r.pos===r.bytes.length);return unpackFolder(bytes,folder);
}
async function readGameFile(file){
  var bytes=new Uint8Array(await file.arrayBuffer());archiveCheck(bytes.length<=MAX_ROM*4,'Size');
  if([55,122,188,175,39,28].every((b,i)=>bytes[i]===b))bytes=readSevenZip(bytes);
  else archiveCheck(!/\.7z$/i.test(file.name));
  return bytes.buffer;
}

;
// Compact local-ROM player; keyboard mapping matches v009.
var player=document.querySelector('main'),canvas=document.getElementById('screen'),
    fileInput=document.getElementById('rom'),muteButton=document.getElementById('mute'),
    fullButton=document.getElementById('full'),statusLine=document.getElementById('status'),
    ui_ready=false,loadSequence=0,
    ui_keys=['KeyX','KeyZ','Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
function clearInputs(){if(ui_ready)for(var i=0;i<8;i++)NES.keyup(i);}
function resumeAudio(){if(apu_context)apu_context.resume().catch(()=>{});}
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await player.requestFullscreen();}catch(e){statusLine.textContent='Full';}}
fullButton.onclick=toggleFullscreen;
document.onfullscreenchange=()=>{fullButton.textContent=document.fullscreenElement?'退出全屏':'全屏';};
muteButton.onclick=()=>{
  apu_muted=!apu_muted;muteButton.textContent=apu_muted?'已静音':'静音';muteButton.setAttribute('aria-pressed',apu_muted);
  if(apu_master)apu_master.gain.setTargetAtTime(apu_muted?0:1,apu_context.currentTime,.005);
  resumeAudio();
};
for(var type of ['keydown','keyup'])window.addEventListener(type,e=>{
  var down=e.type==='keydown';
  if(down&&(e.ctrlKey||e.metaKey||e.altKey||e.isComposing))return;
  if(e.code==='KeyF'){e.preventDefault();if(down&&!e.repeat)toggleFullscreen();return;}
  var key=ui_keys.indexOf(e.code);if(!ui_ready||key<0)return;
  e.preventDefault();if(down)resumeAudio();(down?NES.keydown:NES.keyup)(key);
});
window.addEventListener('blur',clearInputs);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});
document.addEventListener('pointerdown',resumeAudio);
fileInput.onchange=async()=>{
  var file=fileInput.files[0];if(!file)return;
  var sequence=++loadSequence;NES.pause();clearInputs();ui_ready=false;statusLine.textContent='读取中…';
  try{
    var data=await readGameFile(file);if(sequence!==loadSequence)return;
    NES.init({rom:new Uint8Array(data),frame:canvas});ui_ready=true;NES.play();statusLine.textContent=file.name;
  }catch(e){if(sequence===loadSequence)statusLine.textContent=/^[A-Za-z0-9]{1,6}$/.test(e.message)?e.message:'Fail';}
  fileInput.value='';
};
