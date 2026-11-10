const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
process.chdir(__dirname);
const out=process.env.JSNES_OUTPUT_DIR||'../dist/v002-closure-roadroller';
const filenames=process.argv.slice(2);
const targets=filenames.length?filenames:['../dist/v001-terser/jsnes-lite-standalone.html',...['simple.readable.html','simple.min.html','advanced.readable.html','advanced.min.html'].map(n=>out+'/'+n)];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results=[];
 try{
  for(const filename of targets){
   const context=await browser.newContext({offline:true});const page=await context.newPage();
   const errors=[],network=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
   await page.addInitScript(()=>{const read=FileReader.prototype.readAsArrayBuffer;FileReader.prototype.readAsArrayBuffer=function(...args){this.addEventListener('loadend',()=>window.__romLoaded=(window.__romLoaded||0)+1);return read.apply(this,args)}});
   await page.goto(pathToFileURL(path.resolve(filename)).href);
   await page.waitForFunction(()=>typeof document.getElementById('b_frame').onclick==='function',{},{timeout:60000});
   await page.locator('#i_start').uncheck();
   const roms=[];
   for(const rom of ['croom/croom.nes','lj65/lj65.nes','mapper30/H.nes']){
    const before=await page.evaluate(()=>window.__romLoaded||0);
    await page.locator('#fileInput').setInputFiles('upstream/roms/'+rom);
    await page.waitForFunction(n=>window.__romLoaded>n,before);
    const data=await page.evaluate(()=>{
     const hashes=[];const canvas=document.getElementById('frameCanvas');
     const hash=()=>{let h=2166136261;for(const b of canvas.getContext('2d').getImageData(0,0,256,240).data)h=Math.imul(h^b,16777619);return h>>>0};
     for(let i=0;i<120;i++){document.getElementById('b_frame').click();if(i===59||i===119)hashes.push(hash())}
     window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:13,which:13,key:'Enter'}));
     for(let i=0;i<3;i++)document.getElementById('b_frame').click();
     window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:13,which:13,key:'Enter'}));
     for(let i=0;i<120;i++)document.getElementById('b_frame').click();
     hashes.push(hash());
     const pixels=canvas.getContext('2d').getImageData(0,0,256,240).data;
     const colors=new Set(new Uint32Array(pixels.buffer)).size;
     return {hashes,colors,externalScripts:document.querySelectorAll('script[src]').length};
    });
    roms.push({rom,...data});
   }
   await page.screenshot({path:out+'/'+path.basename(filename)+'.png'});
   results.push({file:filename,errors,network,roms});console.log(JSON.stringify(results.at(-1)));
   await context.close();
  }
 }finally{await browser.close()}
 const dest=out+'/'+(filenames.length?'verification-final.json':'verification-closure.json');
 fs.writeFileSync(dest,JSON.stringify(results,null,2)+'\n');
 const reference=filenames.length?JSON.parse(fs.readFileSync(out+'/baseline-reference.json','utf8')).roms:results[0].roms;
 if(results.some(r=>r.errors.length||r.network.length||JSON.stringify(r.roms)!==JSON.stringify(reference)))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
