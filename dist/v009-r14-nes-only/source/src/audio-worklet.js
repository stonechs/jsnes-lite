// JSNES-style PCM buffering with low-water feedback, bounded queue and gap fades.
// All work here runs on the independent AudioWorklet rendering thread.
class LiteNESAudioProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.capacity=8192;
    this.left=new Float32Array(this.capacity);this.right=new Float32Array(this.capacity);
    this.read=0;this.write=0;this.count=0;
    this.playing=false;this.primed=false;this.gain=0.7;this.stream=0;
    this.low=Math.min(4096,Math.ceil(sampleRate*.064/128)*128);
    this.target=Math.min(6144,Math.ceil(sampleRate*.085/128)*128);
    this.pending=false;this.fade=0;this.lastL=0;this.lastR=0;
    this.port.onmessage=event=>{
      const message=event.data;
      if(message[0]===0){
        if(!this.playing||(message[3]!==undefined&&message[3]!==this.stream))return;
        const left=message[1],right=message[2];
        for(let i=0;i<Math.min(left.length,right.length);i++){
          if(this.count===this.capacity){this.read=(this.read+1)%this.capacity;this.count--;}
          this.left[this.write]=left[i];this.right[this.write]=right[i];
          this.write=(this.write+1)%this.capacity;this.count++;
        }
      }else if(message[0]===1){
        this.playing=!!message[1];this.stream=message[2]||0;
        this.read=this.write=this.count=0;this.primed=false;this.pending=false;this.fade=0;
      }else if(message[0]===2){
        this.gain=Math.max(0,Math.min(1,Number(message[1])||0));
      }else if(message[0]===5&&message[1]===this.stream){
        this.pending=false;
      }
    };
  }
  needSamples(){
    if(!this.pending&&this.playing&&this.count<(this.primed?this.low:this.target)){
      this.pending=true;
      this.port.postMessage([4,this.stream,this.count]);
    }
  }
  fadeTail(left,right,start){
    const length=Math.min(32,left.length-start);
    for(let i=0;i<length;i++){
      const gain=1-(i+1)/length;
      left[start+i]=this.lastL*gain;right[start+i]=this.lastR*gain;
    }
    this.lastL=this.lastR=0;
  }
  process(inputs,outputs){
    const output=outputs[0];if(!output||output.length<2)return true;
    const left=output[0],right=output[1];left.fill(0);right.fill(0);
    if(!this.playing){this.fadeTail(left,right,0);return true;}
    this.needSamples();
    if(!this.primed){
      if(this.count<this.target){this.fadeTail(left,right,0);return true;}
      this.primed=true;this.fade=32;
    }
    const length=Math.min(left.length,this.count);
    for(let i=0;i<length;i++){
      const fade=this.fade?(33-this.fade--)/32:1;
      left[i]=this.left[this.read]*this.gain*fade;
      right[i]=this.right[this.read]*this.gain*fade;
      this.read=(this.read+1)%this.capacity;
    }
    this.count-=length;
    if(length){this.lastL=left[length-1];this.lastR=right[length-1];}
    if(length<left.length){this.primed=false;this.fadeTail(left,right,length);}
    this.needSamples();
    return true;
  }
}
registerProcessor('lite-nes-audio',LiteNESAudioProcessor);
