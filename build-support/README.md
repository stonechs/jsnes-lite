# Build and version maintenance

The root `src/` and `interfaces/` directories track the latest published readable emulator and Web interface source. V010's build pipeline reads its versioned inputs from `dist/v010-extreme-runtime/source/`; these root files are synchronized copies for convenient browsing. Node assembles, optimizes, and packages the runtime, which runs in the browser.

The complete V010 build inputs, runnable artifacts, and validation records are preserved under `dist/v010-extreme-runtime/`. Historical release outputs remain under `dist/`. V009 root source copies are preserved in `archive/v009-src/` and `archive/v009-interfaces/`. The original upstream checkout under `upstream/` remains unchanged.

V010 supports NES and single-file LZMA1/LZMA2 7z. It does not support ZIP, CRC verification, or DMC. For future versions, sync the newest readable core and interface into root `src/` and `interfaces/`, create a new numbered release directory under `dist/`, and push a matching Git tag. Keep earlier release outputs intact.
