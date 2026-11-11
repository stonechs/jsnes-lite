# 构建与验证辅助文件

从仓库根目录进入 `build-support/` 执行命令：

```sh
cd build-support
node --test tests/no-debug.test.mjs tests/base122.test.mjs tests/archive-r14.test.mjs tests/mappers.test.mjs tests/audio.test.mjs
node build-v007.mjs compile v010 r14-nes
node build-v007.mjs pack v010 r14-nes
```

v010 为示例，使用前确认编号未占用。定版目录不可覆盖。
界面源文件从 `../interfaces/` 读取，发布输出写入 `../dist/`。
`../src/` 是本地改进后的核心；`upstream/` 是未经修改的原上游源码快照；`references/` 为固定参考代码及公开测试材料；`tools/` 保留原构建工具。
构建工具版本和精确体积见每版的 sizes.json，最终文件校验见 RELEASED.json。

目录适配修改辅助脚本的核心/界面/输出路径；上游快照和定版发布文件保持不变。
音频测试删去了已在 v007 移除的 dropped 诊断字段与统计回复断言，保留实际缓冲溢出、输出样本及断音验证。
`LOCAL-HISTORY.md` 是本地历史说明原文，其中路径与命令以旧目录布局为准；当前命令见本文。
部分历史浏览器测试使用原机器的 Edge/Playwright 绝对路径，跨机器需要调整。

上游和参考源码采用无 .git 的固定快照，构建报告使用固定的原始提交编号，避免误报当前仓库提交。

## V010 极致运行版

最新运行文件和可读源码见 `../dist/V010_极致运行版/`。仅支持 NES/单文件 LZMA1 或 LZMA2 7z，不支持 ZIP，无 CRC 校验，无 DMC。差异说明见该目录 VERSION_NOTES.md。`build-V010.mjs`、`search-V010.mjs`、`select-V010.mjs` 保留构建流程；定版目录不覆盖，重建请另用新编号。V010 单元测试命令：从仓库根目录运行 `node --test --test-timeout=30000 dist/V010_极致运行版/tests/*.test.mjs`。
