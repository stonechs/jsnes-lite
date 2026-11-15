// Compact LZMA1 raw decoder. Flat SDK probability layout, whole output as dictionary.
// State-machine layout informed by Ilya Kurdyukov's micro-lzmadec reference.
// Input: raw range-coded bytes, 5-byte LZMA properties, known output byte count.
function decodeLzma(packed,properties,size,context){
  archiveCheck(properties?.length===5&&properties[0]<225,'Prop');archiveCheck(size>=0&&size<=MAX_BLOCK,'Size');
  var prop=properties[0],lc=prop%9,lp=Math.floor(prop/9)%5,pb=Math.floor(prop/45),
      dictionary=Math.max(4096,new DataView(properties.buffer,properties.byteOffset,5).getUint32(1,true)),
      probs=context?.probs||new Uint16Array(1846+768*2**(lc+lp)).fill(1024),out=context?.out||new Uint8Array(size),
      input=0,pos=context?.pos||0,dictBase=context?.base||0,end=pos+size,range=4294967295,code=0,
      state=context?.state||0,rep0=context?.rep0||1,rep1=context?.rep1||1,rep2=context?.rep2||1,rep3=context?.rep3||1;
  function read(){archiveCheck(input<packed.length,'EOF');return packed[input++];}
  function normalize(){if(range<16777216){range=(range*256)>>>0;code=(code*256+read())>>>0;}}
  function bit(index){
    normalize();var p=probs[index],bound=(range>>>11)*p;
    if(code<bound){range=bound;probs[index]=p+((2048-p)>>>5);return 0;}
    range=(range-bound)>>>0;code=(code-bound)>>>0;probs[index]=p-(p>>>5);return 1;
  }
  function tree(base,bits,reverse){var node=1,value=0;for(var i=0;i<bits;i++){var b=bit(base+node);node=node*2+b;value|=b<<i;}return reverse?value:node-2**bits;}
  function length(base,position){
    if(!bit(base))return tree(base+2+position*8,3,false);
    if(!bit(base+1))return 8+tree(base+130+position*8,3,false);
    return 16+tree(base+258,8,false);
  }
  archiveCheck(read()===0);for(var i=0;i<4;i++)code=(code*256+read())>>>0;
  while(pos<end){
    var position=(pos-dictBase)&((1<<pb)-1),len,distance;
    if(!bit(state*16+position)){
      var base=1846+768*((((pos-dictBase)&((1<<lp)-1))<<lc)+((pos>dictBase?out[pos-1]:0)>>(8-lc))),node=1,
          offset=state>=7?256:0,match=offset?out[pos-rep0]:0;
      while(node<256){match*=2;var b=bit(base+offset+(match&offset)+node);node=node*2+b;offset&=b?match:~match;}
      out[pos++]=node-256;state=state<4?0:state<10?state-3:state-6;
      continue;
    }
    if(!bit(192+state)){
      rep3=rep2;rep2=rep1;rep1=rep0;
      len=length(818,position)+2;
      var slot=tree(432+Math.min(len-2,3)*64,6,false);
      distance=slot;
      if(slot>3){
        var bits=(slot>>1)-1;distance=(2+(slot&1))*2**bits;
        if(slot<14)distance+=tree(687+distance-slot,bits,true);
        else{
          var direct=0;for(var n=bits-4;n>0;n--){normalize();range>>>=1;var b=code>=range?1:0;if(b)code=(code-range)>>>0;direct=direct*2+b;}
          distance+=direct*16+tree(802,4,true);
        }
      }
      rep0=distance+1;state=state<7?7:10;
    }else{
      if(!bit(204+state)){
        if(!bit(240+state*16+position)){
          archiveCheck(rep0<=pos-dictBase&&rep0<=dictionary,'Data');out[pos]=out[pos-rep0];pos++;state=state<7?9:11;continue;
        }
      }else{
        if(!bit(216+state))distance=rep1;
        else{if(!bit(228+state))distance=rep2;else{distance=rep3;rep3=rep2;}rep2=rep1;}
        rep1=rep0;rep0=distance;
      }
      len=length(1332,position)+2;state=state<7?8:11;
    }
    archiveCheck(rep0>0&&rep0<=pos-dictBase&&rep0<=dictionary&&len<=end-pos,'Data');
    for(;len--;pos++)out[pos]=out[pos-rep0];
  }
  if(context){normalize();archiveCheck(input===packed.length&&code===0,'Data');Object.assign(context,{pos,probs,state,rep0,rep1,rep2,rep3});}
  return out;
}

// LZMA2 shares the compact LZMA core; only its chunk/reset framing is new.
function decodeLzma2(packed,properties,size){
  archiveCheck(properties?.length===1&&properties[0]<=40,'Prop');archiveCheck(size>=0&&size<=MAX_BLOCK,'Size');
  var property=properties[0],dictionary=property===40?4294967295:(2+(property&1))*2**(11+(property>>1)),
      props=new Uint8Array(5),r=new ArchiveReader(packed),context={out:new Uint8Array(size),pos:0,base:0},need=224;
  new DataView(props.buffer).setUint32(1,dictionary,true);
  function word(){return r.readByte()*256+r.readByte();}
  for(;;){
    var control=r.readByte();if(!control)break;
    if(control===1||control>=224)context.base=context.pos;
    if(control<128){
      archiveCheck(control===1||control===2&&need!==224,'Data');if(control===1)need=192;
      var count=word()+1;archiveCheck(count<=size-context.pos,'Data');context.out.set(r.take(count),context.pos);context.pos+=count;
    }else{
      archiveCheck(control>=need,'Data');need=0;
      count=(control&31)*65536+word()+1;var length=word()+1;
      if(control>=192){props[0]=r.readByte();archiveCheck(props[0]<225&&props[0]%9+Math.floor(props[0]/9)%5<=4,'Prop');}
      if(control>=160){context.probs=null;context.state=0;context.rep0=context.rep1=context.rep2=context.rep3=1;}
      archiveCheck(count<=size-context.pos,'Data');decodeLzma(r.take(length),props,count,context);
    }
  }
  archiveCheck(context.pos===size&&r.pos===packed.length,'Data');return context.out;
}

