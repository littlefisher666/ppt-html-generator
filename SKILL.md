---
name: ppt-html-generator
description: >
  Create, modify, and validate company-brand PPT decks (恒达智控 / 创信数智 / 郑煤机) as
  1600×900 HTML, or convert a validated brand HTML deck into PPTX with staged visual
  verification. Use only for 公司专属 PPT / 品牌母版 / 恒达智控母版 / 创信数智母版 /
  郑煤机母版, or when the user explicitly invokes /ppt-html-generator or $ppt-html-generator.
  Do not use for generic PPT HTML, ordinary slide authoring, or non-branded decks.
---

# PPT-Compatible HTML 生成与 HTML 转 PPTX

本技能提供 HTML 生成与 HTML→PPTX 转换两类能力。PPTX 转换只有**混合版**一条流程：
2× 无字背景位图承载卡片、渐变、图表与装饰，原生文本框承载全部可编辑文字。

| 功能 | 适用场景 | 操作文档 |
|---|---|---|
| 生成可转 PPT 的 HTML | 新建、修改、检查 1600×900 的品牌 HTML 幻灯片 deck | [HTML 生成工作流](references/html-generation.md) |
| HTML 转 PPTX（混合版） | 输入已生成且结构完整的 HTML deck，产出“位图底板 + 可编辑文字”的 `.pptx` | [HTML 转 PPTX 工作流](references/html-to-pptx.md)、[P3 阶段](references/pptx-stages/hybrid.md) |

旧的原生组装流程（原 P3–P5）已移除，不再作为可选方案或回退路径。混合版流程固定为
P1 输入、P2 视觉基准、P3 转换与验收；已有 deck 若保留旧 P3–P5 目录，须先归档，避免与新的 P3 冲突。

## 运行时依赖

- 仅生成或检查 HTML：Node.js；涉及截图和坐标提取时，另需 Playwright 与其专用 Chromium。解析顺序为 deck
  本地 `node_modules/playwright`、deck 所在项目根目录的 `node_modules/playwright`、全局 npm 安装的
  `playwright`；不使用系统 Google Chrome / Edge。
- HTML 转 PPTX（混合版）：除 Node.js、Playwright 外，需要 `python3` 及 `python-pptx`、`lxml`、`Pillow`；
  渲染与基线标定需要 LibreOffice 与 `pdftoppm`。基线标定与背景采集都必须在本机可执行。
- Codex 环境可优先使用 Presentations runtime 的 `render_slides.py`；不可用时按
  [非 Codex PPTX 渲染后端](references/pptx-renderer-backends.md)使用 LibreOffice + PDF 栅格化链路。
  两种后端都不得以 WPS/PowerPoint 人工导出替代 L2 自动验收。

## 共用参考

- 全局约束：[global-constraints.md](references/global-constraints.md)
- 品牌母版映射：[恒达智控](references/hengda-template.md)、[创信数智](references/chuangxin-template.md)、[郑煤机](references/zhengmeiji-template.md)
- 字体与坐标：[typography.md](references/typography.md)
- 最终 QA：[qa-checklist.md](references/qa-checklist.md)
- 问题定位：[issue-catalog.md](references/issue-catalog.md)

## 当前实现

1. **P1/P2 预处理**：`init-pptx-workspace.mjs` 初始化工作区，`capture-html-slides.mjs` 按 `deck.js`
   页序生成 1× HTML 基准截图与 `page-map.json`。
2. **P3 混合版链路**：
   - `capture-hybrid-backgrounds.mjs`：逐文本节点采集文字真值，隐藏可编辑字形后输出 2× JPEG 背景；
     竖排与半透明文字标记 `bitmapOnly` 并保留在位图；
   - `calibrate-hybrid-text.py`：按字号/行高组合实测 LibreOffice 基线；
   - `build-hybrid-deck.mjs`：生成文字计划并调用 `apply-hybrid-text-plan.py` 组装 PPTX（共享写入器
     `pptx-text-writer.py`；精确行距、行内拆框、中西文字距补偿）；
   - `render-pptx-slides.py` + `compare-pptx-html.py`：逐页渲染并与 P2 截图生成 side/overlay/diff。

调用顺序、参数、产物与门禁见 [hybrid.md](references/pptx-stages/hybrid.md)。

## 交付边界

混合版的文字（含标题、正文、表格文字、页脚）是原生可编辑文本框；卡片、色块、图表、图标、照片与
装饰图形是背景位图，不能在 PowerPoint 中单独改形状或改底色。交付前必须向用户说明这一边界，并在
验收记录中登记 `bitmapOnly` 文字与不可编辑的底板元素。

底板位图只能由 `capture-hybrid-backgrounds.mjs` 生成（可编辑文字字形已隐藏）。禁止使用带文字的
整页截图、P2 检查用 1× 截图或任何外部截图作为交付底板。修改文字后不会重排底板，文字变长可能溢出
卡片，需要改回 HTML 重转。

图片清晰度：贴入 PPT 的背景必须高清（2×，≥3200×1800）；仅用于检查/比对的截图可用 1×。详见
[global-constraints.md](references/global-constraints.md) 与 [html-to-pptx.md](references/html-to-pptx.md)。
