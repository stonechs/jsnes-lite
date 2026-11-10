// Based on JSNES browser/speakers.js (Apache-2.0), extended with queue reset,
// priming, mute/volume and bounded overflow handling. Runs on the audio thread.
// Array messages keep the interface stable across separate minification passes.
class LiteNESAudioProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.capacity=8192;
    this.left=new Float32Array(this.capacity);
    this.right=new Float32Array(this.capacity);
    this.read=0;this.write=0;this.count=0;
    this.playing=false;this.primed=false;this.gain=0.7;
    this.rendered=0;this.dropped=0;this.underruns=0;this.peak=0;
    this.port.onmessage=event=>{
      const message=event.data;
      if(message[0]===0){
        if(!this.playing)return;
        const left=message[1],right=message[2];
        for(let i=0;i<Math.min(left.length,right.length);i++){
          if(this.count===this.capacity){
            this.read=(this.read+1)%this.capacity;this.count--;this.dropped++;
          }
          this.left[this.write]=left[i];this.right[this.write]=right[i];
          this.write=(this.write+1)%this.capacity;this.count++;
        }
      }else if(message[0]===1){
        this.playing=!!message[1];
        this.read=this.write=this.count=0;this.primed=false;
      }else if(message[0]===2){
        this.gain=Math.max(0,Math.min(1,Number(message[1])||0));
      }else if(message[0]===3){
        // Explicit diagnostics only; no periodic messages on the render thread.
        this.port.postMessage([3,message[1],this.rendered,this.dropped,this.underruns,this.count,this.peak]);
      }
    };
  }
  process(inputs,outputs){
    const output=outputs[0];
    if(!output||output.length<2)return true;
    const left=output[0],right=output[1];
    left.fill(0);right.fill(0);
    if(!this.playing)return true;
    if(!this.primed){
      if(this.count<1024)return true;
      this.primed=true;
    }
    const length=Math.min(left.length,this.count);
    for(let i=0;i<length;i++){
      left[i]=this.left[this.read]*this.gain;
      right[i]=this.right[this.read]*this.gain;
      this.peak=Math.max(this.peak,Math.abs(left[i]),Math.abs(right[i]));
      this.read=(this.read+1)%this.capacity;
    }
    this.count-=length;this.rendered+=length;
    if(length<left.length){this.underruns++;this.primed=false;}
    return true;
  }
}
registerProcessor('lite-nes-audio',LiteNESAudioProcessor);
