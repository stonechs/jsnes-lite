// Compare audible-risk queue events with and without controlled main-thread jank.
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
process.chdir(path.resolve(__dirname,'..'));
const directory=process.argv[2]||'dist/v004-audioworklet';
const output=process.argv[3]||'diagnostics/audio-crackle-v004.json';
const files=process.argv.slice(4).length?process.argv.slice(4):['tests/roms/audio-pulse.nes','upstream/roms/croom/croom.nes','upstream/roms/lj65/lj65.nes'];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const results=[];
 try{for(const file of files){
  const context=await browser.newContext({offline:true});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const Node=window.AudioWorkletNode;
   window.AudioWorkletNode=class extends Node{constructor(...args){super(...args);window.__audioNode=this}};
   const put=CanvasRenderingContext2D.prototype.putImageData;window.__frames=0;
   CanvasRenderingContext2D.prototype.putImageData=function(...args){if(this.canvas.id==='frameCanvas')window.__frames++;return put.apply(this,args)};
   window.__stats=()=>new Promise((resolve,reject)=>{
    const node=window.__audioNode,token=Math.random(),timer=setTimeout(()=>reject(Error('No worklet reply')),3000);
    const listener=e=>{if(e.data[0]===3&&e.data[1]===token){clearTimeout(timer);node.port.removeEventListener('message',listener);resolve({rendered:e.data[2],dropped:e.data[3],underruns:e.data[4],queued:e.data[5],peak:e.data[6],extra:e.data.slice(7),frames:window.__frames,time:performance.now()})}};
    node.port.addEventListener('message',listener);node.port.start();node.port.postMessage([3,token]);
   });
  });
  await page.goto(pathToFileURL(path.resolve(directory,process.env.JSNES_HTML||'jsnes-lite.min.html')).href);
  await page.locator('#b_audio').click();await page.waitForFunction(()=>document.getElementById('audioStatus').textContent==='Audio ready');
  await page.locator('#fileInput').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('loadStatus').textContent.includes('loaded'));
  await page.waitForTimeout(900);await page.keyboard.down('Enter');await page.waitForTimeout(140);await page.keyboard.up('Enter');
  await page.locator('#i_volume').fill('1');await page.locator('#i_volume').dispatchEvent('input');
  if(await page.locator('#audioDebug').count()){
    await page.locator('#audioDebug > summary').click();await page.waitForTimeout(600);
  }
  await page.waitForTimeout(150);
  const baselineStart=await page.evaluate(()=>window.__stats());
  await page.waitForTimeout(Number(process.env.BASELINE_MS)||3000);
  const baselineEnd=await page.evaluate(()=>window.__stats());
  await page.screenshot({path:output.replace(/\.json$/,'.'+results.length+'.png')});
  await page.evaluate(()=>{window.__jank=setInterval(()=>{const start=performance.now();while(performance.now()-start<35){}},100)});
  await page.waitForTimeout(Number(process.env.JANK_MS)||4000);
  await page.evaluate(()=>clearInterval(window.__jank));
  const jankEnd=await page.evaluate(()=>window.__stats());
  await page.waitForTimeout(300);
  const result={directory,artifact:process.env.JSNES_HTML||'jsnes-lite.min.html',file,errors,sampleRate:await page.evaluate(()=>window.__audioNode.context.sampleRate),diagnosticText:await page.evaluate(()=>document.getElementById('audioMetrics')?.textContent||null),baselineStart,baselineEnd,jankEnd,
   baseline:{underruns:baselineEnd.underruns-baselineStart.underruns,dropped:baselineEnd.dropped-baselineStart.dropped,fps:(baselineEnd.frames-baselineStart.frames)*1000/(baselineEnd.time-baselineStart.time)},
   jank:{underruns:jankEnd.underruns-baselineEnd.underruns,dropped:jankEnd.dropped-baselineEnd.dropped,fps:(jankEnd.frames-baselineEnd.frames)*1000/(jankEnd.time-baselineEnd.time)}};
  results.push(result);console.log(JSON.stringify(result));await context.close();
 }}finally{await browser.close()}
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(results,null,2)+'\n');
 if(results.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
