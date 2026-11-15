# V014 build notes

## Changes

- Uses the V013 emulator core with a simplified touch UI.
- Sets the page background to #555 and stacks A/B vertically.
- Removes the direction-key inward translations.
- Shrinks the direction keys by 20% and places Down between Left and Right.
- Uses 26vw side columns without minimum or maximum width clamps; the canvas width follows 107dvh.
- Restores 4px offsets for the side controls, tools, and side notes; removing them did not reduce the packed HTML size.
- Removes landscape clipping and the portrait main scroll container; overflow follows the page's natural scrolling behavior.
- Uses Lightning CSS 1.33.0 and the community `da0ka/roadroller` fork with O2 search.

## Build checks and sizes

- Standalone minimized HTML: 10,879 bytes (V013: 11,421 bytes; 542 bytes smaller).
- Inline CSS: 1420 bytes (original: 2,852 bytes; 1,432 bytes smaller).
- Base122 payload round-trip passed.
- Decoded HTML matches V014 source; decoded emulator JavaScript matches V014 Closure output after whitespace normalization.
- Browser gameplay and physical-phone controls were not tested.

See `sizes.json` for exact file sizes, SHA-256 hashes, and tool versions.
