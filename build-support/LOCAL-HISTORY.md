# JSNES lite 单文件体积实测

## 当前版本：v009（r14 界面，仅支持 .nes）

[独立运行版](dist/v009-r14-nes-only/jsnes-lite.min.html)，**13,191 字节**。保持 v008 的界面和按键，移除了 ZIP/7z 解包功能及相应代码；只加载 `.nes` ROM。可读版、工具与构建体积见 `dist/v009-r14-nes-only/`。
构建下个版本：`node build-v007.mjs compile v010 r14-nes`，再 `node build-v007.mjs pack v010 r14-nes`。

## v008（去调试核心 + r14 界面）

已另存两个版本，旧版本全部保留：

- `dist/v007-no-debug/jsnes-lite.min.html`：**11,500 字节**，删除 VRAM 调试显示/缓冲、音频诊断/统计协议和逐帧入口，保留简单操作界面。
- `dist/v008-r14-ui/jsnes-lite.min.html`：**17,350 字节**，在相同去调试核心上移植用户指定的 JSNES r14 深色界面、静音、F 全屏、屏幕手柄、拖入文件和 ZIP/7z 加载。

v008 键位为方向键、Z=B、X=A、空格=Select、Enter=Start、F=全屏。
两个版本均包含可读 HTML/JS、独立最小 JS、精确字节和验证日志。APU 算法和音频缓冲参数保持不变。
v008 增量包含响应式界面与 ZIP/7z 解压器；没有替换当前模拟器核心。
详见各版本目录 README.md；源码界面在 `interfaces/`，调试逻辑已从 `src/` 删除。
新版本构建：`node build-v007.mjs compile v009 r14`，然后 `node build-v007.mjs pack v009 r14`。
去调试简单界面将 `r14` 改为 `clean`；使用未占用编号，定版目录拒绝覆盖。

## v006（Roadroller 二进制 + Base122）

最小独立 HTML：`dist/v006-base122/jsnes-lite.min.html`，**12,249 字节（11.96 KiB）**，
比 v005 减少 **10.17%**。将 Roadroller 六位文本载荷还原为二进制后采用 Base122 编码，
模拟器核心、音频和缓冲参数保持 v005 不变；不使用原生解压 API，不含 ROM。
可读 HTML/JS、最小 JS、五种包装方案的体积和离线测试记录均保存在同目录。
若额外 gzip，v005 仍更小；v006 优化的是独立 HTML 的磁盘体积。
详细说明见同目录 `README.md`，新包装构建：`node build-v006.mjs v007`（使用未占用编号）。

## v005（修复音频欠载）

已针对用户的《杀戮战场》复现并修正音频断续。缓冲总容量仍为 8192 帧，五声道合成算法不变；
关闭隐藏 VRAM 调试绘制、缓存重复图块读取，并补上低水位回补、流代次校验和断音边缘淡化。

- 运行：`dist/v005-audio-stability/jsnes-lite.min.html`，**13,636 字节（13.32 KiB）**。
- 可读版：同目录 `jsnes-lite.readable.html`、`jsnes-lite.readable.js`。
- 页面的 Audio diagnostics 可查看缓冲余量、欠载、丢样、削波和峰值。
- 对比与验证：同目录 `README.md`、`verification-field-combat.json`。
- 后续新版本示例：`node build-v005.mjs compile v006`，再 `node build-v005.mjs pack v006`。

## v004（AudioWorklet + JSNES 音频核心）

已移植最新 JSNES 的五声道 APU，用 AudioWorklet 在独立音频线程中缓冲、调节音量并输出双声道 PCM。
APU 与 CPU 的寄存器、DMC DMA 和 IRQ 同步逻辑保留在主线程，沿用 JSNES 的线程划分。

- 最小独立 HTML：`dist/v004-audioworklet/jsnes-lite.min.html`，**12,806 字节（12.51 KiB）**，不含 ROM。
- 可读版：同目录 `jsnes-lite.readable.html`、`jsnes-lite.readable.js`；最小 JS 为 `jsnes-lite.min.js`。
- 本机 Edge 已实测 file:// 直接打开并发声，无额外脚本或服务器依赖；点击 Enable audio 可解除浏览器静音策略。
- 新版本构建示例：`node build-v004.mjs compile v005`，再 `node build-v004.mjs pack v005`；使用未占用编号。
- 详细线程边界、体积及测试：同目录 `README.md`。

## v003（新增 Mapper 1–4）

已参考最新 JSNES 2.1.0 主分支 `b8a45d0`，适配 MMC1（1）、UxROM（2）、CNROM（3）、MMC3（4）。
继续使用当前 jsnes-lite CPU、图形和声音核心。最小独立 HTML 为 **7,641 字节（7.46 KiB）**，不含 ROM。

