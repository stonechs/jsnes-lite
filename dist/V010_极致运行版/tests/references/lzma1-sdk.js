// Archive readers from the local JSNES r14 player; emulator core is separate.
  var LZMA = LZMA || {};
  (function(LZMA2) {
    "use strict";
    LZMA2.OutWindow = function() {
      this._windowSize = 0;
    };
    LZMA2.OutWindow.prototype.create = function(windowSize) {
      if (!this._buffer || this._windowSize !== windowSize) {
        this._buffer = new Uint8Array(windowSize);
      }
      this._windowSize = windowSize;
      this._pos = 0;
      this._streamPos = 0;
    };
    LZMA2.OutWindow.prototype.flush = function() {
      var size = this._pos - this._streamPos;
      if (size !== 0) {
        if (this._stream.writeBytes) {
          this._stream.writeBytes(this._buffer.subarray(this._streamPos), size);
        } else {
          for (var i = 0; i < size; i++) {
            this._stream.writeByte(this._buffer[this._streamPos + i]);
          }
        }
        if (this._pos >= this._windowSize) {
          this._pos = 0;
        }
        this._streamPos = this._pos;
      }
    };
    LZMA2.OutWindow.prototype.releaseStream = function() {
      this.flush();
      this._stream = null;
    };
    LZMA2.OutWindow.prototype.setStream = function(stream) {
      this.releaseStream();
      this._stream = stream;
    };
    LZMA2.OutWindow.prototype.init = function(solid) {
      if (!solid) {
        this._streamPos = 0;
        this._pos = 0;
      }
    };
    LZMA2.OutWindow.prototype.copyBlock = function(distance, len) {
      var pos = this._pos - distance - 1;
      if (pos < 0) {
        pos += this._windowSize;
      }
      while (len--) {
        if (pos >= this._windowSize) {
          pos = 0;
        }
        this._buffer[this._pos++] = this._buffer[pos++];
        if (this._pos >= this._windowSize) {
          this.flush();
        }
      }
    };
    LZMA2.OutWindow.prototype.putByte = function(b) {
      this._buffer[this._pos++] = b;
      if (this._pos >= this._windowSize) {
        this.flush();
      }
    };
    LZMA2.OutWindow.prototype.getByte = function(distance) {
      var pos = this._pos - distance - 1;
      if (pos < 0) {
        pos += this._windowSize;
      }
      return this._buffer[pos];
    };
    LZMA2.RangeDecoder = function() {
    };
    LZMA2.RangeDecoder.prototype.setStream = function(stream) {
      this._stream = stream;
    };
    LZMA2.RangeDecoder.prototype.releaseStream = function() {
      this._stream = null;
    };
    LZMA2.RangeDecoder.prototype.init = function() {
      var i = 5;
      this._code = 0;
      this._range = -1;
      while (i--) {
        this._code = this._code << 8 | this._stream.readByte();
      }
    };
    LZMA2.RangeDecoder.prototype.decodeDirectBits = function(numTotalBits) {
      var result = 0, i = numTotalBits, t;
      while (i--) {
        this._range >>>= 1;
        t = this._code - this._range >>> 31;
        this._code -= this._range & t - 1;
        result = result << 1 | 1 - t;
        if ((this._range & 4278190080) === 0) {
          this._code = this._code << 8 | this._stream.readByte();
          this._range <<= 8;
        }
      }
      return result;
    };
    LZMA2.RangeDecoder.prototype.decodeBit = function(probs, index) {
      var prob = probs[index], newBound = (this._range >>> 11) * prob;
      if ((this._code ^ 2147483648) < (newBound ^ 2147483648)) {
        this._range = newBound;
        probs[index] += 2048 - prob >>> 5;
        if ((this._range & 4278190080) === 0) {
          this._code = this._code << 8 | this._stream.readByte();
          this._range <<= 8;
        }
        return 0;
      }
      this._range -= newBound;
      this._code -= newBound;
      probs[index] -= prob >>> 5;
      if ((this._range & 4278190080) === 0) {
        this._code = this._code << 8 | this._stream.readByte();
        this._range <<= 8;
      }
      return 1;
    };
    LZMA2.initBitModels = function(probs, len) {
      while (len--) {
        probs[len] = 1024;
      }
    };
    LZMA2.BitTreeDecoder = function(numBitLevels) {
      this._models = [];
      this._numBitLevels = numBitLevels;
    };
    LZMA2.BitTreeDecoder.prototype.init = function() {
      LZMA2.initBitModels(this._models, 1 << this._numBitLevels);
    };
    LZMA2.BitTreeDecoder.prototype.decode = function(rangeDecoder) {
      var m = 1, i = this._numBitLevels;
      while (i--) {
        m = m << 1 | rangeDecoder.decodeBit(this._models, m);
      }
      return m - (1 << this._numBitLevels);
    };
    LZMA2.BitTreeDecoder.prototype.reverseDecode = function(rangeDecoder) {
      var m = 1, symbol = 0, i = 0, bit;
      for (; i < this._numBitLevels; ++i) {
        bit = rangeDecoder.decodeBit(this._models, m);
        m = m << 1 | bit;
        symbol |= bit << i;
      }
      return symbol;
    };
    LZMA2.reverseDecode2 = function(models, startIndex, rangeDecoder, numBitLevels) {
      var m = 1, symbol = 0, i = 0, bit;
      for (; i < numBitLevels; ++i) {
        bit = rangeDecoder.decodeBit(models, startIndex + m);
        m = m << 1 | bit;
        symbol |= bit << i;
      }
      return symbol;
    };
    LZMA2.LenDecoder = function() {
      this._choice = [];
      this._lowCoder = [];
      this._midCoder = [];
      this._highCoder = new LZMA2.BitTreeDecoder(8);
      this._numPosStates = 0;
    };
    LZMA2.LenDecoder.prototype.create = function(numPosStates) {
      for (; this._numPosStates < numPosStates; ++this._numPosStates) {
        this._lowCoder[this._numPosStates] = new LZMA2.BitTreeDecoder(3);
        this._midCoder[this._numPosStates] = new LZMA2.BitTreeDecoder(3);
      }
    };
    LZMA2.LenDecoder.prototype.init = function() {
      var i = this._numPosStates;
      LZMA2.initBitModels(this._choice, 2);
      while (i--) {
        this._lowCoder[i].init();
        this._midCoder[i].init();
      }
      this._highCoder.init();
    };
    LZMA2.LenDecoder.prototype.decode = function(rangeDecoder, posState) {
      if (rangeDecoder.decodeBit(this._choice, 0) === 0) {
        return this._lowCoder[posState].decode(rangeDecoder);
      }
      if (rangeDecoder.decodeBit(this._choice, 1) === 0) {
        return 8 + this._midCoder[posState].decode(rangeDecoder);
      }
      return 16 + this._highCoder.decode(rangeDecoder);
    };
    LZMA2.Decoder2 = function() {
      this._decoders = [];
    };
    LZMA2.Decoder2.prototype.init = function() {
      LZMA2.initBitModels(this._decoders, 768);
    };
    LZMA2.Decoder2.prototype.decodeNormal = function(rangeDecoder) {
      var symbol = 1;
      do {
        symbol = symbol << 1 | rangeDecoder.decodeBit(this._decoders, symbol);
      } while (symbol < 256);
      return symbol & 255;
    };
    LZMA2.Decoder2.prototype.decodeWithMatchByte = function(rangeDecoder, matchByte) {
      var symbol = 1, matchBit, bit;
      do {
        matchBit = matchByte >> 7 & 1;
        matchByte <<= 1;
        bit = rangeDecoder.decodeBit(this._decoders, (1 + matchBit << 8) + symbol);
        symbol = symbol << 1 | bit;
        if (matchBit !== bit) {
          while (symbol < 256) {
            symbol = symbol << 1 | rangeDecoder.decodeBit(this._decoders, symbol);
          }
          break;
        }
      } while (symbol < 256);
      return symbol & 255;
    };
    LZMA2.LiteralDecoder = function() {
    };
    LZMA2.LiteralDecoder.prototype.create = function(numPosBits, numPrevBits) {
      var i;
      if (this._coders && this._numPrevBits === numPrevBits && this._numPosBits === numPosBits) {
        return;
      }
      this._numPosBits = numPosBits;
      this._posMask = (1 << numPosBits) - 1;
      this._numPrevBits = numPrevBits;
      this._coders = [];
      i = 1 << this._numPrevBits + this._numPosBits;
      while (i--) {
        this._coders[i] = new LZMA2.Decoder2();
      }
    };
    LZMA2.LiteralDecoder.prototype.init = function() {
      var i = 1 << this._numPrevBits + this._numPosBits;
      while (i--) {
        this._coders[i].init();
      }
    };
    LZMA2.LiteralDecoder.prototype.getDecoder = function(pos, prevByte) {
      return this._coders[((pos & this._posMask) << this._numPrevBits) + ((prevByte & 255) >>> 8 - this._numPrevBits)];
    };
    LZMA2.Decoder = function() {
      this._outWindow = new LZMA2.OutWindow();
      this._rangeDecoder = new LZMA2.RangeDecoder();
      this._isMatchDecoders = [];
      this._isRepDecoders = [];
      this._isRepG0Decoders = [];
      this._isRepG1Decoders = [];
      this._isRepG2Decoders = [];
      this._isRep0LongDecoders = [];
      this._posSlotDecoder = [];
      this._posDecoders = [];
      this._posAlignDecoder = new LZMA2.BitTreeDecoder(4);
      this._lenDecoder = new LZMA2.LenDecoder();
      this._repLenDecoder = new LZMA2.LenDecoder();
      this._literalDecoder = new LZMA2.LiteralDecoder();
      this._dictionarySize = -1;
      this._dictionarySizeCheck = -1;
      this._posSlotDecoder[0] = new LZMA2.BitTreeDecoder(6);
      this._posSlotDecoder[1] = new LZMA2.BitTreeDecoder(6);
      this._posSlotDecoder[2] = new LZMA2.BitTreeDecoder(6);
      this._posSlotDecoder[3] = new LZMA2.BitTreeDecoder(6);
    };
    LZMA2.Decoder.prototype.setDictionarySize = function(dictionarySize) {
      if (dictionarySize < 0) {
        return false;
      }
      if (this._dictionarySize !== dictionarySize) {
        this._dictionarySize = dictionarySize;
        this._dictionarySizeCheck = Math.max(this._dictionarySize, 1);
        this._outWindow.create(Math.max(this._dictionarySizeCheck, 4096));
      }
      return true;
    };
    LZMA2.Decoder.prototype.setLcLpPb = function(lc, lp, pb) {
      var numPosStates = 1 << pb;
      if (lc > 8 || lp > 4 || pb > 4) {
        return false;
      }
      this._literalDecoder.create(lp, lc);
      this._lenDecoder.create(numPosStates);
      this._repLenDecoder.create(numPosStates);
      this._posStateMask = numPosStates - 1;
      return true;
    };
    LZMA2.Decoder.prototype.setProperties = function(props) {
      if (!this.setLcLpPb(props.lc, props.lp, props.pb)) {
        throw Error("压缩包");
      }
      if (!this.setDictionarySize(props.dictionarySize)) {
        throw Error("压缩包");
      }
    };
    LZMA2.Decoder.prototype.decodeHeader = function(inStream) {
      var properties, lc, lp, pb, uncompressedSize, dictionarySize;
      if (inStream.size < 13) {
        return false;
      }
      properties = inStream.readByte();
      lc = properties % 9;
      properties = ~~(properties / 9);
      lp = properties % 5;
      pb = ~~(properties / 5);
      dictionarySize = inStream.readByte();
      dictionarySize |= inStream.readByte() << 8;
      dictionarySize |= inStream.readByte() << 16;
      dictionarySize += inStream.readByte() * 16777216;
      uncompressedSize = inStream.readByte();
      uncompressedSize |= inStream.readByte() << 8;
      uncompressedSize |= inStream.readByte() << 16;
      uncompressedSize += inStream.readByte() * 16777216;
      inStream.readByte();
      inStream.readByte();
      inStream.readByte();
      inStream.readByte();
      return {

        lc,

        lp,

        pb,

        dictionarySize,

        uncompressedSize
      };
    };
    LZMA2.Decoder.prototype.init = function(keepDictionary) {
      var i = 4;
      if (!keepDictionary) this._outWindow.init(false);
      LZMA2.initBitModels(this._isMatchDecoders, 192);
      LZMA2.initBitModels(this._isRep0LongDecoders, 192);
      LZMA2.initBitModels(this._isRepDecoders, 12);
      LZMA2.initBitModels(this._isRepG0Decoders, 12);
      LZMA2.initBitModels(this._isRepG1Decoders, 12);
      LZMA2.initBitModels(this._isRepG2Decoders, 12);
      LZMA2.initBitModels(this._posDecoders, 114);
      this._literalDecoder.init();
      while (i--) {
        this._posSlotDecoder[i].init();
      }
      this._lenDecoder.init();
      this._repLenDecoder.init();
      this._posAlignDecoder.init();
      this._rangeDecoder.init();
    };
    LZMA2.Decoder.prototype.decodeBody = function(inStream, outStream, maxSize, start, reset) {
      var state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0, nowPos64 = 0, prevByte = 0, posState, decoder2, len, distance, posSlot, numDirectBits;
      this._rangeDecoder.setStream(inStream);
      this._outWindow.setStream(outStream);
      const chunked = start !== void 0;
      if (chunked) {
        nowPos64 = start;
        prevByte = start ? this._outWindow.getByte(0) : 0;
        if (!reset) [state, rep0, rep1, rep2, rep3] = this.savedState;
      }
      if (!chunked || reset) this.init(chunked);
      else this._rangeDecoder.init();
      while (maxSize < 0 || nowPos64 < maxSize) {
        posState = nowPos64 & this._posStateMask;
        if (this._rangeDecoder.decodeBit(this._isMatchDecoders, (state << 4) + posState) === 0) {
          decoder2 = this._literalDecoder.getDecoder(nowPos64++, prevByte);
          if (state >= 7) {
            prevByte = decoder2.decodeWithMatchByte(this._rangeDecoder, this._outWindow.getByte(rep0));
          } else {
            prevByte = decoder2.decodeNormal(this._rangeDecoder);
          }
          this._outWindow.putByte(prevByte);
          state = state < 4 ? 0 : state - (state < 10 ? 3 : 6);
        } else {
          if (this._rangeDecoder.decodeBit(this._isRepDecoders, state) === 1) {
            len = 0;
            if (this._rangeDecoder.decodeBit(this._isRepG0Decoders, state) === 0) {
              if (this._rangeDecoder.decodeBit(this._isRep0LongDecoders, (state << 4) + posState) === 0) {
                state = state < 7 ? 9 : 11;
                len = 1;
              }
            } else {
              if (this._rangeDecoder.decodeBit(this._isRepG1Decoders, state) === 0) {
                distance = rep1;
              } else {
                if (this._rangeDecoder.decodeBit(this._isRepG2Decoders, state) === 0) {
                  distance = rep2;
                } else {
                  distance = rep3;
                  rep3 = rep2;
                }
                rep2 = rep1;
              }
              rep1 = rep0;
              rep0 = distance;
            }
            if (len === 0) {
              len = 2 + this._repLenDecoder.decode(this._rangeDecoder, posState);
              state = state < 7 ? 8 : 11;
            }
          } else {
            rep3 = rep2;
            rep2 = rep1;
            rep1 = rep0;
            len = 2 + this._lenDecoder.decode(this._rangeDecoder, posState);
            state = state < 7 ? 7 : 10;
            posSlot = this._posSlotDecoder[len <= 5 ? len - 2 : 3].decode(this._rangeDecoder);
            if (posSlot >= 4) {
              numDirectBits = (posSlot >> 1) - 1;
              rep0 = (2 | posSlot & 1) << numDirectBits;
              if (posSlot < 14) {
                rep0 += LZMA2.reverseDecode2(
                  this._posDecoders,
                  rep0 - posSlot - 1,
                  this._rangeDecoder,
                  numDirectBits
                );
              } else {
                rep0 += this._rangeDecoder.decodeDirectBits(numDirectBits - 4) << 4;
                rep0 += this._posAlignDecoder.reverseDecode(this._rangeDecoder);
                if (rep0 < 0) {
                  if (rep0 === -1) {
                    break;
                  }
                  return false;
                }
              }
            } else {
              rep0 = posSlot;
            }
          }
          if (rep0 >= nowPos64 || rep0 >= this._dictionarySizeCheck) {
            return false;
          }
          this._outWindow.copyBlock(rep0, len);
          nowPos64 += len;
          prevByte = this._outWindow.getByte(0);
        }
      }
      if (chunked) this.savedState = [state, rep0, rep1, rep2, rep3];
      this._outWindow.flush();
      this._outWindow.releaseStream();
      this._rangeDecoder.releaseStream();
      return true;
    };
  })(LZMA);
  function unpackFolder(bytes, folder) {
    archiveCheck(folder.size <= MAX_BLOCK);
    archiveCheck(folder.start <= bytes.length && folder.packed <= bytes.length - folder.start);
    const packed = bytes.subarray(folder.start, folder.start + folder.packed);
    verifyCRC(packed, folder.packedCRC);
    let out = packed;
    if (folder.method === "33") {
      archiveCheck(false);
    } else {
      const properties = folder.properties;
      archiveCheck(properties && properties.length === 5 && properties[0] < 225);
      const dict = new DataView(properties.buffer, properties.byteOffset, 5).getUint32(1, true);
      const lc = properties[0] % 9, lp = Math.floor(properties[0] / 9) % 5, pb = Math.floor(properties[0] / 45);
      const decoder = new LZMA.Decoder();
      decoder.setProperties({ lc, lp, pb, dictionarySize: Math.min(dict, folder.size) });
      out = new Uint8Array(folder.size);
      let offset = 0;
      const sink = { writeBytes(data, size) {
        archiveCheck(size <= out.length - offset);
        out.set(data.subarray(0, size), offset);
        offset += size;
      } };
      archiveCheck(decoder.decodeBody(new ArchiveReader(packed), sink, folder.size) && offset === folder.size);
    }
    archiveCheck(out.length === folder.size);
    verifyCRC(out, folder.crc);
    return out;
  }

