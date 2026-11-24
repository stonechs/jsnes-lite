# JSNES lite V017-2

V017-2 centers the directional pad in the left landscape control column and the A/B group in the right column. The center column and canvas use the 107dvh width; the side columns share the remaining width equally. Portrait layout remains unchanged.

## Download and use

Download [`jsnes-lite-v017-2.min.html`](https://github.com/stonechs/jsnes-lite/releases/download/v017-2/jsnes-lite-v017-2.min.html), open it in a modern browser, and choose a local `.nes` or supported single-file `.7z` ROM.

Standalone HTML: **10,884 bytes**

SHA-256: `b3413b47b36ae4e55a3931878012b0139d467bf7a265a9b17787289b1561903f`

## Support and verification

Supports iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512; `.nes` and single-file LZMA1/LZMA2 `.7z`. ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported.

Passed Closure/Base122 decoded-source consistency, 25 LZMA1 stream vectors, one synthetic LZMA1 archive, two synthetic LZMA2 archives, standalone VM loading, centered-control assertions, and portrait reset checks. Actual browser gameplay, user ROM loading, and physical-phone visual controls were not tested.

Build tools: Node.js v26.13.1, Closure Compiler 20261108.0.0 (two ADVANCED passes), and da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0). See `README.md` and `sizes.json` for details.
