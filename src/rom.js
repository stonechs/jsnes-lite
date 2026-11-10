// iNES 1.0 loader. NES 2.0/submappers are explicitly rejected.
NES.parse=data=>{
  if(data.length<16||data[0]!==78||data[1]!==69||data[2]!==83||data[3]!==26||!data[4])throw new Error('Invalid iNES ROM');
  if((data[7]&12)===8)throw new Error('NES 2.0 is not supported');
  var offset=16+((data[6]&4)?512:0);
  if(data.length<offset+data[4]*16384+data[5]*8192)throw new Error('Truncated ROM');
  NES.mapper=(data[6]>>4)|(data[7]&240);
  NES.fourScreen=!!(data[6]&8);
  NES.headerMirroring=NES.mirroring=NES.fourScreen?2:(data[6]&1)?0:1;
  NES.chrRAM=data[5]===0;
  NES.prg=[];
  for(var bank=0;bank<data[4];bank++){
    NES.prg.push(data.slice(offset,offset+16384));offset+=16384;
  }
  NES.chr=[];
  for(bank=0;bank<data[5];bank++){
    NES.chr.push(data.slice(offset,offset+8192));offset+=8192;
  }
  if(NES.chrRAM)for(bank=0;bank<(NES.mapper===30?4:1);bank++)NES.chr.push(new Uint8Array(8192));
};
