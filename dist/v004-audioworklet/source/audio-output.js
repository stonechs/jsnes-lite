// AudioWorklet output. Only PCM buffering/rendering runs on the audio thread;
// the APU must remain synchronized with CPU register reads, DMC DMA and IRQs.
var audio_context=null,audio_node=null,audio_loading=null,audio_playing=false,
    audio_enabled=true,audio_volume=0.7,audio_batch_pos=0,
    audio_batch_l=new Float32Array(1024),audio_batch_r=new Float32Array(1024);

var audio_status=message=>{
  var element=document.getElementById('audioStatus');
  if(element)element.textContent=message;
};
var audio_prepare=()=>{
  if(audio_loading)return audio_loading;
  if(!window.AudioContext||!window.AudioWorkletNode||!window.isSecureContext){
    return Promise.reject(new Error('AudioWorklet needs a modern browser and a secure context.'));
  }
  audio_context=new AudioContext({latencyHint:'interactive'});
  // Invoke resume in the original gesture; do not block ROM loading if policy
  // leaves this promise pending until the next explicit click.
  audio_context.resume().catch(()=>{});
  audio_loading=(async()=>{
    // file:// has an opaque origin in Chromium: blob:null worklet loads can
    // fail CORS. An inline data module also works when this HTML is opened locally.
    var url='data:application/javascript,'+encodeURIComponent(audio_worklet_source);
    try{
      await audio_context.audioWorklet.addModule(url);
      audio_node=new AudioWorkletNode(audio_context,'lite-nes-audio',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
      audio_node.onprocessorerror=()=>{audio_status('Audio stopped. Reload the page to retry.');};
      audio_node.connect(audio_context.destination);
      audio_node.port.postMessage([1,audio_playing]);
      audio_set_volume();
      apu_set_sample_rate(audio_context.sampleRate);
      audio_status(audio_context.state==='running'?'Audio ready':'Click Enable audio');
    }catch(error){
      audio_context.close().catch(()=>{});audio_context=null;audio_node=null;audio_loading=null;
      throw error;
    }
  })();
  return audio_loading;
};
var audio_resume=async()=>{
  try{
    await audio_prepare();
    await audio_context.resume();
    audio_status('Audio ready');
  }catch(error){audio_status(error.message);}
};
var audio_set_playing=playing=>{
  audio_playing=playing;audio_batch_pos=0;
  if(audio_node)audio_node.port.postMessage([1,playing]);
};
var audio_set_volume=()=>{
  if(audio_node)audio_node.port.postMessage([2,audio_enabled?audio_volume:0]);
};
var audio_flush=()=>{
  if(audio_batch_pos&&audio_node&&audio_playing){
    var left=audio_batch_l.slice(0,audio_batch_pos),right=audio_batch_r.slice(0,audio_batch_pos);
    audio_node.port.postMessage([0,left,right],[left.buffer,right.buffer]);
  }
  audio_batch_pos=0;
};
var audio_sample=(left,right)=>{
  if(!audio_node||!audio_playing)return;
  audio_batch_l[audio_batch_pos]=left;audio_batch_r[audio_batch_pos]=right;
  if(++audio_batch_pos===audio_batch_l.length)audio_flush();
};
