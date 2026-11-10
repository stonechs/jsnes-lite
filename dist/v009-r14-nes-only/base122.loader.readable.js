function decode(text){
  const illegal=[0,10,13,34,38,92],bytes=[];
  let bits=0,buffer=0;
  function push(value){
    buffer=(buffer<<7)|value;bits+=7;
    if(bits>=8){bits-=8;bytes.push((buffer>>>bits)&255);}
  }
  for(const ch of text){
    const value=ch.charCodeAt(0);
    if(value>127&&((value>>>8)&7)!==7)push(illegal[(value>>>8)&7]);
    push(value&127);
  }
  return Uint8Array.from(bytes);
}
function unpackSixBit(bytes,length){
  let result='',bits=0,buffer=0;
  for(const byte of bytes){
    buffer=(buffer<<8)|byte;bits+=8;
    while(bits>=6&&result.length<length){
      bits-=6;
      const value=(buffer>>>bits)&63;
      result+=String.fromCharCode(value===28||value===63?value:value|64);
    }
  }
  return result;
}
(()=>{const data=decode("__BASE122_PAYLOAD__");const stream=unpackSixBit(data,13994);(0,eval)(Function("[M='"+stream+"'",...']charCodeAtUinyxp',"for(;e<26822;c[e++]=x-128)for(x=1;x<128;n=p.map((i,y)=>(t=r[i]*2+1,t=Math.log(t/(h-t)),A-=a[y]*t,t/930)),A=~-h/(1+Math.exp(A))|1,U=o%h<A,o=o%h+(U?A:h-A)*(o>>15)-!U*A,p.map((i,y)=>(t=r[i]+=(U*h/2-r[i]<<15)/((C[i]+=C[i]<4)+1/15)>>15,a[y]+=n[y]*(U-A/h))),x=x*2+U)for(p='010202103210431065410754307651084208650963'.split(A=0).map((i,y)=>(t=0,[...i].map((i,y)=>(t=t*997+(c[e-i]|0)|0)),h*128-1&t*997+x)*12+y);o<h*128;o=o*64|M.charCodeAt(d++)&63);for(C=String.fromCharCode(...c);r=/[\0-	-]/.exec(C);)with(C.split(r))C=join(shift());return C")([],[],1<<15,[0,0,0,0,0,0,0,0,0,0,0,0],new Uint16Array(51e6).fill(1<<13),new Uint8Array(51e6),0,0,0))})();