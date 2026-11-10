# v005：音频欠载修复

日期：2026-11-10。针对用户提供的《杀戮战场.nes》复现并修正 v004 的断续/咔哒问题。
ROM 为 Mapper 0、16 KiB PRG、8 KiB CHR；SHA-256 为
`ab308f24cde8ca41974f0683d9b271a9ec3d534ed55c2ee635d3783074ce1dd0`。
ROM 只从用户原目录读取，没有修改、复制到交付目录或嵌入 HTML。

## 结论

v004 和 JSNES 的环形缓冲**总容量均为 8192 个采样帧**，左右声道各 8192 个 Float32 值，
在 48 kHz 下可容纳约 171 ms 的声音。总容量不是这次破音的主要原因。
五声道合成源码保持与固定 JSNES 版本一致，仍通过逐样本 PCM 对照。

本次复现的是**采样供给不足导致的欠载**：隐藏 VRAM 调试输出仍在完整绘制，
加上图块逐像素重复读取，主线程在游戏场景达不到正常帧率。
旧版队列见底后补零、重新预填充，没有像 JSNES 那样要求主线程补帧，形成反复断续。
该 ROM 测试的输出峰值远低于 1，没有发现数字削波。

## 改动

| 项目 | v004 | v005 |
|---|---|---|
| 双声道环形缓冲容量 | 8192 帧 | 8192 帧，保持不变 |
| 发送批次上限 | 1024 帧，每帧刷新 | 128 帧，每帧刷新，与 JSNES 批次一致 |
| 48 kHz 启动/重新预填充门槛 | 1024 帧，约 21 ms | 4096 帧，约 85 ms |
| 48 kHz 低水位回补 | 无 | 3072 帧，约 64 ms 时请求补给 |
| 回补与帧时钟 | 各自没有反馈 | 补帧同时推进视频 deadline，避免重复模拟导致游戏加速 |
| 隐藏 VRAM 调试窗口 | 仍完整绘制 | 关闭时不生成其图像/路径，游戏背景正常生成 |
| 图块行读取 | 每像素重复访问 | 每 8 像素共用图案字节和调色板，复用小数组 |
| 欠载/暂停边缘 | 直接跳到 0 | 32 个采样的短淡出/淡入 |

低水位和目标值按实际设备采样率计算并限幅；上述数值为本机 48 kHz。
目标是软门槛，按整帧补给后队列可以略高于目标，上限仍为 8192。
这是稳定性与延迟的取舍：相比 v004，通常会多缓冲几十毫秒，不能理解为总容量变大。

回补请求有 pending/完成确认和播放流代次，暂停、复位或换 ROM 后拒绝旧请求/旧 PCM。
波形合成、噪声/DMC 算法未替换，也没有加入压限器改变正常音乐。
CPU 指令、PPU 的模拟周期计数、Mapper 和输入功能保留；绘制优化不跳过游戏画面。

## 《杀戮战场》实际对比

在同一台机器的离线 Edge 中，均加载同一 ROM，按住 Enter 140 ms 开始游戏。
先测普通运行 10 秒，再每 100 ms 阻塞主线程 35 ms，持续约 10 秒。
这是队列/帧率测量，不能代表所有机器或所有 ROM。

| 阶段 | v004 | v005 最小版 |
|---|---:|---:|
| 普通运行帧率 | 47.94 fps | 60.09 fps |
| 普通运行新增欠载 | 85 | **0** |
| 人工卡顿阶段帧率 | 33.57 fps | 59.95 fps |
| 人工卡顿新增欠载 | 102 | **0** |
| 两阶段新增溢出丢样 | 0 | 0 |

v005 削波计数为 0，峰值约 0.52（音量滑块已设为 100%）。
完整原始计数、时间和帧数见 `verification-field-combat.json`。
可读版另做同样的独立测试，结果也记录在该文件中。
这里修复的是已复现的欠载，不能据此保证任意负载下绝不破音或所有游戏硬件时序完全准确。

