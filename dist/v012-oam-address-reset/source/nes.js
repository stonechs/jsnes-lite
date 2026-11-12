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
