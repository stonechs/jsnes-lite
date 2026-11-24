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

