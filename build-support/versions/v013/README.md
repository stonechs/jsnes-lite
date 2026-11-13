# V013 build workspace

V013 adds a compact mobile touch controller to the V012 emulator build. The editable adaptation is in `interface/`; the upstream snapshot is copied unchanged from `dist/v012-oam-address-reset/source/` when preparing the build input.

Run these commands from this directory:

```powershell
node prepare.mjs
node build.mjs compile
node build.mjs pack
```

The build reuses V011 Roadroller parameters. It writes the V013 source snapshot, readable HTML and JavaScript, minimized JavaScript inspection artifact, standalone minimized HTML, exact byte counts, hashes, and tool versions to `dist/v013-mobile-touch-controls/`. The output is an unfinalized development build; these scripts refuse to overwrite a finalized directory.
