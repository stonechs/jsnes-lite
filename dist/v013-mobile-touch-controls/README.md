# V013 Mobile Touch Controls

V013 is the finalized standalone JSNES lite build based on V012. It adds a simple touch controller around the game screen for phones and tablets:

- Left side: four-way direction pad, Select, and Start.
- Right side: A and B action buttons.
- Buttons support simultaneous touch and stay pressed until released. Focus loss clears held input.
- Keyboard controls remain available. Choose a local `.nes` or supported single-file `.7z` ROM.

For more room around the controls, rotate a phone to landscape. The interface uses flat colors and borders without animation or visual effects. The emulator screen remains pixelated.

In landscape the canvas starts at the top edge; the direction pad and A/B buttons are centered beside it without overlapping the image. Select and Start are 36×36 px and sit beneath the direction pad. In portrait, the canvas spans the row above the touch controls.

## Files

- `jsnes-lite.min.html`: standalone minimized emulator; ROM is selected locally.
- `jsnes-lite.readable.html`: readable standalone HTML.
- `jsnes-lite.readable.js`: readable bundled JavaScript.
- `jsnes-lite.min.js`: separate minimized JavaScript inspection artifact.
- `sizes.json`: exact byte counts, SHA-256 hashes, build tool versions, and source snapshot inventory.
- `source/`: build input snapshot.
- `build/`: compiler, packer, and intermediate artifacts.
- `search/`: Roadroller parameters reused from V011.
- `licenses/`: third-party notices.

V013 keeps V012's ROM support: iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512; Mapper 30 self-flash programming, ZIP, CRC validation, and DMC audio are unsupported. `.7z` support is limited to single-file LZMA1/LZMA2 archives.

## Rebuild

From `build-support/versions/v013/`, run `node prepare.mjs`, `node build.mjs compile`, and `node build.mjs pack`. The local UI adaptation is under that directory's `interface/`; the V012 snapshot and repository-root source files are unchanged.

V013 is finalized. `RELEASED.json` records the standalone artifact hash and build tool versions. Desktop screenshot capture timed out, and physical-device touch behavior has not been verified.
