import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {Packer} from './tools/roadroller-2.1.0/package/index.mjs';
process.chdir(import.meta.dirname);
const version=process.argv[3]||'v004';
if(!/^v\d{3,}$/.test(version))throw Error('Invalid version number');
const out=`../dist/${version}-audioworklet`,mode=process.argv[2]||'compile';
if(fs.existsSync(out+'/RELEASED.json'))throw Error('Version finalized; use a new version number');
fs.mkdirSync(out,{recursive:true});
if(mode==='compile')cp.execFileSync(process.execPath,['prepare-apu.mjs'],{stdio:'inherit'});
const header=fs.readFileSync('../interfaces/ui.html','utf8').trim();
const order=['nes','rom','cpu','memory','mappers','controller','6502','apu-jsnes','audio-output','papu','ppu'];
const workletRaw=fs.readFileSync('src/audio-worklet.js','utf8');
const workletMinPath=out+'/audio-worklet.min.js';
if(mode==='compile'){
 const result=cp.spawnSync(path.resolve('tools/closure-20261108.0.0/package/compiler.exe'),['--compilation_level','SIMPLE','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--js','src/audio-worklet.js','--js_output_file',workletMinPath],{encoding:'utf8'});
 fs.writeFileSync(out+'/worklet.compiler.log',(result.stdout||'')+(result.stderr||''));
 if(result.status!==0)throw Error('Worklet compile failed: '+result.stderr);
 fs.writeFileSync(out+'/audio-worklet.readable.js',workletRaw);
}
const core=order.map(n=>fs.readFileSync(`src/${n}.js`,'utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync('../interfaces/ui.js','utf8');
const runtime='var audio_worklet_source='+JSON.stringify(fs.readFileSync(workletMinPath,'utf8'))+';\n'+core;
const readableWorklet='var audio_worklet_source=String.raw`'+workletRaw+'`;\n';
const wrap=code=>header+'\n<script>\n'+code.replace(/<\/script/gi,'<\\/script')+'\n</script>\n';
const setup='document.body.innerHTML='+JSON.stringify(header.replace(/^<!doctype html>/,''))+';\n';
if(mode==='compile'){
 const sandbox=vm.createContext({});
 vm.runInContext(fs.readFileSync('src/6502.js','utf8'),sandbox);
 const tokens=new Set(sandbox.O.flatMap(f=>f.toString().match(/[A-Za-z_$][\w$]*/g)||[]));
 const names=Object.keys(sandbox).filter(n=>tokens.has(n));
 fs.writeFileSync(out+'/closure.externs.js','/** @externs */\nvar '+names.join(',')+';\n');
 let declarations=[];
 for(let attempt=0;attempt<8;attempt++){
  const source=(declarations.length?'var '+declarations.join(',')+';\n':'')+runtime;
  fs.writeFileSync(out+'/closure.input.js',source);
  const args=['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',out+'/closure.externs.js','--js',out+'/closure.input.js','--js_output_file',out+'/closure.min.js'];
  const result=cp.spawnSync(path.resolve('tools/closure-20261108.0.0/package/compiler.exe'),args,{encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(out+'/closure.compiler.log',(result.stdout||'')+(result.stderr||''));
  if(result.status===0){
   fs.writeFileSync(out+'/jsnes-lite.readable.html',wrap((declarations.length?'var '+declarations.join(',')+';\n':'')+readableWorklet+core));
   fs.writeFileSync(out+'/jsnes-lite.readable.js',setup+(declarations.length?'var '+declarations.join(',')+';\n':'')+readableWorklet+core);
   fs.writeFileSync(out+'/closure.min.html',wrap(fs.readFileSync(out+'/closure.min.js','utf8')));
   break;
  }
  const added=[...(result.stderr||'').matchAll(/variable (\w+) is undeclared/g)].map(m=>m[1]).filter(n=>!declarations.includes(n));
  if(!added.length||attempt===7)throw Error('Closure failed: '+result.stderr);
  declarations=[...new Set([...declarations,...added])].sort();
 }
}else if(mode==='pack'){
 const saved=process.env.JSNES_ROADROLLER_PARAMETERS?JSON.parse(fs.readFileSync(process.env.JSNES_ROADROLLER_PARAMETERS,'utf8')).options:null;
 if(saved)delete saved.resourcePool;
 const packer=new Packer([{data:setup+fs.readFileSync(out+'/closure.min.js','utf8'),type:'js',action:'eval'}],saved||{allowFreeVars:false});
 const result=saved?{reusedParameters:process.env.JSNES_ROADROLLER_PARAMETERS}:await packer.optimize(2,info=>{if(info.bestUpdated)console.log(info.pass,info.bestSize)});
 const decoder=packer.makeDecoder(),packed=decoder.firstLine+'\n'+decoder.secondLine;
 fs.writeFileSync(out+'/jsnes-lite.min.js',packed);
 fs.writeFileSync(out+'/jsnes-lite.min.html','<!doctype html><meta charset=utf-8><body><script>'+packed.replace(/<\/script/gi,'<\\/script')+'</script>');
 fs.writeFileSync(out+'/roadroller.parameters.json',JSON.stringify({options:packer.options,optimization:result},null,2)+'\n');
}else if(mode!=='report')throw Error('Use compile, pack or report');
const files={};
for(const name of fs.readdirSync(out).filter(n=>/\.(js|html)$/.test(n))){
 const data=fs.readFileSync(out+'/'+name),gz=zlib.gzipSync(data,{level:9});
 files[name]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
 if(name==='jsnes-lite.min.html')fs.writeFileSync(out+'/'+name+'.gz',gz);
}
fs.writeFileSync(out+'/sizes.json',JSON.stringify({version,jsnesLiteCommit:cp.execFileSync('git',['-C','upstream','rev-parse','HEAD'],{encoding:'utf8'}).trim(),jsnesReferenceCommit:cp.execFileSync('git',['-C','references/jsnes','rev-parse','HEAD'],{encoding:'utf8'}).trim(),closure:'20261108.0.0',roadroller:'2.1.0',roadrollerLevel:2,romIncluded:false,files},null,2)+'\n');
console.log(JSON.stringify(files,null,2));
