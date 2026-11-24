# JSNES lite

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

Demo: https://xem.github.io/jsnes-lite

## Latest finalized release: V016

**Standalone emulator: [jsnes-lite.min.html](dist/v016-lzmad-frame-scheduler/jsnes-lite.min.html), 10,863 bytes.** Open it in a browser, choose a local `.nes` or supported `.7z` ROM, and use the touch controls or keyboard.

V016 restores the accumulated frame-deadline scheduler from V015-5 and retains LZMA1/LZMA2 archive support and its landscape touch layout. It supports iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512; ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported. Regression vectors passed; browser gameplay and physical-phone touch controls were not tested.

- [V016 build notes](dist/v016-lzmad-frame-scheduler/README.md)
- [V016 release notes](dist/v016-lzmad-frame-scheduler/RELEASE_NOTES.md)
- [V016 byte counts, hashes, and tool versions](dist/v016-lzmad-frame-scheduler/sizes.json)
- [V016 finalization record](dist/v016-lzmad-frame-scheduler/RELEASED.json)
- Root `src/` and `interfaces/` are the editable source. V016's build snapshot is archived at `dist/v016-lzmad-frame-scheduler/source/`.
- [Project guide and source-of-truth rules](PROJECT_GUIDE.md)
- [Build instructions](build-support/README.md) · [Local development history](build-support/LOCAL-HISTORY.md)

## Previous release: V014

V014 uses the community Roadroller O2 build and a compact touch interface. A/B are stacked vertically; the landscape side columns use 26vw and the canvas width uses 107dvh without clamps. Its standalone HTML is 10,879 bytes.

- [V014 standalone](dist/v014-community-roadroller-o2/jsnes-lite.min.html)
- [V014 build notes](dist/v014-community-roadroller-o2/README.md)
- [V014 release notes](dist/v014-community-roadroller-o2/RELEASE_NOTES.md)
- [V014 byte counts and hashes](dist/v014-community-roadroller-o2/sizes.json)
- [V014 finalization record](dist/v014-community-roadroller-o2/RELEASED.json)

## Previous release: V013

V013 introduced the four-way touch pad, Select, Start, A, and B controls around the game screen, with simultaneous touch input. [Standalone HTML](dist/v013-mobile-touch-controls/jsnes-lite.min.html) is 11,421 bytes. See the [build notes](dist/v013-mobile-touch-controls/README.md), [release notes](dist/v013-mobile-touch-controls/RELEASE_NOTES.md), [size metadata](dist/v013-mobile-touch-controls/sizes.json), and [finalization record](dist/v013-mobile-touch-controls/RELEASED.json).

## Previous release: V012

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