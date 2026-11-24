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
