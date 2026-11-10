const fs=require('node:fs');
const outputDir=process.argv[2]||'../dist/v001-terser';
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results=[];
 try{
  for(const name of ['jsnes-lite-standalone.html','jsnes-lite-standalone.min.html']){
   const context=await browser.newContext({offline:true});
   const page=await context.newPage();const errors=[],network=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
   await page.goto(pathToFileURL(require('node:path').resolve(outputDir,name)).href);
   await page.locator('#i_start').uncheck();
   await page.locator('#fileInput').setInputFiles('upstream/roms/croom/croom.nes');
   await page.waitForFunction(()=>NES.controllers!==null);
   const data=await page.evaluate(()=>{
    const snapshots=[];
    for(let i=0;i<120;i++){NES.frame();if(i===59||i===119){let h=2166136261;for(const b of NES.frameData.data)h=Math.imul(h^b,16777619);snapshots.push(h>>>0)}}
    NES.keydown(1,Controller.BUTTON_START);NES.frame();NES.keyup(1,Controller.BUTTON_START);
    return {mapper:NES.mapper,frames:121,hashes:snapshots,colors:new Set(NES.frameBuffer32).size,audioContexts:[a1,a2,a3,a4,a5].map(a=>a.state),externalScripts:document.querySelectorAll('script[src]').length};
   });
   await page.screenshot({path:outputDir+'/'+name+'.png'});
   results.push({file:name,errors,network,...data});
   await context.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync(outputDir+'/verification.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.errors.length||r.network.length||r.colors<2)||JSON.stringify(results[0].hashes)!==JSON.stringify(results[1].hashes))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