- 运行：`dist/v003-mappers-1-4/jsnes-lite.min.html`
- 阅读：同目录 `jsnes-lite.readable.html`、`jsnes-lite.readable.js`
- 说明：同目录 `README.md`（包含 MMC3 时序测试的已知限制）
- 编辑源码：`src/`、`ui.html`、`ui.js`
- 构建：`node build-v003.mjs compile`，再 `node build-v003.mjs pack`
- 测试：`node --test tests/mappers.test.mjs`

已定版目录不可覆盖，后续请给构建命令传入新版本号，例如 `compile v004`、`pack v004`。

## v002（Closure + Roadroller）

最小独立文件：[`dist/v002-closure-roadroller/jsnes-lite.min.html`](dist/v002-closure-roadroller/jsnes-lite.min.html)，**6,420 字节（6.27 KiB）**，不含 ROM。
可读版本：`jsnes-lite.readable.html`、`jsnes-lite.readable.js`；最小 JavaScript：`jsnes-lite.min.js`。
完整构建说明、各候选体积和验证记录见该目录的 `README.md`、`sizes.json`、`verification-final.json`、`verification-js.json`。

原输出已原样归档到 `dist/v001-terser/`；`dist/` 根目录中的重复副本已移除。
今后每个版本使用新的 `dist/vNNN-名称/` 目录；已定版目录不覆盖。
`AGENTS.md` 已记录此规则，`RELEASED.json` 用于标记定版。

下文记录 v001 的首次实测。现在运行 `node build.cjs` 会自动生成下一个版本目录，
不会覆盖原来的输出；`node verify.cjs <版本目录>` 可指定对应的 Terser 版本。

---

核查日期：2026-11-10。

官方下载源：https://github.com/xem/jsnes-lite

已克隆到 `upstream/`，未修改原仓库。下载时远端 HEAD 为
`923d45e04483b7655dbdd91773f74de46c38c661`（2024-12-14）。
GitHub Releases API 返回空数组，无正式 Release 或 tag；这里的“最新版”指主分支最新提交。

## 结果

所有体积均为实际文件字节数，不含 ROM：

| 文件 | 字节 | KiB（1024 字节） | gzip level 9 字节 |
|---|---:|---:|---:|
| 普通独立 HTML | 96,083 | 93.83 | 23,937 |
| Terser 压缩独立 HTML | 15,501 | 15.14 | 5,784 |

9 个原始 JavaScript 文件合计 94,865 字节。没有发现完整 NES 模拟器仅 1K 的官方说明。
本次是保留全部核心的常规压缩实测，不代表理论最小体积。
`.gz` 是压缩传输/存储文件，不能直接当作 HTML 双击运行。

## 使用

双击 `dist/v001-terser/jsnes-lite-standalone.min.html`，选择本地 `.nes` 文件即可。
页面已内嵌全部脚本，没有 CDN、外部脚本或远程 ROM 请求；不含游戏 ROM。
方向键移动，X=A，C=B，Enter=Start，Esc=Select。
沿用上游核心，未移植其他模拟器；页面仅改为本地 ROM 选择，保留播放、暂停、单帧、重置和 VRAM 查看。
上游页面列出 Mapper 0、2、30；源码注明 Mapper 30 不完整。本次仅实测 Mapper 0。

## “1K”可能混淆了什么

- 作者的 mini6502 项目是 **CPU 核心**，仓库标题标为 944 bytes gzipped，并非完整 NES 模拟器：
  https://github.com/xem/mini6502
- 作者文章中 1078 bytes minified / 721 bytes gzipped 的代码是网页前端，代码仍含
  `<script src=jsnes.min.js>`，并未计入外部模拟器库：
  https://xem.github.io/articles/nes.html

## 构建及核验

v001 构建：按上游 index.html 的脚本顺序合并，使用下载到 `tools/package/` 的
Terser 5.51.2（官方 npm 包）压缩，生成的 HTML、gzip 和体积记录保存在
`dist/v001-terser/`。当前运行 `node build.cjs` 会按版本规则生成新的版本目录。
构建脚本使用 Node 内置模块，无需 npm install。

`node verify.cjs`：使用本机 Edge 和当前环境自带 Playwright，在离线浏览器中通过 file://
加载两份 HTML，再选择仓库自带 homebrew `croom.nes`。各运行 121 帧，画面非空，
普通版和压缩版两次采样的帧哈希一致，无 JavaScript 错误，无 HTTP/HTTPS 请求，
无外部脚本。截图和详细记录在 `dist/v001-terser/`。
验证脚本中的 Playwright 路径为此机器路径，迁移机器时需调整。

这只是启动、画面和键盘调用的冒烟验证，不是完整游戏兼容性测试。
AudioContext 均为 running，但未验证声音是否准确，保留上游音频实现和限制。
