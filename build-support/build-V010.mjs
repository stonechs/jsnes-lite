import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {Packer} from './tools/roadroller-2.1.0/package/index.mjs';
import {encode,decode,packSixBit,unpackSixBit,scriptLiteral} from './packaging/base122.mjs';
process.chdir(import.meta.dirname);
process.env.JSNES_ROADROLLER_PARAMETERS=path.resolve('../dist/V010_极致运行版/search/winner.json');
const version='V010';
const directory=version+'_极致运行版';
if(!/^[vV]\d{3,}(?:_\d{3,})?$/.test(version))throw Error('Invalid version number');
const variant=process.argv[3]||'',src=`../dist/${directory}/source`;
const out=`../dist/${directory}`+(variant?'/comparison/'+variant:''),mode=process.argv[2]||'compile';
if(fs.existsSync(`../dist/${directory}/RELEASED.json`)||fs.existsSync(out+'/RELEASED.json'))throw Error('Version finalized; use a new version number');
fs.mkdirSync(out,{recursive:true});
// The native Closure binary cannot reliably accept Unicode Windows paths.
const staging=path.resolve('compiler-staging',version,variant||'main');fs.mkdirSync(staging,{recursive:true});
const header=fs.readFileSync(src+'/ui.html','utf8').trim();
const order=['nes','rom','cpu','memory','mappers','controller','6502','papu','ppu'];
const core=order.map(n=>fs.readFileSync(`${src}/${n}.js`,'utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(src+'/archive.js','utf8')+'\n;\n'+fs.readFileSync(src+'/ui.js','utf8').replace('var data=await readGameFile(file);',(variant==='full'||variant==='short')?'var data=(await readGameFile(file)).buffer;':'var data=await readGameFile(file);');
const wrap=code=>header+'\n<script>\n'+code.replace(/<\/script/gi,'<\\/script')+'\n</script>\n';
const setup='document.open();document.write('+JSON.stringify(header)+');document.close();\n';
if(mode==='compile'){
 const sandbox=vm.createContext({});
 vm.runInContext(fs.readFileSync(src+'/6502.js','utf8'),sandbox);
 const tokens=new Set(sandbox.O.flatMap(f=>f.toString().match(/[A-Za-z_$][\w$]*/g)||[]));
 const names=Object.keys(sandbox).filter(n=>tokens.has(n));
 fs.writeFileSync(out+'/closure.externs.js','/** @externs */\nvar '+names.join(',')+';\n');
 let declarations=[];
 for(let attempt=0;attempt<8;attempt++){
  const source=(declarations.length?'var '+declarations.join(',')+';\n':'')+core;
  fs.writeFileSync(out+'/closure.input.js',source);
  fs.copyFileSync(out+'/closure.input.js',staging+'/input.js');fs.copyFileSync(out+'/closure.externs.js',staging+'/externs.js');
  const args=['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',staging+'/externs.js','--js',staging+'/input.js','--js_output_file',staging+'/min.js'];
  const result=cp.spawnSync(path.resolve('tools/closure-20261108.0.0/package/compiler.exe'),args,{encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(out+'/closure.compiler.log',(result.stdout||'')+(result.stderr||''));
  if(result.status===0){
   fs.copyFileSync(staging+'/min.js',out+'/closure.min.js');
   fs.writeFileSync(out+'/jsnes-lite.readable.html',wrap(source));
   fs.writeFileSync(out+'/jsnes-lite.readable.js',setup+source);
   fs.writeFileSync(out+'/closure.min.html',wrap(fs.readFileSync(out+'/closure.min.js','utf8')));
   break;
  }
  const added=[...(result.stderr||'').matchAll(/variable (\w+) is undeclared/g)].map(m=>m[1]).filter(n=>!declarations.includes(n));
  if(!added.length||attempt===7)throw Error('Closure failed: '+result.stderr);
  declarations=[...new Set([...declarations,...added])].sort();
 }
 // A second ADVANCED pass exposes further constant/dead-code reductions.
 fs.copyFileSync(out+'/closure.min.js',staging+'/pass1.js');
 const pass=cp.spawnSync(path.resolve('tools/closure-20261108.0.0/package/compiler.exe'),['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',staging+'/externs.js','--js',staging+'/pass1.js','--js_output_file',staging+'/pass2.js'],{encoding:'utf8'});
 if(pass.status!==0)throw Error(pass.stderr);fs.writeFileSync(out+'/closure.pass2.log',pass.stderr||'');
 if(fs.statSync(staging+'/pass2.js').size<fs.statSync(out+'/closure.min.js').size)fs.copyFileSync(staging+'/pass2.js',out+'/closure.min.js');
 fs.writeFileSync(out+'/closure.min.html',wrap(fs.readFileSync(out+'/closure.min.js','utf8')));
}else if(mode==='pack'){
 const saved=process.env.JSNES_ROADROLLER_PARAMETERS?JSON.parse(fs.readFileSync(process.env.JSNES_ROADROLLER_PARAMETERS,'utf8')).options:null;
 if(saved)delete saved.resourcePool;
 const packer=new Packer([{data:setup+fs.readFileSync(out+'/closure.min.js','utf8'),type:'js',action:'eval'}],saved||{allowFreeVars:false});
 const result=saved?{reusedParameters:process.env.JSNES_ROADROLLER_PARAMETERS}:await packer.optimize(2,info=>{if(info.bestUpdated)console.log(info.pass,info.bestSize)});
 const decoder=packer.makeDecoder(),packed=decoder.firstLine+'\n'+decoder.secondLine;
 const prefix='\ufeff<!doctype html><script>',suffix='</script>';
 fs.writeFileSync(out+'/roadroller.min.js',packed);
 fs.writeFileSync(out+'/roadroller.min.html',prefix+packed.replace(/<\/script/gi,'<\\/script')+suffix);
 const first=decoder.firstLine,second=decoder.secondLine,begin=first.indexOf("'")+1,end=first.lastIndexOf("'");
 if(!first.startsWith('eval(Function("[M=\'')||!first.endsWith('\'"'))throw Error('Unexpected Roadroller format');
 const stream=first.slice(begin,end),binary=packSixBit(stream),payload=encode(binary);
 if(unpackSixBit(decode(payload),stream.length)!==stream)throw Error('Binary roundtrip mismatch');
 fs.writeFileSync(out+'/roadroller-payload.bin',binary);
 if(!second.includes('M.charCodeAt(d++)&63')||!second.includes('")([],'))throw Error('Unexpected Roadroller binary-reader format');
 const directSecond=second.replace('M.charCodeAt(d++)&63','(M[d*3>>2]<<8|M[(d*3>>2)+1])>>(10-(d++*6&7))&63').replace('")([],','")([data],');
 const loader=decode.toString()+`\n(()=>{const data=decode("__BASE122_PAYLOAD__");(0,eval)(Function("[M"${directSecond}})();`;
 fs.writeFileSync(out+'/base122.loader.readable.js',loader);fs.writeFileSync(staging+'/loader.js',loader);
 const compilation=cp.spawnSync(path.resolve('tools/closure-20261108.0.0/package/compiler.exe'),['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--isolation_mode','IIFE','--warning_level','QUIET','--js',staging+'/loader.js','--js_output_file',staging+'/loader.min.js'],{encoding:'utf8'});
 fs.writeFileSync(out+'/base122.compiler.log',(compilation.stdout||'')+(compilation.stderr||''));
 if(compilation.status!==0)throw Error(compilation.stderr);
 fs.copyFileSync(staging+'/loader.min.js',out+'/base122.loader.min.js');
 const wrapped=fs.readFileSync(out+'/base122.loader.min.js','utf8').replace('"__BASE122_PAYLOAD__"',()=>scriptLiteral(payload));
 fs.writeFileSync(out+'/base122.min.js',wrapped);fs.writeFileSync(out+'/base122.min.html',prefix+wrapped+suffix);
 const winner='base122';
 fs.copyFileSync(out+'/'+winner+'.min.js',out+'/jsnes-lite.min.js');fs.copyFileSync(out+'/'+winner+'.min.html',out+'/jsnes-lite.min.html');
 fs.writeFileSync(out+'/roadroller.parameters.json',JSON.stringify({options:packer.options,optimization:result},null,2)+'\n');
}else if(mode!=='report')throw Error('Use compile, pack or report');
const files={};
for(const name of fs.readdirSync(out).filter(n=>/\.(js|html)$/.test(n))){
 const data=fs.readFileSync(out+'/'+name),gz=zlib.gzipSync(data,{level:9});
 files[name]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
 if(name==='jsnes-lite.min.html')fs.writeFileSync(out+'/'+name+'.gz',gz);
}
fs.writeFileSync(out+'/sizes.json',JSON.stringify({version,jsnesLiteCommit:'923d45e04483b7655dbdd91773f74de46c38c661',jsnesReferenceCommit:'b8a45d088e922b6abcd87c4eb1b7237919e9d3d2',closure:'20261108.0.0',roadroller:'2.1.0',roadrollerLevel:2,standaloneObjective:true,directBinaryRoadrollerReader:true,closurePasses:2,base122Commit:'b62945c2733fa4da8792a1071e40a8b326e8dd1b',node:process.version,romIncluded:false,files},null,2)+'\n');
console.log(JSON.stringify(files,null,2));
