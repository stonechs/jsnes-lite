const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const cases=[...[1,2,3,4].map(n=>({name:'mapper'+n,rom:`tests/roms/mapper${n}-smoke.nes`,frames:3})),
 ...['croom/croom.nes','lj65/lj65.nes','mapper30/H.nes'].map(r=>({name:r.split('/')[0],rom:'upstream/roms/'+r,frames:120})),
 ...['1-clocking','2-details','3-A12_clocking','4-scanline_timing','5-MMC3'].map(n=>({name:n,rom:`references/nes-test-roms/mmc3_test_2/rom_singles/${n}.nes`,frames:360})),
 {name:'MMC1_A12',rom:'references/nes-test-roms/MMC1_A12/mmc1_a12.nes',frames:120}];
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{for(const out of process.argv.slice(2)){
  const baseline=JSON.parse(fs.readFileSync('../dist/v005-audio-stability/verification-reference.json','utf8'))[0];const results=[];
  const files=process.env.ONLY_CLOSURE?['closure.min.html']:['jsnes-lite.readable.html','closure.min.html','jsnes-lite.min.html'];
  for(const file of files){
   const context=await browser.newContext({offline:true});const page=await context.newPage();const errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
   await page.addInitScript(()=>{
    window.AudioContext=undefined;window.__frames=0;window.__limit=1;
    const timer=window.setTimeout;window.setTimeout=(fn,delay,...args)=>window.__frames>=window.__limit?999999:timer(fn,0,...args);
    const put=CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData=function(...args){if(this.canvas.width===256)window.__frames++;return put.apply(this,args)};
   });
   await page.goto(pathToFileURL(path.resolve(out,file)).href);const r14=out.includes('r14-ui'),romInput=r14?'#rom':'#fileInput';
   const roms=[];
   for(const item of cases){
    await page.evaluate(frames=>{window.__frames=0;window.__limit=frames},item.frames);
    await page.locator(romInput).setInputFiles(item.rom);
    await page.waitForFunction(n=>window.__frames===n,item.frames);
    const hash=await page.evaluate(()=>{const pixels=document.querySelector('canvas').getContext('2d').getImageData(0,0,256,240).data;let hash=2166136261;for(const b of pixels)hash=Math.imul(hash^b,16777619);return hash>>>0;});
    if(hash!==baseline.roms.find(r=>r.name===item.name).hash)throw Error(file+' '+item.name+' hash mismatch: '+hash);
    roms.push({name:item.name,frames:item.frames,hash});
   }
   if(r14){
    if(await page.locator('#pads button').count()!==8)throw Error('Missing touch controls');
    for(const [code,index] of [['ArrowUp',4],['ArrowDown',5],['ArrowLeft',6],['ArrowRight',7],['Space',2],['Enter',3],['KeyZ',1],['KeyX',0]]){
     await page.keyboard.down(code);const label=await page.locator('#pads button[aria-pressed=true]').count();if(label!==1)throw Error('Keyboard button not pressed: '+code);
     if(file==='jsnes-lite.readable.html'&&await page.evaluate(i=>NES.controllers[1].state[i],index)!==65)throw Error('Controller mapping mismatch: '+code);
     await page.keyboard.up(code);if(await page.locator('#pads button[aria-pressed=true]').count())throw Error('Stuck key');
    }
    const a=page.locator('#pads button').last();await page.keyboard.down('KeyX');await a.click();
    if(await a.getAttribute('aria-pressed')!=='true')throw Error('Pointer release cleared keyboard source');await page.keyboard.up('KeyX');
    await page.keyboard.down('KeyZ');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));if(await page.locator('#pads button[aria-pressed=true]').count())throw Error('Blur left stuck input');await page.keyboard.up('KeyZ');
    await page.locator('#mute').click();if(await page.locator('#mute').getAttribute('aria-pressed')!=='true')throw Error('Mute toggle');
    await page.keyboard.press('KeyF');await page.waitForFunction(()=>!!document.fullscreenElement);await page.keyboard.press('KeyF');await page.waitForFunction(()=>!document.fullscreenElement);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/'+file+'.mobile.png'});await page.setViewportSize({width:1000,height:900});
   }
   await page.screenshot({path:out+'/'+file+'.desktop.png'});
   if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
   results.push({file,roms,errors,requests,controls:r14?'keyboard, pointer, source overlap, blur, mute, fullscreen':'basic',sha256:require('crypto').createHash('sha256').update(fs.readFileSync(out+'/'+file)).digest('hex')});await context.close();console.log(out+' '+file+' passed');
  }
  fs.writeFileSync(out+'/verification-browser'+(process.env.ONLY_CLOSURE?'-closure':'')+'.json',JSON.stringify(results,null,2)+'\n');
 }}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
