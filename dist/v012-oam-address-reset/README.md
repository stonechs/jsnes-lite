# V012 OAM address and NMI timing fixes

V012 is the finalized standalone JSNES lite build from the root `src/` and `interfaces/` inputs. It corrects sprite DMA alignment by resetting OAMADDR during visible scanline rendering. It also tracks the PPU NMI output edge and cancels a pending NMI when a nearby `$2002` read clears VBlank, allowing Side Pocket to start. The NMI delay is approximated at CPU instruction granularity, not PPU dot accuracy.

## Files

- `jsnes-lite.min.html` — standalone minimized emulator; choose a local `.nes` or supported `.7z` ROM.
- `jsnes-lite.readable.html` — readable standalone emulator.
- `jsnes-lite.readable.js` — readable emulator JavaScript.
- `jsnes-lite.min.js` — minimized JavaScript inspection artifact.
- `sizes.json` — byte counts, SHA-256 hashes, and build tool versions.
- `source/` — exact build input snapshot.
- `build/` — compiler output and packaging intermediates.
- `search/` — saved Roadroller parameters reused from V011; no V012 optimization search has been run.
- `licenses/` — third-party notices.

## Build

From `build-support/versions/v012/`, run `node prepare.mjs`, then `node build.mjs compile` and `node build.mjs pack`. See the version-specific workspace README for diagnostic instructions.

V012 is finalized. See `RELEASED.json` for the standalone artifact hash and build tool versions.
