# JSNES lite

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

Demo: https://xem.github.io/jsnes-lite

## Latest finalized release: V013

**Standalone emulator: [jsnes-lite.min.html](dist/v013-mobile-touch-controls/jsnes-lite.min.html), 11,421 bytes.** Open it in a browser, choose a local ROM, and use the touch controls or keyboard.

V013 adds a four-way touch pad, Select, Start, A, and B around the game screen, with simultaneous touch input. In landscape, the screen aligns to the top and the controls sit beside it without overlap. It retains V012's Mapper 0–4 and Mapper 30 UNROM-512 support. `.7z` is limited to single-file LZMA1/LZMA2; ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported.

- [V013 build notes](dist/v013-mobile-touch-controls/README.md)
- [V013 release notes](dist/v013-mobile-touch-controls/RELEASE_NOTES.md)
- [V013 byte counts, hashes, and tool versions](dist/v013-mobile-touch-controls/sizes.json)
- [V013 finalization record](dist/v013-mobile-touch-controls/RELEASED.json)
- [Project guide and source-of-truth rules](PROJECT_GUIDE.md)
- Root `src/` and `interfaces/` are the editable source. V013's exact build snapshot is archived at `dist/v013-mobile-touch-controls/source/`.
- [Build instructions](build-support/README.md) · [Local development history](build-support/LOCAL-HISTORY.md)

## Previous release: V012

**Standalone emulator: [jsnes-lite.min.html](dist/v011-mapper30/jsnes-lite.min.html), 10,107 bytes.** Open it in a browser and select a local ROM.

Supports `.nes` and single-file LZMA1/LZMA2 `.7z`; no ZIP, CRC verification, or DMC. It has four-channel audio, Mapper 0 through 4 and Mapper 30 UNROM-512 banking, one controller, fullscreen, and mute. Mapper 30 self-flash programming is not emulated.

- [V011 build notes](dist/v011-mapper30/README.md)
- [V011 release notes](dist/v011-mapper30/RELEASE_NOTES.md)
- [V011 byte counts, hashes, and tool versions](dist/v011-mapper30/sizes.json)
- [Project guide and source-of-truth rules](PROJECT_GUIDE.md)
- The root [`src/`](src/) and [`interfaces/`](interfaces/) directories are the editable source. V011's exact build snapshot is archived at `dist/v011-mapper30/source/`; edits there are not the starting point for future development.
- [Build instructions](build-support/README.md) · [Local development history](build-support/LOCAL-HISTORY.md)

V012 fixes OAM DMA alignment for `TCL王牌海战.nes` and the Side Pocket startup failure. Its NMI fix tracks the PPU output edge and lets a nearby `$2002` read cancel a pending interrupt; the one-instruction delay approximates hardware timing. Its standalone HTML is 10,192 bytes.

- [V012 standalone](dist/v012-oam-address-reset/jsnes-lite.min.html)
- [V012 build notes](dist/v012-oam-address-reset/README.md)
- [V012 fixes and verification](dist/v012-oam-address-reset/RELEASE_NOTES.md)
- [V012 byte counts, hashes, and tool versions](dist/v012-oam-address-reset/sizes.json)

## Earlier release: V010 极致运行版

The finalized V010 package remains at [`dist/v010-extreme-runtime/`](dist/v010-extreme-runtime/).

- [V010 standalone HTML](dist/v010-extreme-runtime/jsnes-lite.min.html)
- [V010 feature notes](dist/v010-extreme-runtime/VERSION_NOTES.md)
- [V010 release files and build record](dist/v010-extreme-runtime/README.md)

## Older versions

V009 and earlier outputs remain in their original `dist/` directories. The upstream source snapshot is under `build-support/upstream/` and remains unchanged.
