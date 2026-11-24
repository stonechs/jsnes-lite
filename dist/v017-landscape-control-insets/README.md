# V017 landscape touch-control insets

V017 changes the landscape touch-control positions from the V016 layout. The directional pad is anchored 32 px from the right edge of the left control column. A/B are anchored 32 px from the left edge of the right control column. Portrait layout remains unchanged.

Build from the repository root:

```powershell
node build-support/versions/v017-landscape-control-insets/build.mjs all
```

This build compares V017 with the published V016 source. It uses two Closure ADVANCED passes, da0ka Roadroller community O2, and the saved V016 Roadroller parameters for a matched build. The output is an unfinalized V017 build; it does not create `RELEASED.json`.