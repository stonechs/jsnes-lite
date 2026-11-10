// JSNES 2.1.0 audio core, Apache-2.0. See LICENSE-JSNES.txt.
// Source commit b8a45d088e922b6abcd87c4eb1b7237919e9d3d2.
var JSNESPAPU=(function(){
function copyArrayElements(src, srcPos, dest, destPos, length) {
  for (let i = 0; i < length; ++i) {
    dest[destPos + i] = src[srcPos + i];
  }
}

function copyArray(src) {
  return src.slice(0);
}

function fromJSON(obj, state) {
  const props = obj.constructor.JSON_PROPERTIES;
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const current = obj[prop];
    const value = state[prop];
    if (ArrayBuffer.isView(current) && Array.isArray(value)) {
      // Typed arrays: copy data in-place instead of replacing the array,
      // since JSON.parse produces plain arrays not typed arrays.
      current.set(value);
    } else {
      obj[prop] = value;
    }
  }
}

function toJSON(obj) {
  const state = {};
  const props = obj.constructor.JSON_PROPERTIES;
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    const value = obj[prop];
    // Typed arrays must be converted to plain arrays for JSON.stringify,
    // which otherwise serializes them as objects ({0: v, 1: v, ...}).
    state[prop] = ArrayBuffer.isView(value) ? Array.from(value) : value;
  }
  return state;
}


class ChannelDM {
  static MODE_NORMAL = 0;
  static MODE_LOOP = 1;
  static MODE_IRQ = 2;

  static JSON_PROPERTIES = [
    "isEnabled",
    "hasSample",
    "irqGenerated",
    "playMode",
    "dmaFrequency",
    "dmaCounter",
    "deltaCounter",
    "playStartAddress",
    "playAddress",
    "playLength",
    "playLengthCounter",
    "shiftCounter",
    "reg4012",
    "reg4013",
    "sample",
    "dacLsb",
    "data",
    "lastFetchedByte",
  ];

  constructor(papu) {
    this.papu = papu;

    this.isEnabled = false;
    this.hasSample = false;
    this.irqGenerated = false;
    this.playMode = ChannelDM.MODE_NORMAL;
    this.dmaFrequency = 0;
    this.dmaCounter = 0;
    this.deltaCounter = 0;
    this.playStartAddress = 0;
    this.playAddress = 0;
    this.playLength = 0;
    this.playLengthCounter = 0;
    this.sample = 0;
    this.dacLsb = 0;
    this.shiftCounter = 0;
    this.reg4012 = 0;
    this.reg4013 = 0;
    this.data = 0;
    this.lastFetchedByte = 0;
  }

  clockDmc() {
    // Only alter DAC value if the sample buffer has data:
    if (this.hasSample) {
      if ((this.data & 1) === 0) {
        // Decrement delta:
        if (this.deltaCounter > 0) {
          this.deltaCounter--;
        }
      } else {
        // Increment delta:
        if (this.deltaCounter < 63) {
          this.deltaCounter++;
        }
      }

      // Update sample value:
      this.sample = this.isEnabled ? (this.deltaCounter << 1) + this.dacLsb : 0;

      // Update shift register:
      this.data >>= 1;
    }

    this.dmaCounter--;
    if (this.dmaCounter <= 0) {
      // No more sample bits.
      this.hasSample = false;
      this.endOfSample();
      this.dmaCounter = 8;
    }

    if (this.irqGenerated) {
      this.papu.nes.cpu.requestIrq(this.papu.nes.cpu.IRQ_NORMAL);
    }
  }

  endOfSample() {
    if (this.playLengthCounter === 0 && this.playMode === ChannelDM.MODE_LOOP) {
      // Start from beginning of sample:
      this.playAddress = this.playStartAddress;
      this.playLengthCounter = this.playLength;
    }

    if (this.playLengthCounter > 0) {
      // Fetch next sample:
      this.nextSample();

      if (this.playLengthCounter === 0) {
        // Last byte of sample fetched, generate IRQ:
        if (this.playMode === ChannelDM.MODE_IRQ) {
          // Generate IRQ:
          this.irqGenerated = true;
        }
      }
    }
  }

  nextSample() {
    // Fetch byte:
    this.data = this.papu.nes.mmap.load(this.playAddress);
    // On real hardware, the DMA fetch puts this byte on the CPU data bus.
    // Store it so cpu.load() can detect DMA bus hijacking mid-instruction.
    // See https://www.nesdev.org/wiki/APU_DMC#Memory_reader
    this.lastFetchedByte = this.data;
    this.papu.nes.cpu.haltCycles(4);

    this.playLengthCounter--;
    this.playAddress++;
    if (this.playAddress > 0xffff) {
      this.playAddress = 0x8000;
    }

    this.hasSample = true;
  }

  writeReg(address, value) {
    if (address === 0x4010) {
      // Play mode, DMA Frequency
      if (value >> 6 === 0) {
        this.playMode = ChannelDM.MODE_NORMAL;
      } else if (((value >> 6) & 1) === 1) {
        this.playMode = ChannelDM.MODE_LOOP;
      } else if (value >> 6 === 2) {
        this.playMode = ChannelDM.MODE_IRQ;
      }

      if ((value & 0x80) === 0) {
        this.irqGenerated = false;
      }

      this.dmaFrequency = this.papu.getDmcFrequency(value & 0xf);
    } else if (address === 0x4011) {
      // Delta counter load register:
      this.deltaCounter = (value >> 1) & 63;
      this.dacLsb = value & 1;
      this.sample = (this.deltaCounter << 1) + this.dacLsb; // update sample value
    } else if (address === 0x4012) {
      // DMA address load register.
      // Only updates the start address register — the active playAddress is
      // loaded from playStartAddress when a sample restart occurs (via $4015).
      // See https://www.nesdev.org/wiki/APU_DMC
      this.playStartAddress = (value << 6) | 0x0c000;
      this.reg4012 = value;
    } else if (address === 0x4013) {
      // Length of play code.
      // Only updates the length register — the active playLengthCounter is
      // loaded from playLength when a sample restart occurs (via $4015 or
      // loop). Writing $4013 does not affect a currently playing sample.
      // See https://www.nesdev.org/wiki/APU_DMC
      this.playLength = (value << 4) + 1;
      this.reg4013 = value;
    } else if (address === 0x4015) {
      // DMC/IRQ Status
      // Writing $4015 always clears the DMC IRQ flag first, before any
      // other effects. On real hardware, the flag clear occurs on the
      // write cycle, while DMA fetches happen 3-4 cycles later — so a
      // DMA fetch triggered by this write CAN set a new IRQ flag.
      // See https://www.nesdev.org/wiki/APU_DMC
      this.irqGenerated = false;

      if (((value >> 4) & 1) === 0) {
        // Disable: set bytes remaining to 0.
        this.playLengthCounter = 0;
      } else {
        // Enable: only restart the sample if bytes remaining is 0.
        // If the sample is still playing (bytes remaining > 0), this
        // write has no effect on playback.
        if (this.playLengthCounter === 0) {
          this.playAddress = this.playStartAddress;
          this.playLengthCounter = this.playLength;
          // On real hardware, when DMC is enabled and the sample buffer is
          // empty, a DMA fetch fires within a few CPU cycles. Trigger it
          // immediately so the DMASync loop in test ROMs can detect the
          // first fetch. See https://www.nesdev.org/wiki/APU_DMC
          if (!this.hasSample && this.playLengthCounter > 0) {
            this.nextSample();
            this.dmaCounter = 8;
            this.shiftCounter = this.dmaFrequency;
            // If the immediate DMA fetch consumed the last byte (e.g. a
            // 1-byte sample), set the IRQ flag just like endOfSample does.
            if (
              this.playLengthCounter === 0 &&
              this.playMode === ChannelDM.MODE_IRQ
            ) {
              this.irqGenerated = true;
            }
          }
        }
      }
    }
  }

