function decodeLzma(packed,properties,size,context){archiveCheck(properties?.length===5&&properties[0]<225,'Prop');archiveCheck(packed.length>=5&&packed[0]===0,'Data');var dictionary=Math.max(4096,new DataView(properties.buffer,properties.byteOffset,5).getUint32(1,true)),out=decodeLzmadCore(packed,properties,size,dictionary,context);if(!context)archiveCheck(out.length===size,'Data');return context?out:Uint8Array.from(out);}
function decodeLzmadCore(packed,properties,size,dictionary,context){var d=properties[0],e=d/9,a,u,c,models=context?.models||[],f=(u,a=0,c)=>{var d=u[a]||(u[a]=1024);c=d*(h>>>11),c=c>n>>>0?(h=c,u[a]+=2048-d>>>5,0):(h-=c,n-=c,u[a]-=d>>>5,1),h>>>24||(h<<=8,n=n<<8|s[i++]);return c},r=(u,a=0,c)=>{var d=1,e=a;for(;a--;)d+=d+f(u,d+c);return d^=1<<e},s=packed,t,v,w=d%9,j=t,l,n,m=1<<e/5,g=1<<e%5,p=context?.pos||0,end=p+size,d=0,a=context?.state||0,b=(context?.rep0||1)-1,v=(context?.rep1||1)-1,t=(context?.rep2||1)-1,j=(context?.rep3||1)-1,l=context&&p>(context.base||0)?context.out[p-1]:0,o=context?.out||[],h=16|g--<<8,i=5-h,k;for(;h--;)f[h]=models[h]||(models[h]=[]),n=n<<8|s[i++];for(;p<end;d=(p-(context?.base||0))&m-1)if(f(f[1],a*16+d)){if(f(f[e=k=0],a))f(f[2],a)?(f(f[3],a)?(f(f[4],a)?(e=j,j=t):e=t,t=v):e=v,v=b,b=e):(k=!f(f[5],a*16+d))&&(a=7>a?9:11),k||(c=f[9],k=f(c)?f(c,1)?16+r(c,8,1):r(c,3,d*16+261)+8:r(c,3,d*16+511),k+=2,a=7>a?8:11);else{c=f[8],k=f(c)?f(c,1)?16+r(c,8,1):r(c,3,d*16+261)+8:r(c,3,d*16+511),k+=2,a=7>a?7:10,j=t,t=v,v=b,b=r(f[7],6,6>k?k-2<<6:192);if(b>3)if(u=b>>>1,c=b,b=(2|b&1)<<--u,d=14>c)for(l=b+31-c;u>e;b+=c<<e++)d+=d+=c=f(f[6],d+l);else{for(;4<u--;)h>>>=1,c=n-h>>>31,n-=h&--c,d+=d+-c,h>>>24||(h<<=8,n=n<<8|s[i++]);for(b+=d<<4,d=1;4>e;b+=c<<e++)d+=d+=c=f(f[6],d);if(b<0){archiveCheck(!context,'Data');return o}}}archiveCheck(b>=0&&b<p-(context?.base||0)&&b<dictionary&&k<=end-p,'Data');for(e=p+~b;k--;)l=o[p++]=o[e++]}else{l=f[16+(l>>>8-w|((p-(context?.base||0))&g)<<w)],d=1;if(7>a)for(;d<256;)d+=d+f(l,d);else{for(e=o[p+~b];d<256;)if(k=e>>>7&1,e<<=1,d+=d+=c=f(l,d|k+1<<8),c^k)for(;d<256;)d+=d+f(l,d)}l=o[p++]=d-256;a-=4>a?a:10>a?3:6}if(context)Object.assign(context,{pos:p,models,state:a,rep0:b+1,rep1:v+1,rep2:t+1,rep3:j+1});return o;}
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
      if(control>=160){context.models=null;context.state=0;context.rep0=context.rep1=context.rep2=context.rep3=1;}
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
