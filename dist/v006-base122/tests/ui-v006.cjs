const fs=require('node:fs');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
process.chdir(require('node:path').resolve(__dirname,'..'));
const out='dist/v006-base122';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results=[];
 try{for(const name of ['jsnes-lite.min.js','jsnes-lite.readable.js']){
  const context=await browser.newContext({offline:true});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><meta charset=utf-8><body>');
  await page.evaluate(()=>{const put=CanvasRenderingContext2D.prototype.putImageData;window.__frames=0;CanvasRenderingContext2D.prototype.putImageData=function(...args){if(this.canvas.id==='frameCanvas')window.__frames++;return put.apply(this,args)}});
  await page.addScriptTag({content:fs.readFileSync(out+'/'+name,'utf8')});
  await page.locator('#fileInput').setInputFiles({name:'invalid.nes',mimeType:'application/octet-stream',buffer:Buffer.alloc(16)});
  await page.waitForFunction(()=>document.getElementById('loadStatus').textContent.includes('Invalid'));
  await page.locator('#fileInput').setInputFiles('upstream/roms/croom/croom.nes');
  await page.waitForFunction(()=>window.__frames>=3);
  await page.locator('#b_pause').click();
  const paused=await page.evaluate(()=>window.__frames);
  await page.waitForTimeout(100);
  const pausedCorrectly=await page.evaluate(n=>window.__frames===n,paused);
  const data=await page.evaluate(()=>{
   for(let i=0;i<120;i++)document.getElementById('b_frame').click();
   window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:13}));
   for(let i=0;i<3;i++)document.getElementById('b_frame').click();
   window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:13}));
   for(let i=0;i<120;i++)document.getElementById('b_frame').click();
   const pixels=document.getElementById('frameCanvas').getContext('2d').getImageData(0,0,256,240).data;
   let hash=2166136261;for(const b of pixels)hash=Math.imul(hash^b,16777619);
   return {hash:hash>>>0,colors:new Set(new Uint32Array(pixels.buffer)).size};
  });
  await page.locator('#b_reset').click();await page.locator('#b_frame').click();
  results.push({file:name,errors,invalidROMHandled:true,autoStart:true,pausedCorrectly,resetAndStep:true,...data});
  await context.close();
 }}finally{await browser.close()}
 fs.writeFileSync(out+'/verification-js.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.errors.length||!r.pausedCorrectly||r.hash!==1863927830))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
