import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {encode,decode,packSixBit,unpackSixBit,scriptLiteral} from './packaging/base122.mjs';
process.chdir(import.meta.dirname);
const version=process.argv[2]||'v006';
if(!/^v\d{3,}$/.test(version))throw Error('Invalid version');
const out=`../dist/${version}-base122`,prior='../dist/v005-audio-stability';
if(fs.existsSync(out+'/RELEASED.json'))throw Error('Version already finalized');
fs.mkdirSync(out,{recursive:true});
const prefix='<!doctype html><meta charset=utf-8><body><script>',suffix='</script>';
const marker='__BASE122_PAYLOAD__';
const decoder=decode.toString();
function optimize(name,source,payload){
 fs.writeFileSync(`${out}/${name}.loader.readable.js`,source);
 const file=`${out}/${name}.loader.min.js`;
 const result=cp.spawnSync(path.resolve('tools/closure-20261108.0.0/package/compiler.exe'),['--compilation_level','ADVANCED','--language_in','ECMASCRIPT_NEXT','--language_out','ECMASCRIPT_2020','--emit_use_strict=false','--rewrite_polyfills=false','--isolation_mode','IIFE','--warning_level','QUIET','--js',`${out}/${name}.loader.readable.js`,'--js_output_file',file],{encoding:'utf8'});
 fs.writeFileSync(`${out}/${name}.compiler.log`,(result.stdout||'')+(result.stderr||''));
 if(result.status!==0)throw Error(result.stderr);
 let code=fs.readFileSync(file,'utf8');
 if(!code.includes('"'+marker+'"'))throw Error('Payload marker not preserved');
 code=code.replace('"'+marker+'"',()=>scriptLiteral(payload));
 fs.writeFileSync(`${out}/${name}.js`,code);
 fs.writeFileSync(`${out}/${name}.html`,prefix+code+suffix);
 return code;
}
const stages={};
function native(name,input,format='deflate-raw',base64=false){
 const compressed=format==='gzip'?zlib.gzipSync(input,{level:9}):zlib.deflateRawSync(input,{level:9});
 const payload=base64?compressed.toString('base64'):encode(compressed);
 if(!base64&&!Buffer.from(decode(payload)).equals(compressed))throw Error('Base122 roundtrip failed');
 fs.writeFileSync(`${out}/${name}.bin`,compressed);
 const read=base64?'Uint8Array.from(atob("'+marker+'"),char=>char.charCodeAt(0))':'decode("'+marker+'")';
 const source=`${base64?'':decoder}\n(async()=>{try{const binary=${read};const stream=new Blob([binary]).stream().pipeThrough(new DecompressionStream(${JSON.stringify(format)}));const html=await new Response(stream).text();document.open();document.write(html);document.close();}catch(error){document.body.textContent='Decode error: '+error.message;}})();`;
 optimize(name,source,payload);
 stages[name]={inputBytes:input.length,binaryBytes:compressed.length,encodedUTF8Bytes:Buffer.byteLength(payload),nativeDecompression:format,encoding:base64?'Base64':'Base122'};
}
native('closure-deflate-base122',fs.readFileSync(prior+'/closure.min.html'));
native('roadroller-deflate-base122',fs.readFileSync(prior+'/jsnes-lite.min.html'));
native('roadroller-gzip-base122',fs.readFileSync(prior+'/jsnes-lite.min.html'),'gzip');
native('roadroller-deflate-base64',fs.readFileSync(prior+'/jsnes-lite.min.html'),'deflate-raw',true);

// Extract only Roadroller's 6-bit stream. Do not encode the textual decoder.
const original=fs.readFileSync(prior+'/jsnes-lite.min.js','utf8');
const newline=original.indexOf('\n'),first=original.slice(0,newline),second=original.slice(newline+1);
if(!first.startsWith('eval(Function("[M=\'')||!first.endsWith('\'"'))throw Error('Unexpected Roadroller format');
const begin=first.indexOf("'")+1,end=first.lastIndexOf("'");
const sixBit=first.slice(begin,end),binary=packSixBit(sixBit);
if(unpackSixBit(binary,sixBit.length)!==sixBit)throw Error('6-bit packing changed payload');
const encoded=encode(binary);
if(!Buffer.from(decode(encoded)).equals(Buffer.from(binary)))throw Error('Packed Base122 mismatch');
fs.writeFileSync(out+'/roadroller-binary-base122.bin',binary);
const code=`${decoder}\n${unpackSixBit.toString()}\n(()=>{const data=decode("${marker}");const stream=unpackSixBit(data,${sixBit.length});(0,eval)(Function("[M='"+stream+"'"${second}})();`;
optimize('roadroller-binary-base122',code,encoded);
stages['roadroller-binary-base122']={originalSixBitCharacters:sixBit.length,binaryBytes:binary.length,encodedUTF8Bytes:Buffer.byteLength(encoded),nativeDecompression:false,encoding:'Base122',reconstructedRoadrollerSHA256:crypto.createHash('sha256').update(first.slice(0,begin)+unpackSixBit(binary,sixBit.length)+first.slice(end)+'\n'+second).digest('hex')};

fs.copyFileSync(prior+'/jsnes-lite.readable.html',out+'/jsnes-lite.readable.html');
fs.copyFileSync(prior+'/jsnes-lite.readable.js',out+'/jsnes-lite.readable.js');
const files={};
for(const name of Object.keys(stages)){
 const bytes=fs.readFileSync(`${out}/${name}.html`);
 files[name+'.html']={bytes:bytes.length,KiB:bytes.length/1024,gzipBytes:zlib.gzipSync(bytes,{level:9}).length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...stages[name]};
}
const winner=Object.keys(files).sort((a,b)=>files[a].bytes-files[b].bytes)[0];
fs.copyFileSync(`${out}/${winner}`,`${out}/jsnes-lite.min.html`);
fs.copyFileSync(`${out}/${winner.replace(/\.html$/,'.js')}`,`${out}/jsnes-lite.min.js`);
fs.writeFileSync(out+'/jsnes-lite.min.html.gz',zlib.gzipSync(fs.readFileSync(out+'/jsnes-lite.min.html'),{level:9}));
const artifacts={};
for(const name of ['jsnes-lite.min.html','jsnes-lite.min.js','jsnes-lite.readable.html','jsnes-lite.readable.js','jsnes-lite.min.html.gz']){
 const data=fs.readFileSync(out+'/'+name);
 artifacts[name]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
const report={version,sourceVersion:'v005',base122Commit:cp.execFileSync('git',['-C','references/base122','rev-parse','HEAD'],{encoding:'utf8'}).trim(),closure:'20261108.0.0',roadroller:'2.1.0 (v005 payload unchanged)',node:process.version,zlib:process.versions.zlib,romIncluded:false,previousHTMLBytes:fs.statSync(prior+'/jsnes-lite.min.html').size,winner,files,artifacts};
fs.writeFileSync(out+'/sizes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
