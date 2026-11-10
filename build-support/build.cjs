const fs = require('node:fs');
const vm = require('node:vm');
const zlib = require('node:zlib');
const cp = require('node:child_process');
const path = require('node:path');
process.chdir(__dirname);
fs.mkdirSync('../dist',{recursive:true});
const versionNumbers=fs.readdirSync('../dist').map(n=>/^v(\d+)-/.exec(n)).filter(Boolean).map(m=>Number(m[1]));
const nextVersion='v'+String(Math.max(0,...versionNumbers)+1).padStart(3,'0');
const outputDir=`../dist/${nextVersion}-terser`;
fs.mkdirSync(outputDir);
// Use Terser's browser build; source maps are disabled, so no source-map library is needed.
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('tools/package/dist/bundle.min.js', 'utf8'), context);
const index = fs.readFileSync('upstream/index.html', 'utf8');
const files = [...index.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const core = files.map(f => fs.readFileSync(path.join('upstream', f), 'utf8')).join('\n;\n');
const header = `<!doctype html><meta charset=utf-8><title>JSNES lite standalone</title>
<h3>JSNES lite</h3><p>Mapper 0, 2, 30 (30 incomplete). Load a local .nes file.</p>
<canvas id=frameCanvas width=256 height=240></canvas>
<p><input type=file id=fileInput accept=.nes> <label><input type=checkbox id=i_start checked>Auto start</label></p>
<p><button id=b_play>Play</button> <button id=b_pause>Pause</button> <button id=b_frame>Next frame</button> <button id=b_reset>Reset</button></p>
<p>Arrow keys: move; X: A; C: B; Enter: Start; Esc: Select.</p>
<details id=p_debug><summary>VRAM</summary><canvas id=vramCanvas width=512 height=480></canvas></details>
<style>body{font:14px Arial;background:#888}canvas{background:#000;image-rendering:pixelated}</style>`;
const ui = `
debug=1;
fileInput.onchange=()=>{if(!fileInput.files.length)return;const r=new FileReader();r.onload=()=>{NES.init({rom:new Uint8Array(r.result),frame:frameCanvas,vram:vramCanvas});if(i_start.checked)NES.play()};r.readAsArrayBuffer(fileInput.files[0])};
b_play.onclick=()=>{NES.pause();NES.play()};b_pause.onclick=NES.pause;b_frame.onclick=NES.frame;
b_reset.onclick=()=>{frameCanvas.width^=0;vramCanvas.width^=0;NES.reset()};
`;
const wrap = js => header + '\n<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>\n';
(async()=>{
  const min = await context.Terser.minify(core+'\n;\n'+ui,{compress:{passes:2},mangle:true,format:{comments:false},sourceMap:false});
  fs.writeFileSync(outputDir+'/jsnes-lite.readable.js',core+'\n;\n'+ui);
  fs.writeFileSync(outputDir+'/jsnes-lite.min.js',min.code);
  fs.writeFileSync(outputDir+'/jsnes-lite-standalone.html',wrap(core+'\n;\n'+ui));
  fs.writeFileSync(outputDir+'/jsnes-lite-standalone.min.html',wrap(min.code));
  const report={commit:cp.execFileSync('git',['-C','upstream','rev-parse','HEAD'],{encoding:'utf8'}).trim(),terser:'5.51.2',romIncluded:false,sourceBytes:files.reduce((n,f)=>n+fs.statSync(path.join('upstream',f)).size,0),files:{}};
  for(const f of fs.readdirSync(outputDir).filter(f=>f.endsWith('.html'))){
    const data=fs.readFileSync(outputDir+'/'+f),gz=zlib.gzipSync(data,{level:9});
    fs.writeFileSync(outputDir+'/'+f+'.gz',gz);
    report.files[f]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length};
  }
  fs.writeFileSync(outputDir+'/sizes.json',JSON.stringify(report,null,2)+'\n');
  console.log('Output:',outputDir);
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
