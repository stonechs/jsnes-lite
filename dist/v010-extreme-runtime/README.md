# V010 极致运行版

**9,997 字节，单文件离线 NES 模拟器。支持 7z，不支持 ZIP；没有 CRC 校验；没有 DMC 功能。**

下载 `jsnes-lite.min.html` 后直接用浏览器打开，选择本地 `.nes` 或单文件 `.7z`。7z 支持 LZMA1/LZMA2 及相应压缩文件头；不支持加密、多文件和其他过滤器。原键位、全屏和静音保留。错误提示均为不超过 6 字符的英文短码。

[与 V009 的完整功能差异](VERSION_NOTES.md)。V009 仅支持 `.nes`；V010 新增 7z，改用精简四通道音频，移除 AudioWorklet/DMC、第二手柄和 Mapper 30，并去掉触屏手柄和拖放界面。本版侧重小体积与直接运行。

V010 由 V003_017 正式更名。最小 HTML、压缩/可读 JS、可读 HTML、二进制 payload 和独立解码模块均保持原字节；版本元数据、路径、说明和测试参考路径随名称调整。rename-record.json 保存更名前的运行文件哈希。

## 文件与验证

- `jsnes-lite.min.html`：自包含运行文件，**9,997 字节**，含 UTF-8 BOM。
- `jsnes-lite.readable.html`、`jsnes-lite.readable.js`：可读成品。
- `jsnes-lite.min.js`、`closure.min.js`：独立压缩 JS 检视文件。
- `source/`：运行源码、构建和搜索脚本快照；`tests/`：合成测试数据和单元检查。
- `sizes.json`：精确字节、哈希及工具版本；`RELEASED.json`：整个发布目录的最终清单。

在仓库根目录运行 `node --test --test-timeout=30000 dist/v010-extreme-runtime/tests/*.test.mjs`。测试用历史参考解码器已放入 `tests/references/`，无需下载中间试验版本；它们不编入运行 HTML，其中的 ZIP/CRC 代码只作为参考验证，V010 运行时没有 ZIP/CRC 功能。Mapper 对照仍使用仓库 `build-support/references/jsnes/` 中固定版本。

143 项单元检查通过。另有离线浏览器验证：三个 HTML 成品均实际验证八键按下/释放、组合键、失焦、修饰键和未知键过滤、重载清键及空闲第二端口，使用 $4016/$4017 读取确认；LZMA1/LZMA2 数据与压缩头、三种非默认属性、全屏、静音、四种尺寸和短错误提示通过。中文/长原生异常均显示 Fail。浏览器检查脚本使用本机 Windows Edge/Playwright 路径，在其他机器上需调整。未进行所有商业 ROM 的长期兼容性验证。

## 构建记录

Node v24.22.1；Closure Compiler 20261108.0.0 两遍 ADVANCED；Roadroller 2.1.0，采用保存的搜索参数；Base122 参考 b62945c2733fa4da8792a1071e40a8b326e8dd1b。`build-support/build-V010.mjs` 保存完整流水线，`search-V010.mjs` / `select-V010.mjs` 用于参数搜索与实际文件体积选择。评分适配在 `build-support/packaging/roadroller-standalone.mjs`，上游 checkout 和 vendored 工具不变。

定版目录受 RELEASED.json 保护。需要重建时，使用新的编号目录并调整脚本中的版本/目录常量，不覆盖本发布目录；保存的 `search/winner.json` 可复用参数。核心运行文件在重命名时未重编译。
