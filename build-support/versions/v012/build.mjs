import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {Packer} from '../../tools/roadroller-2.1.0/package/index.mjs';
import {encode,decode,packSixBit,unpackSixBit,scriptLiteral} from '../../packaging/base122.mjs';

process.chdir(import.meta.dirname);
const version='V012',directory='v012-oam-address-reset';
process.env.JSNES_ROADROLLER_PARAMETERS=path.resolve(`../../../dist/${directory}/search/winner.json`);
const variant=process.argv[3]||'',src=`../../../dist/${directory}/source`;
const release=`../../../dist/${directory}`,out=release+'/build'+(variant?'/comparison/'+variant:''),mode=process.argv[2]||'compile';
if(fs.existsSync(`../../../dist/${directory}/RELEASED.json`)||fs.existsSync(out+'/RELEASED.json'))throw Error('Version finalized; use a new version number');
fs.mkdirSync(out,{recursive:true});
// Stage compiler inputs under ASCII-only paths for the native Closure binary.
const staging=path.resolve('compiler-staging',version,variant||'main');fs.mkdirSync(staging,{recursive:true});
const header=fs.readFileSync(src+'/ui.html','utf8').trim();
const order=['nes','rom','cpu','memory','mappers','controller','6502','papu','ppu'];
const core=order.map(n=>fs.readFileSync(`${src}/${n}.js`,'utf8')).join('\n;\n')+'\n;\n'+fs.readFileSync(src+'/archive.js','utf8')+'\n;\n'+fs.readFileSync(src+'/ui.js','utf8');
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
  const result=cp.spawnSync(path.resolve('../../tools/closure-20261108.0.0/package/compiler.exe'),args,{encoding:'utf8',maxBuffer:16*1024*1024});
  fs.writeFileSync(out+'/closure.compiler.log',(result.stdout||'')+(result.stderr||''));
  if(result.status===0){
   fs.copyFileSync(staging+'/min.js',out+'/closure.min.js');
   fs.writeFileSync(out+'/jsnes-lite.readable.html',wrap(source));
   fs.writeFileSync(out+'/jsnes-lite.readable.js',setup+source);
   fs.copyFileSync(out+'/jsnes-lite.readable.html',release+'/jsnes-lite.readable.html');
   fs.copyFileSync(out+'/jsnes-lite.readable.js',release+'/jsnes-lite.readable.js');
   fs.writeFileSync(out+'/closure.min.html',wrap(fs.readFileSync(out+'/closure.min.js','utf8')));
   break;
  }
  const added=[...(result.stderr||'').matchAll(/variable (\w+) is undeclared/g)].map(m=>m[1]).filter(n=>!declarations.includes(n));
  if(!added.length||attempt===7)throw Error('Closure failed: '+result.stderr);
  declarations=[...new Set([...declarations,...added])].sort();
 }
 // A second ADVANCED pass exposes further constant/dead-code reductions.
 fs.copyFileSync(out+'/closure.min.js',staging+'/pass1.js');
 const pass=cp.spawnSync(path.resolve('../../tools/closure-20261108.0.0/package/compiler.exe'),['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--warning_level','QUIET','--externs',staging+'/externs.js','--js',staging+'/pass1.js','--js_output_file',staging+'/pass2.js'],{encoding:'utf8'});
 if(pass.status!==0)throw Error(pass.stderr);fs.writeFileSync(out+'/closure.pass2.log',pass.stderr||'');
 if(fs.statSync(staging+'/pass2.js').size<fs.statSync(out+'/closure.min.js').size)fs.copyFileSync(staging+'/pass2.js',out+'/closure.min.js');
 fs.writeFileSync(out+'/closure.min.html',wrap(fs.readFileSync(out+'/closure.min.js','utf8')));
}else if(mode==='pack'){
 const winner=JSON.parse(fs.readFileSync(process.env.JSNES_ROADROLLER_PARAMETERS,'utf8'));
 const saved=winner.options;
 delete saved.resourcePool;
 const packer=new Packer([{data:setup+fs.readFileSync(out+'/closure.min.js','utf8'),type:'js',action:'eval'}],saved);
 const result={parameterFile:'search/winner.json',reusedParametersFrom:'V011',seedTag:winner.tag,seedScore:winner.score};
 const decoder=packer.makeDecoder(),packed=decoder.firstLine+'\n'+decoder.secondLine;
 const prefix='\ufeff<!doctype html><script>',suffix='</script>';
 fs.writeFileSync(out+'/roadroller.min.js',packed);
 fs.writeFileSync(out+'/roadroller.min.html',prefix+packed.replace(/<\/script/gi,'<\\/script')+suffix);
 const first=decoder.firstLine,second=decoder.secondLine,begin=first.indexOf("'")+1,end=first.lastIndexOf("'");
 if(!first.startsWith("eval(Function(\"[M='")||!first.endsWith("'\""))throw Error('Unexpected Roadroller format');
 const stream=first.slice(begin,end),binary=packSixBit(stream),payload=encode(binary);
 if(unpackSixBit(decode(payload),stream.length)!==stream)throw Error('Binary roundtrip mismatch');
 fs.writeFileSync(out+'/roadroller-payload.bin',binary);
 if(!second.includes('M.charCodeAt(d++)&63')||!second.includes('")([],'))throw Error('Unexpected Roadroller binary-reader format');
 const directSecond=second.replace('M.charCodeAt(d++)&63','(M[d*3>>2]<<8|M[(d*3>>2)+1])>>(10-(d++*6&7))&63').replace('")([],' ,'")([data],');
 const loader=decode.toString()+`\n(()=>{const data=decode("__BASE122_PAYLOAD__");(0,eval)(Function("[M"${directSecond}})();`;
 fs.writeFileSync(out+'/base122.loader.readable.js',loader);fs.writeFileSync(staging+'/loader.js',loader);
 const compilation=cp.spawnSync(path.resolve('../../tools/closure-20261108.0.0/package/compiler.exe'),['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--isolation_mode','IIFE','--warning_level','QUIET','--js',staging+'/loader.js','--js_output_file',staging+'/loader.min.js'],{encoding:'utf8'});
 fs.writeFileSync(out+'/base122.compiler.log',(compilation.stdout||'')+(compilation.stderr||''));
 if(compilation.status!==0)throw Error(compilation.stderr);
 fs.copyFileSync(staging+'/loader.min.js',out+'/base122.loader.min.js');
 const wrapped=fs.readFileSync(out+'/base122.loader.min.js','utf8').replace('"__BASE122_PAYLOAD__"',()=>scriptLiteral(payload));
 fs.writeFileSync(out+'/base122.min.js',wrapped);fs.writeFileSync(out+'/base122.min.html',prefix+wrapped+suffix);
 fs.copyFileSync(out+'/base122.min.js',out+'/jsnes-lite.min.js');fs.copyFileSync(out+'/base122.min.html',out+'/jsnes-lite.min.html');
 fs.copyFileSync(out+'/jsnes-lite.min.js',release+'/jsnes-lite.min.js');
 fs.copyFileSync(out+'/jsnes-lite.min.html',release+'/jsnes-lite.min.html');
 fs.writeFileSync(out+'/roadroller.parameters.json',JSON.stringify({options:packer.options,optimization:result},null,2)+'\n');
}else if(mode!=='report')throw Error('Use compile, pack or report');
const files={};
for(const name of fs.readdirSync(out).filter(n=>/\.(js|html)$/.test(n))){
 const data=fs.readFileSync(out+'/'+name),gz=zlib.gzipSync(data,{level:9});
 files['build/'+name]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
 if(name==='jsnes-lite.min.html')fs.writeFileSync(out+'/'+name+'.gz',gz);
}
for(const name of ['jsnes-lite.min.html','jsnes-lite.readable.html','jsnes-lite.min.js','jsnes-lite.readable.js']){
 if(!fs.existsSync(release+'/'+name))continue;
 const data=fs.readFileSync(release+'/'+name),gz=zlib.gzipSync(data,{level:9});
 files[name]={bytes:data.length,KiB:data.length/1024,gzipBytes:gz.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
const sourceFiles=fs.readdirSync(src).filter(n=>/\.(js|html)$/.test(n)).sort().map(name=>({name:'source/'+name,bytes:fs.statSync(src+'/'+name).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(src+'/'+name)).digest('hex')}));
const packageFiles={};
const addPackageFiles=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())addPackageFiles(full);else{const name=path.relative(release,full).replaceAll('\\','/');if(name==='sizes.json'||name==='RELEASED.json')continue;const data=fs.readFileSync(full);packageFiles[name]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}}};
addPackageFiles(release);
fs.writeFileSync(release+'/sizes.json',JSON.stringify({version,status:'unfinalized',source:'repository root src/ and interfaces/',tools:{node:process.version,closure:'20261108.0.0',roadroller:'2.1.0',base122:'b62945c2733fa4da8792a1071e40a8b326e8dd1b'},romIncluded:false,files,sourceFiles,packageFiles},null,2)+'\n');
console.log(JSON.stringify(files,null,2));
