  var player = document.querySelector("main");
  var canvas = document.querySelector("canvas");
  var statusLine = document.querySelector("#status");
  var fileInput = document.querySelector("#rom");
  var fullButton = document.querySelector("#full");
  var bindings = [
    ["UP", "上", "ArrowUp", "↑"],
    ["DOWN", "下", "ArrowDown", "↓"],
    ["LEFT", "左", "ArrowLeft", "←"],
    ["RIGHT", "右", "ArrowRight", "→"],
    ["SELECT", "Select", "Space", "空格"],
    ["START", "Start", "Enter", "Enter"],
    ["B", "B", "KeyZ", "Z"],
    ["A", "A", "KeyX", "X"]
  ];
  var ui_ready=false;

  var loadSequence = 0;
  var muteButton = document.querySelector("#mute");
  var muted = false;
  muteButton.addEventListener("click", () => {
    muted = !muted;
    muteButton.setAttribute("aria-pressed", String(muted));
    muteButton.textContent = muted ? "已静音" : "静音";
    audio_enabled=!muted;audio_set_volume();
  });
  var controls =   new Map();
  for (const [pad, label, code, hint] of bindings) {
    let setPressed = function(source, down) {
      if (down) sources.add(source);
      else sources.delete(source);
      const pressed = sources.size !== 0;
      button.setAttribute("aria-pressed", String(pressed));
      if (ui_ready) {
        const index = { "UP": Controller.BUTTON_UP, "DOWN": Controller.BUTTON_DOWN, "LEFT": Controller.BUTTON_LEFT, "RIGHT": Controller.BUTTON_RIGHT, "SELECT": Controller.BUTTON_SELECT, "START": Controller.BUTTON_START, "A": Controller.BUTTON_A, "B": Controller.BUTTON_B }[pad];
        if (pressed) NES.keydown(1, index);
        else NES.keyup(1, index);
      }
    };
    const button = document.createElement("button");
    button.className = "pad";
    button.type = "button";
    button.append(label, document.createElement("kbd"));
    button.lastChild.textContent = hint;
    button.setAttribute("aria-label", label + "，键盘 " + hint);
    button.setAttribute("aria-pressed", "false");
    document.querySelector("#pads").append(button);
    const sources =   new Set();
    controls.set(code, { setPressed, clear() {
      sources.clear();
      setPressed("keyboard", false);
    } });
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setPressed(event.pointerId, true);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, (event) => setPressed(event.pointerId, false));
    }
  }
  function clearInputs() {
    for (const control of controls.values()) control.clear();
  }
  window.addEventListener("blur", clearInputs);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInputs();
  });
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await player.requestFullscreen();
    } catch {
      statusLine.textContent = "当前浏览器未能切换全屏。";
    }
  }
  document.addEventListener("fullscreenchange", () => {
    fullButton.firstChild.textContent = document.fullscreenElement ? "退出全屏 " : "全屏 ";
    fullButton.setAttribute("aria-pressed", String(!!document.fullscreenElement));
  });
  fullButton.addEventListener("click", toggleFullscreen);
  for (const type of ["keydown", "keyup"]) {
    window.addEventListener(type, (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const down = type === "keydown";
      if (event.code === "KeyF") {
        event.preventDefault();
        if (down && !event.repeat) toggleFullscreen();
        return;
      }
      const control = controls.get(event.code);
      if (!ui_ready || !control) return;
      event.preventDefault();
      control.setPressed("keyboard", down);
    });
  }

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
 try{
  var buffer=await file.arrayBuffer();
  if(sequence!==loadSequence)return;
  var sound=audio_prepare().catch(()=>null);
  NES.init({rom:new Uint8Array(buffer),frame:canvas});
  await sound;
  if(sequence!==loadSequence)return;
  ui_ready=true;clearInputs();NES.play();
  statusLine.textContent=file.name+(audio_node?'':'（音频不可用）');
 }catch(error){if(sequence===loadSequence)statusLine.textContent='加载失败：'+error.message;}
}
document.querySelector('#choose').addEventListener('click',()=>{
 audio_prepare().catch(()=>{});resumeAudio();fileInput.click();
});
fileInput.addEventListener('change',()=>{loadRom(fileInput.files[0]);fileInput.value='';});
window.addEventListener('dragover',event=>event.preventDefault());
window.addEventListener('drop',event=>{event.preventDefault();loadRom(event.dataTransfer.files[0]);});
