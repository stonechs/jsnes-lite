# Build support

This directory contains versioned build scripts, vendored tools, packaging adaptations, tests, references, and the unchanged upstream snapshot. The editable source of truth is in the repository root `src/` and `interfaces/`; released inputs are copied into each version's `source/` snapshot.

## Current release

V012 is the latest finalized release at `../dist/v012-oam-address-reset/`; its scripts are under `versions/v012/` and refuse to overwrite the finalized directory. The V011 scripts remain here as historical, version-specific entry points.

## Future versions

Keep existing version scripts at their current paths so archived instructions remain valid. Starting with V012, place new version-specific build, search, selection, finalization, and verification scripts under `build-support/versions/v012/` (and the matching directory for later versions). The `versions/` README describes this convention; create the actual release output under a fresh `dist/vNNN-english-name/` directory.

Run a script from the directory documented by that script. Check its source paths and output path before building: old scripts may use version-specific inputs and are not generic builders. The V011 scripts, for example, consume `dist/v011-mapper30/source/` and target `dist/v011-mapper30/`.

## Repository rules

- Preserve every existing `dist/` version and its artifacts. V012 and earlier are finalized.
- New version directories use numbered versions and English names.
- Keep standalone HTML self-contained except for the user's local ROM; keep readable HTML/JavaScript, separate minimized JavaScript, exact byte counts, and tool versions.
- Ordinary builds do not create `RELEASED.json`. Create it only when explicitly asked to finalize a version.
- Keep build adaptations outside `upstream/`, and document them with the version.

For project architecture and source-copy rules, see [`../PROJECT_GUIDE.md`](../PROJECT_GUIDE.md). For the chronological record of earlier experiments, see [`LOCAL-HISTORY.md`](LOCAL-HISTORY.md).