  setEnabled(value) {
    // Just track the enable flag. The restart logic (reloading address and
    // length counter) is handled in writeReg for $4015, which is always
    // called after setEnabled in the $4015 write path.
    this.isEnabled = value;
  }

  getLengthStatus() {
    return this.playLengthCounter === 0 || !this.isEnabled ? 0 : 1;
  }

  getIrqStatus() {
    return this.irqGenerated ? 1 : 0;
  }

  toJSON() {
    return toJSON(this);
  }

  fromJSON(s) {
    fromJSON(this, s);
  }
}



class ChannelNoise {
  constructor(papu) {
    this.papu = papu;

    this.progTimerCount = 0;
    this.progTimerMax = 0;
    this.isEnabled = false;
    this.lengthCounter = 0;
    this.lengthCounterEnable = false;
    this.envDecayDisable = false;
    this.envDecayLoopEnable = false;
    this.envReset = false;
    this.shiftNow = false;
    this.envDecayRate = 0;
    this.envDecayCounter = 0;
    this.envVolume = 0;
    this.masterVolume = 0;
    this.shiftReg = 1;
    this.randomBit = 0;
    this.randomMode = 0;
    this.sampleValue = 0;
    this.tmp = 0;
    this.accValue = 0;
    this.accCount = 1;
  }

  clockLengthCounter() {
    if (this.lengthCounterEnable && this.lengthCounter > 0) {
      this.lengthCounter--;
      if (this.lengthCounter === 0) {
        this.updateSampleValue();
      }
    }
  }

  clockEnvDecay() {
    if (this.envReset) {
      // Reset envelope:
      this.envReset = false;
      this.envDecayCounter = this.envDecayRate + 1;
      this.envVolume = 0xf;
    } else if (--this.envDecayCounter <= 0) {
      // Normal handling:
      this.envDecayCounter = this.envDecayRate + 1;
      if (this.envVolume > 0) {
        this.envVolume--;
      } else {
        this.envVolume = this.envDecayLoopEnable ? 0xf : 0;
      }
    }
    if (this.envDecayDisable) {
      this.masterVolume = this.envDecayRate;
    } else {
      this.masterVolume = this.envVolume;
    }
    this.updateSampleValue();
  }

  updateSampleValue() {
    if (this.isEnabled && this.lengthCounter > 0) {
      this.sampleValue = this.randomBit * this.masterVolume;
    }
  }

  writeReg(address, value) {
    if (address === 0x400c) {
      // Volume/Envelope decay:
      this.envDecayDisable = (value & 0x10) !== 0;
      this.envDecayRate = value & 0xf;
      this.envDecayLoopEnable = (value & 0x20) !== 0;
      this.lengthCounterEnable = (value & 0x20) === 0;
      if (this.envDecayDisable) {
        this.masterVolume = this.envDecayRate;
      } else {
        this.masterVolume = this.envVolume;
      }
    } else if (address === 0x400e) {
      // Programmable timer:
      this.progTimerMax = this.papu.getNoiseWaveLength(value & 0xf);
      this.randomMode = value >> 7;
    } else if (address === 0x400f) {
      // Length counter — only loaded when the channel is enabled via $4015.
      // Writing this register while disabled has no effect on the length counter.
      // See https://www.nesdev.org/wiki/APU#Status_($4015)
      if (this.isEnabled) {
        this.lengthCounter = this.papu.getLengthMax(value & 248);
      }
      this.envReset = true;
    }
    // Update:
    //updateSampleValue();
  }

  setEnabled(value) {
    this.isEnabled = value;
    if (!value) {
      this.lengthCounter = 0;
    }
    this.updateSampleValue();
  }

  getLengthStatus() {
    return this.lengthCounter === 0 || !this.isEnabled ? 0 : 1;
  }

  toJSON() {
    return toJSON(this);
  }

  fromJSON(s) {
    fromJSON(this, s);
  }

  static JSON_PROPERTIES = [
    "isEnabled",
    "envDecayDisable",
    "envDecayLoopEnable",
    "lengthCounterEnable",
    "envReset",
    "shiftNow",
    "lengthCounter",
    "progTimerCount",
    "progTimerMax",
    "envDecayRate",
    "envDecayCounter",
    "envVolume",
    "masterVolume",
    "shiftReg",
    "randomBit",
    "randomMode",
    "sampleValue",
    "accValue",
    "accCount",
    "tmp",
  ];
}



class ChannelSquare {
  constructor(papu, square1) {
    this.papu = papu;

    // prettier-ignore
    this.dutyLookup = [
           0, 1, 0, 0, 0, 0, 0, 0,
           0, 1, 1, 0, 0, 0, 0, 0,
           0, 1, 1, 1, 1, 0, 0, 0,
           1, 0, 0, 1, 1, 1, 1, 1
      ];
    // prettier-ignore
    this.impLookup = [
           1,-1, 0, 0, 0, 0, 0, 0,
           1, 0,-1, 0, 0, 0, 0, 0,
           1, 0, 0, 0,-1, 0, 0, 0,
          -1, 0, 1, 0, 0, 0, 0, 0
      ];

    this.sqr1 = square1;

    this.progTimerCount = 0;
    this.progTimerMax = 0;
    this.lengthCounter = 0;
    this.squareCounter = 0;
    this.sweepCounter = 0;
    this.sweepCounterMax = 0;
    this.sweepMode = 0;
    this.sweepShiftAmount = 0;
    this.envDecayRate = 0;
    this.envDecayCounter = 0;
    this.envVolume = 0;
    this.masterVolume = 0;
    this.dutyMode = 0;
    this.vol = 0;
    this.isEnabled = false;
    this.lengthCounterEnable = false;
    this.sweepActive = false;
    this.sweepCarry = false;
    this.envDecayDisable = false;
    this.envDecayLoopEnable = false;
    this.envReset = false;
    this.updateSweepPeriod = false;
    this.sweepResult = 0;
    this.sampleValue = 0;
  }

  clockLengthCounter() {
    if (this.lengthCounterEnable && this.lengthCounter > 0) {
      this.lengthCounter--;
      if (this.lengthCounter === 0) {
        this.updateSampleValue();
      }
    }
  }

