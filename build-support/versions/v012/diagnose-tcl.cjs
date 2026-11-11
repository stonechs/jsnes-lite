// Local differential reproduction. Commercial ROM and captures stay local.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../..');
const romPath = process.env.TCL_ROM || path.join(root, 'roms/commercial/TCL王牌海战.nes');
const referencePath = process.env.TCL_REFERENCE || 'D:/2026work/jsnes/jsnes-2.1.0-r14/nes-readable.html';
const output = path.join(root, 'roms/commercial/tcl-diagnostics');
fs.mkdirSync(output, { recursive: true });
const rom = fs.readFileSync(romPath);
const metadata = { bytes: rom.length, sha256: require('node:crypto').createHash('sha256').update(rom).digest('hex'), header: [...rom.subarray(0,16)], mapper: (rom[6]>>4)|(rom[7]&240) };
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results={rom:metadata,runs:{}};
 try {
  for(const kind of ['v011','reference']){
   const page=await browser.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(kind==='v011')await page.setContent(fs.readFileSync(path.join(root,'dist/v011-mapper30/jsnes-lite.readable.html'),'utf8'));
   else {
    const html=fs.readFileSync(referencePath,'utf8');
    const script=html.slice(html.indexOf('<script>')+8,html.indexOf('  var player = document.querySelector("main");'));
    await page.setContent('<canvas id="screen" width="256" height="240"></canvas><script>'+script+'window.RefNES=nes_default;})();</script>');
   }
   await page.evaluate(({kind,bytes})=>{
    const canvas=document.querySelector('canvas');
    if(kind==='v011') { NES.init({rom:new Uint8Array(bytes),frame:canvas});window.emu=NES; }
    else {
     const ctx=canvas.getContext('2d'),data=ctx.createImageData(256,240),pixels=new Uint32Array(data.data.buffer);
     window.emu=new RefNES({emulateSound:false,onFrame:b=>{for(let i=0;i<b.length;i++)pixels[i]=0xff000000|b[i];ctx.putImageData(data,0,0)}});
     emu.loadROM(String.fromCharCode(...bytes.slice(0,0x8000))+Array.from({length:Math.ceil((bytes.length-0x8000)/0x8000)},(_,i)=>String.fromCharCode(...bytes.slice((i+1)*0x8000,(i+2)*0x8000))).join(''));
    }
   },{kind,bytes:[...rom]});
   const records=[];
   for(const [label,count,button] of [['boot',2400],['start-down',5,true],['game',600,false],['start-again',5,true],['later',300,false],['playing',300]]){
    const state=await page.evaluate(({kind,count,button})=>{
     if(button!==undefined){if(kind==='v011')emu[button?'keydown':'keyup'](3);else emu[button?'buttonDown':'buttonUp'](1,3)}
     for(let i=0;i<count;i++)emu.frame();
     return kind==='v011'?{oam:[...OAM],ctrl:[PPUCTRL_H,PPUCTRL_S,PPUCTRL_B],mask:[PPUMASK_s,PPUMASK_b],chr:mapper_chr,ram:Array.from({length:2048},(_,i)=>cpu_mem[i]||0)}:{oam:[...emu.ppu.spriteMem],ctrl:[emu.ppu.f_spriteSize,emu.ppu.f_spPatternTable,emu.ppu.f_bgPatternTable],ram:emu.cpu.mem.slice(0,2048)};
    },{kind,count,button});
    records.push({label,...state});
    await page.locator('canvas').screenshot({path:path.join(output,kind+'-'+label+'.png')});
   }
   results.runs[kind]={errors,records};
   await page.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'state.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify({rom:metadata,output,runs:Object.fromEntries(Object.entries(results.runs).map(([k,v])=>[k,{errors:v.errors,states:v.records.map(s=>({label:s.label,ctrl:s.ctrl,oam:s.oam?.slice(0,32)}))}]))},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
