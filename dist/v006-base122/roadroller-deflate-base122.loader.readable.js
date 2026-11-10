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
(async()=>{try{const binary=decode("__BASE122_PAYLOAD__");const stream=new Blob([binary]).stream().pipeThrough(new DecompressionStream("deflate-raw"));const html=await new Response(stream).text();document.open();document.write(html);document.close();}catch(error){document.body.textContent='Decode error: '+error.message;}})();