  clockEnvDecay() {
    if (this.envReset) {
      // Reset envelope:
      this.envReset = false;
      this.envDecayCounter = this.envDecayRate + 1;
      this.envVolume = 0xf;
    } else if (--this.envDecayCounter <= 0) {
      // Normal handling:
      this.envDecayCounter = this.envDecayRate + 1;
      if (this.envVolume > 0) {
        this.envVolume--;
      } else {
        this.envVolume = this.envDecayLoopEnable ? 0xf : 0;
      }
    }

    if (this.envDecayDisable) {
      this.masterVolume = this.envDecayRate;
    } else {
      this.masterVolume = this.envVolume;
    }
    this.updateSampleValue();
  }

  clockSweep() {
    if (--this.sweepCounter <= 0) {
      this.sweepCounter = this.sweepCounterMax + 1;
      if (
        this.sweepActive &&
        this.sweepShiftAmount > 0 &&
        this.progTimerMax > 7
      ) {
        // Calculate result from shifter:
        this.sweepCarry = false;
        if (this.sweepMode === 0) {
          this.progTimerMax += this.progTimerMax >> this.sweepShiftAmount;
          if (this.progTimerMax > 0x7ff) {
            this.progTimerMax = 4095;
            this.sweepCarry = true;
          }
        } else {
          this.progTimerMax =
            this.progTimerMax -
            ((this.progTimerMax >> this.sweepShiftAmount) +
              (this.sqr1 ? 1 : 0));
        }
      }
    }

    if (this.updateSweepPeriod) {
      this.updateSweepPeriod = false;
      this.sweepCounter = this.sweepCounterMax + 1;
    }
  }

  updateSampleValue() {
    if (this.isEnabled && this.lengthCounter > 0 && this.progTimerMax > 7) {
      if (
        this.sweepMode === 0 &&
        this.progTimerMax + (this.progTimerMax >> this.sweepShiftAmount) > 0x7ff
      ) {
        //if (this.sweepCarry) {
        this.sampleValue = 0;
      } else {
        this.sampleValue =
          this.masterVolume *
          this.dutyLookup[(this.dutyMode << 3) + this.squareCounter];
      }
    } else {
      this.sampleValue = 0;
    }
  }

  writeReg(address, value) {
    let addrAdd = this.sqr1 ? 0 : 4;
    if (address === 0x4000 + addrAdd) {
      // Volume/Envelope decay:
      this.envDecayDisable = (value & 0x10) !== 0;
      this.envDecayRate = value & 0xf;
      this.envDecayLoopEnable = (value & 0x20) !== 0;
      this.dutyMode = (value >> 6) & 0x3;
      this.lengthCounterEnable = (value & 0x20) === 0;
      if (this.envDecayDisable) {
        this.masterVolume = this.envDecayRate;
      } else {
        this.masterVolume = this.envVolume;
      }
      this.updateSampleValue();
    } else if (address === 0x4001 + addrAdd) {
      // Sweep:
      this.sweepActive = (value & 0x80) !== 0;
      this.sweepCounterMax = (value >> 4) & 7;
      this.sweepMode = (value >> 3) & 1;
      this.sweepShiftAmount = value & 7;
      this.updateSweepPeriod = true;
    } else if (address === 0x4002 + addrAdd) {
      // Programmable timer:
      this.progTimerMax &= 0x700;
      this.progTimerMax |= value;
    } else if (address === 0x4003 + addrAdd) {
      // Programmable timer, length counter
      this.progTimerMax &= 0xff;
      this.progTimerMax |= (value & 0x7) << 8;

      if (this.isEnabled) {
        this.lengthCounter = this.papu.getLengthMax(value & 0xf8);
      }

      this.envReset = true;
    }
  }

  setEnabled(value) {
    this.isEnabled = value;
    if (!value) {
      this.lengthCounter = 0;
    }
    this.updateSampleValue();
  }

  getLengthStatus() {
    return this.lengthCounter === 0 || !this.isEnabled ? 0 : 1;
  }

  toJSON() {
    return toJSON(this);
  }

  fromJSON(s) {
    fromJSON(this, s);
  }

  static JSON_PROPERTIES = [
    "isEnabled",
    "lengthCounterEnable",
    "sweepActive",
    "envDecayDisable",
    "envDecayLoopEnable",
    "envReset",
    "sweepCarry",
    "updateSweepPeriod",
    "progTimerCount",
    "progTimerMax",
    "lengthCounter",
    "squareCounter",
    "sweepCounter",
    "sweepCounterMax",
    "sweepMode",
    "sweepShiftAmount",
    "envDecayRate",
    "envDecayCounter",
    "envVolume",
    "masterVolume",
    "dutyMode",
    "sweepResult",
    "sampleValue",
    "vol",
  ];
}



class ChannelTriangle {
  constructor(papu) {
    this.papu = papu;

    this.progTimerCount = 0;
    this.progTimerMax = 0;
    this.triangleCounter = 0;
    this.isEnabled = false;
    this.sampleCondition = false;
    this.lengthCounter = 0;
    this.lengthCounterEnable = false;
    this.linearCounter = 0;
    this.lcLoadValue = 0;
    this.lcHalt = true;
    this.lcControl = false;
    this.tmp = 0;
    this.sampleValue = 0xf;
  }

  clockLengthCounter() {
    if (this.lengthCounterEnable && this.lengthCounter > 0) {
      this.lengthCounter--;
      if (this.lengthCounter === 0) {
        this.updateSampleCondition();
      }
    }
  }

  clockLinearCounter() {
    if (this.lcHalt) {
      // Load:
      this.linearCounter = this.lcLoadValue;
      this.updateSampleCondition();
    } else if (this.linearCounter > 0) {
      // Decrement:
      this.linearCounter--;
      this.updateSampleCondition();
    }
    if (!this.lcControl) {
      // Clear halt flag:
      this.lcHalt = false;
    }
  }

  getLengthStatus() {
    return this.lengthCounter === 0 || !this.isEnabled ? 0 : 1;
  }

  // eslint-disable-next-line no-unused-vars
  readReg(address) {
    return 0;
  }

  writeReg(address, value) {
    if (address === 0x4008) {
      // New values for linear counter:
      this.lcControl = (value & 0x80) !== 0;
      this.lcLoadValue = value & 0x7f;

      // Length counter enable:
      this.lengthCounterEnable = !this.lcControl;
    } else if (address === 0x400a) {
      // Programmable timer:
      this.progTimerMax &= 0x700;
      this.progTimerMax |= value;
    } else if (address === 0x400b) {
      // Programmable timer, length counter
      this.progTimerMax &= 0xff;
      this.progTimerMax |= (value & 0x07) << 8;
      // Length counter is only loaded when the channel is enabled via $4015.
      // Writing this register while disabled has no effect on the length counter.
      // See https://www.nesdev.org/wiki/APU#Status_($4015)
      if (this.isEnabled) {
        this.lengthCounter = this.papu.getLengthMax(value & 0xf8);
      }
      this.lcHalt = true;
    }

    this.updateSampleCondition();
  }

