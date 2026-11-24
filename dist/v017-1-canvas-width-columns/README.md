# V017-1 center column matches canvas

V017-1 sets the landscape center grid column to `107dvh`, matching the canvas width. The left and right columns use equal `1fr` tracks to share the remaining width. The directional pad remains 32 px from the left column's right edge; A/B remain 32 px from the right column's left edge. Portrait layout is unchanged.

## Build and size

The standalone HTML is **10,859 bytes**, 3 bytes smaller than V017. SHA-256: `49f98680fbaacdbf0f3fe6c95d9f29e5af265a0fa34842072415c279382c48b3`.

Tools: Node.js v26.13.1; Closure Compiler 20261108.0.0 (two ADVANCED passes); da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0). See `sizes.json` for all artifact sizes and hashes.

Build from the repository root:

```powershell
node build-support/versions/v017-1-canvas-width-columns/build.mjs all
```

The build compares against published V017 and reuses the saved V017 Roadroller O2 parameters. It is an unfinalized small-version build.

## Support and verification

V017-1 retains `.nes` and single-file LZMA1/LZMA2 `.7z` support. Layout assertions, standalone VM loading, 25 LZMA1 stream vectors, a synthetic LZMA1 archive, and two synthetic LZMA2 archives passed. Browser gameplay, actual ROM loading, and physical-phone visual controls were not tested.