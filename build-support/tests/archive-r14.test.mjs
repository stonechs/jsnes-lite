import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({TextDecoder,Blob,DecompressionStream,Uint8Array,Uint32Array,DataView});
vm.runInContext(fs.readFileSync('src/archive-r14.js','utf8'),context);
for(const name of ['stored.zip','deflate.zip','stored.7z','lzma.7z','lzma2.7z'])test('r14 archive reader: '+name,async()=>{
 const data=fs.readFileSync('tests/archives/'+name);
 const result=await context.readGameFile({name,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.length)});
 assert.deepEqual(Buffer.from(result.buffer),fs.readFileSync('tests/roms/audio-pulse.nes'));
 assert.equal(result.name,name+' › test.nes');
});
test('r14 archive reader rejects corrupted CRC and incomplete archives',async()=>{
 const data=fs.readFileSync('tests/archives/lzma2.7z');data[32]^=1;
 await assert.rejects(()=>context.readGameFile({name:'corrupt.7z',arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.length)}),/CRC/);
 const broken=new Uint8Array([80,75,3,4]);
 await assert.rejects(()=>context.readGameFile({name:'broken.zip',arrayBuffer:async()=>broken.buffer}));
});
