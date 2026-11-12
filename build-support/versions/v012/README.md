# V012 build workspace

V012 is the finalized build that corrects the PPU OAM address reset required by sprite evaluation and the NMI/VBlank startup race in Side Pocket. The release output is `dist/v012-oam-address-reset/`.

## Workflow

Run these commands from this directory:

```powershell
node prepare.mjs
node build.mjs compile
node build.mjs pack
node diagnose-tcl.cjs
node diagnose-side-pocket.cjs
```

`prepare.mjs` snapshots repository-root `src/` and `interfaces/` and copies required notices and the V011 Roadroller parameter seed. `build.mjs` compiles that snapshot with Closure, then packs the standalone HTML. The V012 parameter search has not been run. `diagnose-tcl.cjs` compares V011, V012, and JSNES 2.1.0 r14; set `TCL_FORCE_OAMADDR_ZERO=1` for an additional V011-only intervention. `diagnose-side-pocket.cjs` compares V011 and V012 and checks the minimized HTML through the ROM picker. Both use local commercial ROMs and save screenshots and traces under the ignored `roms/commercial/` directory.

V012 is finalized. The build scripts refuse to overwrite its release directory.
