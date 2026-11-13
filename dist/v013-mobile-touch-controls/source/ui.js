// Compact local-ROM player with keyboard and multi-touch controller input.
var player=document.querySelector('main'),canvas=document.getElementById('screen'),
    fileInput=document.getElementById('rom'),muteButton=document.getElementById('mute'),
    fullButton=document.getElementById('full'),statusLine=document.getElementById('status'),
    ui_ready=false,loadSequence=0,
    ui_keys=['KeyX','KeyZ','Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'],
    heldKeys=Array.from({length:8},()=>new Set());
function pressInput(key,source){
  if(!ui_ready)return;
  var held=heldKeys[key];if(!held.size)NES.keydown(key);held.add(source);
}
function releaseInput(key,source){
  var held=heldKeys[key];if(held.delete(source)&&!held.size&&ui_ready)NES.keyup(key);
}
function clearInputs(){
  for(var i=0;i<8;i++){heldKeys[i].clear();if(ui_ready)NES.keyup(i);}
  document.querySelectorAll('.touch[aria-pressed=true]').forEach(button=>button.setAttribute('aria-pressed','false'));
}
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
  e.preventDefault();if(down){resumeAudio();pressInput(key,'keyboard:'+e.code);}else releaseInput(key,'keyboard:'+e.code);
});
document.querySelectorAll('.touch').forEach(button=>{
  var key=Number(button.dataset.button),source='';
  function release(e){
    if(!source||e&&e.pointerId!==Number(source.slice(6)))return;
    releaseInput(key,source);source='';button.setAttribute('aria-pressed','false');
  }
  button.addEventListener('pointerdown',e=>{
    if(source||e.button!==0)return;
    e.preventDefault();source='touch:'+e.pointerId;button.setPointerCapture(e.pointerId);
    if(ui_ready){resumeAudio();pressInput(key,source);}button.setAttribute('aria-pressed','true');
  });
  for(var event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
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
