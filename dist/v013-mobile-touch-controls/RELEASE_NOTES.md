# V013 — Mobile touch controls

V013 adds a mobile touch controller to the V012 build. The screen sits between the direction and system controls on the left and A/B buttons on the right. Pointer events allow holding buttons and pressing multiple controls at once; pointer cancellation, focus loss, and page hiding release held inputs. Keyboard controls remain available.

In landscape, the game canvas aligns with the top edge and uses the center column. The direction pad and A/B cluster sit in side columns, vertically centered without covering the canvas. Directional button centers are moved inward by 15% of their width or height, reducing center-to-center spacing by about 30%; overlap is allowed. Select and Start are 36×36 px below the pad. In portrait, the canvas spans the row above the controls.

The V013 UI source is stored in `build-support/versions/v013/interface/`, copied into the version snapshot by `prepare.mjs`, and synchronized to repository-root `interfaces/`. The emulator core remains from V012. The upstream snapshot and finalized version directories are unchanged.

The readable and minimized standalone builds were generated with Node.js 24.22.1, Closure Compiler 20261108.0.0, Roadroller 2.1.0, and Base122 encoder revision `b62945c2733fa4da8792a1071e40a8b326e8dd1b`. Roadroller parameters were reused from V011; no V013 parameter search was run. File sizes and SHA-256 hashes are recorded in `sizes.json`.

V013 is finalized. The phone layout is designed to work best in landscape, where the controls have more room. The bundle was rebuilt after the final layout adjustment; desktop-browser screenshot inspection timed out, and physical-device touch behavior has not been exercised.
