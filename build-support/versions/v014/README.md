# V014 build

V014 uses the V013 emulator core with a simplified mobile touch interface from root `interfaces/ui.html`. It rebuilds the standalone package with the community `da0ka/roadroller` fork, using `exe: 0` and Roadroller O2 search by default. The O2 winner is recorded in the version's `search/winner.json`.

The fork sources, license, and commit are copied into the output directory so the optimization can be reproduced without relying on an external checkout. Closure Compiler builds the application and compact Base122 loader; Lightning CSS 1.33.0 prepares the interface stylesheet. The decoded page header is checked against V014 source, decoded emulator JavaScript is compared with the Closure output, and the Base122 payload is round-trip checked during packing.

## Build

Run from this directory:

```powershell
node prepare.mjs
node build.mjs compile
node build.mjs pack
```

`pack` runs `optimize(2)` by default. Build intermediates and exact sizes, SHA-256 hashes, and tool versions are stored under `dist/v014-community-roadroller-o2/`.

## Output

The version root contains the standalone minimized HTML, readable HTML and JavaScript, minimized JavaScript inspection file, `README.md`, and `sizes.json`. `source/` retains the V013 emulator snapshot plus the root interface. `build/` contains compiler and packer artifacts. `tools/roadroller-fast/` archives the community implementation and license.

V014 inherits V013's controls and support limits: `.nes` and single-file LZMA1/LZMA2 `.7z`; iNES 1.0 Mapper 0–4 and Mapper 30 UNROM-512. Mapper 30 self-flash programming, ZIP, CRC validation, and DMC audio are unsupported. ROM files are selected locally and are not included.

This build is not finalized until explicitly requested; it intentionally has no `RELEASED.json`.
