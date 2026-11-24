# V017-2 centered side controls

V017-2 centers the directional pad in the left landscape column and the A/B group in the right column. The 107dvh center column matches the canvas CSS width; left and right columns share the remaining width equally. Portrait layout remains unchanged.

## Build and size

The standalone HTML is **10,884 bytes**, 25 bytes larger than V017-1. SHA-256: `b3413b47b36ae4e55a3931878012b0139d467bf7a265a9b17787289b1561903f`.

Tools: Node.js v26.13.1; Closure Compiler 20261108.0.0 (two ADVANCED passes); da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3` (O2, exe 0). See `sizes.json` for all artifact sizes and hashes.

Build from the repository root:

```powershell
node build-support/versions/v017-2-centered-controls/build.mjs all
```

The build compares against V017-1 and reuses its saved Roadroller O2 parameters. This is an unfinalized small-version build.

## Support and verification

V017-2 retains `.nes` and single-file LZMA1/LZMA2 `.7z` support. Layout assertions, standalone VM loading, 25 LZMA1 stream vectors, a synthetic LZMA1 archive, and two synthetic LZMA2 archives passed. Browser gameplay, actual ROM loading, and physical-phone visual controls were not tested.