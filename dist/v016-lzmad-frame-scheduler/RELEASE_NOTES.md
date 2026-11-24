# JSNES lite V016

V016 restores the accumulated frame-deadline scheduler from V015-5. It retains LZMA1/LZMA2 `.7z` decoding and V015-5's landscape touch-control layout. The frame loop tracks target deadlines with `performance.now()` and resynchronizes after a delay exceeding three frame periods.

## Download and use

Download [`jsnes-lite-v016.min.html`](https://github.com/stonechs/jsnes-lite/releases/download/v016/jsnes-lite-v016.min.html), open it in a modern browser, and choose a local `.nes` or supported single-file `.7z` ROM.

Standalone HTML size: **10,863 bytes**
SHA-256: `8353272b52f6dc47bf2f665f593a95bc331ee5ab2d24741c3a502fade00c7139`

## Support and limits

Supports iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512; `.nes` and single-file LZMA1/LZMA2 `.7z`. ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported.

## Verification

Passed Base122 decoded-source consistency, 25 LZMA1 stream vectors, one synthetic LZMA1 archive, two synthetic LZMA2 archive vectors, and a temporary VM check of scheduler waiting and resynchronization. Browser gameplay, actual user ROM loading, and physical-phone controls were not tested.

Build tools: Node.js v26.13.1, Closure Compiler 20261108.0.0 (two ADVANCED passes), and da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0). See `README.md` and `sizes.json` in the V016 directory for exact artifacts and hashes.
