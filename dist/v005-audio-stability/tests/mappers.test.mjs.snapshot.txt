import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import JSNES from '../references/jsnes/src/nes.js';
import {lite,load,makeROM,write,serial,prg,chr} from './helpers.mjs';

test('MMC1: serial latch, all PRG/CHR modes, mirroring and partial reset',()=>{
 const c=lite();load(c,makeROM(1));assert.deepEqual(prg(c),[0,1,14,15]);
 serial(c,0xe000,3);assert.deepEqual(prg(c),[6,7,14,15]);
 serial(c,0x8000,8);assert.deepEqual(prg(c),[0,1,6,7]);
 serial(c,0x8000,0);assert.deepEqual(prg(c),[4,5,6,7]);
 serial(c,0xa000,5);assert.deepEqual(chr(c),[16,17,18,19,20,21,22,23]);
 serial(c,0x8000,28);serial(c,0xc000,7);assert.deepEqual(chr(c),[20,21,22,23,28,29,30,31]);
 for(let mode=0;mode<4;mode++){
  serial(c,0x8000,28|mode);
  assert.deepEqual([0x2000,0x2400,0x2800,0x2c00].map(a=>c.mirrorAddress(a)),[[8192,8192,8192,8192],[9216,9216,9216,9216],[8192,9216,8192,9216],[8192,8192,9216,9216]][mode]);
  assert.equal(c.mirrorAddress(0x3000),c.mirrorAddress(0x2000));
 }
 write(c,0xe000,1);write(c,0xa000,128);assert.equal(c.mmc1_shift,16);assert.equal(c.mmc1_control&12,12);
 serial(c,0xe000,2);assert.deepEqual(prg(c),[4,5,14,15]);
});
test('MMC1: final write address determines register, adjacent writes ignored',()=>{
 const c=lite();load(c,makeROM(1));
 for(let bit=0;bit<4;bit++)write(c,0x8000,(3>>bit)&1);
 write(c,0xe000,0);assert.equal(c.mmc1_prg,3);assert.equal(c.mmc1_control,12);
 const shift=c.mmc1_shift;c.memory_write(0x8000,1);const first=c.mmc1_shift;
 c.clk++;c.memory_write(0x8000,0);assert.equal(c.mmc1_shift,first);assert.notEqual(shift,first);
});
test('MMC1: PRG-RAM enable, CHR-RAM banking and SUROM outer bank',()=>{
 const c=lite();load(c,makeROM(1,32,0));
 write(c,0x6000,0x5a);assert.equal(c.memory_read(0x6000),0x5a);
 serial(c,0xe000,16);write(c,0x6000,0x33);assert.equal(c.memory_read(0x6000),0);
 serial(c,0xe000,3);assert.equal(c.memory_read(0x6000),0x5a);
 serial(c,0xa000,16);assert.deepEqual(prg(c),[38,39,62,63]);
 serial(c,0x8000,28);serial(c,0xa000,17);serial(c,0xc000,0);
 c.mapper_chr_write(0,0x77);assert.equal(c.NES.chr[0][4096],0x77);
 c.NES.reset();assert.equal(c.memory_read(0x6000),0x5a);assert.deepEqual(prg(c),[0,1,30,31]);
});
test('UxROM: bank bits, wraparound, fixed bank, CHR-RAM and register aliases',()=>{
 const c=lite();load(c,makeROM(2,16,0));
 for(let bank=0;bank<32;bank++){write(c,0x8123,bank);assert.deepEqual(prg(c),[(bank%16)*2,(bank%16)*2+1,30,31])}
 c.mapper_chr_write(123,99);assert.equal(c.ppu_read(123),99);
});
test('CNROM: all 8 KiB CHR banks, fixed PRG and CHR-ROM write protection',()=>{
 const c=lite();load(c,makeROM(3,2,4));const fixed=prg(c);
 for(let bank=0;bank<8;bank++){
  write(c,0xffff,bank);assert.deepEqual(chr(c),Array.from({length:8},(_,i)=>(bank%4)*8+i));assert.deepEqual(prg(c),fixed);
 }
 const previous=c.ppu_read(0);c.PPUADDR=0;c.set_PPUDATA(111);assert.equal(c.ppu_read(0),previous);
});
test('MMC3: all bank registers, inverted CHR/PRG modes and odd pair alignment',()=>{
 const c=lite();load(c,makeROM(4));assert.deepEqual(prg(c),[0,1,14,15]);
 const values=[11,17,22,25,29,33,5,7];
 for(let reg=0;reg<8;reg++){write(c,0x8002,reg);write(c,0x8003,values[reg])}
 assert.deepEqual(chr(c),[10,11,16,17,22,25,29,33]);assert.deepEqual(prg(c),[5,7,14,15]);
 write(c,0x8000,0xc0);assert.deepEqual(chr(c),[22,25,29,33,10,11,16,17]);assert.deepEqual(prg(c),[14,7,5,15]);
 write(c,0x8000,0);assert.deepEqual(chr(c),[10,11,16,17,22,25,29,33]);assert.deepEqual(prg(c),[5,7,14,15]);
});
test('MMC3: four-screen lock, mirror aliases, SRAM enable/write protect',()=>{
 const c=lite();load(c,makeROM(4));write(c,0xa002,1);assert.equal(c.NES.mirroring,1);
 write(c,0xa002,0);assert.equal(c.NES.mirroring,0);
 write(c,0xa001,128);write(c,0x6012,123);assert.equal(c.memory_read(0x6012),123);
 write(c,0xa001,192);write(c,0x6012,90);assert.equal(c.memory_read(0x6012),123);
 write(c,0xa001,0);assert.equal(c.memory_read(0x6012),0);
 write(c,0xa001,128);assert.equal(c.memory_read(0x6012),123);
 load(c,makeROM(4,8,8,{fourScreen:true}));write(c,0xa000,1);assert.equal(c.NES.mirroring,2);
 assert.equal(c.mirrorAddress(0x2c00),0x2c00);
});
test('MMC3: reload/decrement, pending line, ack, disabled counting and zero latch',()=>{
 const c=lite();load(c,makeROM(4));write(c,0xc000,2);write(c,0xc001,0);write(c,0xe001,0);
 c.mapper_clock_irq();assert.equal(c.mmc3_counter,2);c.mapper_clock_irq();assert.equal(c.mapper_irq,0);
 c.mapper_clock_irq();assert.equal(c.mapper_irq,1);write(c,0xe000,0);assert.equal(c.mapper_irq,0);
 c.mapper_clock_irq();assert.equal(c.mmc3_counter,2);c.mapper_clock_irq();c.mapper_clock_irq();assert.equal(c.mapper_irq,0);
 write(c,0xc000,0);write(c,0xc001,0);write(c,0xe001,0);assert.equal(c.mapper_irq,0);c.mapper_clock_irq();assert.equal(c.mapper_irq,1);
});
test('MMC3: CPU PPUADDR clocks, filter, scanline rendering guard and reset',()=>{
 const c=lite();load(c,makeROM(4));write(c,0xc000,3);write(c,0xc001,0);
 const addr=a=>{c.latch=0;c.set_PPUADDR(a>>8);c.set_PPUADDR(a&255)};
 c.clk=20;addr(0);c.clk+=3;addr(0x1000);assert.equal(c.mmc3_counter,3);
 addr(0);c.clk++;addr(0x1000);assert.equal(c.mmc3_counter,3);
 c.PPUMASK_b=c.PPUMASK_s=0;c.mapper_scanline();assert.equal(c.mmc3_counter,3);
 c.PPUMASK_s=1;c.mapper_scanline();assert.equal(c.mmc3_counter,2);
 c.NES.reset();assert.equal(c.mapper_irq,0);assert.equal(c.mmc3_enabled,0);
});
test('IRQ integration: masked line retained, then serviced; NMI has priority',()=>{
 const c=lite();load(c,makeROM(4));c.interrupt_requested=0;c.mapper_irq=1;
 const calls=[];c.op=v=>{calls.push(v);c.c=2};c.I=1;c.emulate();assert.deepEqual(calls,[undefined]);assert.equal(c.mapper_irq,1);
 c.I=0;c.emulate();assert.deepEqual(calls,[undefined,3]);c.interrupt_requested=1;c.emulate();assert.equal(calls[2],1);
});
test('Loader validation, trainer skip, SRAM isolation and mapper reset isolation',()=>{
 const c=lite();assert.throws(()=>c.NES.parse(new Uint8Array(16)),/Invalid/);
 const truncated=makeROM(1).slice(0,20);assert.throws(()=>c.NES.parse(truncated),/Truncated/);
 const nes2=makeROM(1);nes2[7]|=8;assert.throws(()=>c.NES.parse(nes2),/NES 2/);
 assert.throws(()=>load(c,makeROM(5)),/Unsupported mapper/);
 load(c,makeROM(4));write(c,0x6000,99);write(c,0x8000,64);
 load(c,makeROM(2,2,0));assert.equal(c.memory_read(0x6000),0);assert.deepEqual(prg(c),[0,1,2,3]);
 const original=makeROM(2,2,0),trainer=new Uint8Array(original.length+512);trainer.set(original.slice(0,16));trainer[6]|=4;trainer.set(original.slice(16),528);
 load(c,trainer);assert.deepEqual(prg(c),[0,1,2,3]);
});
test('Differential bank switching against pinned latest JSNES (1,2,3,4)',()=>{
 for(const mapper of [1,2,3,4]){
  const data=makeROM(mapper,mapper===3?2:8,8),c=lite();load(c,data);
  const reference=new JSNES({emulateSound:false});reference.loadROM(data);
  const compare=()=>{
   assert.deepEqual(prg(c),[0x8000,0xa000,0xc000,0xe000].map(a=>reference.cpu.mem[a]),'PRG mapper '+mapper);
   assert.deepEqual(chr(c),Array.from({length:8},(_,i)=>reference.ppu.vramMem[i*1024]),'CHR mapper '+mapper);
  };
  compare();
  if(mapper===1){
   for(let bank=0;bank<8;bank++){serial(c,0xe000,bank);for(let i=0;i<5;i++)reference.mmap.write(0xe000,(bank>>i)&1);compare()}
   for(let bank=0;bank<8;bank++){serial(c,0xa000,bank*2);for(let i=0;i<5;i++)reference.mmap.write(0xa000,((bank*2)>>i)&1);compare()}
  }else if(mapper===4){
   for(let reg=0;reg<8;reg++){write(c,0x8000,reg);reference.mmap.write(0x8000,reg);write(c,0x8001,reg*2);reference.mmap.write(0x8001,reg*2);compare()}
  }else for(let bank=0;bank<16;bank++){write(c,0x8000,bank);reference.mmap.write(0x8000,bank);compare()}
 }
});
