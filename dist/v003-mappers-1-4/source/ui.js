// Local-file interface. No external scripts or ROM downloads.
var frameCanvas=document.getElementById('frameCanvas');
var vramCanvas=document.getElementById('vramCanvas');
var fileInput=document.getElementById('fileInput');
var i_start=document.getElementById('i_start');
var b_play=document.getElementById('b_play');
var b_pause=document.getElementById('b_pause');
var b_frame=document.getElementById('b_frame');
var b_reset=document.getElementById('b_reset');
var loadStatus=document.getElementById('loadStatus');
var ui_ready=false;
debug=1;
fileInput.onchange=()=>{
  if(!fileInput.files.length)return;
  NES.pause();
  ui_ready=false;
  loadStatus.textContent='Loading ROM...';
  var reader=new FileReader();
  reader.onload=()=>{
    try{
      NES.init({rom:new Uint8Array(reader.result),frame:frameCanvas,vram:vramCanvas});
      ui_ready=true;
      loadStatus.textContent='Mapper '+NES.mapper+' loaded';
      if(i_start.checked)NES.play();
    }catch(error){loadStatus.textContent=error.message;}
  };
  reader.onerror=()=>{loadStatus.textContent='Unable to read ROM';};
  reader.readAsArrayBuffer(fileInput.files[0]);
};
b_play.onclick=()=>{if(ui_ready){NES.pause();NES.play();}};
b_pause.onclick=NES.pause;
b_frame.onclick=()=>{if(ui_ready)NES.frame();};
b_reset.onclick=()=>{
  if(ui_ready){frameCanvas.width^=0;vramCanvas.width^=0;NES.reset();}
};
