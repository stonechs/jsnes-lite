const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{for(const out of process.argv.slice(2)){
  const results=[];
  for(const file of ['jsnes-lite.readable.html','jsnes-lite.min.html']){
   const context=await browser.newContext({offline:true});const page=await context.newPage();const errors=[],http=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))http.push(r.url())});
   await page.addInitScript(()=>{
    window.__contexts=[];window.__nodes=[];window.__processorErrors=[];window.__frames=0;
    const put=CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData=function(...args){if(this.canvas.width===256)window.__frames++;return put.apply(this,args)};
    const C=window.AudioContext,N=window.AudioWorkletNode;
    window.AudioContext=class extends C{constructor(...args){super(...args);window.__contexts.push(this)}};
    window.AudioWorkletNode=class extends N{constructor(...args){super(...args);window.__nodes.push(this);this.onprocessorerror=()=>window.__processorErrors.push('error')}};
    C.prototype.createScriptProcessor=()=>{throw Error('Legacy audio API')};
   });
   await page.goto(pathToFileURL(path.resolve(out,file)).href);const r14=out.includes('r14-ui'),input=r14?'#rom':'#fileInput';
   // File input itself is an explicit user gesture for the clean interface.
   if(r14){const chooser=page.waitForEvent('filechooser');await page.locator('#choose').click();await(await chooser).setFiles('tests/roms/audio-pulse.nes');}
   else{await page.locator('#b_audio').click();await page.locator(input).setInputFiles('tests/roms/audio-pulse.nes');}
   await page.waitForFunction(()=>window.__nodes.length===1&&window.__frames>=20);
   await page.evaluate(()=>{const analyser=new AnalyserNode(window.__contexts[0],{fftSize:2048});window.__nodes[0].connect(analyser);window.__analyser=analyser;window.__peak=()=>{const a=new Float32Array(2048);analyser.getFloatTimeDomainData(a);return Math.max(...a.map(Math.abs))}});
   await page.waitForTimeout(150);const peak=await page.evaluate(()=>window.__peak());if(peak<.01)throw Error('Missing nonzero audio');
   const threaded=await page.evaluate(()=>{const start=performance.now(),time=window.__contexts[0].currentTime;while(performance.now()-start<55){}return {elapsed:window.__contexts[0].currentTime-time,peak:window.__peak()};});
   if(threaded.elapsed<.02||threaded.peak<.01)throw Error('Audio thread output failed during main-thread block');
   if(r14)await page.locator('#mute').click();else await page.locator('#i_audio').uncheck();await page.waitForTimeout(160);
   const mutePeak=await page.evaluate(()=>window.__peak());if(mutePeak>1e-6)throw Error('Mute failed');
   if(r14)await page.locator('#mute').click();else await page.locator('#i_audio').check();await page.waitForTimeout(150);
   if(await page.evaluate(()=>window.__peak())<.01)throw Error('Unmute failed');
   if(r14){
    const archiveResults=[];
    for(const name of ['stored.zip','deflate.zip','stored.7z','lzma.7z','lzma2.7z']){
     const before=await page.evaluate(()=>window.__frames);await page.locator(input).setInputFiles('tests/archives/'+name);
     await page.waitForFunction(name=>document.querySelector('#status').textContent.includes(name+' › test.nes'),name);
     await page.waitForFunction(before=>window.__frames>before+4,before);archiveResults.push(name);
    }
    const bytes=fs.readFileSync('tests/roms/audio-pulse.nes').toString('base64');
    await page.evaluate(data=>{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],'dropped.nes'));window.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,cancelable:true}));},bytes);
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='dropped.nes');
    await page.locator(input).setInputFiles({name:'bad.nes',mimeType:'application/octet-stream',buffer:Buffer.alloc(16)});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('加载失败'));
    results.push({file,peak,mutePeak,threaded,archiveResults,drop:true,invalidROMHandled:true});
   }else{
    await page.locator('#b_pause').click();await page.waitForTimeout(120);if(await page.evaluate(()=>window.__peak())>1e-6)throw Error('Pause did not mute');
    await page.locator('#b_reset').click();await page.waitForTimeout(200);if(await page.evaluate(()=>window.__peak())<.01)throw Error('Reset/resume lost sound');
    results.push({file,peak,mutePeak,threaded,pauseReset:true});
   }
   const state=await page.evaluate(()=>({contexts:window.__contexts.length,nodes:window.__nodes.length,processorErrors:window.__processorErrors}));
   if(state.contexts!==1||state.nodes!==1||errors.length||http.length||state.processorErrors.length)throw Error(JSON.stringify({state,errors,http}));
   Object.assign(results.at(-1),{...state,errors,http});console.log(out+' '+file+' audio/player passed');await context.close();
  }
  fs.writeFileSync(out+'/verification-player.json',JSON.stringify(results,null,2)+'\n');
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
