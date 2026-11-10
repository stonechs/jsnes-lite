# v008：去调试核心 + r14 界面

最小独立 HTML：`jsnes-lite.min.html`，**17,350 字节（16.94 KiB）**，不包含 ROM。
基于 v007 去调试核心，移植用户指定的
`D:\2026work\jsnes\jsnes-2.1.0-r14\nes-readable.html` 界面与输入行为。
没有替换成该文件的完整 JSNES 模拟器核心，也没有改动该参考文件。

## 界面和操作

深色响应式布局、像素画面、选择 ROM、静音、F 全屏、八个屏幕手柄按钮和文件状态行。
可点击选择或拖入 .nes、ZIP、7z；ZIP 支持存储/Deflate，7z 支持存储/LZMA/LZMA2，
自动取其中首个 .nes。压缩包读取代码从同一 r14 文件移植，因此单文件也包含相应解压器。
ZIP Deflate 使用浏览器 DecompressionStream('deflate-raw')；最终 Base122 包装本身不依赖该 API。
原模拟器只支持的 iNES 1.0、Mapper 0/1/2/3/4/30 范围保持不变，30 仍不完整。

| NES 操作 | 键盘 |
|---|---|
| 方向 | 方向键 |
| A | X |
| B | Z |
| Select | 空格 |
| Start | Enter |
| 全屏 | F |

屏幕按钮支持按住和指针捕获，键盘与指针来源独立，失焦或页面隐藏时清理按键。
Esc/C 不再映射到 Select/B。标题改为 JSNES lite，以对应实际使用的核心。
调试面板、逐帧入口、音频诊断协议与累计统计、VRAM 调试分配和绘制均已删除。
状态行仅展示加载状态、文件名和错误，供正常操作使用。

音频保持 v007 的 AudioWorklet 缓冲与低水位回补；APU 算法未改。
原 MMC3 精确扫描线时序限制仍存在，详见历史诊断，不因更换界面而改变。

## 产物、构建和验证

`jsnes-lite.min.html` 为最终运行版，`jsnes-lite.min.js` 为独立最小 JS，
`jsnes-lite.readable.html` 与 `jsnes-lite.readable.js` 为可读版。
`sizes.json` 保存所有构建阶段的字节数、gzip 大小、哈希和工具版本。
`source/`、`tests/` 保存源码、构建器、编解码与验证脚本快照。
编解码采用 Google Closure 20261108.0.0 + Roadroller 2.1.0 等级 2 + Base122。
新构建：在项目根目录执行 `node build-v007.mjs compile v009 r14`，然后
`node build-v007.mjs pack v009 r14`，使用未占用编号；已定版版本拒绝覆盖。

验证：14 组 Mapper/去诊断测试、6 组压缩包测试，及 Edge file:// 离线运行。
可读版、Closure 和最终 Base122 HTML 的 13 个 ROM 画面哈希与 v005 对齐；
这些是防止改动导致渲染退化的回归检查，不表示所有兼容性测试已通过。
验证方向键/Z/X/空格/Enter、键盘与指针叠加、失焦释放、静音、F 全屏和窄屏布局。
真实 AudioWorklet 发声、主线程阻塞期间音频继续、静音恢复、重复加载仅保留一个音频上下文/节点。
自制 ZIP/7z 固定数据和拖入 ROM、无效 ROM 提示均测试。日志见 `verification-*.json/.txt`。
测试只使用自制或原有公开测试 ROM，不把商业 ROM 放入发布目录。
