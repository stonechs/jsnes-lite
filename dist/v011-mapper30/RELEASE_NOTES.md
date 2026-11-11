# V011 — Mapper 30 support

V011 adds iNES 1.0 Mapper 30 UNROM-512 support for PRG and CHR-RAM bank switching, bus-conflict handling on non-battery-backed boards, and lower single-screen mirroring. Mapper 0 through 4 remain supported.

## Use

Open `jsnes-lite.min.html` in a modern browser and choose a local `.nes` or single-file `.7z` ROM. The standalone HTML embeds the emulator; no server or ROM download is required.

## Limitations

- Mapper 30 PRG self-flash programming is not emulated.
- `.7z` support is limited to single-file LZMA1/LZMA2 archives. ZIP and CRC verification are not supported.
- DMC audio is not supported.

## Release assets

- `jsnes-lite.min.html` — 10,107 bytes; SHA-256 `a75cb9d82cb932f0916edc504357fc928760ca763c78e58e7d7d842161f4292f`.
- `jsnes-lite.readable.html` — 99,854 bytes; SHA-256 `63d2c7649c429910ffddc813f4502e2a830e837e79d8a94f3261104ac9667306`.

Build tools: Node.js v24.22.1, Closure Compiler 20261108.0.0 (two ADVANCED passes), Roadroller 2.1.0, and Base122 encoder revision `b62945c2733fa4da8792a1071e40a8b326e8dd1b`.