## 运行与文件

- `jsnes-lite.min.html`：**13,636 字节（13.32 KiB）**，独立最小运行文件。
- `jsnes-lite.min.js`：13,578 字节，在有 body 的页面中执行可创建界面。
- `jsnes-lite.readable.html`：149,949 字节；`jsnes-lite.readable.js`：149,961 字节。
- `jsnes-lite.min.html.gz`：10,451 字节。
- `audio-worklet.readable.js` / `audio-worklet.min.js`：分别为 3,506 / 2,427 字节，单独导出便于阅读。

比 v004 独立 HTML 增加 830 字节，约 6.5%。没有外部脚本、CDN 或远程 ROM。
本地 HTML 的 data URL Worklet 加载和 Enable audio、静音、音量等行为保留。
需要支持 AudioWorklet 的浏览器和安全上下文，本机 Edge 的 file:// 已实测。

新增 Audio diagnostics 面板，打开后每 500 ms 刷新：
Buffer 为实际队列余量；underruns 为播放欠载次数；dropped 为溢出丢弃帧数；
clipping 为绝对值超过 1 的输出帧数；peak 为输出峰值。
计数从页面打开后累计，暂停或换 ROM 只清除待播放队列，不清除历史计数；重新加载页面可清零。
调试面板关闭时不轮询。VRAM 面板仍可打开，但该可视化会增加绘制负担。

## 验证与限制

- `verification-unit.txt`：19 组测试通过，覆盖原 12 组 Mapper 测试、APU 源码和 PCM 对照、
  环形队列、淡化、低水位反馈、旧播放流拒绝，以及回补 deadline 和暂停保护。
- `verification-optimized.json`：Closure、Roadroller 输出在原有 13 个测试输入上的图像与可读版一致。
- `verification-vram.json`：使用《杀戮战场》验证 VRAM 开/关时游戏画面哈希一致，
  关闭时不输出调试图，打开时仍生成非空调试图；最小和可读版结果一致。
- `verification-audio-browser.json`、`verification-js.json`：保留实际 Worklet 线程运行、
  主线程阻塞期间继续输出、静音、暂停、复位、换 ROM 和独立 JS 测试。
- `verification-summary.json`：保存参数逐字节复现、旧版本不可变校验及测试汇总。

原有 MMC3 `4-scanline_timing` 仍未通过，报告 Failed #3。本次没有扩大支持板型，
也没有声称修复 CPU/PPU/APU 的全部微时序、DMC 总线冲突或 PAL 支持。

## 构建及复现

Closure 20261108.0.0（主代码 ADVANCED、Worklet SIMPLE），Roadroller 2.1.0，等级 2。
后续使用未占用编号，例如：

```powershell
node build-v005.mjs compile v006
node build-v005.mjs pack v006
```

复用本次压缩参数，可设置 JSNES_ROADROLLER_PARAMETERS 为本目录 roadroller.parameters.json。
构建、音频核心展开和测试脚本均在项目根目录；本目录保留源码及脚本快照。
许可证和作者信息见 LICENSE-JSNES.txt、JSNES-AUTHORS.md、THIRD_PARTY_NOTICES.md。

本轮回归命令：

```powershell
node --test tests/mappers.test.mjs tests/audio.test.mjs
node tests/browser-v005.cjs reference
node tests/browser-v005.cjs optimized
node tests/audio-v005.cjs
node tests/ui-v005.cjs
```

实际 ROM 测量使用 tests/audio-crackle.cjs，第四个参数起为本地 ROM 路径；
BASELINE_MS/JANK_MS 控制测量时长，JSNES_HTML 可指定可读版。
tests/vram-v005.cjs 通过 FIELD_COMBAT_ROM 指定本地 ROM。
浏览器测试依赖本机 Edge 和已安装的 Playwright；用户 ROM 不随版本分发。