function unpackFolder(bytes,folder){
  archiveCheck(folder.size<=MAX_BLOCK,'Size');archiveCheck(folder.start<=bytes.length&&folder.packed<=bytes.length-folder.start,'EOF');
  var packed=bytes.subarray(folder.start,folder.start+folder.packed);
  return (folder.method==='3.1.1'?decodeLzma:decodeLzma2)(packed,folder.properties,folder.size);
}
var MAX_ROM=16<<20,MAX_BLOCK=MAX_ROM;
function archiveCheck(ok,reason='Fmt'){if(!ok)throw Error(reason);}
class ArchiveReader{
  constructor(bytes){this.bytes=bytes;this.pos=0;}
  readByte(){archiveCheck(this.pos<this.bytes.length,'EOF');return this.bytes[this.pos++];}
  take(n){archiveCheck(n>=0&&n<=this.bytes.length-this.pos,'EOF');this.pos+=n;return this.bytes.subarray(this.pos-n,this.pos);}
  fixed(n){var v=0;for(var i=0;i<n;i++)v+=this.readByte()*256**i;archiveCheck(Number.isSafeInteger(v),'Size');return v;}
  number(){var first=this.readByte(),v=0;for(var i=0,mask=128;i<8;i++,mask>>=1){if(!(first&mask)){v+=(first&(mask-1))*256**i;archiveCheck(Number.isSafeInteger(v),'Size');return v;}v+=this.readByte()*256**i;}archiveCheck(Number.isSafeInteger(v),'Size');return v;}
  expect(n){archiveCheck(this.readByte()===n);}
  skipDigest(n=1){var all=this.readByte();archiveCheck(all<=1);var defined=n&&(all||this.readByte()&128);if(defined)this.take(4);return !!defined;}
}
function readStreams(r){
  r.expect(6);var f={start:32+r.number()};r.expect(1);r.expect(9);f.packed=r.number();
  var tag=r.readByte();if(tag===10){r.skipDigest();tag=r.readByte();}archiveCheck(tag===0);
  r.expect(7);r.expect(11);archiveCheck(r.number()===1,'Multi');r.expect(0);r.expect(1);
  var flags=r.readByte();archiveCheck(!(flags&208));f.method=Array.from(r.take(flags&15)).join('.');
  archiveCheck(f.method==='3.1.1'||f.method==='33','Codec');f.properties=flags&32?r.take(r.number()):null;
  var inherited=false;r.expect(12);f.size=r.number();tag=r.readByte();if(tag===10){inherited=r.skipDigest();tag=r.readByte();}archiveCheck(tag===0);
  tag=r.readByte();if(tag===8){
    tag=r.readByte();if(tag===13){archiveCheck(r.number()===1,'Multi');tag=r.readByte();}
    if(tag===9)tag=r.readByte();
    if(tag===10){r.skipDigest(!inherited);tag=r.readByte();}
    archiveCheck(tag===0);tag=r.readByte();
  }
  archiveCheck(tag===0);return f;
}
function readSevenZip(bytes){
  archiveCheck(bytes.length>=32,'EOF');
  var start=new ArchiveReader(bytes);start.take(6);start.expect(0);start.readByte();start.take(4);
  var offset=32+start.fixed(8),size=start.fixed(8);archiveCheck(size<=MAX_BLOCK,'Size');archiveCheck(offset+size<=bytes.length,'EOF');
  var header=bytes.subarray(offset,offset+size);var r=new ArchiveReader(header),tag=r.readByte();
  if(tag===23){var encoded=readStreams(r);archiveCheck(r.pos===r.bytes.length);r=new ArchiveReader(unpackFolder(bytes,encoded));tag=r.readByte();}
  archiveCheck(tag===1);tag=r.readByte();if(tag===2){while(r.readByte()!==0)r.take(r.number());tag=r.readByte();}
  archiveCheck(tag!==5&&tag!==0,'Empty');archiveCheck(tag===4);var folder=readStreams(r);r.expect(5);archiveCheck(r.number()===1,'Multi');
  while((tag=r.readByte())!==0){var value=r.take(r.number());if(tag===14)archiveCheck(value.length===1&&!(value[0]&128),'Empty');}
  r.expect(0);archiveCheck(r.pos===r.bytes.length);return unpackFolder(bytes,folder);
}
async function readGameFile(file){
  var bytes=new Uint8Array(await file.arrayBuffer());archiveCheck(bytes.length<=MAX_ROM*4,'Size');
  if([55,122,188,175,39,28].every((b,i)=>bytes[i]===b))bytes=readSevenZip(bytes);
  else archiveCheck(!/\.7z$/i.test(file.name));
  return bytes.buffer;
}
