JSNES lite
===

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

Backstory (Twitter thread): https://twitter.com/MaximeEuziere/status/1316455403274858501

DEMO: https://xem.github.io/jsnes-lite

## 本地改进版（v009）

最新独立运行版：[jsnes-lite.min.html](dist/v009-r14-nes-only/jsnes-lite.min.html)（13,191 字节）。下载后直接打开，选择本地 `.nes` 文件。包含深色界面、屏幕手柄、静音和全屏；支持 Mapper 0–4，使用 JSNES APU 与 AudioWorklet 音频。不包含用户游戏 ROM。方向键移动，Z=B，X=A，空格=Select，Enter=Start，F=全屏。

- [interfaces/](interfaces/)：新增界面源码。
- [build-support/](build-support/)：构建脚本、工具、测试及上游参考快照。
- [dist/](dist/)：v001–v009 各版完整发布文件，含可读 HTML/JavaScript、独立压缩 JavaScript、体积和工具版本记录。
- [构建说明](build-support/README.md)；[完整本地开发记录](build-support/LOCAL-HISTORY.md)。

`src/` 已更新为改进核心；原始核心保存在 `build-support/upstream/src/`，`roms/` 保留。所有新增发布继续使用新的 dist/vNNN-名称/ 目录；含 RELEASED.json 的定版目录不覆盖。


### 核心更新

根目录 `src/` 是当前模拟器核心源码，新增 Mapper 1–4（MMC1、UxROM、CNROM、MMC3）。音频参考 JSNES 2.1.0（固定提交 b8a45d088e922b6abcd87c4eb1b7237919e9d3d2）的五声道 APU：CPU/APU 同步、DMC DMA 与 IRQ 在主线程处理，AudioWorklet 在音频线程缓冲并输出双声道 PCM。

新增音频实现包括 `src/jsnes-apu/`、`src/apu-jsnes.js`、`src/audio-output.js`、`src/audio-worklet.js`，以及更新后的 `src/papu.js`。授权及来源见 [第三方说明](build-support/THIRD_PARTY_NOTICES.md)。当前运行入口使用 `dist/v009-r14-nes-only/jsnes-lite.min.html`；根目录原始 `index.html` 保留作历史页面。
