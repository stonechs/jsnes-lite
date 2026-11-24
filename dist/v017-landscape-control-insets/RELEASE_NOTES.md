# JSNES lite V017

V017 moves the landscape touch controls inward toward the center column: the directional pad sits 32 px from the right edge of the left control column, while A/B sit 32 px from the left edge of the right control column. Portrait layout is unchanged. V016 frame scheduling and LZMA1/LZMA2 archive support remain in place.

## Download and use

Download [`jsnes-lite-v017.min.html`](https://github.com/stonechs/jsnes-lite/releases/download/v017/jsnes-lite-v017.min.html), open it in a modern browser, and choose a local `.nes` or supported single-file `.7z` ROM.

Standalone HTML: **10,862 bytes**
SHA-256: `c8df7885769241af1d86679e36ab4a67bfeff6c0dfdbafd781acb6f79f36c263`

## Support and limits

Supports iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512; `.nes` and single-file LZMA1/LZMA2 `.7z`. ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported.

## Verification

Passed Closure/Base122 decoded-source consistency, 25 LZMA1 stream vectors, one synthetic LZMA1 archive, two synthetic LZMA2 archives, standalone VM loading, and checks for the requested landscape offsets and unchanged portrait positioning. Actual browser gameplay, user ROM loading, and physical-phone visual controls were not tested.

Build tools: Node.js v26.13.1, Closure Compiler 20261108.0.0 (two ADVANCED passes), and da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0). See `README.md` and `sizes.json` for artifact details.
