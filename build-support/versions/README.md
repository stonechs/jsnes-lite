# Versioned build scripts

Historical scripts for V002 through V011 remain in `build-support/` at their original paths. They are tied to specific source snapshots and output directories; do not move them or assume they can target a new version unchanged.

Starting with V012, put new version-specific scripts and their short workflow notes in a directory named `vNNN/`, for example:

```text
build-support/versions/v012/
  README.md
  build.mjs
  search.mjs       # when the version needs parameter search
  select.mjs       # when the version compares packaged candidates
  verify.mjs       # checks appropriate to that version
```

The release output still belongs in a new numbered English-named directory under `dist/`, such as `dist/v012-feature-name/`. Keep an explicit source snapshot under that release's `source/` directory and record sizes and tool versions there. This convention does not create or reserve a `dist/` release directory; create one when the scope of the next version is known.

Do not copy V011 scripts verbatim without updating and reviewing their source, output, and finalization paths. V011 is finalized and its scripts intentionally refuse to write into its release directory.