  clockProgrammableTimer(nCycles) {
    if (this.progTimerMax > 0) {
      this.progTimerCount += nCycles;
      while (
        this.progTimerMax > 0 &&
        this.progTimerCount >= this.progTimerMax
      ) {
        this.progTimerCount -= this.progTimerMax;
        if (
          this.isEnabled &&
          this.lengthCounter > 0 &&
          this.linearCounter > 0
        ) {
          this.clockTriangleGenerator();
        }
      }
    }
  }

  clockTriangleGenerator() {
    this.triangleCounter++;
    this.triangleCounter &= 0x1f;
  }

  setEnabled(value) {
    this.isEnabled = value;
    if (!value) {
      this.lengthCounter = 0;
    }
    this.updateSampleCondition();
  }

  updateSampleCondition() {
    this.sampleCondition =
      this.isEnabled &&
      this.progTimerMax > 7 &&
      this.linearCounter > 0 &&
      this.lengthCounter > 0;
  }

  toJSON() {
    return toJSON(this);
  }

  fromJSON(s) {
    fromJSON(this, s);
  }

  static JSON_PROPERTIES = [
    "isEnabled",
    "sampleCondition",
    "lengthCounterEnable",
    "lcHalt",
    "lcControl",
    "progTimerCount",
    "progTimerMax",
    "triangleCounter",
    "lengthCounter",
    "linearCounter",
    "lcLoadValue",
    "sampleValue",
    "tmp",
  ];
}



const CPU_FREQ_NTSC = 1789772.5; //1789772.72727272d;
// const CPU_FREQ_PAL = 1773447.4;

// Frame counter step timing tables (in CPU cycles).
// The APU frame counter fires at these specific cycle positions within each
// sequence. On real hardware, the APU clock is half the CPU clock, so
// these correspond to APU cycles 3728.5, 7456.5, 11185.5, 14914, 14914.5 etc.
// In 4-step mode, the IRQ flag is set 1 CPU cycle before the clock event
// (at 29828 vs 29829), so step 3 is split into two sub-steps.
// See https://www.nesdev.org/wiki/APU_Frame_Counter
const FRAME_STEPS_4 = [7457, 14913, 22371, 29828, 29829];
// 5-step mode step 3 fires at 29829 per the nesdev wiki, not 29828. This is
// fine because fireFrameStep step 3 in 5-step mode is a no-op (no clock or IRQ).
const FRAME_STEPS_5 = [7457, 14913, 22371, 29829, 37281];
const FRAME_PERIOD_4 = 29830; // Total CPU cycles for 4-step sequence
const FRAME_PERIOD_5 = 37282; // Total CPU cycles for 5-step sequence

class PAPU {
  constructor(nes) {
    this.nes = nes;

    this.square1 = new ChannelSquare(this, true);
    this.square2 = new ChannelSquare(this, false);
    this.triangle = new ChannelTriangle(this);
    this.noise = new ChannelNoise(this);
    this.dmc = new ChannelDM(this);

    this.startedPlaying = false;
    this.recordOutput = false;
    this.triValue = 0;

    // DC removal vars:
    this.prevSampleL = 0;
    this.prevSampleR = 0;
    this.smpAccumL = 0;
    this.smpAccumR = 0;

    // DAC range:
    this.dacRange = 0;
    this.dcValue = 0;

    // Master volume:
    this.masterVolume = 256;

    // Panning:
    this.panning = [80, 170, 100, 150, 128];
    this.setPanning(this.panning);

    // Initialize lookup tables:
    this.initLengthLookup();
    this.initDmcFrequencyLookup();
    this.initNoiseWavelengthLookup();
    this.initDACtables();

    // Init sound registers:
    for (let i = 0; i < 0x14; i++) {
      if (i === 0x10) {
        this.writeReg(0x4010, 0x10);
      } else {
        this.writeReg(0x4000 + i, 0);
      }
    }

    this.sampleRate = this.nes.opts.sampleRate;
    this.sampleTimerMax = Math.floor(
      (1024.0 * CPU_FREQ_NTSC) / this.sampleRate,
    );
    this.sampleTimer = 0;
    this.updateChannelEnable(0);
    this.frameCycleCounter = 0;
    this.frameStep = 0;
    this.countSequence = 0;
    this.sampleCount = 0;
    this.frameIrqEnabled = false;
    this.frameIrqActive = false;
    // Deferred clearing of the frame IRQ flag: on real hardware, reading
    // $4015 doesn't clear bit 6 immediately. The clear takes effect at the
    // next APU "get" cycle (the APU clock runs at half the CPU rate, so
    // get/put phases alternate every CPU cycle). This matters when $4015 is
    // read twice in quick succession (e.g., by the SLO RMW instruction's
    // dummy read + actual read, which are 1 CPU cycle apart). Depending on
    // the APU phase alignment, the second read may or may not still see
    // the flag. See AccuracyCoin test 0x0467 subtests 6 and 7.
    // https://www.nesdev.org/wiki/APU_Frame_Counter
    this.frameIrqClearPending = false;
    // APU cycle parity tracks the CPU cycle count modulo 2, determining
    // which APU half-cycle phase we're on (get or put).
    this.apuCycleParity = 0;
    this.accCount = 0;
    this.smpSquare1 = 0;
    this.smpSquare2 = 0;
    this.smpTriangle = 0;
    this.smpDmc = 0;
    this.channelEnableValue = 0xff;
    this.extraCycles = 0;
    this.maxSample = -500000;
    this.minSample = 500000;
  }

  // eslint-disable-next-line no-unused-vars
  readReg(address) {
    // Read 0x4015:
    let tmp = 0;
    tmp |= this.square1.getLengthStatus();
    tmp |= this.square2.getLengthStatus() << 1;
    tmp |= this.triangle.getLengthStatus() << 2;
    tmp |= this.noise.getLengthStatus() << 3;
    tmp |= this.dmc.getLengthStatus() << 4;
    // Bit 5 is open bus (not driven by APU), comes from CPU data bus
    // See https://www.nesdev.org/wiki/Open_bus_behavior
    tmp |= this.nes.cpu.dataBus & 0x20;
    // Frame interrupt flag: reflects whether the flag is set, regardless of
    // the IRQ inhibit bit in $4017. The inhibit only prevents the IRQ from
    // firing, not the flag from being reported.
    tmp |= (this.frameIrqActive ? 1 : 0) << 6;
    tmp |= this.dmc.getIrqStatus() << 7;

    // Reading $4015 schedules the frame interrupt flag for clearing, but
    // the actual clear is deferred to the next APU "get" cycle. This means
    // if two reads happen 1 CPU cycle apart (e.g., dummy + actual read in
    // an RMW instruction), the second read may still see the flag depending
    // on APU clock phase alignment. The DMC interrupt flag is NOT cleared.
    // Only schedule a clear when the flag is actually set; otherwise a stale
    // pending clear could race with a future fireFrameStep that sets the flag.
    // See https://www.nesdev.org/wiki/APU#Status_($4015)
    if (this.frameIrqActive) {
      this.frameIrqClearPending = true;
    }

    return tmp & 0xff;
  }

