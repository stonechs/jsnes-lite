# V011 core source

These readable JavaScript files are the current emulator modules. The V011 build pipeline uses the matching snapshots in `dist/v011-mapper30/source/` and combines them with the Web interface source from `interfaces/`.

V011 supports Mapper 0–4 and Mapper 30 UNROM-512 bank switching for iNES 1.0 ROMs. Mapper 30 PRG self-flash is not emulated. V011 also accepts single-file LZMA1/LZMA2 7z archives; it does not support ZIP, CRC verification, or DMC. See `dist/v011-mapper30/README.md` for build details and `dist/v011-mapper30/sizes.json` for exact sizes, hashes, and tool versions.