var MAX_ROM=16<<20,MAX_BLOCK=MAX_ROM;
function archiveCheck(ok){if(!ok)throw Error('压缩包');}
var crcTable=Uint32Array.from({length:256},(_,v)=>{for(var i=0;i<8;i++)v=(v>>>1)^((v&1)?3988292384:0);return v;});
function verifyCRC(bytes,expected){if(expected===undefined)return;var crc=-1;for(var b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);archiveCheck((~crc>>>0)===expected);}
class ArchiveReader{
  constructor(bytes){this.bytes=bytes;this.pos=0;}
  readByte(){archiveCheck(this.pos<this.bytes.length);return this.bytes[this.pos++];}
  take(n){archiveCheck(n>=0&&n<=this.bytes.length-this.pos);this.pos+=n;return this.bytes.subarray(this.pos-n,this.pos);}
  fixed(n){var v=0;for(var i=0;i<n;i++)v+=this.readByte()*256**i;archiveCheck(Number.isSafeInteger(v));return v;}
  number(){var first=this.readByte(),v=0;for(var i=0,mask=128;i<8;i++,mask>>=1){if(!(first&mask)){v+=(first&(mask-1))*256**i;archiveCheck(Number.isSafeInteger(v));return v;}v+=this.readByte()*256**i;}archiveCheck(Number.isSafeInteger(v));return v;}
  expect(n){archiveCheck(this.readByte()===n);}
  digest(n=1){var all=this.readByte();archiveCheck(all<=1);var defined=all||(n?this.readByte()&128:0);return n&&defined?this.fixed(4):undefined;}
}
async function readZip(bytes){
  var view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length),u16=p=>view.getUint16(p,true),u32=p=>view.getUint32(p,true);
  var end=bytes.length-22,low=Math.max(0,end-65535);
  for(;end>=low;end--)if(u32(end)===101010256&&end+22+u16(end+20)===bytes.length)break;
  archiveCheck(end>=low&&!u16(end+4)&&!u16(end+6)&&u16(end+8)===1&&u16(end+10)===1);
  var pos=u32(end+16);archiveCheck(pos+46<=end&&u32(pos)===33639248&&!(u16(pos+8)&1)&&u16(pos+10)===8);
  var packed=u32(pos+20),size=u32(pos+24),local=u32(pos+42);
  archiveCheck(size<=MAX_ROM&&pos+46+u16(pos+28)+u16(pos+30)+u16(pos+32)<=end&&local+30<=pos&&u32(local)===67324752&&u16(local+8)===8);
  var start=local+30+u16(local+26)+u16(local+28);archiveCheck(start+packed<=pos);
  var reader=new Blob([bytes.subarray(start,start+packed)]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),out=new Uint8Array(size),offset=0;
  try{for(;;){var part=await reader.read();if(part.done)break;archiveCheck(part.value.length<=size-offset);out.set(part.value,offset);offset+=part.value.length;}}finally{await reader.cancel().catch(()=>{});}
  archiveCheck(offset===size);verifyCRC(out,u32(pos+16));return out;
}
function readStreams(r){
  r.expect(6);var f={start:32+r.number()};r.expect(1);r.expect(9);f.packed=r.number();
  var tag=r.readByte();if(tag===10){f.packedCRC=r.digest();tag=r.readByte();}archiveCheck(tag===0);
  r.expect(7);r.expect(11);r.expect(1);r.expect(0);r.expect(1);
  var flags=r.readByte();archiveCheck(!(flags&208));f.method=Array.from(r.take(flags&15)).join('.');
  archiveCheck(f.method==='3.1.1');f.properties=flags&32?r.take(r.number()):null;
  r.expect(12);f.size=r.number();tag=r.readByte();if(tag===10){f.crc=r.digest();tag=r.readByte();}archiveCheck(tag===0);
  tag=r.readByte();if(tag===8){
    tag=r.readByte();if(tag===13){r.expect(1);tag=r.readByte();}
    if(tag===9)tag=r.readByte();
    if(tag===10){var crc=r.digest(f.crc===undefined?1:0);if(crc!==undefined)f.crc=crc;tag=r.readByte();}
    archiveCheck(tag===0);tag=r.readByte();
  }
  archiveCheck(tag===0);return f;
}
function readSevenZip(bytes){
  var start=new ArchiveReader(bytes);start.take(6);start.expect(0);start.readByte();verifyCRC(bytes.subarray(12,32),start.fixed(4));
  var offset=32+start.fixed(8),size=start.fixed(8),crc=start.fixed(4);archiveCheck(size<=MAX_BLOCK&&offset+size<=bytes.length);
  var header=bytes.subarray(offset,offset+size);verifyCRC(header,crc);var r=new ArchiveReader(header),tag=r.readByte();
  if(tag===23){var encoded=readStreams(r);archiveCheck(r.pos===r.bytes.length);r=new ArchiveReader(unpackFolder(bytes,encoded));tag=r.readByte();}
  archiveCheck(tag===1);tag=r.readByte();if(tag===2){while(r.readByte()!==0)r.take(r.number());tag=r.readByte();}
  archiveCheck(tag===4);var folder=readStreams(r);r.expect(5);r.expect(1);
  while((tag=r.readByte())!==0){var value=r.take(r.number());if(tag===14)archiveCheck(value.length===1&&!(value[0]&128));}
  r.expect(0);archiveCheck(r.pos===r.bytes.length);return unpackFolder(bytes,folder);
}
async function readGameFile(file){
  var bytes=new Uint8Array(await file.arrayBuffer());archiveCheck(bytes.length<=MAX_ROM*4);
  if(bytes[0]===80&&bytes[1]===75||/\.zip$/i.test(file.name))bytes=await readZip(bytes);
  else if([55,122,188,175,39,28].every((b,i)=>bytes[i]===b))bytes=readSevenZip(bytes);
  else archiveCheck(!/\.7z$/i.test(file.name));
  return bytes.buffer;
}
