// Compact local-ROM player; keyboard mapping matches v009.
var player=document.querySelector('main'),canvas=document.getElementById('screen'),
    fileInput=document.getElementById('rom'),muteButton=document.getElementById('mute'),
    fullButton=document.getElementById('full'),statusLine=document.getElementById('status'),
    ui_ready=false,loadSequence=0,
    ui_keys=['KeyX','KeyZ','Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
function clearInputs(){if(ui_ready)for(var i=0;i<8;i++)NES.keyup(i);}
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
  e.preventDefault();if(down)resumeAudio();(down?NES.keydown:NES.keyup)(key);
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
