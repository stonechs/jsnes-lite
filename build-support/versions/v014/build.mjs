import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {encode,decode,packSixBit,unpackSixBit,scriptLiteral} from '../../packaging/base122.mjs';
import {trimBase122Loader} from '../../packaging/loader-trim.mjs';

process.chdir(import.meta.dirname);
const version='V014',directory='v014-community-roadroller-o2';
const release=`../../../dist/${directory}`,mode=process.argv[2]||'compile';
const out=release+'/build',src=release+'/source';
if(fs.existsSync(release+'/RELEASED.json'))throw Error('Version finalized; use a new version number');
fs.mkdirSync(out,{recursive:true});
const staging=path.resolve('compiler-staging/V014/main');fs.mkdirSync(staging,{recursive:true});
const header=fs.readFileSync(src+'/ui.html','utf8').trim();
const order=['nes','rom','cpu','memory','mappers','controller','6502','papu','ppu'];
const core=order.map(n=>fs.readFileSync(`${src}/${n}.js`,'utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(src+'/archive.js','utf8')+'\n;\n'+fs.readFileSync(src+'/ui.js','utf8');
const wrap=code=>header+'\n<script>\n'+code.replace(/<\/script/gi,'<\\/script')+'\n</script>\n';
const setup='document.open();document.write('+JSON.stringify(header)+');document.close();\n';
const compiler=path.resolve('../../tools/closure-20261108.0.0/package/compiler.exe');

const fastSandbox={TextDecoder,TextEncoder,performance,WebAssembly,console,setTimeout,clearTimeout};
vm.createContext(fastSandbox);
for(const file of ['js-token.js','wasm.js','deflate.js','index.js'])
  vm.runInContext(fs.readFileSync(`${release}/tools/roadroller-fast/${file}`,'utf8'),fastSandbox,{filename:file});
vm.runInContext('globalThis.FastPacker=Packer',fastSandbox);
const Packer=fastSandbox.FastPacker;

function decodedProgram(code){
 let decoded='';new vm.Script(code).runInNewContext({eval(value){decoded=value;return value;}},{timeout:30000});return decoded;
}

if(mode==='compile'){
 const sandbox=vm.createContext({});vm.runInContext(fs.readFileSync(src+'/6502.js','utf8'),sandbox);
 const tokens=new Set(sandbox.O.flatMap(f=>f.toString().match(/[A-Za-z_$][\w$]*/g)||[]));
 const names=Object.keys(sandbox).filter(n=>tokens.has(n));
 fs.writeFileSync(out+'/closure.externs.js','/** @externs */\nvar '+names.join(',')+';\n');
 let declarations=[];
 for(let attempt=0;attempt<8;attempt++){
  const source=(declarations.length?'var '+declarations.join(',')+';\n':'')+core;
  fs.writeFileSync(out+'/closure.input.js',source);fs.copyFileSync(out+'/closure.input.js',staging+'/input.js');fs.copyFileSync(out+'/closure.externs.js',staging+'/externs.js');
  const args=['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',staging+'/externs.js','--js',staging+'/input.js','--js_output_file',staging+'/min.js'];
  const result=cp.spawnSync(compiler,args,{encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(out+'/closure.compiler.log',(result.stdout||'')+(result.stderr||''));
  if(result.status===0){
   fs.copyFileSync(staging+'/min.js',out+'/closure.min.js');
   fs.writeFileSync(out+'/jsnes-lite.readable.html',wrap(core));
   fs.writeFileSync(out+'/jsnes-lite.readable.js','document.open();document.write('+JSON.stringify(header)+');document.close();\n'+core);
   fs.copyFileSync(out+'/jsnes-lite.readable.html',release+'/jsnes-lite.readable.html');
   fs.copyFileSync(out+'/jsnes-lite.readable.js',release+'/jsnes-lite.readable.js');
   break;
  }
  const added=[...(result.stderr||'').matchAll(/variable (\w+) is undeclared/g)].map(m=>m[1]).filter(n=>!declarations.includes(n));
  if(!added.length||attempt===7)throw Error('Closure failed: '+result.stderr);
  declarations=[...new Set([...declarations,...added])].sort();
 }
 fs.copyFileSync(out+'/closure.min.js',staging+'/pass1.js');
 const pass=cp.spawnSync(compiler,['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',staging+'/externs.js','--js',staging+'/pass1.js','--js_output_file',staging+'/pass2.js'],{encoding:'utf8'});
 if(pass.status!==0)throw Error(pass.stderr);fs.writeFileSync(out+'/closure.pass2.log',pass.stderr||'');
 if(fs.statSync(staging+'/pass2.js').size<fs.statSync(out+'/closure.min.js').size)fs.copyFileSync(staging+'/pass2.js',out+'/closure.min.js');
 fs.writeFileSync(out+'/closure.min.html',wrap(fs.readFileSync(out+'/closure.min.js','utf8')));
}else if(mode==='pack'){
 const initial=JSON.parse(fs.readFileSync(release+'/search/initial-options.json','utf8')).options;
 const input=setup+fs.readFileSync(out+'/closure.min.js','utf8');
 const searchPacker=new Packer([{data:input,type:'js',action:'eval'}],{...initial,exe:0});
 const started=performance.now();
 const optimization=await searchPacker.optimize(2,info=>{
  if(info.bestUpdated)console.log(`O2 ${info.pass}: best=${info.bestSize}`);
 });
 const searchMs=Math.round(performance.now()-started);
 const options={...searchPacker.options};delete options.resourcePool;
 const packer=new Packer([{data:input,type:'js',action:'eval'}],options);
 const decoder=packer.makeDecoder(),roadroller=decoder.firstLine+'\n'+decoder.secondLine;
 const begin=decoder.firstLine.indexOf("[M='")+4,end=decoder.firstLine.lastIndexOf("'");
 if(begin<4||end<begin)throw Error('Unexpected Roadroller first-line format');
 const stream=decoder.firstLine.slice(begin,end),binary=packSixBit(stream),payload=encode(binary);
 if(unpackSixBit(decode(payload),stream.length)!==stream)throw Error('Base122 roundtrip mismatch');
 const second=decoder.secondLine;
 if(!second.includes('M.charCodeAt(d++)&63')||!second.includes('")([],'))throw Error('Unexpected Roadroller binary-reader format');
 const directSecond=second.replace('M.charCodeAt(d++)&63','(M[d*3>>2]<<8|M[(d*3>>2)+1])>>(10-(d++*6&7))&63').replace('")([],' ,'")([data],');
 const loader=decode.toString()+`\n(()=>{const data=decode("__BASE122_PAYLOAD__");(0,eval)(Function("[M"${directSecond}})();`;
 fs.writeFileSync(out+'/roadroller.min.js',roadroller);
 fs.writeFileSync(out+'/roadroller-payload.bin',binary);
 fs.writeFileSync(out+'/base122.loader.readable.js',loader);fs.writeFileSync(staging+'/loader.js',loader);
 const compilation=cp.spawnSync(compiler,['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--isolation_mode','IIFE','--warning_level','QUIET','--js',staging+'/loader.js','--js_output_file',staging+'/loader.min.js'],{encoding:'utf8',maxBuffer:16*1024*1024});
 fs.writeFileSync(out+'/base122.compiler.log',(compilation.stdout||'')+(compilation.stderr||''));if(compilation.status!==0)throw Error(compilation.stderr);
 const compactLoader=trimBase122Loader(fs.readFileSync(staging+'/loader.min.js','utf8'));
 fs.writeFileSync(out+'/base122.loader.min.js',compactLoader);
 const wrapped=compactLoader.replace('"__BASE122_PAYLOAD__"',()=>scriptLiteral(payload));
 fs.writeFileSync(out+'/base122.min.js',wrapped);fs.writeFileSync(out+'/base122.min.html','\ufeff<!doctype html><script>'+wrapped.replace(/<\/script/gi,'<\\/script')+'</script>');
 fs.copyFileSync(out+'/base122.min.js',out+'/jsnes-lite.min.js');fs.copyFileSync(out+'/base122.min.html',out+'/jsnes-lite.min.html');
 fs.copyFileSync(out+'/jsnes-lite.min.js',release+'/jsnes-lite.min.js');fs.copyFileSync(out+'/jsnes-lite.min.html',release+'/jsnes-lite.min.html');
 fs.writeFileSync(release+'/search/winner.json',JSON.stringify({tag:'community-roadroller-fast-o2',score:optimization.bestSize,searchMs,options,sourceOptions:'V014 community Roadroller O2 winner',optimizationLevel:2,exe:0},null,2)+'\n');
 fs.writeFileSync(out+'/roadroller.parameters.json',JSON.stringify({tool:'da0ka/roadroller community fork',commit:'64614b5fc6c7a97d75315c4d8c9ca407e6f233a3',optimizationLevel:2,searchMs,bestSize:optimization.bestSize,options},null,2)+'\n');
 const actual=decodedProgram(wrapped);
 const htmlMatch=actual.match(/document\.write\(("(?:\\.|[^"\\])*")\)/);
 if(!htmlMatch||new vm.Script(`(${htmlMatch[1]})`).runInNewContext()!==header)throw Error('Decoded HTML differs from V014 source');
 const close=actual.indexOf('document.close();',htmlMatch.index);
 if(close<0)throw Error('Decoded page setup is incomplete');
 const actualCore=actual.slice(close+'document.close();'.length).trim();
 const expectedCore=fs.readFileSync(out+'/closure.min.js','utf8');
 for(const [name,code] of [['decoded.js',actualCore],['expected.js',expectedCore]]){
  fs.writeFileSync(staging+'/'+name,code);
  const result=cp.spawnSync(compiler,['--compilation_level','WHITESPACE_ONLY','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--warning_level','QUIET','--js',staging+'/'+name,'--js_output_file',staging+'/'+name+'.normalized.js'],{encoding:'utf8'});
  if(result.status!==0)throw Error('Decoded JavaScript verification failed: '+result.stderr);
 }
 if(!fs.readFileSync(staging+'/decoded.js.normalized.js').equals(fs.readFileSync(staging+'/expected.js.normalized.js')))throw Error('Decoded emulator JavaScript differs from V014 build');
}else if(mode!=='report')throw Error('Use compile, pack or report');

const files={};
for(const name of fs.readdirSync(out).filter(n=>/\.(js|html|bin)$/.test(n))){
 const data=fs.readFileSync(out+'/'+name),gz=zlib.gzipSync(data,{level:9});
 files['build/'+name]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
 if(name==='jsnes-lite.min.html')fs.writeFileSync(out+'/'+name+'.gz',gz);
}
for(const name of ['jsnes-lite.min.html','jsnes-lite.readable.html','jsnes-lite.min.js','jsnes-lite.readable.js']){
 if(!fs.existsSync(release+'/'+name))continue;const data=fs.readFileSync(release+'/'+name),gz=zlib.gzipSync(data,{level:9});
 files[name]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
const sourceFiles=fs.readdirSync(src).filter(n=>/\.(js|html)$/.test(n)).sort().map(name=>({name:'source/'+name,bytes:fs.statSync(src+'/'+name).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(src+'/'+name)).digest('hex')}));
const packageFiles={};
const addPackageFiles=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())addPackageFiles(full);else{const name=path.relative(release,full).replaceAll('\\','/');if(name==='sizes.json'||name==='RELEASED.json')continue;const data=fs.readFileSync(full);packageFiles[name]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}}};
addPackageFiles(release);
const fork=fs.readFileSync(release+'/tools/roadroller-fast/README.md','utf8').trim();
const searchResult=fs.existsSync(release+'/search/winner.json')?JSON.parse(fs.readFileSync(release+'/search/winner.json','utf8')):null;
fs.writeFileSync(release+'/sizes.json',JSON.stringify({version,status:'unfinalized',source:'V013 emulator snapshot plus simplified root mobile UI',tools:{node:process.version,closure:'20261108.0.0',roadroller:'da0ka/roadroller 64614b5fc6c7a97d75315c4d8c9ca407e6f233a3 (exe:0; O2)',lightningcss:'1.33.0 (UI CSS)',base122:'b62945c2733fa4da8792a1071e40a8b326e8dd1b'},optimization:searchResult?{level:2,searchMs:searchResult.searchMs}:null,romIncluded:false,files,sourceFiles,packageFiles,roadrollerForkReadme:fork},null,2)+'\n');
console.log(JSON.stringify(files,null,2));
