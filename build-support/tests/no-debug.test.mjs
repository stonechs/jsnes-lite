import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
function processor(file){
 let Type;const sandbox=vm.createContext({sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>this.messages.push(m)};this.messages=[];}},registerProcessor:(name,value)=>{Type=value;}});
 vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);return new Type();
}
test('Removing audio diagnostics preserves samples, fades, buffering and refill messages',()=>{
 const previous=processor('../dist/v005-audio-stability/source/audio-worklet.js'),current=processor('src/audio-worklet.js');
 const send=message=>{for(const p of [previous,current])p.port.onmessage({data:message});};
 const render=()=>{const outputs=[];for(const p of [previous,current]){const output=[new Float32Array(128),new Float32Array(128)];p.process([], [output]);outputs.push(output);}assert.deepEqual(outputs[0],outputs[1]);assert.equal(JSON.stringify(previous.messages),JSON.stringify(current.messages));};
 send([1,true,1]);render();
 const samples=Float32Array.from({length:10000},(_,i)=>Math.sin(i*.04)*.8);
 send([0,samples,samples,1]);for(let i=0;i<80;i++)render();
 send([5,1]);send([2,0]);send([0,samples,samples,1]);render();
 send([1,false,2]);render();send([1,true,3]);send([0,samples,samples,1]);render();
 send([0,samples,samples,3]);send([2,1]);render();
 assert.equal('rendered' in current,false);assert.equal('underruns' in current,false);assert.equal('peak' in current,false);
});
test('Executable sources and both interfaces contain no debug UI or telemetry protocol',()=>{
 const source=['nes','ppu','audio-output','audio-worklet'].map(n=>fs.readFileSync('src/'+n+'.js','utf8')).join('\n');
 assert.doesNotMatch(source,/debugVRAM|vramCtx|vramData|vramBuffer|audio_show_stats|audio_stats|audioMetrics|this\.(rendered|dropped|underruns|clipped|peak|refills)/);
 for(const name of ['clean','r14'])assert.doesNotMatch(fs.readFileSync('../interfaces/'+name+'.html','utf8'),/audioDebug|p_debug|vramCanvas|b_frame|diagnostic/i);
});
