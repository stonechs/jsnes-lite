# JSNES lite V016 — LZMA archives and restored frame scheduler

V016 restores the accumulated frame-deadline scheduler from V015-5 while retaining V015's LZMA1/LZMA2 archive decoding and landscape touch layout. `performance.now()` tracks the target frame deadline; after a delay longer than three frame periods, the scheduler resets its target. The callback-entry timer experiment from V015-6 is not used.

## Files

- `jsnes-lite.min.html` — standalone emulator; open it in a browser and choose a local ROM.
- `jsnes-lite.readable.html` and `jsnes-lite.readable.js` — readable counterparts.
- `jsnes-lite.min.js` — packed JavaScript inspection artifact.
- `source/` — archived V016 source snapshot.
- `build/` — Closure, Roadroller, Base122, and size-report artifacts.
- `sizes.json` — byte counts, SHA-256 hashes, comparison data, and tool versions.
- `RELEASE_NOTES.md` and `RELEASED.json` — release details and finalization record.

## Build and size

The standalone HTML is **10,863 bytes**. The build used two Closure ADVANCED passes and da0ka Roadroller community O2, with the matching saved search parameters. Exact byte counts and SHA-256 hashes are in `sizes.json`.

Tools: Node.js v26.13.1; Closure Compiler 20261108.0.0; da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0).

## Support and verification

Supports `.nes` and single-file `.7z` archives using LZMA1 or LZMA2, with Mapper 0–4 and 30 (UNROM-512). ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported.

Regression verification passed: 25 LZMA1 stream vectors, one synthetic LZMA1 archive, two synthetic LZMA2 archives, Base122 decoded-source consistency, and a temporary VM check of frame-deadline waiting/resynchronization. Browser gameplay, actual ROM loading, and physical-phone controls were not tested.

V016 is finalized and published as [GitHub Release v016](https://github.com/stonechs/jsnes-lite/releases/tag/v016).