# ROM and test data index

This directory contains ROM files and related reference material used for emulator development or validation. These are local inputs to tests; they are not embedded in standalone HTML builds. Check each subdirectory's included documentation for provenance and license terms before redistributing its contents.

| Directory | Contents | Typical use |
|---|---|---|
| `croom/` | `croom.nes` and upstream HTML documentation | Homebrew game smoke checks; the included page identifies it as an NROM-128 game. |
| `lj65/` | `lj65.nes` and `README.txt` | Homebrew puzzle game smoke checks; its documentation describes a Mapper 0 iNES binary. |
| `mapper30/` | `1.nes`, `H.nes`, `V.nes` | Mapper 30 test images/variants. Consult the build and verification notes for the specific behavior under test. |
| `nestest/` | `nestest.nes`, `nestest.log.txt` | 6502/CPU instruction behavior comparison against the reference log. |
| `others/` | `hb1.nes` | Additional homebrew test input; check the relevant test notes before relying on it for a specific feature. |

Do not add commercial ROM dumps to the repository. The `roms/commercial` path is ignored by Git for local-only material. When adding a test ROM, record its purpose, source, license/provenance, and related check here or in a subdirectory README.
