# 去辅助层、最终回归与 PPTX 交付

## 进入条件

P5 已通过，全部内容页检查记录和 subagent 交接齐全。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. [最终 QA](../qa-checklist.md) 中与截图视觉审看、可读性、裁切、重叠、图片比例和跨页一致性有关的规则；
   不将 HTML 的 DOM 或 CSS 静态扫描要求应用到 PPTX；
3. `P2/coordinate-map.json`、`P2/page-map.json`、`P3/framework-review.md`、全部
   `P5/page-checks/`、`P1/tasks.md` 与 P1、P2、P3、P5 的 `pptx-stage-gates.md`；
4. HTML 原始截图和输入 deck 的 `assets/deck.js`。

## 执行

1. 在保留框线图时进行全量几何校验，核对页序、尺寸、框线匹配、文字、媒体、背景、Logo 和已知降级项；失败
   时回到所属阶段修复。
2. 移除 PPTX 中仅用于定位的框线辅助层（形状名前缀 guide-frame:，含框线矩形与 id 标签）和整页截图基准层，仅保留实际复原的元素。依据 `coordinate-map.json` 完成
   最终位置、尺寸、层级和样式微调；不得依赖截图掩盖缺失、错位或不可编辑元素。
3. 使用 P1 记录的渲染后端将最终 PPTX 渲染至 `pptx/P6/pptx-renders/`。在 Codex 中，若选择
   `artifact-tool`，使用 Presentations skill 的 `container_tools/render_slides.py` 并指定
   `--width 1600 --height 900`，并以 `python3` 运行；非 Codex 中，使用 LibreOffice 无界面导出 PDF 后再栅格化为 PNG。渲染页数、
   顺序和 PNG 尺寸必须与 HTML 截图一致。
4. 按 `P2/page-map.json` 将 PPTX 渲染图与 HTML 截图生成叠加图和差异图，保存至
   `pptx/P6/comparison/`。大模型必须查看原始成对图片、叠加图和差异图，审查布局、文字、图片、背景、Logo、
   层级和页序；仅比较像素差异不足以判定通过。缺页、页序错误、文字裁切或异常换行、图片变形、背景/Logo 缺失、
   元素出页或错误遮挡均为失败；字体抗锯齿、阴影或渐变等预期微小差异必须记录其原因后才可接受。非 Codex
   环境必须使用 LibreOffice 自动导出渲染图；每次修复后必须重新导出并重跑本步骤，不得复用修复前渲染图。共享
   模板、字体、页序或渲染后端变更时，必须重新渲染并审查全部页面。

## P6 检查与交接

写入 `pptx/P6/conversion-report.md` 和 `pptx/P6/pptx-validation.md`，记录所选渲染后端、版本与渲染命令/
操作、输入、页数、资源与字体状态、元素降级、逐页叠加/差异图、大模型视觉结论、失败修复和最终结论。只有
`P6/<deck-name>.pptx`、渲染图、`P6/comparison/`、两份报告齐全且 P6 在 `P6/pptx-stage-gates.md` 标记为通过后，方可交付。
