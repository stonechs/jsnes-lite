# v003：Mapper 1、2、3、4

构建日期：2026-11-10。
参考最新 JSNES 主分支提交 `b8a45d088e922b6abcd87c4eb1b7237919e9d3d2`，package version 2.1.0。
上游 jsnes-lite 仍固定于 `923d45e04483b7655dbdd91773f74de46c38c661`。
两个参考仓库均未修改。适配后的源码位于项目根目录 `src/`，本目录 `source/` 保存定版快照。

## 使用及体积

直接打开 `jsnes-lite.min.html`，选择本地 iNES 1.0 `.nes` 文件。
没有嵌入 ROM、CDN 或外部运行库。

| 文件 | 字节 |
|---|---:|
| 最小独立 HTML：jsnes-lite.min.html | **7,641**（7.46 KiB） |
| 最小独立 JS：jsnes-lite.min.js | 7,583 |
| gzip：jsnes-lite.min.html.gz | 5,914 |
| 可读 HTML：jsnes-lite.readable.html | 93,203 |
| 可读 JS：jsnes-lite.readable.js | 93,211 |

比 v002 的独立 HTML 增加 1,221 字节（约 19.0%），加入新 Mapper 及相关内存和错误处理。
最小 JS 和可读 JS 可在有 body 的页面中执行，自行创建界面。
方向键移动，X=A，C=B，Enter=Start，Esc=Select；保留所有 v002 页面操作。
新增加载状态与无效 ROM 错误提示。

## 合入内容

| Mapper | 实现 |
|---|---|
| 0 / NROM | 保留固定 PRG/CHR，加入 CHR-ROM 写保护 |
| 1 / MMC1 | 5 位串行写入、复位、16/32 KiB PRG、4/8 KiB CHR、两种单屏及横/纵镜像、PRG-RAM 开关；含 SUROM 的 512 KiB 外层 PRG 选择 |
| 2 / UxROM | 修复原来的 0x1111 掩码；支持实际 ROM 大小内的 PRG 银行切换，末银行固定，CHR-RAM |
| 3 / CNROM | 固定 PRG，8 KiB CHR 银行切换 |
| 4 / MMC3 | 8 KiB PRG 银行、2/1 KiB CHR 银行、PRG/CHR 模式反转、成对银行对齐、四屏保护、PRG-RAM 使能与写保护、IRQ 重载/使能/确认 |
| 30 / UNROM-512 | 保留原有基础功能，修正 5 位 PRG 银行掩码，仍不实现 flash 操作 |

CPU 使用 8 KiB PRG 映射表，PPU 使用 1 KiB CHR 映射表，支持映射后的 CHR-RAM 读写。
增加运行期 8 KiB PRG-RAM，修复原来访问不存在的电池 RAM 回调导致的异常。
软复位恢复 Mapper 寄存器并保留该 ROM 的 RAM，换 ROM 清空 RAM。
RAM 目前不写入磁盘或 localStorage，关闭页面不保留游戏存档。
修复上下单屏命名表及 $3000 镜像；OAM DMA 从 CPU 映射接口读取，包括 SRAM/ROM 页。

MMC3 使用 MMC3B/C 的重载语义；IRQ 保持电平，等待 $E000 确认；CPU 正确保留被 I 标志屏蔽的 IRQ，NMI 优先。
渲染期间按扫描线计时，CPU 对 PPUADDR/PPUDATA 的访问另有过滤后的 A12 上升沿计数。
调试 VRAM 读取不参与 IRQ 计数。

## 验证结果与明确限制

1. `verification-unit.txt`：12 组测试全部通过。包含 MMC1 全模式、串行与复位、SRAM/CHR-RAM、SUROM，
   UxROM/CNROM 银行切换，MMC3 模式/镜像/RAM/IRQ，以及与固定最新 JSNES 的银行数据对照。
