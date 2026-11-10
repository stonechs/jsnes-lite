// Bridge the unmodified JSNES APU to jsnes-lite's CPU, mapper bus and worklet.
var apu_device=null,apu_bus=0,apu_catchup_cycles=0,apu_stalls=0;
var apu_host={
  opts:{sampleRate:44100,onAudioSample:(left,right)=>audio_sample(left,right)},
  cpu:{
    IRQ_NORMAL:0,dataBus:0,instrBusCycles:0,apuCatchupCycles:0,
    // IRQ is polled as a level below rather than losing a request while masked.
    requestIrq:()=>{},
    haltCycles:cycles=>{apu_stalls+=cycles;}
  },
  mmap:{load:address=>{apu_bus=memory_read(address);return apu_bus;}}
};
var apu_set_sample_rate=rate=>{
  apu_host.opts.sampleRate=rate;
  if(apu_device){apu_device.sampleRate=rate;apu_device.setFrameRate(60);}
};
var apu_reset=()=>{
  apu_stalls=apu_catchup_cycles=apu_bus=0;
  apu_host.cpu.dataBus=apu_host.cpu.instrBusCycles=apu_host.cpu.apuCatchupCycles=0;
  apu_host.opts.sampleRate=audio_context?audio_context.sampleRate:44100;
  apu_device=new JSNESPAPU(apu_host);
  audio_set_playing(false);
};
var apu_clock=cycles=>{
  if(apu_device){
    apu_device.clockFrameCounter(cycles,apu_catchup_cycles);
    apu_catchup_cycles=0;apu_host.cpu.apuCatchupCycles=0;
  }
};
var apu_read=()=>{
  if(!apu_device)return 0;
  var elapsed=Math.max(0,c-apu_catchup_cycles);
  if(elapsed)apu_device.advanceFrameCounter(elapsed);
  apu_catchup_cycles+=elapsed;
  apu_host.cpu.apuCatchupCycles=apu_catchup_cycles;
  apu_host.cpu.dataBus=apu_bus;
  return apu_device.readReg(0x4015);
};
var apu_write=(address,value)=>{
  if(!apu_device)return;
  apu_host.cpu.instrBusCycles=c;
  apu_host.cpu.apuCatchupCycles=apu_catchup_cycles;
  apu_device.writeReg(address,value&255);
};
var apu_irq_pending=()=>apu_device&&(
  (apu_device.frameIrqEnabled&&apu_device.frameIrqActive)||apu_device.dmc.irqGenerated
);
var cpu_bus_read=address=>{
  var value=memory_read(address);
  if((address&65535)!==0x4015)apu_bus=value;
  return value;
};
