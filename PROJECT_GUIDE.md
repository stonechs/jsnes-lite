# JSNES lite 项目说明

这份文档介绍仓库结构、当前版本和后续维护方式，供开发者与 Codex 开始工作时快速了解项目。版本状态以仓库中的 `AGENTS.md`、各版本 `RELEASED.json` 和实际文件为准。

## 项目简介

JSNES lite 是一个用 JavaScript 编写的 NES 模拟器，源自 [xem/jsnes-lite](https://github.com/xem/jsnes-lite)，并在本仓库中进行核心、音频、界面、ROM 加载和单文件构建方面的本地适配。主要交付物是可离线打开的独立 HTML：模拟器代码和界面都嵌在文件中，用户在浏览器内选择本地 ROM；ROM 本身不随构建产物分发。

仓库同时保存可读源码、构建工具、构建/验证记录，以及多个历史版本的完整产物。`dist/` 是版本归档，不是临时输出目录。

## 当前状态

- 当前最新版本为 V011，目录是 `dist/v011-mapper30/`。它包含 `RELEASED.json`，已经定版；不要覆盖或改写该目录。
- V011 独立 HTML 为 10,107 字节。支持 iNES 1.0 Mapper 0–4 和 Mapper 30 UNROM-512 的 PRG/CHR-RAM 银行切换、非电池板卡总线冲突处理及低位单屏镜像；不模拟 Mapper 30 PRG 自闪存编程。
- ROM 输入支持 `.nes` 和单文件 LZMA1/LZMA2 `.7z`。不支持 ZIP、CRC 校验或 DMC 音频。
- V010 及更早版本也均有 `RELEASED.json`。目前 `dist/` 中所有版本都已经定版；任何后续版本必须使用新的未占用编号目录。
- 根目录 `src/` 与 `interfaces/` 是后续开发的唯一可编辑源码入口。`dist/v011-mapper30/source/` 是 V011 的冻结构建输入快照，不是日常编辑位置；V011 的清单记录快照哈希，可用于核对历史构建输入。

## 仓库结构

| 路径 | 用途 |
|---|---|
| `src/` | 模拟器核心和 ROM/压缩包处理源码，按模块拆分。 |
| `interfaces/` | Web 界面源码：`ui.html` 定义页面，`ui.js` 处理文件选择、键盘/界面事件及模拟器初始化。 |
| `build-support/` | 按版本保留的构建脚本、打包器、测试、参考资料、上游快照和第三方许可说明。新增构建适配应放这里，不要修改上游副本。 |
| `build-support/upstream/` | 官方上游仓库快照，作为参考基线；保持不变。 |
| `build-support/tools/` | 固定版本的 Closure、Roadroller 等构建工具。 |
| `build-support/packaging/` | Roadroller 独立包适配和 Base122 编码/打包代码。 |
| `build-support/tests/` | 核心、Mapper、音频、归档格式及历史版本相关检查。 |
| `build-support/references/` | 对照源码和 NES 测试资料。 |
| `dist/vNNN-name/` | 编号版本的发布/构建快照、独立 HTML、可读产物、构建中间件、说明和元数据。保留既有目录。 |
| `roms/` | 仓库内用于开发或验证的 ROM/ROM 相关材料；不要把这些文件自动嵌入发布 HTML。 |

### 核心模块速查

- `nes.js`：NES 实例、组件连接与主要运行入口。
- `rom.js`：ROM 数据解析与 ROM 对象。
- `memory.js`：CPU/PPU 可见内存和读写分发。
- `mappers.js`：Mapper 及银行切换逻辑。
- `6502.js`、`cpu.js`：6502 指令执行与 CPU 调度。
- `ppu.js`：图像/扫描线相关模拟。
- `papu.js`：APU 音频通道与采样。
- `controller.js`：控制器输入状态和串行读取。
- `archive.js`、`lzma-small.js`：归档识别和精简 LZMA 解码逻辑。
- `interfaces/ui.html`、`interfaces/ui.js`：浏览器界面和页面事件连接。

## 构建产物约定

每个新版本目录应使用 `dist/vNNN-english-name/` 形式，并在版本根目录保存主要可读/可运行 HTML、构建说明及 `sizes.json`。版本还应包含可读 JavaScript、独立最小 JavaScript 检视文件、字节数和构建工具版本；standalone HTML 必须内嵌运行所需资源（用户本地 ROM 除外）。中间文件和构建输入放入英文命名子目录。

普通构建不创建 `RELEASED.json`。只有用户明确要求定版时才执行定版；一旦目录含有该标记，应保留目录并在下一次工作中使用新的版本号。现存所有版本目录都受此规则保护。

## 文档分工

- 根 `README.md`：项目首页、最新版本摘要和常用入口。
- `PROJECT_GUIDE.md`：架构、源码真相来源及 Codex 工作约定。
- `build-support/README.md`：当前构建支持目录布局和后续版本脚本约定。
- `build-support/LOCAL-HISTORY.md`：历史试验时间线；其中旧命令只作为历史记录。
- `dist/<version>/README.md` 和发布说明：该版本的具体功能、用法、限制和构建记录。

## V011 构建入口

V011 的历史版本脚本位于 `build-support/` 根目录，保留原路径以免破坏既有命令和引用：

- `build-V011.mjs compile`：读取 V011 快照源码并生成 Closure 编译及可读产物。
- `search-V011.mjs`：搜索 Roadroller 参数并将记录写入 V011 的 `search/`。
- `select-V011.mjs`：对候选参数实际打包，按 Base122 standalone HTML 字节数选胜者。
- `build-V011.mjs pack`：使用 `search/winner.json` 打包最终体积较小的独立 HTML。
- `verify-build.mjs`：构建产物核对工具；具体检查范围以脚本内容为准。

历史构建步骤在 `build-support/README.md`、版本 README 及 `build-support/LOCAL-HISTORY.md`。后者按时间记录 v001 起的试验，部分旧命令描述的是当时的入口和布局，不应当作当前 V011 的构建说明。

V012 起，新版本专用脚本放在 `build-support/versions/v012/`（后续版本同理），避免继续扩展根目录平铺的脚本列表。V011 的脚本目标目录已定版，不要直接复用来覆盖输出。

V011 及历史构建记录使用 Node.js v24.22.1、Closure Compiler 20261108.0.0、Roadroller 2.1.0 和 Base122 encoder revision `b62945c2733fa4da8792a1071e40a8b326e8dd1b`。实际运行环境可能不同，执行前可用 `node --version` 核对。构建脚本中的版本路径目前固定为已定版的 `dist/v011-mapper30/`，且会检测 `RELEASED.json` 并拒绝覆盖；新版本应先在 `build-support/` 中新增/调整专用入口和目标目录，再进行构建。

## 后续改动建议

1. 先阅读本文件、`AGENTS.md`、根 `README.md`、`build-support/README.md` 和目标版本的 README。
2. 确认目标版本没有 `RELEASED.json`；不要在已定版目录上迭代。
3. 修改当前可读源码时，只在根 `src/`、`interfaces/` 中开发；为新版本复制确切构建输入到新版本的 `source/` 快照。不要直接修改 V011 快照或 `build-support/upstream/`。
4. 为新版本使用英文目录名、版本专用构建脚本/说明和尺寸元数据；V012 起脚本放 `build-support/versions/vNNN/`。清楚记录支持的 ROM/Mapper/音频范围及限制。
5. 按改动面运行相关检查，并保留记录。浏览器相关验证脚本可能依赖特定 Windows 浏览器或本机路径，迁移环境时先查看脚本配置。
6. 只有在用户明确要求时才创建 `RELEASED.json`；定版前确认主产物、源码快照、清单和说明一致。

## 资料导航

- 仓库规则：[`AGENTS.md`](AGENTS.md)
- 最新版本概览：[`README.md`](README.md)
- 构建与版本维护：[`build-support/README.md`](build-support/README.md)
- 开发历史：[`build-support/LOCAL-HISTORY.md`](build-support/LOCAL-HISTORY.md)
- ROM 测试材料索引：[`roms/README.md`](roms/README.md)
- V011 包说明：[`dist/v011-mapper30/README.md`](dist/v011-mapper30/README.md)
- V011 功能与限制：[`dist/v011-mapper30/RELEASE_NOTES.md`](dist/v011-mapper30/RELEASE_NOTES.md)
- V011 文件大小、哈希和工具版本：[`dist/v011-mapper30/sizes.json`](dist/v011-mapper30/sizes.json)
