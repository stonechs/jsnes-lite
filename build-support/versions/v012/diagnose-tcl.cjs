// Local differential reproduction. Commercial ROM and captures stay local.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/maco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../../..');
const romPath = process.env.TCL_ROM || path.join(root, 'roms/commercial/TCL王牌海战.nes');
const referencePath = process.env.TCL_REFERENCE || 'D:/2026work/jsnes/jsnes-2.1.0-r14/nes-readable.html';
const forceOamReset = process.env.TCL_FORCE_OAMADDR_ZERO === '1';
const output = path.join(root, 'roms/commercial', forceOamReset ? 'tcl-diagnostics-oamreset' : 'tcl-diagnostics');
fs.mkdirSync(output, { recursive: true });
const rom = fs.readFileSync(romPath);
const metadata = { bytes: rom.length, sha256: require('node:crypto').createHash('sha256').update(rom).digest('hex'), header: [...rom.subarray(0,16)], mapper: (rom[6]>>4)|(rom[7]&240) };
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results={rom:metadata,runs:{}};
 try {
  for(const kind of ['v011','v012','reference']){
   const page=await browser.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(kind!=='reference')await page.setContent(fs.readFileSync(path.join(root,kind==='v012'?'dist/v012-oam-address-reset/jsnes-lite.readable.html':'dist/v011-mapper30/jsnes-lite.readable.html'),'utf8'));
   else {
    const html=fs.readFileSync(referencePath,'utf8');
    const script=html.slice(html.indexOf('<script>')+8,html.indexOf('  var player = document.querySelector("main");'));
    await page.setContent('<canvas id="screen" width="256" height="240"></canvas><script>'+script+'window.RefNES=nes_default;})();</script>');
   }
   await page.evaluate(({kind,bytes,forceOamReset})=>{
    window.oamTrace=[];
    const canvas=document.querySelector('canvas');
    if(kind!=='reference') {
     const writeAddress=set_OAMADDR,writeDma=set_OAMDMA;
     const writeOamData=set_OAMDATA;
     set_OAMADDR=value=>{if(oamTrace.length<500)oamTrace.push({type:'addr',value,pc:PC});writeAddress(value)};
     set_OAMDATA=value=>{if(oamTrace.length<500)oamTrace.push({type:'data',value,address:OAMADDR,pc:PC});writeOamData(value)};
     set_OAMDMA=page=>{if(oamTrace.length<500)oamTrace.push({type:'dma',page,address:OAMADDR,pc:PC,source:Array.from({length:16},(_,i)=>memory_read(page*256+i))});writeDma(page)};
     NES.init({rom:new Uint8Array(bytes),frame:canvas});window.emu=NES;
     if(kind==='v011'&&forceOamReset){const frame=NES.frame;NES.frame=()=>{OAMADDR=0;frame()}}
    }
    else {
     const ctx=canvas.getContext('2d'),data=ctx.createImageData(256,240),pixels=new Uint32Array(data.data.buffer);
     window.emu=new RefNES({emulateSound:false,onFrame:b=>{for(let i=0;i<b.length;i++)pixels[i]=0xff000000|b[i];ctx.putImageData(data,0,0)}});
     emu.loadROM(String.fromCharCode(...bytes.slice(0,0x8000))+Array.from({length:Math.ceil((bytes.length-0x8000)/0x8000)},(_,i)=>String.fromCharCode(...bytes.slice((i+1)*0x8000,(i+2)*0x8000))).join(''));
     const ppu=emu.ppu,writeAddress=ppu.writeSRAMAddress.bind(ppu),writeData=ppu.sramWrite.bind(ppu),writeDma=ppu.sramDMA.bind(ppu);
     ppu.writeSRAMAddress=value=>{if(oamTrace.length<500)oamTrace.push({type:'addr',value,pc:emu.cpu.REG_PC});writeAddress(value)};
     ppu.sramWrite=value=>{if(oamTrace.length<500)oamTrace.push({type:'data',value,address:ppu.sramAddress,pc:emu.cpu.REG_PC});writeData(value)};
     ppu.sramDMA=page=>{if(oamTrace.length<500)oamTrace.push({type:'dma',page,address:ppu.sramAddress,pc:emu.cpu.REG_PC,source:Array.from({length:16},(_,i)=>emu.cpu.mem[page*256+i])});writeDma(page)};
    }
   },{kind,bytes:[...rom],forceOamReset});
   const records=[];
   for(const [label,count,button] of [['boot',2400],['a-down',120,true],['game',1800,false],['playing',300]]){
    const state=await page.evaluate(({kind,count,button})=>{
     if(button!==undefined){if(kind!=='reference')emu[button?'keydown':'keyup'](0);else emu[button?'buttonDown':'buttonUp'](1,0)}
     for(let i=0;i<count;i++)emu.frame();
     return kind!=='reference'?{oam:[...OAM],oamAddress:OAMADDR,ctrl:[PPUCTRL_H,PPUCTRL_S,PPUCTRL_B],mask:[PPUMASK_s,PPUMASK_b],chr:mapper_chr,ram:Array.from({length:2048},(_,i)=>cpu_mem[i]||0),dma:oamTrace.splice(0)}:{oam:[...emu.ppu.spriteMem],oamAddress:emu.ppu.sramAddress,ctrl:[emu.ppu.f_spriteSize,emu.ppu.f_spPatternTable,emu.ppu.f_bgPatternTable],ram:emu.cpu.mem.slice(0,2048),dma:oamTrace.splice(0)};
    },{kind,count,button});
    records.push({label,...state});
    await page.locator('canvas').screenshot({path:path.join(output,kind+'-'+label+'.png')});
   }
   results.runs[kind]={errors,records};
   await page.close();
  }
 }finally{await browser.close()}
 fs.writeFileSync(path.join(output,'state.json'),JSON.stringify(results,null,2));
   const summary=Object.fromEntries(Object.entries(results.runs).map(([kind,run])=>[kind,{
    errors:run.errors,
    states:run.records.map(state=>{
     const events=state.dma||[],dmas=events.filter(event=>event.type==='dma'),starts={};
     for(const event of dmas)starts[event.address]=(starts[event.address]||0)+1;
     return {label:state.label,oamAddress:state.oamAddress,ctrl:state.ctrl,oam:state.oam?.slice(0,8),dmaCount:dmas.length,dmaStarts:starts,dataWrites:events.filter(event=>event.type==='data').length};
    })
   }]));
   console.log(JSON.stringify({rom:metadata,output,runs:summary},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
