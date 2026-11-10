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
        throw Error("Incorrect stream properties");
      }
      if (!this.setDictionarySize(props.dictionarySize)) {
        throw Error("Invalid dictionary size");
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
  var MAX_ROM = 16 * 1024 * 1024;
  var MAX_BLOCK = 64 * 1024 * 1024;
  function archiveCheck(condition, message = "压缩包损坏或不完整。") {
    if (!condition) throw new Error(message);
  }
  var crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let i = 0; i < 8; i++) value = value >>> 1 ^ (value & 1 ? 3988292384 : 0);
    return value;
  });
  function verifyCRC(bytes, expected) {
    if (expected === void 0) return;
    let crc = 4294967295;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
    archiveCheck(~crc >>> 0 === expected, "压缩包 CRC 校验失败。");
  }
  async function inflateZip(packed, size) {
    const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const output = new Uint8Array(size);
    let offset = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        archiveCheck(offset + value.length <= size);
        output.set(value, offset);
        offset += value.length;
      }
    } finally {
      await reader.cancel().catch(() => {
      });
    }
    archiveCheck(offset === size);
    return output;
  }
  async function readZip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    const u16 = (p) => view.getUint16(p, true);
    const u32 = (p) => view.getUint32(p, true);
    let end = bytes.length - 22;
    const lower = Math.max(0, end - 65535);
    for (; end >= lower; end--) {
      if (u32(end) === 101010256 && end + 22 + u16(end + 20) === bytes.length) break;
    }
    archiveCheck(end >= lower);
    archiveCheck(!u16(end + 4) && !u16(end + 6) && u16(end + 8) === u16(end + 10) && u16(end + 10) !== 65535, "不支持分卷或 ZIP64。");
    const central = u32(end + 16);
    let pos = central;
    for (let index = 0; index < u16(end + 10); index++) {
      archiveCheck(pos + 46 <= end && u32(pos) === 33639248);
      const nameLength = u16(pos + 28), next = pos + 46 + nameLength + u16(pos + 30) + u16(pos + 32);
      archiveCheck(next <= end);
      const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
      if (/\.nes$/i.test(name)) {
        const method = u16(pos + 10), size = u32(pos + 24), packedSize = u32(pos + 20), local = u32(pos + 42);
        archiveCheck(!(u16(pos + 8) & 1), "不支持加密 ZIP。");
        archiveCheck(method === 0 || method === 8, "ZIP 只支持存储和 Deflate。");
        archiveCheck(size <= MAX_ROM, "ROM 超过 16 MiB。");
        archiveCheck(local + 30 <= central && u32(local) === 67324752 && u16(local + 8) === method);
        const start = local + 30 + u16(local + 26) + u16(local + 28);
        archiveCheck(start + packedSize <= central);
        const packed = bytes.subarray(start, start + packedSize);
        const rom = method === 8 ? await inflateZip(packed, size) : packed;
        archiveCheck(rom.length === size);
        verifyCRC(rom, u32(pos + 16));
        return { name, bytes: rom };
      }
      pos = next;
    }
    throw new Error("压缩包内没有 .nes 文件。");
  }
  var ArchiveReader = class {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0;
    }
    readByte() {
      archiveCheck(this.pos < this.bytes.length);
      return this.bytes[this.pos++];
    }
    take(size) {
      archiveCheck(size >= 0 && size <= this.bytes.length - this.pos);
      this.pos += size;
      return this.bytes.subarray(this.pos - size, this.pos);
    }
    fixed(n) {
      let value = 0;
      for (let i = 0; i < n; i++) value += this.readByte() * 256 ** i;
      archiveCheck(Number.isSafeInteger(value));
      return value;
    }
    number() {
      const first = this.readByte();
      let low = 0;
      for (let i = 0, mask = 128; i < 8; i++, mask >>= 1) {
        if (!(first & mask)) {
          const result = low + (first & mask - 1) * 256 ** i;
          archiveCheck(Number.isSafeInteger(result));
          return result;
        }
        low += this.readByte() * 256 ** i;
      }
      archiveCheck(Number.isSafeInteger(low));
      return low;
    }
    count() {
      const count = this.number();
      archiveCheck(count <= 65535, "压缩包条目过多。");
      return count;
    }
    expect(id) {
      archiveCheck(this.readByte() === id);
    }
    flags(count) {
      const bits = this.take(Math.ceil(count / 8));
      return Array.from({ length: count }, (_, i) => !!(bits[i >> 3] & 128 >> i % 8));
    }
    digests(count) {
      const all = this.readByte();
      const flags = all ? null : this.flags(count);
      return Array.from({ length: count }, (_, i) => all || flags[i] ? this.fixed(4) : void 0);
    }
  };
  function readStreams(r) {
    r.expect(6);
    let packedPos = 32 + r.number();
    const n = r.count();
    r.expect(9);
    const folders = Array.from({ length: n }, () => {
      const start = packedPos, packed = r.number();
      packedPos += packed;
      return { start, packed, count: 1, sizes: [] };
    });
    let tag = r.readByte();
    if (tag === 10) {
      r.digests(n).forEach((crc, i) => folders[i].packedCRC = crc);
      tag = r.readByte();
    }
    archiveCheck(tag === 0);
    r.expect(7);
    r.expect(11);
    archiveCheck(r.count() === n && r.readByte() === 0, "不支持该 7z 数据流结构。");
    for (const folder of folders) {
      archiveCheck(r.number() === 1, "不支持带额外滤镜或加密的 7z。");
      const flags = r.readByte();
      archiveCheck(!(flags & 208), "不支持该 7z 编码器。");
      const method = Array.from(r.take(flags & 15)).join(".");
      archiveCheck(method === "3.1.1" || method === "33" || method === "0", "7z 支持 LZMA、LZMA2 和存储。此压缩方法不受支持。");
      folder.method = method;
      folder.properties = flags & 32 ? r.take(r.number()) : null;
    }
    r.expect(12);
    for (const folder of folders) folder.size = r.number();
    tag = r.readByte();
    if (tag === 10) {
      r.digests(n).forEach((crc, i) => folders[i].crc = crc);
      tag = r.readByte();
    }
    archiveCheck(tag === 0);
    tag = r.readByte();
    if (tag === 8) {
      tag = r.readByte();
      if (tag === 13) {
        for (const folder of folders) folder.count = r.count();
        tag = r.readByte();
      }
      archiveCheck(folders.reduce((sum, f) => sum + f.count, 0) <= 65535);
      if (tag === 9) {
        for (const folder of folders) {
          for (let i = 1; i < folder.count; i++) folder.sizes.push(r.number());
        }
        tag = r.readByte();
      }
      if (tag === 10) {
        const separate = folders.filter((f) => f.count !== 1 || f.crc === void 0);
        const crcs = r.digests(separate.reduce((sum, f) => sum + f.count, 0));
        let pos = 0;
        for (const f of separate) {
          f.crcs = crcs.slice(pos, pos + f.count);
          pos += f.count;
        }
        tag = r.readByte();
      }
      archiveCheck(tag === 0);
      tag = r.readByte();
    }
    archiveCheck(tag === 0);
    for (const f of folders) {
      if (!f.count) continue;
      const last = f.size - f.sizes.reduce((a, b) => a + b, 0);
      archiveCheck(last >= 0 && f.sizes.length === f.count - 1);
      f.sizes.push(last);
    }
    return folders;
  }
  function decodeLZMA2(packed, properties, size) {
    archiveCheck(properties?.length === 1 && properties[0] <= 40);
    const prop = properties[0];
    const dictionary = prop === 40 ? 4294967295 : (2 + (prop & 1)) * 2 ** (11 + (prop >> 1));
    const reader = new ArchiveReader(packed);
    const out = new Uint8Array(size);
    const decoder = new LZMA.Decoder();
    decoder.setDictionarySize(Math.min(dictionary, size));
    let offset = 0, sinceReset = 0, initialized = false, configured = false;
    const sink = { writeBytes(data, length) {
      archiveCheck(length <= size - offset);
      out.set(data.subarray(0, length), offset);
      offset += length;
    } };
    const word = () => reader.readByte() * 256 + reader.readByte();
    for (; ; ) {
      const control = reader.readByte();
      if (control === 0) break;
      if (control >= 224 || control === 1) {
        initialized = true;
        configured = false;
        sinceReset = 0;
        decoder._outWindow.init(false);
      }
      archiveCheck(initialized);
      let length = word() + 1;
      if (control < 128) {
        archiveCheck(control <= 2 && length <= size - offset);
        decoder._outWindow.setStream(sink);
        for (const b of reader.take(length)) decoder._outWindow.putByte(b);
        decoder._outWindow.releaseStream();
      } else {
        length += (control & 31) * 65536;
        const compressed = word() + 1;
        if (control >= 192) {
          const p = reader.readByte(), lc = p % 9, lp = Math.floor(p / 9) % 5, pb = Math.floor(p / 45);
          archiveCheck(lc + lp <= 4 && decoder.setLcLpPb(lc, lp, pb));
          configured = true;
        }
        archiveCheck(configured && length <= size - offset);
        const chunk = new ArchiveReader(reader.take(compressed));
        const end = offset + length;
        archiveCheck(chunk.bytes[0] === 0 && decoder.decodeBody(chunk, sink, sinceReset + length, sinceReset, control >= 160));
        archiveCheck(offset === end && chunk.pos === compressed && decoder._rangeDecoder._code >>> 0 === 0);
      }
      sinceReset += length;
    }
    archiveCheck(offset === size && reader.pos === packed.length);
    return out;
  }
  function unpackFolder(bytes, folder) {
    archiveCheck(folder.size <= MAX_BLOCK, "7z 解压块超过 64 MiB。");
    archiveCheck(folder.start <= bytes.length && folder.packed <= bytes.length - folder.start);
    const packed = bytes.subarray(folder.start, folder.start + folder.packed);
    verifyCRC(packed, folder.packedCRC);
    let out = packed;
    if (folder.method === "33") {
      out = decodeLZMA2(packed, folder.properties, folder.size);
    } else if (folder.method !== "0") {
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
  function readSevenZip(bytes) {
    const signature = new ArchiveReader(bytes);
    signature.take(6);
    archiveCheck(signature.readByte() === 0, "不支持该 7z 版本。");
    signature.readByte();
    const startCRC = signature.fixed(4);
    verifyCRC(bytes.subarray(12, 32), startCRC);
    const start = 32 + signature.fixed(8), size = signature.fixed(8), crc = signature.fixed(4);
    archiveCheck(size <= MAX_BLOCK && start + size <= bytes.length);
    const header = bytes.subarray(start, start + size);
    verifyCRC(header, crc);
    if (!header.length) throw new Error("压缩包内没有 .nes 文件。");
    let r = new ArchiveReader(header), tag = r.readByte();
    if (tag === 23) {
      const folders2 = readStreams(r);
      archiveCheck(folders2.length === 1);
      r = new ArchiveReader(unpackFolder(bytes, folders2[0]));
      tag = r.readByte();
    }
    archiveCheck(tag === 1);
    tag = r.readByte();
    if (tag === 2) {
      while (r.readByte() !== 0) r.take(r.number());
      tag = r.readByte();
    }
    let folders = [];
    if (tag === 4) {
      folders = readStreams(r);
      tag = r.readByte();
    }
    archiveCheck(tag === 5, "不支持该 7z 文件目录。");
    const count = r.count();
    let names = [], empty = [];
    while ((tag = r.readByte()) !== 0) {
      const value = new ArchiveReader(r.take(r.number()));
      if (tag === 14) empty = value.flags(count);
      if (tag === 17) {
        value.expect(0);
        names = new TextDecoder("utf-16le").decode(value.take(value.bytes.length - 1)).split("\0");
        archiveCheck(names.pop() === "" && names.length === count);
      }
    }
    r.expect(0);
    let index = 0;
    for (const f of folders) {
      let offset = 0;
      for (let i = 0; i < f.count; i++) {
        while (index < count && empty[index]) index++;
        archiveCheck(index < count);
        const name = names[index++], length = f.sizes[i];
        if (name && /\.nes$/i.test(name)) {
          archiveCheck(length <= MAX_ROM, "ROM 超过 16 MiB。");
          const entry = unpackFolder(bytes, f).subarray(offset, offset + length);
          verifyCRC(entry, f.crcs?.[i]);
          return { name, bytes: entry };
        }
        offset += length;
      }
    }
    throw new Error("压缩包内没有 .nes 文件。");
  }
  async function readGameFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let entry;
    if (bytes[0] === 80 && bytes[1] === 75 || /\.zip$/i.test(file.name)) {
      entry = await readZip(bytes);
    } else if ([55, 122, 188, 175, 39, 28].every((b, i) => bytes[i] === b)) {
      entry = readSevenZip(bytes);
    } else {
      archiveCheck(!/\.7z$/i.test(file.name), "7z 文件签名无效。");
      return { buffer: bytes.buffer, name: file.name };
    }
    return { buffer: entry.bytes.slice().buffer, name: file.name + " › " + entry.name };
  }
