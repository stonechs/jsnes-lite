import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {Packer} from './tools/roadroller-2.1.0/package/index.mjs';

process.chdir(import.meta.dirname);
const version=process.argv[3]||'v002';
if(!/^v\d{3,}$/.test(version))throw Error('Version must look like v002 or v003');
const out=`../dist/${version}-closure-roadroller`;
if(fs.existsSync(`${out}/RELEASED.json`))throw Error('This version is finalized. Use a new version number.');
fs.mkdirSync(out,{recursive:true});
const compiler=path.resolve('tools/closure-20261108.0.0/package/compiler.exe');
const prior=fs.readFileSync('../dist/v001-terser/jsnes-lite-standalone.html','utf8');
const start=prior.indexOf('<script>\n'), end=prior.lastIndexOf('\n</script>');
const header=prior.slice(0,start).trim();
const original=prior.slice(start+9,end);
// Make DOM bindings explicit so Closure can rename internal identifiers safely.
const ids=['frameCanvas','vramCanvas','fileInput','i_start','b_play','b_pause','b_frame','b_reset'];
const bindings=ids.map(id=>`var ${id}=document.getElementById(${JSON.stringify(id)});`).join('\n');
let core=original.replace('NES[e.type](', '(e.type === "keydown" ? NES.keydown : NES.keyup)(');
if(core===original)throw Error('Expected keyboard dispatch was not found');
core=core.replace('onkeydown = onkeyup = e => {','window.onkeydown = window.onkeyup = e => {');
// The original CPU builds opcode functions from strings. Materialize the exact
// functions at build time for ADVANCED, which cannot rename identifiers in strings.
const cpu=fs.readFileSync('upstream/src/6502.js','utf8');
const sandbox=vm.createContext({});
vm.runInContext(cpu,sandbox);
const table='O = [\n'+sandbox.O.map(f=>f.toString()).join(',\n')+'\n];';
const staticCPU=cpu.slice(0,cpu.indexOf('O = [...Array(255)]'))+table+'\n'+cpu.slice(cpu.indexOf('// Emulation'));
const advancedCore=core.replace(cpu,staticCPU);
if(advancedCore===core)throw Error('CPU expansion did not match source');
const wrap=js=>header+'\n<script>\n'+js.replace(/<\/script/gi,'<\\/script')+'\n</script>\n';
function compile(kind,source,externNames=[]){
 const filename=`${out}/${kind}.readable.js`, log=`${out}/${kind}.compiler.log`;
 const externPath=`${out}/${kind}.externs.js`;
 if(externNames.length)fs.writeFileSync(externPath,'/** @externs */\nvar '+externNames.join(',')+';\n');
 let declarations=[];
 for(let attempt=0;attempt<5;attempt++){
  fs.writeFileSync(filename,(declarations.length?'var '+declarations.join(',')+';\n':'')+bindings+'\n'+source);
  const args=['--compilation_level',kind.startsWith('advanced')?'ADVANCED':'SIMPLE','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--warning_level','QUIET','--js',filename,'--js_output_file',`${out}/${kind}.min.js`];
  if(kind.endsWith('-native'))args.push('--rewrite_polyfills=false');
  if(externNames.length)args.push('--externs',externPath);
  const result=cp.spawnSync(compiler,args,{encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(log,(result.stdout||'')+(result.stderr||''));
  if(result.status===0){fs.writeFileSync(`${out}/${kind}.readable.html`,wrap(fs.readFileSync(filename,'utf8')));fs.writeFileSync(`${out}/${kind}.min.html`,wrap(fs.readFileSync(`${out}/${kind}.min.js`,'utf8')));return}
  const names=[...(result.stderr||'').matchAll(/variable (\w+) is undeclared/g)].map(m=>m[1]);
  const added=names.filter(n=>!declarations.includes(n));
  if(!added.length)throw Error(`Closure failed; see ${log}\n`+result.stderr);
  declarations=[...new Set([...declarations,...added])].sort();
 }
 throw Error('Unable to declare all implicit globals');
}
const mode=process.argv[2]||'compile';
if(mode==='compile'){
 compile('simple',core);compile('advanced',advancedCore);
 console.log('Closure candidates generated. Validate before packing.');
}else if(mode==='dynamic'||mode==='dynamic-native'){
 const tokens=new Set(sandbox.O.flatMap(f=>f.toString().match(/[A-Za-z_$][\w$]*/g)||[]));
 const protectedNames=Object.keys(sandbox).filter(n=>tokens.has(n));
 compile(mode==='dynamic-native'?'advanced-dynamic-native':'advanced-dynamic',core,protectedNames);
 console.log('Dynamic CPU candidate generated; protected CPU symbols:',protectedNames.join(','));
}else if(mode==='pack'||mode==='pack-page'){
 for(const kind of (process.argv[4]?[process.argv[4]]:['simple','advanced'])){
  console.log(`Roadroller ${kind} optimization level 2...`);
  const pageMode=mode==='pack-page',stem=kind+(pageMode?'.page':'');
  const setup=pageMode?'document.body.innerHTML='+JSON.stringify(header.replace(/^<!doctype html>/,''))+';\n':'';
  const saved=process.env.JSNES_ROADROLLER_PARAMETERS?JSON.parse(fs.readFileSync(process.env.JSNES_ROADROLLER_PARAMETERS,'utf8')).options:null;
  if(saved)delete saved.resourcePool;
  const packer=new Packer([{data:setup+fs.readFileSync(`${out}/${kind}.min.js`,'utf8'),type:'js',action:'eval'}],saved||{allowFreeVars:false});
  const result=saved?{reusedParameters:process.env.JSNES_ROADROLLER_PARAMETERS}:await packer.optimize(2,info=>{if(info.bestUpdated)console.log(`${kind}: ${info.pass} best=${info.bestSize}`)});
  const decoder=packer.makeDecoder();
  const packed=decoder.firstLine+'\n'+decoder.secondLine;
  fs.writeFileSync(`${out}/${stem}.roadroller.js`,packed);
  fs.writeFileSync(`${out}/${stem}.roadroller.html`,pageMode?'<!doctype html><meta charset=utf-8><body><script>'+packed.replace(/<\/script/gi,'<\\/script')+'</script>':wrap(packed));
  fs.writeFileSync(`${out}/${stem}.roadroller.parameters.json`,JSON.stringify({options:packer.options,optimization:result},null,2)+'\n');
 }
}else if(mode!=='report')throw Error('Use compile, dynamic, pack or report');
const files={};
function describe(data){return {bytes:data.length,gzipBytes:zlib.gzipSync(data,{level:9}).length,sha256:crypto.createHash('sha256').update(data).digest('hex')}}
for(const name of fs.readdirSync(out).filter(n=>/\.(html|js)$/.test(n))){
 const data=fs.readFileSync(`${out}/${name}`);
 files[name]=describe(data);
}
const candidates=Object.keys(files).filter(n=>/^(simple|advanced|advanced-dynamic(?:-native)?)(?:\.page)?\.(min|roadroller)\.html$/.test(n)).sort((a,b)=>files[a].bytes-files[b].bytes);
if(candidates.length){
 const winner=candidates[0],kind=winner.split('.')[0];
 fs.copyFileSync(`${out}/${winner}`,`${out}/jsnes-lite.min.html`);
 fs.copyFileSync(`${out}/${kind}.readable.html`,`${out}/jsnes-lite.readable.html`);
 const readableSetup=winner.includes('.page.')?'// Create the interface before initializing the emulator.\ndocument.body.innerHTML='+JSON.stringify(header.replace(/^<!doctype html>/,''))+';\n\n':'';
 fs.writeFileSync(`${out}/jsnes-lite.readable.js`,readableSetup+fs.readFileSync(`${out}/${kind}.readable.js`,'utf8'));
 fs.copyFileSync(`${out}/${winner.replace(/\.html$/,'.js')}`,`${out}/jsnes-lite.min.js`);
 for(const name of ['jsnes-lite.min.html','jsnes-lite.readable.html','jsnes-lite.readable.js','jsnes-lite.min.js'])files[name]=describe(fs.readFileSync(`${out}/${name}`));
 fs.writeFileSync(`${out}/jsnes-lite.min.html.gz`,zlib.gzipSync(fs.readFileSync(`${out}/jsnes-lite.min.html`),{level:9}));
 fs.writeFileSync(`${out}/sizes.json`,JSON.stringify({upstreamCommit:'923d45e04483b7655dbdd91773f74de46c38c661',closure:'20261108.0.0',roadroller:'2.1.0',roadrollerLevel:2,romIncluded:false,winner,files},null,2)+'\n');
 console.log('Smallest HTML:',winner,files[winner]);
}
