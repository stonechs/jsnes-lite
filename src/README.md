# Current core source (V012)

These readable JavaScript files are the editable emulator modules. The V012 build pipeline copies them into `dist/v012-oam-address-reset/source/` and combines them with the Web interface source from `interfaces/`.

V012 supports Mapper 0–4 and Mapper 30 UNROM-512 bank switching for iNES 1.0 ROMs. It resets OAM address during sprite evaluation and delays NMI delivery to allow `$2002` to cancel a pending edge. The delay approximates hardware timing at CPU instruction granularity. Mapper 30 PRG self-flash is not emulated. The interface also accepts single-file LZMA1/LZMA2 7z archives; ZIP, CRC verification, and DMC are unsupported. See `dist/v012-oam-address-reset/README.md` and `sizes.json` for build details and exact file metadata.
