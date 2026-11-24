# JSNES lite V017 — landscape touch-control insets

V017 changes the landscape touch-control positions from V016: the directional pad is 32 px from the right edge of the left control column, and A/B are 32 px from the left edge of the right control column. Portrait control layout remains unchanged. LZMA1/LZMA2 archive support and frame scheduling remain as in V016.

## Files

- `jsnes-lite.min.html` — standalone emulator; open it in a browser and choose a local ROM.
- `jsnes-lite.readable.html` and `jsnes-lite.readable.js` — readable counterparts.
- `jsnes-lite.min.js` — packed JavaScript inspection artifact.
- `source/` — V017 source snapshot; `build/` — Closure, Roadroller, and regression artifacts.
- `sizes.json` — byte counts, SHA-256 hashes, comparison data, and tool versions.
- `RELEASE_NOTES.md` and `RELEASED.json` — release details and finalization record.

## Build and size

The standalone HTML is **10,862 bytes**, one byte smaller than V016's 10,863-byte HTML. The build uses two Closure ADVANCED passes and da0ka Roadroller community O2 with the V016 saved parameters. See `sizes.json` for exact sizes and hashes.

Tools: Node.js v26.13.1; Closure Compiler 20261108.0.0; da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0).

## Support and verification

Supports `.nes` and single-file `.7z` archives using LZMA1 or LZMA2, with Mapper 0–4 and 30 (UNROM-512). ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported.

Regression verification passed: 25 LZMA1 stream vectors, one synthetic LZMA1 archive, two synthetic LZMA2 archives, standalone VM loading, and control-layout assertions. Browser gameplay, actual ROM loading, and physical-phone visual controls were not tested.

V017 is finalized and published as [GitHub Release v017](https://github.com/stonechs/jsnes-lite/releases/tag/v017).