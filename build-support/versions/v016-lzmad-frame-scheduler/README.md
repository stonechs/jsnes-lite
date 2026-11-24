# V016 frame scheduler restoration

V016 is based on the V015-6 source snapshot, with `source/nes.js` restored byte-for-byte from V015-5. This restores the accumulated `nextFrameAt` deadline scheduler, `performance.now()` deadline check, and three-frame lag resynchronization. LZMA1/LZMA2 support and the V015-5 landscape control layout remain in place.

The build compares the V015-6 callback-entry timer with V016. It uses two Closure ADVANCED passes and da0ka Roadroller community O2. To keep the comparison reproducible and fast, it reuses the O2 options already searched for these exact source variants.

Build from the repository root:

```powershell
node build-support/versions/v016-lzmad-frame-scheduler/build.mjs all
```

Run the inherited LZMA1 and LZMA2 archive regression vectors after building:

```powershell
node build-support/versions/v016-lzmad-frame-scheduler/test-candidate.mjs
```

This is an unfinalized V016 build. It does not create `RELEASED.json`.
