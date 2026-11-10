const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
process.chdir(path.resolve(__dirname,'..'));
const local='D:/2026work/jsnes/jsnes-2.1.0-r14/nes-readable.html';
const html=fs.readFileSync(local,'utf8');
const anchor=html.lastIndexOf('})();');
if(anchor<0)throw Error('Expected local player wrapper not found');
fs.mkdirSync('diagnostics',{recursive:true});
fs.writeFileSync('diagnostics/jsnes-r14-mmc3-probe.html',html.slice(0,anchor)+'window.__emulatorProbe=()=>emulator;\n'+html.slice(anchor));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const results=[];
 try{
  const context=await browser.newContext({offline:true});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('diagnostics/jsnes-r14-mmc3-probe.html')).href);
  await page.locator('#rom').setInputFiles('references/nes-test-roms/mmc3_test_2/rom_singles/4-scanline_timing.nes');
  await page.waitForFunction(()=>window.__emulatorProbe?.(),null,{timeout:30000});
  const result=await page.evaluate(()=>{
   const nes=window.__emulatorProbe();for(let i=0;i<360;i++)nes.frame();const mem=nes.cpu.mem;
   return {status:mem[0x6000],signature:Array.from(mem.slice(0x6001,0x6004)),message:String.fromCharCode(...mem.slice(0x6004,0x6404)).split('\0')[0]};
  });
  results.push({engine:'local JSNES r14',source:local,errors,...result});
  await context.close();
  for(const mode of ['baseline','vblank-next-line']){
   const context=await browser.newContext({offline:true}),page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.resolve('../dist/v005-audio-stability/jsnes-lite.readable.html')).href);
   await page.locator('#i_start').uncheck();
   if(mode!=='baseline')await page.evaluate(()=>{
    const source=ppu_tick.toString();const changed=source.replace('else if(scanline == 240){','else if(scanline == 241){');
    if(changed===source)throw Error('PPU probe source did not match');
    ppu_tick=eval('('+changed+')');
   });
   await page.locator('#fileInput').setInputFiles('references/nes-test-roms/mmc3_test_2/rom_singles/4-scanline_timing.nes');
   await page.waitForFunction(()=>document.getElementById('loadStatus').textContent.includes('loaded'));
   const result=await page.evaluate(()=>{
    for(let i=0;i<360;i++)NES.frame();
    return{status:memory_read(0x6000),message:String.fromCharCode(...Array.from({length:1024},(_,i)=>memory_read(0x6004+i))).split('\0')[0]};
   });
   results.push({engine:'jsnes-lite v005',probe:mode,shipped:mode==='baseline',errors,...result});
   await context.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync('diagnostics/mmc3-browser-probes.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
