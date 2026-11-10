import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {encode,decode,packSixBit,unpackSixBit,scriptLiteral} from '../packaging/base122.mjs';
test('Base122 preserves every byte and partial final groups',()=>{
 let seed=123;
 for(let length=0;length<2049;length++){
  const input=Uint8Array.from({length},(_,i)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return length===256?i:seed>>>24});
  assert.deepEqual(decode(encode(input)),input);
 }
});
test('Roadroller bit packing preserves alphabet and padding lengths',()=>{
 for(let length=0;length<1024;length++){
  const input=Array.from({length},(_,i)=>{const q=i%64;return String.fromCharCode(q===28||q===63?q:q|64)}).join('');
  assert.equal(unpackSixBit(packSixBit(input),length),input);
 }
});
test('Payload substitution preserves dollar sequences and script boundaries',()=>{
 const input="$&$'$`<!--<script></SCRIPT>";
 const output='const result="MARKER"'.replace('"MARKER"',()=>scriptLiteral(input));
 assert.equal(vm.runInNewContext(output+';result'),input);
 assert.doesNotMatch(output,/<(?:\/?script|!--)/i);
});
test('Repackaged binary restores the exact released v005 Roadroller program',()=>{
 const original=fs.readFileSync('../dist/v005-audio-stability/jsnes-lite.min.js','utf8');
 const newline=original.indexOf('\n'),first=original.slice(0,newline),start=first.indexOf("'")+1,end=first.lastIndexOf("'");
 const binary=fs.readFileSync('../dist/v006-base122/roadroller-binary-base122.bin');
 assert.equal(first.slice(0,start)+unpackSixBit(decode(encode(binary)),end-start)+first.slice(end)+original.slice(newline),original);
 for(const name of ['jsnes-lite.readable.html','jsnes-lite.readable.js'])assert.deepEqual(fs.readFileSync('../dist/v006-base122/'+name),fs.readFileSync('../dist/v005-audio-stability/'+name));
});
