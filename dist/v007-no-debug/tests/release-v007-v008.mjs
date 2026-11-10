import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const oldVersions={};
for(const name of fs.readdirSync('dist').filter(n=>/^v00[1-6]-/.test(n))){
 const manifest=JSON.parse(fs.readFileSync('dist/'+name+'/RELEASED.json','utf8'));
 oldVersions[name]=Object.entries(manifest.files).every(([file,info])=>hash(fs.readFileSync('dist/'+name+'/'+file))===info.sha256);
}
for(const out of ['dist/v007-no-debug','dist/v008-r14-ui']){
 if(fs.existsSync(out+'/RELEASED.json'))throw Error('Already finalized');
 const r14=out.includes('r14-ui');
 const browser=JSON.parse(fs.readFileSync(out+'/verification-browser.json','utf8'));
 const player=JSON.parse(fs.readFileSync(out+'/verification-player.json','utf8'));
 const sizes=JSON.parse(fs.readFileSync(out+'/sizes.json','utf8'));
 const unit=fs.readFileSync(out+'/verification-unit.txt','utf8');
 const summary={oldVersionsUnchanged:oldVersions,
  unitPassed:/pass 14/.test(unit)&&/fail 0/.test(unit),
  browserArtifactsValid:browser.length===3&&browser.every(r=>r.errors.length===0&&r.requests.length===0&&r.roms.length===13&&r.sha256===hash(fs.readFileSync(out+'/'+r.file))),
  playerAudioPassed:player.length===2&&player.every(r=>r.peak>.01&&r.mutePeak===0&&r.threaded.elapsed>.02&&r.threaded.peak>.01&&r.contexts===1&&r.nodes===1&&r.errors.length===0&&r.http.length===0&&r.processorErrors.length===0),
  sizeHashesValid:Object.entries(sizes.files).every(([n,i])=>fs.statSync(out+'/'+n).size===i.bytes&&hash(fs.readFileSync(out+'/'+n))===i.sha256),
  diagnosticsRemoved:!/(?:audioDebug|p_debug|debugVRAM|audioMetrics|audio_show_stats|vramCanvas|NES\.vramBuffer)/.test(fs.readFileSync(out+'/jsnes-lite.readable.html','utf8')),
  sourceAPUUnchanged:hash(fs.readFileSync('src/apu-jsnes.js'))===hash(fs.readFileSync('dist/v005-audio-stability/source/apu-jsnes.js')),
  sourceCPUUnchanged:hash(fs.readFileSync('src/6502.js'))===hash(fs.readFileSync('dist/v005-audio-stability/source/6502.js')),
  referencePlayerUnchanged:hash(fs.readFileSync('D:/2026work/jsnes/jsnes-2.1.0-r14/nes-readable.html'))===JSON.parse(fs.readFileSync(out+'/reference.json','utf8')).sha256,
  finalHTMLBytes:fs.statSync(out+'/jsnes-lite.min.html').size,
  knownLimitations:['Original mapper 30 incomplete; MMC3 precise scanline timing test still fails.']};
 if(r14){const archive=fs.readFileSync(out+'/verification-archives.txt','utf8');summary.archivesPassed=/pass 6/.test(archive)&&/fail 0/.test(archive)&&player.every(r=>r.archiveResults.length===5&&r.drop&&r.invalidROMHandled);}
 fs.writeFileSync(out+'/verification-summary.json',JSON.stringify(summary,null,2)+'\n');
 if(Object.values(oldVersions).includes(false)||Object.values(summary).some(v=>v===false))throw Error('Verification failed: '+out);
 console.log(out+' '+JSON.stringify(summary));
}
if(process.argv.includes('--finalize'))for(const out of ['dist/v007-no-debug','dist/v008-r14-ui']){
 const files={};for(const name of fs.readdirSync(out,{recursive:true}).sort()){const p=out+'/'+name;if(fs.statSync(p).isFile())files[name.replaceAll('\\','/')]={bytes:fs.statSync(p).size,sha256:hash(fs.readFileSync(p))};}
 fs.writeFileSync(out+'/RELEASED.json',JSON.stringify({version:out.includes('v007')?'v007':'v008',date:'2026-11-10',status:'finalized-do-not-overwrite',files},null,2)+'\n');
}
