import fs from 'node:fs';
import vm from 'node:vm';
export const order=['nes','rom','cpu','memory','mappers','controller','6502','apu-jsnes','audio-output','papu','ppu'];
export function makeROM(mapper,prg16=8,chr8=8,{fourScreen=false,vertical=false}={}){
  const data=new Uint8Array(16+prg16*16384+chr8*8192);
  data.set([78,69,83,26,prg16,chr8,((mapper&15)<<4)|(fourScreen?8:0)|(vertical?1:0),mapper&240]);
  for(let bank=0;bank<prg16*2;bank++)data.fill(bank,16+bank*8192,16+(bank+1)*8192);
  for(let bank=0;bank<chr8*8;bank++)data.fill(bank,16+prg16*16384+bank*1024,16+prg16*16384+(bank+1)*1024);
  return data;
}
export function lite(){
  const context=vm.createContext({console,Uint8Array,Uint32Array,ArrayBuffer,clearInterval,setInterval,clearTimeout,setTimeout,performance});
  context.window=context;
  for(const name of order)vm.runInContext(fs.readFileSync(new URL('../../src/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
  context.apu_reset=()=>{};
  return context;
}
export function load(context,data){
  context.cpu_reset();context.ppu_reset();context.c=0;
  context.NES.parse(data);context.NES.load();
}
export function write(context,address,value){context.clk+=4;context.memory_write(address,value)}
export function serial(context,address,value){for(let bit=0;bit<5;bit++)write(context,address,(value>>bit)&1)}
export const prg=context=>[0x8000,0xa000,0xc000,0xe000].map(a=>context.memory_read(a));
export const chr=context=>Array.from({length:8},(_,i)=>context.ppu_read(i*1024));
