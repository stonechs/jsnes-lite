var frameCanvas=document.getElementById('frameCanvas'),ui_ready=false,ui_sequence=0;
var statusLine=document.getElementById('loadStatus');
document.getElementById('fileInput').onchange=async event=>{
 var file=event.target.files[0];if(!file)return;
 var sequence=++ui_sequence;NES.pause();ui_ready=false;
 try{
  await audio_prepare().catch(error=>audio_status(error.message));
  var bytes=new Uint8Array(await file.arrayBuffer());if(sequence!==ui_sequence)return;
  NES.init({rom:bytes,frame:frameCanvas});ui_ready=true;statusLine.textContent=file.name;NES.play();
 }catch(error){if(sequence===ui_sequence)statusLine.textContent=error.message;}
};
document.getElementById('b_play').onclick=()=>{if(ui_ready)NES.play();};
document.getElementById('b_pause').onclick=NES.pause;
document.getElementById('b_reset').onclick=()=>{if(ui_ready){NES.reset();NES.play();}};
document.getElementById('b_audio').onclick=audio_resume;
document.getElementById('i_audio').onchange=event=>{audio_enabled=event.target.checked;audio_set_volume();};
var keys={ArrowLeft:6,ArrowUp:4,ArrowRight:7,ArrowDown:5,KeyX:0,KeyC:1,Escape:2,Enter:3};
for(var type of ['keydown','keyup'])window.addEventListener(type,event=>{
 if(!ui_ready||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||keys[event.code]===undefined)return;
 event.preventDefault();(event.type==='keydown'?NES.keydown:NES.keyup)(1,keys[event.code]);
});
window.addEventListener('blur',()=>{if(ui_ready)for(var key=0;key<8;key++)NES.keyup(1,key);});
