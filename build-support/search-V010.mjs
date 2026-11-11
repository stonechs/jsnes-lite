import fs from 'node:fs';import path from 'node:path';import {Packer,defaultSparseSelectors} from './packaging/roadroller-standalone.mjs';
const out=path.resolve(import.meta.dirname,'../dist/v010-extreme-runtime'),search=out+'/search';fs.mkdirSync(search,{recursive:true});
const header=fs.readFileSync(out+'/source/ui.html','utf8').trim(),input='document.open();document.write('+JSON.stringify(header)+');document.close();\n'+fs.readFileSync(out+'/closure.min.js','utf8');
const clean=o=>Object.fromEntries(Object.entries(o).filter(([k])=>k!=='resourcePool'));
const seed=clean(JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../dist/v010-extreme-runtime/search/winner.json'))).options);
const history=[],candidates=[];let globalBest=Infinity;
async function run(tag,options,seconds){let best={},score=Infinity,evaluations=0;const start=Date.now(),packer=new Packer([{data:input,type:'js',action:'eval'}],options);try{await packer.optimize(2,info=>{evaluations++;if(info.bestUpdated){best={...info.best};score=info.bestSize;const candidate={tag,score,options:clean({...options,...best})};candidates.push(candidate);if(score<globalBest){globalBest=score;fs.writeFileSync(search+'/best-score.json',JSON.stringify(candidate,null,2));console.log(JSON.stringify({tag,evaluations,score,seconds:Math.round((Date.now()-start)/1000)}));}}if(Date.now()-start>seconds*1000)return false;});}catch(e){if(e.message!=='search aborted')throw e;}history.push({tag,evaluations,score,elapsedMs:Date.now()-start});fs.writeFileSync(search+'/history.json',JSON.stringify(history,null,2));fs.writeFileSync(search+'/candidates.json',JSON.stringify(candidates.sort((a,b)=>a.score-b.score),null,2));console.log('completed '+tag);}
await run('warm',seed,100);
const best=candidates.reduce((a,b)=>a.score<b.score?a:b);await run('refine',best.options,100);
console.log(JSON.stringify({done:true,bestScore:globalBest,searches:history.length,evaluations:history.reduce((n,r)=>n+r.evaluations,0)}));