  writeReg(address, value) {
    if (address >= 0x4000 && address < 0x4004) {
      // Square Wave 1 Control
      this.square1.writeReg(address, value);
      // console.log("Square Write");
    } else if (address >= 0x4004 && address < 0x4008) {
      // Square 2 Control
      this.square2.writeReg(address, value);
    } else if (address >= 0x4008 && address < 0x400c) {
      // Triangle Control
      this.triangle.writeReg(address, value);
    } else if (address >= 0x400c && address <= 0x400f) {
      // Noise Control
      this.noise.writeReg(address, value);
    } else if (address === 0x4010) {
      // DMC Play mode & DMA frequency
      this.dmc.writeReg(address, value);
    } else if (address === 0x4011) {
      // DMC Delta Counter
      this.dmc.writeReg(address, value);
    } else if (address === 0x4012) {
      // DMC Play code starting address
      this.dmc.writeReg(address, value);
    } else if (address === 0x4013) {
      // DMC Play code length
      this.dmc.writeReg(address, value);
    } else if (address === 0x4015) {
      // Channel enable
      this.updateChannelEnable(value);

      // DMC/IRQ Status
      this.dmc.writeReg(address, value);
    } else if (address === 0x4017) {
      // Frame counter control
      // Bit 7: sequence mode (0=4-step, 1=5-step)
      // Bit 6: IRQ inhibit (0=IRQs enabled, 1=IRQs disabled)
      // See https://www.nesdev.org/wiki/APU_Frame_Counter
      this.countSequence = (value >> 7) & 1;
      // Writing $4017 resets the frame counter's internal divider, but on
      // real hardware the reset is delayed after the write cycle. The delay
      // depends on the APU clock phase at the write:
      //   "get" phase (odd parity): reset after 3 CPU cycles
      //   "put" phase (even parity): reset after 4 CPU cycles
      // Since the emulator clocks the full STA instruction's cycles (4 for
      // STA absolute) after writeReg, we compensate by starting the counter
      // negative so it reaches 0 at the true reset point.
      // See https://www.nesdev.org/wiki/APU_Frame_Counter
      let cpu = this.nes.cpu;
      let pendingCycles = cpu.instrBusCycles + 1 - cpu.apuCatchupCycles;
      let writeParity = (this.apuCycleParity + pendingCycles) & 1;
      // "get" phase (odd): -6 → after STA (4 cycles) → -2, after 2 cycles → 0
      // "put" phase (even): -7 → after STA (4 cycles) → -3, after 3 cycles → 0
      this.frameCycleCounter = -7 + writeParity;
      this.frameStep = 0;

      if (value & 0x40) {
        // IRQ inhibit set: clear the frame interrupt flag and prevent
        // future frame IRQs from firing
        this.frameIrqEnabled = false;
        this.frameIrqActive = false;
        this.frameIrqClearPending = false;
      } else {
        // IRQ inhibit clear: enable frame IRQs (flag is not affected)
        this.frameIrqEnabled = true;
      }

      if (this.countSequence === 1) {
        // 5-step mode: immediately clock all quarter-frame and half-frame
        // units on the write cycle
        this.clockQuarterFrame();
        this.clockHalfFrame();
      }
    }
  }

  // Updates channel enable status.
  // This is done on writes to the
  // channel enable register (0x4015),
  // and when the user enables/disables channels
  // in the GUI.
  updateChannelEnable(value) {
    this.channelEnableValue = value & 0xffff;
    this.square1.setEnabled((value & 1) !== 0);
    this.square2.setEnabled((value & 2) !== 0);
    this.triangle.setEnabled((value & 4) !== 0);
    this.noise.setEnabled((value & 8) !== 0);
    this.dmc.setEnabled((value & 16) !== 0);
  }

  // Clocks all APU channel timers and the frame counter by nCycles CPU cycles.
  // Called once per instruction from the frame loop with the total cycle count.
  // frameCounterAlreadyAdvanced is the number of frame counter cycles already
  // advanced mid-instruction by APU catch-up (advanceFrameCounter). This is
  // subtracted from the frame counter portion only, not from channel timers.
  clockFrameCounter(nCycles, frameCounterAlreadyAdvanced) {
    let frameCounterCycles = nCycles - (frameCounterAlreadyAdvanced || 0);

    // Process deferred frame IRQ clear and update APU cycle parity for
    // the remaining cycles not yet advanced by advanceFrameCounter.
    this.processFrameIrqClear(frameCounterCycles);
    this.apuCycleParity = (this.apuCycleParity + frameCounterCycles) & 1;

    // Don't process channel ticks beyond next sampling:
    nCycles += this.extraCycles;
    let maxCycles = this.sampleTimerMax - this.sampleTimer;
    if (nCycles << 10 > maxCycles) {
      this.extraCycles = ((nCycles << 10) - maxCycles) >> 10;
      nCycles -= this.extraCycles;
    } else {
      this.extraCycles = 0;
    }

    let dmc = this.dmc;
    let triangle = this.triangle;
    let square1 = this.square1;
    let square2 = this.square2;
    let noise = this.noise;

    // Clock DMC:
    if (dmc.isEnabled) {
      dmc.shiftCounter -= nCycles << 3;
      while (dmc.shiftCounter <= 0 && dmc.dmaFrequency > 0) {
        dmc.shiftCounter += dmc.dmaFrequency;
        dmc.clockDmc();
      }
    }

    // Clock Triangle channel Prog timer:
    if (triangle.progTimerMax > 0) {
      triangle.progTimerCount -= nCycles;
      while (triangle.progTimerCount <= 0) {
        triangle.progTimerCount += triangle.progTimerMax + 1;
        if (triangle.linearCounter > 0 && triangle.lengthCounter > 0) {
          triangle.triangleCounter++;
          triangle.triangleCounter &= 0x1f;

          if (triangle.isEnabled) {
            if (triangle.triangleCounter >= 0x10) {
              // Normal value.
              triangle.sampleValue = triangle.triangleCounter & 0xf;
            } else {
              // Inverted value.
              triangle.sampleValue = 0xf - (triangle.triangleCounter & 0xf);
            }
            triangle.sampleValue <<= 4;
          }
        }
      }
    }

    // Clock Square channel 1 Prog timer:
    square1.progTimerCount -= nCycles;
    if (square1.progTimerCount <= 0) {
      square1.progTimerCount += (square1.progTimerMax + 1) << 1;

      square1.squareCounter++;
      square1.squareCounter &= 0x7;
      square1.updateSampleValue();
    }

    // Clock Square channel 2 Prog timer:
    square2.progTimerCount -= nCycles;
    if (square2.progTimerCount <= 0) {
      square2.progTimerCount += (square2.progTimerMax + 1) << 1;

      square2.squareCounter++;
      square2.squareCounter &= 0x7;
      square2.updateSampleValue();
    }

    // Clock noise channel Prog timer:
    let acc_c = nCycles;
    if (noise.progTimerCount - acc_c > 0) {
      // Do all cycles at once:
      noise.progTimerCount -= acc_c;
      noise.accCount += acc_c;
      noise.accValue += acc_c * noise.sampleValue;
    } else {
      // Slow-step:
      while (acc_c-- > 0) {
        if (--noise.progTimerCount <= 0 && noise.progTimerMax > 0) {
          // Update noise shift register:
          noise.shiftReg <<= 1;
          noise.tmp =
            ((noise.shiftReg << (noise.randomMode === 0 ? 1 : 6)) ^
              noise.shiftReg) &
            0x8000;
          if (noise.tmp !== 0) {
            // Sample value must be 0.
            noise.shiftReg |= 0x01;
            noise.randomBit = 0;
            noise.sampleValue = 0;
          } else {
            // Find sample value:
            noise.randomBit = 1;
            if (noise.isEnabled && noise.lengthCounter > 0) {
              noise.sampleValue = noise.masterVolume;
            } else {
              noise.sampleValue = 0;
            }
          }

          noise.progTimerCount += noise.progTimerMax;
        }

        noise.accValue += noise.sampleValue;
        noise.accCount++;
      }
    }

    // Frame IRQ handling:
    if (this.frameIrqEnabled && this.frameIrqActive) {
      this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL);
    }

