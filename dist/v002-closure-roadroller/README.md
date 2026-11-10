# v002：Google Closure Compiler + Roadroller

2026-11-10 构建。上游提交仍为 `923d45e04483b7655dbdd91773f74de46c38c661`，未修改 upstream 工作区。

## 使用与交付文件

- `jsnes-lite.min.html`：最小独立运行版，6,420 字节。双击打开后选择本地 `.nes` 文件。
- `jsnes-lite.readable.html`：含注释的可读独立 HTML，页面结构和核心代码直接展开。
- `jsnes-lite.min.js`：6,362 字节的自解压 JavaScript，在已存在 body 的 HTML 中执行会创建界面。
- `jsnes-lite.readable.js`：对应的可读 JavaScript，包含界面初始化和保留注释的核心。
- `jsnes-lite.min.html.gz`：4,975 字节的 gzip 文件，用于传输/存储对比，不能直接当 HTML 打开。
- `sizes.json`：实际字节数、gzip level 9 大小、SHA-256、获选候选和工具版本。
- `source/`：上游原始 JS 的可读快照。

没有嵌入 ROM，也没有 CDN、外部脚本、远程 ROM 或其他运行依赖。
方向键移动；X=A；C=B；Enter=Start；Esc=Select。
保留 v001 的本地文件选择、自动开始、播放/暂停、单帧、重置和 VRAM 查看，以及上游的全部核心。
Mapper 支持仍为上游的 0、2、30，30 不完整。

## 实测大小

| 路径 | 独立 HTML 字节 | gzip 字节 |
|---|---:|---:|
| v001：Terser | 15,501 | 5,784 |
| Closure SIMPLE → Roadroller | 9,812 | 7,491 |
| Closure ADVANCED：构建时展开 CPU → Roadroller | 8,202 | 6,257 |
| Closure ADVANCED：保留动态 CPU → Roadroller | 7,825 | 5,973 |
| Closure ADVANCED：保留动态 CPU，关闭多余 polyfill | 11,154 | 5,234 |
| 上一项 → Roadroller，仅打包 JS | 6,621 | 5,051 |
| 上一项 → Roadroller，界面与 JS 一并打包 | **6,420** | **4,975** |

最终 HTML 比 v001 小 58.6%；gzip 后小约 14.0%。这是本轮实测最小结果，不代表理论极限。
Roadroller 会增加启动时的解压工作，体积更小不代表启动更快。

## 优化方式

Google Closure Compiler **20261108.0.0**（官方 Windows 原生包）；Roadroller **2.1.0**，优化等级 **2**。

上游 CPU 通过 `Function(string)` 生成 opcode 函数。直接做 ADVANCED 会重命名字符串外的变量，
却不能同步修改字符串中的变量名。本轮比较了构建时展开函数和保留动态函数两种办法。
最终保留动态 CPU，通过 externs 保护动态函数实际引用的 24 个符号，允许 Closure 优化其他部分。
隐式全局变量在编译输入中显式声明；DOM 使用 getElementById；键盘事件明确绑定到 window，
并将按事件名称动态索引方法改为显式分支，防止属性重命名破坏键盘。

Closure 给 Array.map 的使用注入了不必要的 Iterator.prototype.map 等兼容代码。
最终设置 `--rewrite_polyfills=false`，保留原项目所需的浏览器原生功能；目标为现代浏览器。
这一步未删除模拟器的硬件功能。编译目标为 ECMASCRIPT_2020。

最后将界面 HTML 的初始化和 Closure 产物一起交给 Roadroller；解码后创建界面并启动原逻辑。
保留 Roadroller 默认作用域隔离（allowFreeVars=false）。

## 复现与后续版本

在项目根目录执行，选一个未使用的版本号，例如 v003：

```powershell
node build-v002.mjs dynamic-native v003
node build-v002.mjs pack v003 advanced-dynamic-native
node build-v002.mjs pack-page v003 advanced-dynamic-native
```

构建工具已在项目 `tools/` 中，不需要 Java 或 npm install。
Roadroller 参数搜索存在随机性，复跑可能得到不同大小。精确复用本次整页打包参数可先设置：

```powershell
$env:JSNES_ROADROLLER_PARAMETERS = 'dist/v002-closure-roadroller/advanced-dynamic-native.page.roadroller.parameters.json'
node build-v002.mjs pack-page v003 advanced-dynamic-native
Remove-Item Env:JSNES_ROADROLLER_PARAMETERS
```

还可用 `compile v003` 生成 SIMPLE 和构建时展开 CPU 的 ADVANCED 比较版本，
用 `dynamic v003` 生成默认 polyfill 的动态 CPU 版。
每种候选的 readable.js/html、min.js/html、Roadroller 产物及参数均保留。
构建脚本遇到 RELEASED.json 会拒绝覆盖，后续请使用新版本号。

工具来源：https://www.npmjs.com/package/google-closure-compiler-windows 、https://github.com/lifthrasiir/roadroller

## 验证范围

`verification-final.json`：在离线 Edge 中通过 file:// 运行仅 JS 打包、整页打包、最终最小 HTML、
最终可读 HTML。每种使用 croom、lj65（Mapper 0）及 H 示例（Mapper 30），
各执行 243 帧，包含 Enter 按下/松开；三个采样画面哈希与 v001 一致。
无页面 JavaScript 错误、无 HTTP/HTTPS 请求、无外部脚本。

`verification-js.json`：另外在空白页面中分别执行独立 min.js 和 readable.js，
验证界面创建、自动开始、暂停、键盘、单帧及重置，比较游戏画面。

验证脚本为根目录的 verify-v002.cjs 和 verify-js.cjs，使用本机 Edge 和已安装的 Playwright。
verify-v002.cjs 可通过 JSNES_OUTPUT_DIR 环境变量指定其他版本目录；baseline-reference.json
保存 v001 基准。trials/ 下是过程中的测试记录，包含高级优化键盘绑定修正前的失败记录；
最终验证以 verification-final.json 和 verification-js.json 为准。

`verification-build.json` 另确认保存的 Roadroller 参数可以逐字节复现最小 HTML，
且 dist 根目录旧文件与 v001 归档逐字节一致。根目录构建和验证脚本的快照在 source/ 下，
文件后缀 .snapshot.txt 表示构建依据快照，不是独立运行入口。

未宣称所有游戏或 Mapper 均兼容，也未逐项验证音频准确性。音频实现沿用上游。
