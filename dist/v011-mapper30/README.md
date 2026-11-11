# V011 build package

V011 was built from the repository root `src/` and `interfaces/` inputs. This package is **finalized** and protected by `RELEASED.json`; do not overwrite it. Future changes belong in a new numbered version directory.

## Root files

- `jsnes-lite.min.html`: standalone offline emulator, 10,107 bytes, including the UTF-8 BOM. Open it in a browser and select a local `.nes` or `.7z` ROM.
- `jsnes-lite.readable.html`: readable standalone output.
- `sizes.json`: exact byte counts, SHA-256 hashes, and build tool versions.
- `RELEASE_NOTES.md`: release summary, usage, limitations, and asset hashes.
- `README.md`: build and package notes.

V011 adds iNES 1.0 Mapper 30 UNROM-512 PRG/CHR-RAM banking, including lower single-screen mirroring, alongside Mapper 0 through 4. Mapper 30 PRG self-flash programming is not emulated.

Other files are organized in English-named subdirectories: `source/` contains the exact source inputs, `build/` contains generated JavaScript inspection files and build intermediates, `licenses/` contains license notices, and `search/` contains the V011-specific Roadroller search history, candidates, finalists, and winning parameters. The winning Roadroller score is 9,750; finalist selection used the actual Base122 standalone HTML size.

## Rebuild

The original build used `node build-V011.mjs compile`, `node search-V011.mjs`, and `node select-V011.mjs` from `build-support/`. Three Roadroller level-2 searches ran against V011's compiled input; finalist selection chose the smallest standalone HTML. The saved winner can be repacked with `node build-V011.mjs pack`. The build scripts refuse to overwrite this finalized directory; use a new numbered directory for future builds. Build adaptations live in `build-support/`; the upstream checkout remains unchanged.

Build tools: Node.js v24.22.1, Closure Compiler 20261108.0.0, Roadroller 2.1.0, and the vendored Base122 encoder. The standalone HTML embeds the emulator runtime; the user's local ROM is selected at run time and is not bundled.
