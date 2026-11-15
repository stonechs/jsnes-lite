# JSNES lite V014 — simplified touch UI

V014 combines the V013 emulator with a compact mobile touch interface and the community Roadroller O2 build. The page uses a #555 background, stacks A/B controls vertically, and lays out the direction keys without inward translations. Landscape side columns use 26vw and the canvas uses 107dvh directly, without width clamps. The local `.nes` and supported single-file `.7z` ROM loading flow remains.

## Files

- `jsnes-lite.min.html` — standalone offline build.
- `jsnes-lite.readable.html` and `jsnes-lite.readable.js` — readable counterparts.
- `jsnes-lite.min.js` — packed JavaScript inspection artifact.
- `source/` — V013 emulator snapshot plus V014 UI source.
- `build/` — Closure, Roadroller, Base122, and size-report artifacts.
- `search/winner.json` — O2-selected Roadroller parameters.
- `tools/roadroller-fast/` — archived community fork and license.
- `sizes.json` — byte counts, hashes, source inventory, and tool versions.

## Build result

The standalone HTML is **10,879 bytes**, 542 bytes smaller than V013's 11,421-byte build. The inline CSS is **1420 bytes**, reduced from 2,852 bytes in the original interface. Roadroller O2 and the build-time Base122, decoded-header, and emulator-JavaScript checks completed.

Build tools: Node.js v26.13.1, Closure Compiler 20261108.0.0, Lightning CSS 1.33.0, `da0ka/roadroller` commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, `exe: 0`), and Base122 revision `b62945c2733fa4da8792a1071e40a8b326e8dd1b`.

## Support and status

V014 supports iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512; `.nes` and single-file LZMA1/LZMA2 `.7z`. Mapper 30 self-flash programming, ZIP, CRC validation, and DMC audio are unsupported. Browser gameplay and physical-phone controls have not been tested for this rebuild.

V014 is finalized and published as [GitHub Release v014](https://github.com/stonechs/jsnes-lite/releases/tag/v014). Its finalization record is in `RELEASED.json`.
