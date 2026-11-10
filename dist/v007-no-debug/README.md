# v007：去调试版

最小独立 HTML：`jsnes-lite.min.html`，**11,500 字节（11.23 KiB）**，不包含 ROM。
比 v006 的 12,249 字节减少 749 字节（6.11%）。
保留选择 ROM、自动播放、播放/暂停、复位和声音开关。
键盘保持原版：方向键、X=A、C=B、Esc=Select、Enter=Start。

已删除 VRAM 可视化画布、整屏调试缓冲和绘制、每帧调试 DOM 查询，
音频诊断面板、统计轮询、诊断消息协议及峰值/削波/欠载/丢样/回补累计计数，
以及 UI 逐帧按钮与 Auto start 复选框。错误提示保留，用于 ROM 和音频加载失败。
真实游戏背景行生成及硬件 VRAM 内存保持正常；这些属于模拟器功能。

五声道 APU 算法、Mapper、CPU 和游戏渲染时序保持原逻辑。
AudioWorklet 容量 8192 样本帧、128 帧消息 batch、低水位约 64ms、目标约 85ms，
流代次、低水位回补和 32 样本边缘淡化仍保留。已逐样本对比旧 Worklet 输出与回补消息。
MMC3 精确扫描线时序的原有已知限制未在本版本修复。

## 产物与构建

- `jsnes-lite.min.html`：最终独立运行版，Closure + Roadroller + Base122。
- `jsnes-lite.min.js`：独立最小 JS；`jsnes-lite.readable.html` / `.js`：可读版。
- `closure.min.html`：Closure 阶段；`roadroller.min.html`：未做 Base122 包装的对照。
- `sizes.json`：全部 JS/HTML 的精确大小、gzip 大小、哈希及工具版本。
- `source/`：源码、界面、构建器和 Base122 模块快照；`tests/`：验证脚本快照。

在项目根目录构建：`node build-v007.mjs compile v009 clean`，再
`node build-v007.mjs pack v009 clean`，使用未占用编号。定版目录拒绝覆盖。
Google Closure Compiler 20261108.0.0；Roadroller 2.1.0，优化等级 2；Base122 参考提交
`b62945c2733fa4da8792a1071e40a8b326e8dd1b`。构建不依赖外部 CDN。

验证记录：`verification-unit.txt`、`verification-browser.json`、`verification-player.json`、
`verification-summary.json`。浏览器测试以本地 file://、禁止 HTTP 请求运行。
画面哈希与 v005 的 13 个 ROM 基准对比，保留已知测试失败的原始画面，不将其误记为通过。
测试使用的自制音频和 Mapper ROM 留在项目 tests 目录，未嵌入播放器。
