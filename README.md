JSNES lite
===

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

Backstory (Twitter thread): https://twitter.com/MaximeEuziere/status/1316455403274858501

DEMO: https://xem.github.io/jsnes-lite

## 本地改进版（v009）

最新独立运行版：[jsnes-lite.min.html](dist/v009-r14-nes-only/jsnes-lite.min.html)（13,191 字节）。下载后直接打开，选择本地 `.nes` 文件。包含深色界面、屏幕手柄、静音和全屏；支持 Mapper 0–4，使用 JSNES APU 与 AudioWorklet 音频。不包含用户游戏 ROM。方向键移动，Z=B，X=A，空格=Select，Enter=Start，F=全屏。

- [interfaces/](interfaces/)：新增界面源码。
- [build-support/](build-support/)：构建脚本、改进核心、工具、测试及上游参考快照。
- [dist/](dist/)：v001–v009 各版完整发布文件，含可读 HTML/JavaScript、独立压缩 JavaScript、体积和工具版本记录。
- [构建说明](build-support/README.md)；[完整本地开发记录](build-support/LOCAL-HISTORY.md)。

原有根目录文件、src/ 和 roms/ 保留。所有新增发布继续使用新的 dist/vNNN-名称/ 目录；含 RELEASED.json 的定版目录不覆盖。
