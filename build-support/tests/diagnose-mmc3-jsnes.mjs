import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import NES from '../references/jsnes/src/nes.js';
process.chdir(path.resolve(import.meta.dirname,'..'));
const names=['1-clocking','2-details','3-A12_clocking','4-scanline_timing','5-MMC3','6-MMC3_alt'];
const results=[];
for(const name of names){
 const file=`references/nes-test-roms/mmc3_test_2/rom_singles/${name}.nes`;
 const rom=fs.readFileSync(file),nes=new NES({emulateSound:false});
 nes.loadROM(rom);
 let frames=0,error=null;
 try{for(;frames<1800;frames++){
  nes.frame();
  const mem=nes.cpu.mem;
  if(mem[0x6001]===0xde&&mem[0x6002]===0xb0&&mem[0x6003]===0x61&&mem[0x6000]<128){frames++;break}
 }}catch(e){error=e.message}
 const mem=nes.cpu.mem;
 const result={name,frames,error,status:mem[0x6000],signature:mem.slice(0x6001,0x6004),message:String.fromCharCode(...mem.slice(0x6004,0x6404)).split('\0')[0],romSHA256:crypto.createHash('sha256').update(rom).digest('hex')};
 results.push(result);console.log(JSON.stringify(result));
}
fs.mkdirSync('diagnostics',{recursive:true});
fs.writeFileSync('diagnostics/mmc3-official-jsnes.json',JSON.stringify({jsnesCommit:cp.execFileSync('git',['-C','references/jsnes','rev-parse','HEAD'],{encoding:'utf8'}).trim(),packageVersion:JSON.parse(fs.readFileSync('references/jsnes/package.json','utf8')).version,results},null,2)+'\n');
