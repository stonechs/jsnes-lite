# V012 — OAM address and NMI timing fixes

V012 fixes a sprite DMA alignment bug found with `TCL王牌海战.nes` (Mapper 4). The PPU now initializes OAMADDR to zero and resets it after visible scanline sprite evaluation whenever background or sprite rendering is enabled. This keeps repeated `$4014` DMA copies aligned to four-byte OAM sprite records after software writes `$2004`.

The local differential diagnostic confirmed the ROM writes OAMADDR zero, writes one byte through OAMDATA, and then issues page `$02` DMA each frame. V011 consequently began DMA at address 1; V012 begins subsequent DMA at address 0, matching the reference behavior. The fix does not add dot-accurate PPU sprite evaluation or change the Mapper 4 implementation.

V012 also fixes Side Pocket (U) (Mapper 2) remaining black at startup. The previous PPU queued NMI immediately upon VBlank, allowing the interrupt handler to read and clear `$2002` before the game's main loop observed VBlank. The new PPU logic tracks the rising edge of `PPUCTRL.7 && PPUSTATUS.7`; clearing the status flag can cancel a pending NMI. Delivery is delayed one CPU instruction. This models real NMI edge and suppression behavior, but the instruction-based delay is an approximation rather than cycle- or dot-accurate hardware timing. The VBlank scanline model also remains coarse.

Browser verification used the local 131,088-byte ROM (SHA-256 `867e4ccbad4c5375438557353df11f096fa3ac58f4b588867f0ef1afd3030285`). After 2,400 frames, V011 still had both PPUMASK display bits clear and no OAM data; the rebuilt V012 displays the title, enables both display bits, and has 256 OAM bytes. Pressing Start and running 600 more frames keeps rendering active. The minimized standalone HTML loads the ROM via its file picker and renders 10,166 nonblack pixels without page errors. The TCL regression matches the reference for the first eight OAM bytes, with all 920 game-phase DMA transfers starting at OAM address 0.

Open `jsnes-lite.min.html` in a modern browser and choose the local `.nes` or supported single-file `.7z` ROM. The ROM is not included in the build.

ROM support follows V011: Mapper 0–4 and Mapper 30, with Mapper 30 self-flash programming unsupported; `.7z` is limited to single-file LZMA1/LZMA2 archives; ZIP, CRC verification, and DMC audio are unsupported.

V012 reuses V011's Roadroller parameter file; no V012 parameter search has been run. This finalized build is published as GitHub release V012.
