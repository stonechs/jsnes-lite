# V016 LZMA build with restored frame scheduler

V016 is based on V015-6, with `source/nes.js` restored byte-for-byte from V015-5. It restores the accumulated frame-deadline scheduler: `performance.now()` tracks target frame times, the loop waits only until the next target, and a delay exceeding three frame periods resets the target. V015-6's callback-entry timer experiment is not used.

V016 retains the V015 LZMA1/LZMA2 archive support and landscape control layout. The upstream `src/` and `interfaces/` were not changed.

## Comparison with V015-6

| Artifact | V015-6 | V016 | Difference |
| --- | ---: | ---: | ---: |
| Readable JavaScript input | 98,960 B | 99,189 B | +229 B |
| Closure ADVANCED output | 19,101 B | 19,186 B | +85 B |
| Roadroller O2 output | 12,151 B | 12,201 B | +50 B |
| Standalone minimized HTML | 10,820 B | **10,863 B** | +43 B |

The build used two Closure ADVANCED passes and da0ka Roadroller community O2, reusing the search parameters for the matching source variants. Exact byte counts and SHA-256 hashes are in `sizes.json`; build inputs and intermediate outputs are under `build/`.

Tool versions: Node.js v26.13.1; Closure Compiler 20261108.0.0; da0ka Roadroller community fork commit `64614b5fc6c7a97d75315c4d8c9ca407e6f233a3`, O2, exe 0.

Build command:

```powershell
node build-support/versions/v016-lzmad-frame-scheduler/build.mjs all
```

Run LZMA1/LZMA2 archive regression vectors with:

```powershell
node build-support/versions/v016-lzmad-frame-scheduler/test-candidate.mjs
```

Build verification passed: Closure/Base122 decoded-source consistency, 25 LZMA1 stream vectors, a synthetic LZMA1 archive, two synthetic LZMA2 archives, and a temporary VM check of frame-deadline waiting/resynchronization. The test summary is `build/tests/test-results.json`. Browser gameplay and actual ROM loading were not tested. This is an unfinalized build; no `RELEASED.json` is included.
