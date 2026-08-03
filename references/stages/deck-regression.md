# 全 deck 回归与交付门禁

## 进入条件

所有内容页均已通过 G6，且 `stage-gates.md`、`visual-strategy.md`、`image-inventory.md`、所有 `page-checks/` 记录齐全。

## 执行与 G7 检查

创建 `exports/final-regression.md` 并记录：

1. 交接产物齐全且均标记为通过。
2. 在最终 1600×900 截图中检查跨页一致性与节奏：字体 token、标题位置、颜色、同一比较组的卡片基线、Logo、母版 chrome、目录和导航；并对照 `visual-strategy.md` 检查页面类型连续性、卡片/总结条使用比例、主视觉权重、有意留白和整套叙事节奏。此项确认最终组合状态，不重复替代 G6 的单页细节检查。
3. 若 G6 后改动共享 CSS/token/字体/导航/母版资源，必须重跑所有受影响页面 G6；共享 CSS、token、字体、
   导航变更默认影响全 deck。页序、目录或共享导航变更必须回退 G3。
4. 运行 `node scripts/verify-hengda-assets.mjs <deck>/assets/brand --deck <deck>`，确认 7/7 资源、哈希和
   固定背景均通过。
5. 按 `references/qa-checklist.md` 完成整套 deck 剩余静态扫描、DOM 量测、交互测试和截图验收；截图结论
   高于自动检查结论。

## 交付

仅 G7 通过后交付。报告母版映射、画布、页数、目录/导航、G1–G7、资源/字体状态、截图与门禁记录路径。
若仍有阻塞，写明页码、证据和所需决定，不得静默豁免。
