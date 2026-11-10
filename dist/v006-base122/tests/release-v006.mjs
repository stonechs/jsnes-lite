import fs from 'node:fs';
import crypto from 'node:crypto';
const out='dist/v006-base122';
if(fs.existsSync(out+'/RELEASED.json'))throw Error('Version already finalized');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const oldVersions={};
for(const dir of fs.readdirSync('dist').filter(n=>/^v00[1-5]-/.test(n))){
 const manifest=JSON.parse(fs.readFileSync('dist/'+dir+'/RELEASED.json','utf8'));
 oldVersions[dir]=Object.entries(manifest.files).every(([name,info])=>hash(fs.readFileSync('dist/'+dir+'/'+name))===info.sha256);
}
const audio=JSON.parse(fs.readFileSync(out+'/verification-audio-browser.json','utf8'));
const optimized=JSON.parse(fs.readFileSync(out+'/verification-optimized.json','utf8'));
const reference=JSON.parse(fs.readFileSync(out+'/verification-reference.json','utf8'))[0];
const ui=JSON.parse(fs.readFileSync(out+'/verification-js.json','utf8'));
const sizes=JSON.parse(fs.readFileSync(out+'/sizes.json','utf8'));
const field=JSON.parse(fs.readFileSync(out+'/verification-field-combat.json','utf8'));
const summary={oldVersionsUnchanged:oldVersions,
 unitPassed:/pass 4/.test(fs.readFileSync(out+'/verification-unit.txt','utf8'))&&/fail 0/.test(fs.readFileSync(out+'/verification-unit.txt','utf8')),
 originalRoadrollerRestored:sizes.files['roadroller-binary-base122.html'].reconstructedRoadrollerSHA256===hash(fs.readFileSync('dist/v005-audio-stability/jsnes-lite.min.js')),
 candidatesMatchRecordedSizes:Object.entries(sizes.files).every(([n,i])=>fs.statSync(out+'/'+n).size===i.bytes&&hash(fs.readFileSync(out+'/'+n))===i.sha256),
 coreUnchanged:['jsnes-lite.readable.html','jsnes-lite.readable.js'].every(n=>hash(fs.readFileSync(out+'/'+n))===hash(fs.readFileSync('dist/v005-audio-stability/'+n))),
 canvasHashesMatchV005:optimized.every(r=>r.errors.length===0&&r.requests.length===0&&r.roms.every((v,i)=>v.hash===reference.roms[i].hash)&&r.artifactSHA256===hash(fs.readFileSync(out+'/'+r.file))),
 audioWorkletOfflinePassed:audio.every(r=>r.errors.length===0&&r.http.length===0&&r.processorErrors.length===0&&r.initialWorkletStats[6]>.001&&r.threaded.advanced>=512&&r.mutedPeak===0&&r.pausedPeak===0&&r.contexts===1&&r.nodes===1),
 standaloneJSPassed:ui.every(r=>r.errors.length===0&&r.pausedCorrectly&&r.hash===1863927830),
 fieldCombatSmokePassed:field.length===1&&field.every(r=>r.errors.length===0&&r.jankEnd.extra[0]===0&&r.baseline.fps>=55&&r.jank.fps>=55),
 fieldCombatObservations:field.map(r=>({baseline:r.baseline,jank:r.jank,initialDropped:r.baselineStart.dropped})),
 finalHTMLBytes:fs.statSync(out+'/jsnes-lite.min.html').size,
 knownLimitations:['MMC3 precise scanline timing test still fails, unchanged from v005.']};
fs.writeFileSync(out+'/verification-summary.json',JSON.stringify(summary,null,2)+'\n');
if(Object.values(oldVersions).includes(false)||Object.entries(summary).some(([k,v])=>typeof v==='boolean'&&!v))throw Error('Release verification failed');
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--finalize')){
 const files={};for(const n of fs.readdirSync(out,{recursive:true}).sort()){const p=out+'/'+n;if(fs.statSync(p).isFile())files[n.replaceAll('\\','/')]={bytes:fs.statSync(p).size,sha256:hash(fs.readFileSync(p))};}
 fs.writeFileSync(out+'/RELEASED.json',JSON.stringify({version:'v006',date:'2026-11-10',status:'finalized-do-not-overwrite',files},null,2)+'\n');
}
