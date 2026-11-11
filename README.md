JSNES lite
===

Tiny NES emulator in JS inspired by JSNES (https://github.com/bfirsh/jsnes + https://github.com/bfirsh/jsnes-web)

DEMO: https://xem.github.io/jsnes-lite

## 最新版：V010 极致运行版

**独立运行文件：[jsnes-lite.min.html](dist/v010-extreme-runtime/jsnes-lite.min.html)，9,997 字节。** 下载后直接用浏览器打开，选择本地 ROM。

支持 `.nes` 和单文件 LZMA1/LZMA2 `.7z`；不支持 ZIP，没有 CRC 校验，也没有 DMC 功能。精简四通道音频，支持 Mapper 0–4 和单手柄，提供全屏与静音。

- [V010 与 V009 的功能差异](dist/v010-extreme-runtime/VERSION_NOTES.md)
- [V010 发布文件、源码与构建记录](dist/v010-extreme-runtime/README.md)
- 根目录 [`src/`](src/) 和 [`interfaces/`](interfaces/) 始终对应最新发布版本；Node 构建脚本组装模拟器模块与界面源码，再压缩并打包。
- [构建说明](build-support/README.md) · [本地开发记录](build-support/LOCAL-HISTORY.md)

## V009

[V009 独立运行版](dist/v009-r14-nes-only/jsnes-lite.min.html)（13,191 字节）支持 `.nes`，使用 JSNES 五声道 APU 与 AudioWorklet，含触屏手柄、静音和全屏。按键为方向键、Z=B、X=A、空格=Select、Enter=Start、F=全屏。

V009 根目录源码历史副本保存在 `build-support/archive/v009-src/` 和 `build-support/archive/v009-interfaces/`。V009 及更早版本的发布文件均保留在 `dist/` 对应目录。原始上游源码快照在 `build-support/upstream/`，未作修改。

## 版本维护

每次发布都把最新可读核心和界面源码同步到根目录 `src/`、`interfaces/`，在 `dist/` 新建编号目录并推送对应 Git 版本标签。已定版版本输出保留。
