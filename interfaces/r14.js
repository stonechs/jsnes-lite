function resumeAudio(){
 if(audio_context&&audio_context.state==='suspended')audio_context.resume().catch(()=>{});
}
document.addEventListener('pointerdown',resumeAudio);
document.addEventListener('keydown',resumeAudio);
async function loadRom(file){
 if(!file)return;
 var sequence=++loadSequence;
 NES.pause();clearInputs();ui_ready=false;
 statusLine.textContent='正在读取 '+file.name;
 var sound=audio_prepare().catch(()=>null);
 try{
  var game=await readGameFile(file);await sound;
  if(sequence!==loadSequence)return;
  NES.init({rom:new Uint8Array(game.buffer),frame:canvas});
  ui_ready=true;clearInputs();NES.play();
  statusLine.textContent=game.name+(audio_node?'':'（音频不可用）');
 }catch(error){if(sequence===loadSequence)statusLine.textContent='加载失败：'+error.message;}
}
document.querySelector('#choose').addEventListener('click',()=>{
 audio_prepare().catch(()=>{});resumeAudio();fileInput.click();
});
fileInput.addEventListener('change',()=>{loadRom(fileInput.files[0]);fileInput.value='';});
window.addEventListener('dragover',event=>event.preventDefault());
window.addEventListener('drop',event=>{event.preventDefault();loadRom(event.dataTransfer.files[0]);});
