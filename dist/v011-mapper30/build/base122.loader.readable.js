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
(()=>{const data=decode("__BASE122_PAYLOAD__");(0,eval)(Function("[M",...']charCodeAtUinyxpf',"for(;e<18052;c[e++]=p-=128,A=A?p-A&&A:p==34&&p)for(p=1;p<128;y=f.map((n,x)=>(U=r[n]*2+1,U=Math.log(U/(h-U)),t-=a[x]*U,U/1746)),t=~-h/(1+Math.exp(t))|1,i=o%h<t,o=o%h+(i?t:h-t)*(o>>16)-!i*t,f.map((n,x)=>(U=r[n]+=(i*h/2-r[n]<<14)/((C[n]+=C[n]<3)+1/30)>>14,a[x]+=y[x]*(i-t/h))),p=p*2+i)for(f='0102021031032032104310641064206530751'.split(t=0).map((n,x)=>(U=0,[...n].map((n,x)=>(U=U*997+(c[e-n]|0)|0)),h*64-1&U*997+p+!!A*129)*12+x);o<h*64;o=o*64|(M[d*3>>2]<<8|M[(d*3>>2)+1])>>(10-(d++*6&7))&63);for(C=String.fromCharCode(...c);r=/[\0-	]/.exec(C);)with(C.split(r))C=join(shift());return C")([data],[],1<<16,[0,0,0,0,0,0,0,0,0,0,0,0],new Uint16Array(51e6).fill(1<<14),new Uint8Array(51e6),0,0,0,0))})();