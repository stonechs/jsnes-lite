# V012 build workspace

This directory is the home for V012-specific build scripts once the next version's feature scope and output directory are chosen. It is only a build-script workspace: no `dist/` version directory or release output has been created here.

Before adding scripts, choose an unused `dist/v012-english-feature-name/` destination, snapshot the intended inputs there, and ensure scripts reject writes to any directory containing `RELEASED.json`. Document the commands and tool versions here. See [`../../README.md`](../../README.md) and [`../README.md`](../README.md) for repository-wide rules.
