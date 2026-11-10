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
// Observe CPU-driven PPUADDR/PPUDATA edges, NOT debug renderer CHR reads.
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
  if(![0,1,2,3,4,30].includes(NES.mapper))throw new Error('Unsupported mapper: '+NES.mapper);
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
  }else if(NES.mapper===30&&address>=0xc000){
    mapper_map_prg(0,(value&31)*2,2);
    mapper_map_chr(0,((value>>5)&3)*8,8);
    NES.mirroring=(value&128)?3:NES.headerMirroring;
  }
};
