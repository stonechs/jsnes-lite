# v004：AudioWorklet 独立音频线程

日期：2026-11-10。参考 JSNES 最新主分支 `b8a45d088e922b6abcd87c4eb1b7237919e9d3d2`（2.1.0），
本次另核对远端 HEAD，仍为该提交。旧版 v001、v002、v003 保留。

## 使用及交付文件

直接打开 `jsnes-lite.min.html`，选择本地 `.nes` 文件。
浏览器未自动启用声音时，点击 **Enable audio**。支持 Sound 静音开关和 Volume 音量条。
仍保留原来的播放、暂停、单帧、复位、键盘和 Mapper 0/1/2/3/4/30。

| 文件 | 字节 |
|---|---:|
| jsnes-lite.min.html：最小独立 HTML | **12,806**（12.51 KiB） |
| jsnes-lite.min.js：最小独立 JS | 12,748 |
| jsnes-lite.min.html.gz：gzip level 9 | 9,825 |
| jsnes-lite.readable.html：可读独立 HTML | 146,446 |
| jsnes-lite.readable.js：可读 JS | 146,456 |
| audio-worklet.min.js：单独导出的 Worklet 代码 | 1,437 |
| audio-worklet.readable.js：可读 Worklet 代码 | 2,388 |

比 v003 HTML 增加 5,165 字节，主要用于完整 APU、Worklet 缓冲及音频生命周期处理。
所有运行代码已嵌入 HTML，不需要单独的 worklet 文件、CDN、其他模拟器库或远程 ROM。
单独导出的 JS/Worklet 文件用于阅读和复用，HTML 运行时不读取它们。
完整字节数和 SHA-256 见 `sizes.json`。

## 线程划分

与最新 JSNES `src/browser/speakers.js` 相同，本版的结构是：

```text
主线程：原有 CPU / PPU / Mapper + JSNES APU
           │ 每帧双声道 PCM，Float32Array 可转移批次
           ▼
独立音频线程：AudioWorkletProcessor
           环形缓冲 → 音量 / 静音 → process() 输出
```

**不是把整个 APU、CPU 或模拟器搬到另一个线程。**
APU 寄存器读写、frame IRQ、DMC 从 Mapper 读取样本及 CPU 停顿仍与 CPU 同步执行。
独立线程负责 PCM 队列、渲染和播放，不使用 ScriptProcessorNode 或旧振荡器实现。
主线程长期不产生采样时，有限队列仍会耗尽，届时 Worklet 输出静音。

## 音频核心与接入

- JSNES 的 PAPU、两个方波、三角波、噪声、DMC 五声道模块原样复制到 `src/jsnes-apu/`。
  `prepare-apu.mjs` 只展开 ESM 导入/导出，生成 `src/apu-jsnes.js`，不改声音算法。
- 包络、长度/线性计数器、占空比、扫频、噪声移位寄存器、DMC、非线性混音和 DC 去除沿用该核心。
- `src/papu.js` 将 CPU 寄存器、实际采样率、Mapper 内存、IRQ 与 DMC haltCycles 接入原模拟器。
  CPU 的原有指令逻辑与 PPU 没有被 JSNES 整体替换。
- 每条 CPU 指令及 DMA 停顿时钟推进 APU，$4015 读取补齐 frame counter 状态。
  增加数据总线状态与 APU IRQ 电平检查。DMC 从当前 Mapper 映射读取样本。
- 使用 AudioContext 的实际采样率，本机实测 48 kHz，不硬编码设备为 44.1 kHz。
- 主线程每帧发送采样，超过 1024 帧时分批；使用 transferable ArrayBuffer 降低消息复制。
- Worklet 的容量为 8192 个双声道采样帧（48 kHz 时约 171 ms），预填充 1024 帧；
  欠载补零并重新预填充，溢出丢弃最旧数据，避免延迟无限增长。
- 暂停、软复位、换 ROM 会清除旧音频队列。一次页面会话复用同一个 AudioContext 和 WorkletNode。
  快速换 ROM 使用加载代次，避免较早的异步读文件覆盖最新选择。
- 主机帧计时改为按 performance.now() 校正的 deadline 定时，目标 NTSC 60.098 fps，
  避免整数毫秒 setInterval 导致队列持续漂移；该目标同样参考最新 JSNES 的 FrameTimer。

