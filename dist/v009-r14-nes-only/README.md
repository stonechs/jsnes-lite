# v009：r14 界面，仅支持 .nes 文件

独立最小 HTML：`jsnes-lite.min.html`，**13,191 字节（12.88 KiB）**，不包含 ROM。
基于 v008 的去调试核心和 r14 深色响应式界面，保留方向键、Z=B、X=A、空格=Select、Enter=Start、F=全屏、触屏手柄、静音、全屏与拖放。
文件选择器只接受 `.nes`，移除了 ZIP/7z 读取、CRC 校验、Deflate/LZMA/LZMA2 解压代码；拖入压缩包会按普通无效 ROM 提示错误。
APU、Worklet、Mapper、CPU、PPU 核心和音频缓冲不变。Mapper 30 仍为部分实现，MMC3 精确扫描线时序限制仍在。

相比 v008 的 17,350 字节减少 **4,159 字节（23.97%）**。

可读文件为 `jsnes-lite.readable.html`、`jsnes-lite.readable.js`；独立最小 JS 为 `jsnes-lite.min.js`。
`sizes.json` 记录全部阶段精确字节、gzip 字节、SHA-256 和 Closure/Roadroller/Base122/Node 版本。
`source/` 保存构建源快照，`tests/` 保存项目现有验证脚本。
构建命令：`node build-v007.mjs compile v010 r14-nes`，然后 `node build-v007.mjs pack v010 r14-nes`，使用未占用编号。
