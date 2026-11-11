# Build output policy
- Keep all existing emulator versions and their outputs.
- Use numbered version directories with English names under `dist/`, for example `dist/v003-closure-roadroller/`.
- Each version must include a runnable standalone minimized HTML, readable HTML and readable JavaScript, plus exact byte counts and the build tool versions.
- Keep minimized JavaScript as a separate inspection artifact; the standalone HTML must embed everything needed by the emulator, except the user's local ROM file.
- Keep build inputs and intermediate artifacts in English-named subdirectories; keep the primary runnable and readable HTML, build notes, and size/tool metadata at the version root.
- Do not create a finalization marker during ordinary builds. Create `RELEASED.json` only when the user explicitly asks to finalize a version. Once finalized, preserve that directory and use the next unused version number for subsequent changes.
- Keep the upstream checkout unchanged. Apply build adaptations outside it and document them.
## 项目记忆
- 需要了解项目架构时，读取 \PROJECT_GUIDE.md。