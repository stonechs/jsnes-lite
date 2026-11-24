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
(()=>{const data=decode("__BASE122_PAYLOAD__");(0,eval)(Function("[M",...']charCodeAtUinyxpf',"for(;p=e<20949;c[e++]=p-=128,A=A?p-A&&A:p==34&&p)for(;p<128;p+=p+x){for(n of'01020210310320321043105310642076108653'.split(y=0)){f=0;for(n of n)f=f*997+(c[e-n]|0)|0;f=2*r[U[t]=12*(h*32-1&f*997+p+!!A*129)+t]+1,i[t]=f=Math.log(f/(h-f)),y-=f*a[t++]}for(y=~-h/(1+Math.exp(y))|1;o<h*32;o=o*64|(M[d*3>>2]<<8|M[(d*3>>2)+1])>>(10-(d++*6&7))&63);for(x=o%h<y,o=o%h+(x?y:h-y)*(o>>17)-!x*y;t;a[t]+=i[t]/1746*(x-y/h))r[n=U[--t]]+=(x*h/2-r[n]<<13)/((C[n]+=C[n]<3)+1/36)>>13}for(C=String.fromCharCode(...c);r=/[\0-]/.exec(C);)with(C.split(r))C=join(shift());return C")([data],[],1<<17,Array(12).fill(0),new Uint16Array(51e6).fill(1<<15),new Uint8Array(51e6),0,0,0,0,0,[],[]))})();