    // Clock frame counter: fire steps at the correct CPU cycle positions.
    // Uses the uncapped cycle count to maintain accurate timing.
    this._advanceFrameSteps(frameCounterCycles);

    // Accumulate sample value:
    this.accSample(nCycles);

    // Clock sample timer:
    this.sampleTimer += nCycles << 10;
    if (this.sampleTimer >= this.sampleTimerMax) {
      // Sample channels:
      this.sample();
      this.sampleTimer -= this.sampleTimerMax;
    }
  }

  // Process the deferred frame IRQ flag clear. On real hardware, reading
  // $4015 schedules the clear for the next APU "get" cycle (which happens
  // every 2 CPU cycles). If the current APU phase is "put" (parity 0),
  // the next "get" is 1 cycle away. If "get" (parity 1), it's 2 cycles
  // away. This must be called BEFORE updating apuCycleParity for the
  // current advance, so it sees the parity at the start of the period.
  // See https://www.nesdev.org/wiki/APU_Frame_Counter
  processFrameIrqClear(nCycles) {
    if (!this.frameIrqClearPending || nCycles <= 0) return;
    // Determine how many CPU cycles until the next APU "get" boundary.
    let cyclesToNextGet = (this.apuCycleParity & 1) === 0 ? 1 : 2;
    if (nCycles >= cyclesToNextGet) {
      this.frameIrqActive = false;
      this.frameIrqClearPending = false;
    }
  }

  // Advance only the frame counter steps without clocking channel timers,
  // DMC, or audio sampling. Used by CPU APU catch-up to update frame counter
  // state (length counters, envelopes) before $4015 reads, without disturbing
  // DMC DMA timing or audio generation.
  advanceFrameCounter(nCycles) {
    this.processFrameIrqClear(nCycles);
    this.apuCycleParity = (this.apuCycleParity + nCycles) & 1;
    this._advanceFrameSteps(nCycles);
  }

  // Advance frame counter steps and handle period wrap. Shared by both
  // clockFrameCounter (full APU tick) and advanceFrameCounter (catch-up only).
  // The step loop and period wrap are separated: steps fire when the counter
  // reaches each step's cycle position, and the period wrap only occurs when
  // the counter reaches the full period length (not immediately after the
  // last step). This matters because in 4-step mode, the last step fires at
  // 29829 but the period wrap (and 3rd IRQ assertion) occurs at 29830.
  // See https://www.nesdev.org/wiki/APU_Frame_Counter
  _advanceFrameSteps(frameCounterCycles) {
    this.frameCycleCounter += frameCounterCycles;
    let steps = this.countSequence === 0 ? FRAME_STEPS_4 : FRAME_STEPS_5;
    let period = this.countSequence === 0 ? FRAME_PERIOD_4 : FRAME_PERIOD_5;
    for (;;) {
      if (
        this.frameStep < steps.length &&
        this.frameCycleCounter >= steps[this.frameStep]
      ) {
        this.fireFrameStep(this.frameStep);
        this.frameStep++;
      } else if (
        this.frameStep >= steps.length &&
        this.frameCycleCounter >= period
      ) {
        // Period wrap: reset the frame counter for the next sequence.
        this.frameStep = 0;
        this.frameCycleCounter -= period;
        // In 4-step mode, the IRQ flag is asserted for 3 consecutive CPU
        // cycles: at 29828 (step 3), 29829 (step 4), and 29830 (period wrap).
        // On the 3rd cycle (period wrap), the flag is set only if the IRQ
        // inhibit flag is clear. If inhibit is set, the flag is actively
        // cleared (it was unconditionally set on cycles 29828-29829).
        // See https://www.nesdev.org/wiki/APU_Frame_Counter
        if (this.countSequence === 0) {
          this.frameIrqActive = this.frameIrqEnabled;
          this.frameIrqClearPending = false;
        }
      } else {
        break;
      }
    }
  }

  accSample(cycles) {
    // Special treatment for triangle channel - need to interpolate.
    if (this.triangle.sampleCondition) {
      this.triValue = Math.floor(
        (this.triangle.progTimerCount << 4) / (this.triangle.progTimerMax + 1),
      );
      if (this.triValue > 16) {
        this.triValue = 16;
      }
      if (this.triangle.triangleCounter >= 16) {
        this.triValue = 16 - this.triValue;
      }

      // Add non-interpolated sample value:
      this.triValue += this.triangle.sampleValue;
    }

    // Now sample normally:
    if (cycles === 2) {
      this.smpTriangle += this.triValue << 1;
      this.smpDmc += this.dmc.sample << 1;
      this.smpSquare1 += this.square1.sampleValue << 1;
      this.smpSquare2 += this.square2.sampleValue << 1;
      this.accCount += 2;
    } else if (cycles === 4) {
      this.smpTriangle += this.triValue << 2;
      this.smpDmc += this.dmc.sample << 2;
      this.smpSquare1 += this.square1.sampleValue << 2;
      this.smpSquare2 += this.square2.sampleValue << 2;
      this.accCount += 4;
    } else {
      this.smpTriangle += cycles * this.triValue;
      this.smpDmc += cycles * this.dmc.sample;
      this.smpSquare1 += cycles * this.square1.sampleValue;
      this.smpSquare2 += cycles * this.square2.sampleValue;
      this.accCount += cycles;
    }
  }

  // Fire a frame counter step. Each step clocks different APU units depending
  // on the mode and step number.
  // See https://www.nesdev.org/wiki/APU_Frame_Counter
  fireFrameStep(step) {
    if (this.countSequence === 0) {
      // Mode 0 (4-step):
      //   Step 0 (7457): quarter frame (envelope + linear counter)
      //   Step 1 (14913): half frame (quarter + length counter + sweep)
      //   Step 2 (22371): quarter frame
      //   Step 3 (29828): set frame IRQ flag only (1 cycle before clock)
      //   Step 4 (29829): half frame + set frame IRQ flag
      // On real hardware, the IRQ flag is asserted 1 CPU cycle before the
      // clock event at the end of the 4-step sequence. This is why step 3
      // is split from step 4.
      // See https://www.nesdev.org/wiki/APU_Frame_Counter
      switch (step) {
        case 0:
          this.clockQuarterFrame();
          break;
        case 1:
          this.clockQuarterFrame();
          this.clockHalfFrame();
          break;
        case 2:
          this.clockQuarterFrame();
          break;
        case 3:
          // IRQ flag is UNCONDITIONALLY set 1 CPU cycle before the half-frame
          // clock, regardless of the IRQ inhibit flag ($4017 bit 6). On real
          // hardware, the flag is driven high by the frame counter output for
          // cycles 29828-29829 even when inhibit is set; only the period wrap
          // at 29830 respects the inhibit flag. Cancel any pending deferred
          // clear since the flag is being re-asserted by hardware.
          // See AccuracyCoin tests I-L.
          this.frameIrqActive = true;
          this.frameIrqClearPending = false;
          break;
        case 4:
          this.clockQuarterFrame();
          this.clockHalfFrame();
          // IRQ flag continues to be unconditionally asserted on this cycle.
          this.frameIrqActive = true;
          this.frameIrqClearPending = false;
          break;
      }
    } else {
      // Mode 1 (5-step):
      //   Step 0: quarter frame
      //   Step 1: half frame
      //   Step 2: quarter frame
      //   Step 3: nothing (no clocking, no IRQ)
      //   Step 4: half frame
      switch (step) {
        case 0:
          this.clockQuarterFrame();
          break;
        case 1:
          this.clockQuarterFrame();
          this.clockHalfFrame();
          break;
        case 2:
          this.clockQuarterFrame();
          break;
        case 3:
          // Nothing happens at step 4 in 5-step mode
          break;
        case 4:
          this.clockQuarterFrame();
          this.clockHalfFrame();
          break;
      }
    }
  }

  // Quarter frame: clock envelopes and triangle linear counter (~240Hz)
  clockQuarterFrame() {
    this.square1.clockEnvDecay();
    this.square2.clockEnvDecay();
    this.noise.clockEnvDecay();
    this.triangle.clockLinearCounter();
  }

  // Half frame: clock length counters and sweep units (~120Hz)
  clockHalfFrame() {
    this.triangle.clockLengthCounter();
    this.square1.clockLengthCounter();
    this.square2.clockLengthCounter();
    this.noise.clockLengthCounter();
    this.square1.clockSweep();
    this.square2.clockSweep();
  }

  // Samples the channels, mixes the output together, then writes to buffer.
  sample() {
    let sq_index, tnd_index;

    if (this.accCount > 0) {
      this.smpSquare1 <<= 4;
      this.smpSquare1 = Math.floor(this.smpSquare1 / this.accCount);

      this.smpSquare2 <<= 4;
      this.smpSquare2 = Math.floor(this.smpSquare2 / this.accCount);

      this.smpTriangle = Math.floor(this.smpTriangle / this.accCount);

      this.smpDmc <<= 4;
      this.smpDmc = Math.floor(this.smpDmc / this.accCount);

      this.accCount = 0;
    } else {
      this.smpSquare1 = this.square1.sampleValue << 4;
      this.smpSquare2 = this.square2.sampleValue << 4;
      this.smpTriangle = this.triangle.sampleValue;
      this.smpDmc = this.dmc.sample << 4;
    }

    let smpNoise = Math.floor((this.noise.accValue << 4) / this.noise.accCount);
    this.noise.accValue = smpNoise >> 4;
    this.noise.accCount = 1;

    // Stereo sound.

    // Left channel:
    sq_index =
      (this.smpSquare1 * this.stereoPosLSquare1 +
        this.smpSquare2 * this.stereoPosLSquare2) >>
      8;
    tnd_index =
      (3 * this.smpTriangle * this.stereoPosLTriangle +
        (smpNoise << 1) * this.stereoPosLNoise +
        this.smpDmc * this.stereoPosLDMC) >>
      8;
    if (sq_index >= this.square_table.length) {
      sq_index = this.square_table.length - 1;
    }
    if (tnd_index >= this.tnd_table.length) {
      tnd_index = this.tnd_table.length - 1;
    }
    let sampleValueL =
      this.square_table[sq_index] + this.tnd_table[tnd_index] - this.dcValue;

    // Right channel:
    sq_index =
      (this.smpSquare1 * this.stereoPosRSquare1 +
        this.smpSquare2 * this.stereoPosRSquare2) >>
      8;
    tnd_index =
      (3 * this.smpTriangle * this.stereoPosRTriangle +
        (smpNoise << 1) * this.stereoPosRNoise +
        this.smpDmc * this.stereoPosRDMC) >>
      8;
    if (sq_index >= this.square_table.length) {
      sq_index = this.square_table.length - 1;
    }
    if (tnd_index >= this.tnd_table.length) {
      tnd_index = this.tnd_table.length - 1;
    }
    let sampleValueR =
      this.square_table[sq_index] + this.tnd_table[tnd_index] - this.dcValue;

    // Remove DC from left channel:
    let smpDiffL = sampleValueL - this.prevSampleL;
    this.prevSampleL += smpDiffL;
    this.smpAccumL += smpDiffL - (this.smpAccumL >> 10);
    sampleValueL = this.smpAccumL;

    // Remove DC from right channel:
    let smpDiffR = sampleValueR - this.prevSampleR;
    this.prevSampleR += smpDiffR;
    this.smpAccumR += smpDiffR - (this.smpAccumR >> 10);
    sampleValueR = this.smpAccumR;

    // Write:
    if (sampleValueL > this.maxSample) {
      this.maxSample = sampleValueL;
    }
    if (sampleValueL < this.minSample) {
      this.minSample = sampleValueL;
    }

    if (this.nes.opts.onAudioSample) {
      this.nes.opts.onAudioSample(sampleValueL / 32768, sampleValueR / 32768);
    }

    // Reset sampled values:
    this.smpSquare1 = 0;
    this.smpSquare2 = 0;
    this.smpTriangle = 0;
    this.smpDmc = 0;
  }

  getLengthMax(value) {
    return this.lengthLookup[value >> 3];
  }

  getDmcFrequency(value) {
    if (value >= 0 && value < 0x10) {
      return this.dmcFreqLookup[value];
    }
    return 0;
  }

  getNoiseWaveLength(value) {
    if (value >= 0 && value < 0x10) {
      return this.noiseWavelengthLookup[value];
    }
    return 0;
  }

  // Recalculate the sample timer for a non-standard host frame rate.
  // At 60fps the timer fires once per (CPU_FREQ / sampleRate) cycles. If the
  // host calls frame() at a different rate, scale proportionally so the total
  // audio output per second stays constant.
  setFrameRate(rate) {
    this.sampleTimerMax = Math.floor(
      (1024.0 * CPU_FREQ_NTSC * rate) / (this.sampleRate * 60.0),
    );
  }

  setPanning(pos) {
    for (let i = 0; i < 5; i++) {
      this.panning[i] = pos[i];
    }
    this.updateStereoPos();
  }

  setMasterVolume(value) {
    if (value < 0) {
      value = 0;
    }
    if (value > 256) {
      value = 256;
    }
    this.masterVolume = value;
    this.updateStereoPos();
  }

  updateStereoPos() {
    this.stereoPosLSquare1 = (this.panning[0] * this.masterVolume) >> 8;
    this.stereoPosLSquare2 = (this.panning[1] * this.masterVolume) >> 8;
    this.stereoPosLTriangle = (this.panning[2] * this.masterVolume) >> 8;
    this.stereoPosLNoise = (this.panning[3] * this.masterVolume) >> 8;
    this.stereoPosLDMC = (this.panning[4] * this.masterVolume) >> 8;

    this.stereoPosRSquare1 = this.masterVolume - this.stereoPosLSquare1;
    this.stereoPosRSquare2 = this.masterVolume - this.stereoPosLSquare2;
    this.stereoPosRTriangle = this.masterVolume - this.stereoPosLTriangle;
    this.stereoPosRNoise = this.masterVolume - this.stereoPosLNoise;
    this.stereoPosRDMC = this.masterVolume - this.stereoPosLDMC;
  }

  initLengthLookup() {
    // prettier-ignore
    this.lengthLookup = [
            0x0A, 0xFE,
            0x14, 0x02,
            0x28, 0x04,
            0x50, 0x06,
            0xA0, 0x08,
            0x3C, 0x0A,
            0x0E, 0x0C,
            0x1A, 0x0E,
            0x0C, 0x10,
            0x18, 0x12,
            0x30, 0x14,
            0x60, 0x16,
            0xC0, 0x18,
            0x48, 0x1A,
            0x10, 0x1C,
            0x20, 0x1E
        ];
  }

  initDmcFrequencyLookup() {
    this.dmcFreqLookup = new Array(16);

    this.dmcFreqLookup[0x0] = 0xd60;
    this.dmcFreqLookup[0x1] = 0xbe0;
    this.dmcFreqLookup[0x2] = 0xaa0;
    this.dmcFreqLookup[0x3] = 0xa00;
    this.dmcFreqLookup[0x4] = 0x8f0;
    this.dmcFreqLookup[0x5] = 0x7f0;
    this.dmcFreqLookup[0x6] = 0x710;
    this.dmcFreqLookup[0x7] = 0x6b0;
    this.dmcFreqLookup[0x8] = 0x5f0;
    this.dmcFreqLookup[0x9] = 0x500;
    this.dmcFreqLookup[0xa] = 0x470;
    this.dmcFreqLookup[0xb] = 0x400;
    this.dmcFreqLookup[0xc] = 0x350;
    this.dmcFreqLookup[0xd] = 0x2a0;
    this.dmcFreqLookup[0xe] = 0x240;
    this.dmcFreqLookup[0xf] = 0x1b0;
    //for(int i=0;i<16;i++)dmcFreqLookup[i]/=8;
  }

  initNoiseWavelengthLookup() {
    this.noiseWavelengthLookup = new Array(16);

    this.noiseWavelengthLookup[0x0] = 0x004;
    this.noiseWavelengthLookup[0x1] = 0x008;
    this.noiseWavelengthLookup[0x2] = 0x010;
    this.noiseWavelengthLookup[0x3] = 0x020;
    this.noiseWavelengthLookup[0x4] = 0x040;
    this.noiseWavelengthLookup[0x5] = 0x060;
    this.noiseWavelengthLookup[0x6] = 0x080;
    this.noiseWavelengthLookup[0x7] = 0x0a0;
    this.noiseWavelengthLookup[0x8] = 0x0ca;
    this.noiseWavelengthLookup[0x9] = 0x0fe;
    this.noiseWavelengthLookup[0xa] = 0x17c;
    this.noiseWavelengthLookup[0xb] = 0x1fc;
    this.noiseWavelengthLookup[0xc] = 0x2fa;
    this.noiseWavelengthLookup[0xd] = 0x3f8;
    this.noiseWavelengthLookup[0xe] = 0x7f2;
    this.noiseWavelengthLookup[0xf] = 0xfe4;
  }

  initDACtables() {
    let value, ival, i;
    let max_sqr = 0;
    let max_tnd = 0;

    this.square_table = new Array(32 * 16);
    this.tnd_table = new Array(204 * 16);

    for (i = 0; i < 32 * 16; i++) {
      value = 95.52 / (8128.0 / (i / 16.0) + 100.0);
      value *= 0.98411;
      value *= 50000.0;
      ival = Math.floor(value);

      this.square_table[i] = ival;
      if (ival > max_sqr) {
        max_sqr = ival;
      }
    }

    for (i = 0; i < 204 * 16; i++) {
      value = 163.67 / (24329.0 / (i / 16.0) + 100.0);
      value *= 0.98411;
      value *= 50000.0;
      ival = Math.floor(value);

      this.tnd_table[i] = ival;
      if (ival > max_tnd) {
        max_tnd = ival;
      }
    }

    this.dacRange = max_sqr + max_tnd;
    this.dcValue = this.dacRange / 2;
  }

  toJSON() {
    let obj = toJSON(this);
    obj.dmc = this.dmc.toJSON();
    obj.noise = this.noise.toJSON();
    obj.square1 = this.square1.toJSON();
    obj.square2 = this.square2.toJSON();
    obj.triangle = this.triangle.toJSON();
    return obj;
  }

  fromJSON(s) {
    fromJSON(this, s);
    this.dmc.fromJSON(s.dmc);
    this.noise.fromJSON(s.noise);
    this.square1.fromJSON(s.square1);
    this.square2.fromJSON(s.square2);
    this.triangle.fromJSON(s.triangle);
  }

  static JSON_PROPERTIES = [
    "channelEnableValue",
    "sampleRate",
    "frameIrqEnabled",
    "frameIrqActive",
    "frameIrqClearPending",
    "apuCycleParity",
    "startedPlaying",
    "recordOutput",
    "frameCycleCounter",
    "frameStep",
    "countSequence",
    "sampleTimer",
    "sampleTimerMax",
    "sampleCount",
    "triValue",
    "smpSquare1",
    "smpSquare2",
    "smpTriangle",
    "smpDmc",
    "accCount",
    "prevSampleL",
    "prevSampleR",
    "smpAccumL",
    "smpAccumR",
    "masterVolume",
    "stereoPosLSquare1",
    "stereoPosLSquare2",
    "stereoPosLTriangle",
    "stereoPosLNoise",
    "stereoPosLDMC",
    "stereoPosRSquare1",
    "stereoPosRSquare2",
    "stereoPosRTriangle",
    "stereoPosRNoise",
    "stereoPosRDMC",
    "extraCycles",
    "maxSample",
    "minSample",
    "panning",
  ];
}


return PAPU;
})();
