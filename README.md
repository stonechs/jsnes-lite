# JSNES lite

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

Demo: https://xem.github.io/jsnes-lite

## Latest finalized release: V017-2

**Standalone emulator: [jsnes-lite.min.html](dist/v017-2-centered-controls/jsnes-lite.min.html), 10,884 bytes.** Open it in a browser, choose a local `.nes` or supported `.7z` ROM, and use the touch controls or keyboard.

V017-2 centers the landscape directional pad in the left control column and A/B in the right control column. The center column matches the canvas width, and the side columns share the remaining space equally. Portrait layout is unchanged. V017 frame scheduling and LZMA1/LZMA2 support remain. Mapper 0–4 and Mapper 30 UNROM-512 are supported; ZIP, CRC verification, Mapper 30 self-flash programming, and DMC audio are unsupported. Regression and VM layout checks passed; browser gameplay and physical-phone visuals were not tested.

- [V017-2 build notes](dist/v017-2-centered-controls/README.md)
- [V017-2 release notes](dist/v017-2-centered-controls/RELEASE_NOTES.md)
- [V017-2 byte counts, hashes, and tool versions](dist/v017-2-centered-controls/sizes.json)
- [V017-2 finalization record](dist/v017-2-centered-controls/RELEASED.json)
- Root `src/` and `interfaces/` are the editable source. V017-2's source snapshot is archived at `dist/v017-2-centered-controls/source/`.
- [Project guide and source-of-truth rules](PROJECT_GUIDE.md)
- [Build instructions](build-support/README.md) · [Local development history](build-support/LOCAL-HISTORY.md)

## Previous release: V017

V017 moved the landscape touch controls 32 px inward from their side-column edges. Its standalone HTML is 10,862 bytes.

- [V017 standalone](dist/v017-landscape-control-insets/jsnes-lite.min.html)
- [V017 build notes](dist/v017-landscape-control-insets/README.md)
- [V017 release notes](dist/v017-landscape-control-insets/RELEASE_NOTES.md)
- [V017 byte counts and hashes](dist/v017-landscape-control-insets/sizes.json)
- [V017 finalization record](dist/v017-landscape-control-insets/RELEASED.json)

## Previous release: V016

V016 restored the accumulated frame-deadline scheduler and retained LZMA1/LZMA2 archive support. Its standalone HTML is 10,863 bytes.

- [V016 standalone](dist/v016-lzmad-frame-scheduler/jsnes-lite.min.html)
- [V016 build notes](dist/v016-lzmad-frame-scheduler/README.md)
- [V016 release notes](dist/v016-lzmad-frame-scheduler/RELEASE_NOTES.md)
- [V016 byte counts and hashes](dist/v016-lzmad-frame-scheduler/sizes.json)
- [V016 finalization record](dist/v016-lzmad-frame-scheduler/RELEASED.json)

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