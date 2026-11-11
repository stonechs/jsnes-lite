# Build and version maintenance

The root `src/` and `interfaces/` directories track the latest readable emulator and Web interface source. V011's build pipeline reads its versioned inputs from `dist/v011-mapper30/source/`; these root files are synchronized copies for convenient browsing. Node assembles, optimizes, and packages the runtime, which runs in the browser.

The V010 finalized build remains under `dist/v010-extreme-runtime/`. V011 keeps primary HTML and build metadata at its root, source snapshots in `source/`, generated build artifacts in `build/`, and licenses in `licenses/`. The original upstream checkout under `upstream/` remains unchanged.

V010 supports NES and single-file LZMA1/LZMA2 7z. It does not support ZIP, CRC verification, or DMC. For future versions, sync the newest readable core and interface into root `src/` and `interfaces/`, and use an English-named numbered directory under `dist/`. Ordinary builds remain unfinalized: create `RELEASED.json` only after the user explicitly requests finalization. Keep the upstream checkout unchanged and document build adaptations outside it.