2. `tests/roms/mapper1..4-smoke.nes`：四个项目自产测试 ROM 全部通过实际 CPU 执行；
   Mapper 4 还验证 IRQ 向量、ISR 执行、$E000 确认和 RTI，RAM IRQ 标记为 1。
   这些测试 ROM 不含商业游戏数据，不内嵌到模拟器。
3. 公开 blargg MMC3 测试 `1-clocking`、`2-details`、`3-A12_clocking`、`5-MMC3` 均报告 Passed，
   内存签名为 DE B0 61、状态为 0。对应日志在 `verification-reference.json`。
4. `4-scanline_timing` **未通过**，报告 Failed #3：$2000=$08 时第 0 行 IRQ 应更早。
   该测试要求逐 PPU 周期精度，当前核心按整行渲染、CPU 按指令推进，尚不具备这种精度。
   本次未把 CPU/PPU 替换为完整 JSNES，也未以硬编码偏移迎合测试。
5. croom、lj65、Mapper 30 H 示例的画面哈希与 v002 一致；额外运行 MMC1_A12 作为视觉诊断，
   它不是通过证明。SNROM 等依赖 CHR/A12 的特殊 SRAM 门控尚未模拟。
6. `verification-optimized.json`：Closure 和 Roadroller 两种产物与可读版在上述 13 个输入上的固定帧画面一致，
   无页面脚本错误、无 HTTP/HTTPS 请求。
7. `verification-js.json`：独立最小/可读 JS 均验证无效 ROM 处理、自动开始、暂停、按键、单帧与复位。

`verification-summary.json` 汇总通过项和已知失败，并确认保存的压缩参数可以逐字节复现 HTML，
v001/v002 的定版文件哈希全部未变。tests/ 下为根目录测试脚本的 .snapshot.txt 快照，
执行入口仍是项目根目录的 tests/，测试依赖的参考仓库位于 references/。

支持的是常见 iNES 1.0 的基础 Mapper/板型，**不是所有板型与芯片版本的完整兼容保证**。
不支持 NES 2.0/submapper、MMC6、Mapper 118/119/TQROM、SOROM/SXROM 的多银行 PRG-RAM，
没有模拟 UxROM/CNROM 的总线冲突，也未修补原 CPU 对非官方指令及 PPU/APU 的全部精度问题。
MMC3 对严格分屏时序的游戏仍可能有画面异常；本次没有验证商业游戏全集或音频准确性。

## 构建与复现

Google Closure Compiler 20261108.0.0，ADVANCED，目标 ECMASCRIPT_2020，关闭不必要的 polyfill。
通过 externs 保留动态 CPU 函数实际引用的符号；其余符号由 Closure 优化。
Roadroller 2.1.0，优化等级 2，页面结构和 JS 一起打包，保留作用域隔离。

在项目根目录使用新版本号，例如 v004：

```powershell
node build-v003.mjs compile v004
node build-v003.mjs pack v004
```

需要复用本次 Roadroller 参数时：

```powershell
$env:JSNES_ROADROLLER_PARAMETERS='dist/v003-mappers-1-4/roadroller.parameters.json'
node build-v003.mjs pack v004
Remove-Item Env:JSNES_ROADROLLER_PARAMETERS
```

运行测试：

```powershell
node --test tests/mappers.test.mjs
node tests/make-smoke-roms.mjs
node tests/browser-v003.cjs reference
node tests/browser-v003.cjs optimized
node tests/ui-v003.cjs
```

浏览器验证脚本当前固定 v003 路径，并使用本机 Edge / Playwright；测试其他版本需修改输出路径。
构建依赖均保存在 tools/，参考库在 references/，不需要 Java 或 npm install。
许可和来源见 LICENSE-JSNES.txt、JSNES-AUTHORS.md、THIRD_PARTY_NOTICES.md。
RELEASED.json 保存定版文件哈希，后续版本不覆盖本目录或 v001/v002。