## 单文件与浏览器

本机 Edge 在 file:// 页面中加载 blob:null Worklet 时触发 CORS 拒绝。
因此本版使用 **内嵌 data:application/javascript 模块**，不访问网络，也不要求本地服务器。
已实测本机 Edge 直接打开本地 HTML 发声。

需要支持 AudioWorklet 的现代浏览器和安全上下文；HTTPS、localhost 是常见部署方式。
其他浏览器对本地文件的策略未逐一验证。未满足条件时会显示音频提示，游戏可继续运行，
不会降级调用已弃用的 ScriptProcessor。浏览器自动播放策略可能要求点击 Enable audio。

## 验证

`verification-unit.txt`：17 组音频及 Mapper 测试全部通过，包含：

- 与固定 JSNES 的官方 APU 源文件逐字节一致；同一寄存器序列及周期输入下，
  包含方波、三角波、噪声和 DMC 的数千个双声道 PCM 采样与 JSNES 逐样本一致。
- frame IRQ / DMC IRQ、$4015 状态、DMC 停顿请求及实际采样率。
- Worklet 预填充、左右声道、音量/静音、队列清空、溢出边界和欠载静音。
- 原有 Mapper 1–4 的 12 组银行、镜像、RAM 与 IRQ 测试。

`verification-audio-browser.json`：在离线 Edge 中运行可读、Closure、Roadroller 三种 HTML，
真实创建 AudioWorkletNode，生成测试 ROM 的约 440 Hz 方波，验证非零声音输出。
阻塞主线程约 80 ms 时，音频线程仍继续消费约 3,800–4,300 个采样；
静音与暂停测得输出峰值为 0，复位及换 ROM 后上下文和节点数量仍各为 1。
同时测量了主机帧率，约 60 fps。没有页面或 processorerror，也没有 HTTP/HTTPS 请求。

`verification-optimized.json`：两种压缩产物在 13 个原有测试输入上的固定帧画面与可读版一致。
四个自产 Mapper CPU 测试 ROM 通过，公开 MMC3 `1-clocking`、`2-details`、`3-A12_clocking`、`5-MMC3`
保持通过。`verification-js.json` 另验证两个独立 JS 的无效 ROM 处理、自动开始、暂停、按键、单帧和复位。

**保留的精度限制**：原有 CPU/PPU 的微时序限制仍在，MMC3 `4-scanline_timing` 仍报告 Failed #3，
不宣称完整的周期精度、所有商业游戏音频准确性、所有 DMC DMA 总线冲突或全部特殊 Mapper 板型兼容。

## 构建与复现

Google Closure Compiler 20261108.0.0；主代码 ADVANCED、Worklet SIMPLE；目标 ECMASCRIPT_2020。
Roadroller 2.1.0、优化等级 2。通过数组消息避免两端独立压缩时属性重命名破坏通信。

项目根目录使用未占用的新版本号，例如 v005：

```powershell
node build-v004.mjs compile v005
node build-v004.mjs pack v005
```

compile 会自动运行 prepare-apu.mjs。复用本次精确参数时先设置：

```powershell
$env:JSNES_ROADROLLER_PARAMETERS='dist/v004-audioworklet/roadroller.parameters.json'
node build-v004.mjs pack v005
Remove-Item Env:JSNES_ROADROLLER_PARAMETERS
```

验证命令：

```powershell
node --test tests/mappers.test.mjs tests/audio.test.mjs
node tests/make-smoke-roms.mjs
node tests/audio-v004.cjs
node tests/browser-v004.cjs reference
node tests/browser-v004.cjs optimized
node tests/ui-v004.cjs
```

浏览器测试脚本固定 v004 路径，并使用本机 Edge 和 Playwright。原始参考库位于 references/，
定版源码和脚本快照、许可及作者信息随本版本保存。测试 ROM 不嵌入模拟器。
RELEASED.json 标记不可覆盖的版本；后续请创建新编号目录。

参考：[JSNES 音频核心](https://github.com/bfirsh/jsnes/tree/b8a45d088e922b6abcd87c4eb1b7237919e9d3d2/src/papu)、
[JSNES Speakers](https://github.com/bfirsh/jsnes/blob/b8a45d088e922b6abcd87c4eb1b7237919e9d3d2/src/browser/speakers.js)、
[MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)。
