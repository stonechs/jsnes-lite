# Build output policy

- Keep all existing emulator versions and their outputs.
- Put every new output version in a new numbered directory under `dist/`, for example `dist/v003-closure-roadroller/`.
- Each version must include a runnable standalone minimized HTML, readable HTML and readable JavaScript, plus exact byte counts and the build tool versions.
- Keep minimized JavaScript as a separate inspection artifact; the standalone HTML must embed everything needed by the emulator, except the user's local ROM file.
- Never replace a finalized version. `RELEASED.json` marks a finalized directory. Use the next unused version number for subsequent changes.
- Keep the upstream checkout unchanged. Apply build adaptations outside it and document them.
