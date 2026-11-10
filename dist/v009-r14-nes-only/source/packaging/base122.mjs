// Compatible with Kevin Albertson's MIT-licensed Base122 format.
// The reference encoder is used at build time; this small decoder runs offline.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export const reference=require('../references/base122/base122.js');
export const encode=bytes=>Buffer.from(reference.encode(bytes)).toString('utf8');
export function decode(text){
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
export function packSixBit(text){
  const bytes=[];let bits=0,buffer=0;
  for(const char of text){
    buffer=(buffer<<6)|(char.charCodeAt(0)&63);bits+=6;
    if(bits>=8){bits-=8;bytes.push((buffer>>>bits)&255);}
  }
  if(bits)bytes.push((buffer<<(8-bits))&255);
  return Uint8Array.from(bytes);
}
export function unpackSixBit(bytes,length){
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
// Raw double-quoted JS strings can hold this alphabet; guard HTML script states.
export const scriptLiteral=text=>'"'+text.replace(/<(\/?script|!--)/gi,value=>'\\x3c'+value.slice(1))+'"';
