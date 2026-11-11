JSNES lite
===

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

Backstory (Twitter thread): https://twitter.com/MaximeEuziere/status/1316455403274858501

DEMO: https://xem.github.io/jsnes-lite

## V010 极致运行版

**最新独立运行版：[jsnes-lite.min.html](dist/V010_极致运行版/jsnes-lite.min.html)，9,997 字节。** 下载保存后直接用浏览器打开，无服务器和外部运行资源依赖（游戏 ROM 由用户自行选择）。

**支持 7z，不支持 ZIP；没有 CRC 校验；没有 DMC 功能。** 支持原始 `.nes` 与单文件 LZMA1/LZMA2 `.7z`（含相应压缩文件头）。这是以小体积和直接离线运行为目标的**极致运行版**。

- 精简四通道音频，保留包络、扫频等控制；无 AudioWorklet，无 DMC 的声音、状态、DMA 停顿或 IRQ。
- Mapper 0、1、2、3、4；单手柄；居中放大、静音和全屏。无 Mapper 30、触屏手柄或拖放。
- 按键：方向键移动，Z=B、X=A、空格=Select、Enter=Start、F=全屏；最终压缩成品已实际验证八键。
- 错误提示为不超过 6 字符的英文短码；143 项单元检查与离线浏览器检查通过。
- [与 V009 的功能差异](dist/V010_极致运行版/VERSION_NOTES.md) · [V010 源码与验证说明](dist/V010_极致运行版/README.md)。

V009 仅支持 `.nes`，没有 ZIP/7z 和压缩包 CRC 校验；V010 新增 7z。DMC 删除可能影响部分游戏音效或运行，无 CRC 时无法可靠发现压缩数据损坏。V009 和所有旧发布保持原样；V010 的最新运行源码位于 `dist/V010_极致运行版/source/`，根目录 `src/` 保留 V009 开发核心。

## 上一版：V009

上一版独立运行版：[jsnes-lite.min.html](dist/v009-r14-nes-only/jsnes-lite.min.html)（13,191 字节）。下载后直接打开，选择本地 `.nes` 文件。包含深色界面、屏幕手柄、静音和全屏；支持 Mapper 0–4，使用 JSNES APU 与 AudioWorklet 音频。不包含用户游戏 ROM。方向键移动，Z=B，X=A，空格=Select，Enter=Start，F=全屏。

- [interfaces/](interfaces/)：新增界面源码。
- [build-support/](build-support/)：构建脚本、工具、测试及上游参考快照。
- [dist/](dist/)：v001–v009 各版完整发布文件，含可读 HTML/JavaScript、独立压缩 JavaScript、体积和工具版本记录。
- [构建说明](build-support/README.md)；[完整本地开发记录](build-support/LOCAL-HISTORY.md)。

`src/` 已更新为改进核心；原始核心保存在 `build-support/upstream/src/`，`roms/` 保留。所有新增发布继续使用新的 dist/vNNN-名称/ 目录；含 RELEASED.json 的定版目录不覆盖。


### V009 开发核心（保留）

根目录 `src/` 是当前模拟器核心源码，新增 Mapper 1–4（MMC1、UxROM、CNROM、MMC3）。音频参考 JSNES 2.1.0（固定提交 b8a45d088e922b6abcd87c4eb1b7237919e9d3d2）的五声道 APU：CPU/APU 同步、DMC DMA 与 IRQ 在主线程处理，AudioWorklet 在音频线程缓冲并输出双声道 PCM。

新增音频实现包括 `src/jsnes-apu/`、`src/apu-jsnes.js`、`src/audio-output.js`、`src/audio-worklet.js`，以及更新后的 `src/papu.js`。授权及来源见 [第三方说明](build-support/THIRD_PARTY_NOTICES.md)。V009 历史运行入口使用 `dist/v009-r14-nes-only/jsnes-lite.min.html`；根目录原始 `index.html` 保留作历史页面。
