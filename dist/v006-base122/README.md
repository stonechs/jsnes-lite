# v006：Roadroller 二进制 + Base122

最小独立文件：`jsnes-lite.min.html`，**12,249 字节（11.96 KiB）**。
与 v005 的 13,636 字节相比，减少 1,387 字节（10.17%）。不包含 ROM。
可读版：`jsnes-lite.readable.html`、`jsnes-lite.readable.js`，与 v005 逐字节相同。
独立最小 JavaScript：`jsnes-lite.min.js`，12,191 字节。

## 方案比较

计入 UTF-8 实际字节、HTML 外壳、字符转义和全部解码器。

| 方案 | HTML 字节 | gzip 后字节 |
|---|---:|---:|
| v005 Closure + Roadroller | 13,636 | 10,451 |
| Roadroller 二进制 + Base122（最终采用） | 12,249 | 11,044 |
| Roadroller HTML + DEFLATE + Base122 | 12,483 | 11,364 |
| Roadroller HTML + gzip + Base122 | 12,496 | 11,382 |
| Roadroller HTML + DEFLATE + Base64 | 14,293 | 10,845 |
| Closure HTML + DEFLATE + Base122 | 14,196 | 12,921 |

Base122 是二进制到文本的编码，不是压缩算法，典型开销约 8/7，Base64 约 4/3。
最终方案把 Roadroller 的 12,890 个六位编码字符还原为 9,668 字节二进制，
再编码为 11,051 字节 UTF-8 Base122 载荷，增加 HTML 和解码器后共 12,249 字节。
直接编码未经压缩的 JavaScript 并不会产生这种收益。

最终方案不使用 DecompressionStream；运行时先恢复完全相同的 Roadroller 文本流，
再执行原来的解压器。CPU、PPU、Mapper、APU、AudioWorklet 和音频缓冲参数均未修改。
原 MMC3 逐周期扫描线时序测试的已知失败保持不变。
若通过 HTTP gzip 发布，v005 的 gzip 体积反而较小；本版本优化的是磁盘上独立 HTML 的大小。

## 构建和验证

构建：`node build-v006.mjs v007`，使用未占用的编号。已存在 RELEASED.json 的目录拒绝覆盖。
工具：Google Closure Compiler 20261108.0.0，Roadroller 2.1.0（复用 v005 载荷）。
Base122 参考实现：Kevin Albertson，MIT，commit `b62945c2733fa4da8792a1071e40a8b326e8dd1b`。
参考源：https://github.com/kevinAlbs/Base122 。许可证随本目录保存。

`source/` 保存构建器和编解码源；`*.loader.readable.js` 为带占位符的可读加载器模板。
`sizes.json` 保存每个候选的精确字节数、SHA-256、二进制载荷大小和编码大小。
`verification-unit.txt` 验证所有字节值、尾部填充、HTML 字符串边界以及原 Roadroller 程序精确还原。
Edge file:// 离线测试记录见 `verification-audio-browser.json`，ROM 画面回归记录见
`verification-optimized.json`，独立 JS 操作测试见 `verification-js.json`。
`verification-reference.json` 复制自 v005，作为相同核心的基准，而非重新运行的测试结果。
`verification-summary.json` 汇总验证并检查 v001–v005 已定版文件哈希未变。
《杀戮战场》正常运行 10 秒、每 100ms 人为阻塞主线程 35ms 持续 10 秒的结果保存在
`verification-field-combat.json`；ROM 仅从用户指定路径读取，未打包进输出。

本轮测试不是“所有音频计数器为零”：v006 正常阶段 0 次欠载、13 帧丢样，
阻塞阶段 0 次欠载、9 帧丢样；正常阶段开始前累计 3,365 帧丢样。
同机随后对照 v005，正常阶段 2 次欠载、0 丢样，阻塞阶段 0 次欠载、0 丢样。
v005 对照结果见 `verification-field-combat-v005-comparison.json`。
这些是包含启动与主机调度差异的单次观察，不能据此断言音频稳定性提高或退化。
本次只变更包装，解包还原的模拟器程序与 v005 精确一致；没有调整音频参数。
