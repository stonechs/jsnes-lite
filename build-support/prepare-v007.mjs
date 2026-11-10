import fs from 'node:fs';
const edit=(file,change)=>fs.writeFileSync(file,change(fs.readFileSync(file,'utf8')));
edit('../src/nes.js',s=>s.replace(/.*vram(?:Ctx|Data|Buffer).*\r?\n/g,'')
 .replace(/    if\(vram\)\{\s*\}\s*/,'')
 .replace('init: ({rom, save, frame, vram})','init: ({rom, save, frame})')
 .replace(/    \/\/ Controller #1 keys listeners[\s\S]*?\n  \},/,'  },')
 .replace(/    \/\/ Debug drawing[\s\S]*?    var cycles;/,'    var cycles;')
 .replace(/frame, vram, audio/g,'frame, audio').replace('and the 2 canvases','and the display canvas'));
edit('../src/ppu.js',s=>s.replace(/      \/\/ Debug: Render[\s\S]*?if\(NES\.debugVRAM\).*\r?\n/,'')
 .replace(/      if\(NES\.debugVRAM\) drawVramScanline.*\r?\n/,'')
 .replace(/      \/\/ Debug\r?\n      if\(NES\.debugVRAM\)\{[\s\S]*?      \}/,'')
 .replace(/      \/\/ Debug \(VRAM view\)[\s\S]*?      \}/,'')
 .replace(/.*console\.log.*\r?\n/g,'')
 .replace('Render one line of the VRAM visualizer and fill a buffer with all the non-transparent pixels','Generate one background scanline for game rendering and sprite priority')
 .replace('independent of VRAM debug','when rendering is enabled'));
edit('../src/audio-output.js',s=>s.replace(',audio_stats=null','')
 .replace(/        else if\(message\[0\]===3[^\n]*\r?\n/,'')
 .replace(/var audio_show_stats=[\s\S]*$/,''));
edit('../src/audio-worklet.js',s=>s.replace(/    this\.rendered=0;[^\n]*\r?\n    this\.clipped=0;[^\n]*\r?\n/,'')
 .replace('this.count--;this.dropped++;','this.count--;')
 .replace(/      \}else if\(message\[0\]===3\)\{[\s\S]*?(?=      \}else if\(message\[0\]===5)/,'')
 .replace('this.pending=true;this.refills++;','this.pending=true;')
 .replace(/      this\.peak=Math\.max[^\n]*\r?\n      if\(Math\.abs[^\n]*\r?\n/,'')
 .replace('this.count-=length;this.rendered+=length;','this.count-=length;')
 .replace('this.underruns++;',''));
edit('../src/cpu.js',s=>s.replace(/.*console\.log.*\r?\n/g,''));
fs.mkdirSync('interfaces',{recursive:true});
const reference=fs.readFileSync('D:/2026work/jsnes/jsnes-2.1.0-r14/nes-readable.html','utf8');
const html=reference.slice(0,reference.indexOf('<script>')).replace('JSNES 2.1.0 播放器','JSNES lite 播放器').replace('<h1>JSNES 2.1</h1>','<h1>JSNES lite</h1>');
fs.writeFileSync('../interfaces/r14.html',html);
fs.writeFileSync('../src/archive-r14.js','// Archive readers from the local JSNES r14 player; emulator core is separate.\n'+reference.slice(reference.indexOf('  var LZMA ='),reference.indexOf('  var player =')));
// Preserve the reference button behavior, including simultaneous pointer/keyboard input.
let controls=reference.slice(reference.indexOf('  var player ='),reference.indexOf('  var picture ='));
controls=controls.replace('  var emulator;','  var ui_ready=false;').replace('  var audioOutput;','')
 .replace('    setVolume();','    audio_enabled=!muted;audio_set_volume();')
 .replaceAll('if (emulator)','if (ui_ready)').replaceAll('controller_default.','Controller.')
 .replace('emulator.buttonDown','NES.keydown').replace('emulator.buttonUp','NES.keyup')
 .replace('!emulator || !control','!ui_ready || !control');
fs.writeFileSync('../interfaces/r14-controls.js',controls);
