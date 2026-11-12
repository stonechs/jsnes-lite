// Local browser reproduction. Commercial ROMs and captures stay outside dist/.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '../../..');
const romPath = process.env.SIDE_POCKET_ROM || path.join(root, 'roms/commercial/0007.Side Pocket  (U)桌球.nes');
const output = path.join(root, 'roms/commercial/side-pocket-v012-diagnostics');
const frames = Number(process.env.SIDE_POCKET_FRAMES || 2400);
const rom = fs.readFileSync(romPath);
fs.mkdirSync(output, {recursive:true});

(async()=>{
  const browser = await chromium.launch({executablePath:process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const results = {rom:{bytes:rom.length,sha256:crypto.createHash('sha256').update(rom).digest('hex')},frames};
  try {
    for(const [name,version] of [['v011','v011-mapper30'],['v012','v012-oam-address-reset']]){
      const page=await browser.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.setContent(fs.readFileSync(path.join(root,'dist',version,'jsnes-lite.readable.html'),'utf8'));
      const state=await page.evaluate(({bytes,frames})=>{
        NES.init({rom:new Uint8Array(bytes),frame:document.querySelector('canvas')});
        for(let i=0;i<frames;i++)NES.frame();
        return {pc:PC,mask:[PPUMASK_b,PPUMASK_s],oamLength:OAM.length,nmiEnabled:PPUCTRL_V};
      },{bytes:[...rom],frames});
      const png=await page.locator('canvas').screenshot({path:path.join(output,name+'-readable.png')});
      results[name]={...state,errors,pngSha256:crypto.createHash('sha256').update(png).digest('hex')};
      if(name==='v012'){
        const afterStart=await page.evaluate(()=>{
          NES.keydown(3);for(let i=0;i<2;i++)NES.frame();
          NES.keyup(3);for(let i=0;i<600;i++)NES.frame();
          return {pc:PC,mask:[PPUMASK_b,PPUMASK_s],oamLength:OAM.length};
        });
        const startedPng=await page.locator('canvas').screenshot({path:path.join(output,'v012-after-start.png')});
        results.v012AfterStart={...afterStart,pngSha256:crypto.createHash('sha256').update(startedPng).digest('hex')};
      }
      await page.close();
    }
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(fs.readFileSync(path.join(root,'dist/v012-oam-address-reset/jsnes-lite.min.html'),'utf8'));
    await page.locator('#rom').setInputFiles(romPath);
    await page.waitForFunction(name=>document.querySelector('#status')?.textContent===name,path.basename(romPath),{timeout:30000});
    await page.waitForTimeout(6000);
    const pixelCount=await page.locator('canvas').evaluate(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let count=0;for(let i=0;i<data.length;i+=4)if(data[i]||data[i+1]||data[i+2])count++;
      return count;
    });
    const png=await page.locator('canvas').screenshot({path:path.join(output,'v012-min-ui.png')});
    results.v012Min={status:await page.locator('#status').textContent(),nonBlackPixels:pixelCount,errors,pngSha256:crypto.createHash('sha256').update(png).digest('hex')};
    await page.close();
  }finally{await browser.close()}
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
  if(results.v011.mask.some(Boolean)||!results.v012.mask.every(Boolean)||results.v012.errors.length||!results.v012Min.nonBlackPixels||results.v012Min.errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
