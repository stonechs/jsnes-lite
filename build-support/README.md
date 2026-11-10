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
`src/` 是本地改进后的核心；`upstream/` 是未经修改的原上游源码快照；`references/` 为固定参考代码及公开测试材料；`tools/` 保留原构建工具。
构建工具版本和精确体积见每版的 sizes.json，最终文件校验见 RELEASED.json。

本次目录适配仅修改辅助脚本的界面/输出路径；没有修改原仓库文件、上游快照或定版发布文件。
音频测试删去了已在 v007 移除的 dropped 诊断字段与统计回复断言，保留实际缓冲溢出、输出样本及断音验证。
`LOCAL-HISTORY.md` 是本地历史说明原文，其中路径与命令以旧目录布局为准；当前命令见本文。
部分历史浏览器测试使用原机器的 Edge/Playwright 绝对路径，跨机器需要调整。
