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

本技能提供两项彼此独立的功能。开始工作前先阅读本文件，再根据任务类型完整阅读对应功能文档；不要把
HTML 生成流程和 PPTX 转换流程混用。

| 功能 | 适用场景 | 操作文档 |
|---|---|---|
| 生成可转 PPT 的 HTML | 新建、修改、检查 1600×900 的品牌 HTML 幻灯片 deck | [HTML 生成工作流](references/html-generation.md) |
| 将既有 HTML 转为 PPTX | 输入已生成且结构完整的 HTML deck，产出可交付的 `.pptx` | [HTML 转 PPTX 工作流](references/html-to-pptx.md) |

## 运行时依赖

- 仅生成或检查 HTML：Node.js；涉及截图和坐标提取时，另需 Playwright 与其专用 Chromium。解析顺序为 deck
  本地 `node_modules/playwright`、deck 所在项目根目录的 `node_modules/playwright`、全局 npm 安装的
  `playwright`；不使用系统 Google Chrome / Edge。
- 完整 HTML 转 PPTX 的 Codex 验收路径：除上述依赖外，需要可执行的 `python3`，用于运行 Presentations runtime
  提供的 `container_tools/render_slides.py`。该脚本依赖 Presentations runtime 已配置的 Python 包和渲染工具，
  不应在本技能目录内临时 `pip install` 或复制脚本。
- 非 Codex 环境：不调用 `render_slides.py`；按 [非 Codex PPTX 渲染后端](references/pptx-renderer-backends.md)
  准备 LibreOffice、PDF 栅格化工具及其运行依赖。

## 共用参考

- 全局约束：[global-constraints.md](references/global-constraints.md)
- 品牌母版映射：[恒达智控](references/hengda-template.md)、[创信数智](references/chuangxin-template.md)、[郑煤机](references/zhengmeiji-template.md)
- 字体与坐标：[typography.md](references/typography.md)
- 最终 QA：[qa-checklist.md](references/qa-checklist.md)
- 问题定位：[issue-catalog.md](references/issue-catalog.md)

当前已内置转换前的工作区初始化、HTML 基准截图、DOM 坐标提取与框线图工具，以及 P3 的模板与框架装配链路：

- **共享母版转换**（`scripts/build-shared-template.mjs`）：从真实 deck 与 P2 坐标清单生成封面、章节、内容页 chrome、封底四类共享模板。品牌背景、Logo、渐变遮罩、内容页三段横线与安全区锚点版式几何三品牌统一，按 deck 品牌 Logo/背景生成，供 P3 全页框架装配调用。
- **目录页模板转换**（`scripts/build-agenda-template.mjs`）：生成统一目录模板定义与资产；目录页固定底图与条目组件为三品牌共用内置高清资产，长条与编号方块独立放置；**不单独输出目录 PPTX**，由 framework-deck 统一装配。

- **完整页面框架装配**（scripts/build-framework-deck.mjs）：按 deck.js 页序生成 P3/framework-deck.pptx，写入固定页可编辑内容、内容页 chrome + 标题区 + 空白业务安全区，并叠加全部页面的 P2 框线辅助层（guide-frame:*）。

P3 视觉渲染比对、P4 内容页业务区复原、最终自动视觉比对与全 deck 交付主链路仍待完成。后续必须以 P2 元素坐标和 P3 原生框架组装 PPTX；禁止以整页 HTML 截图或隐藏文字后的整页截图作为最终页面背景。不得把模板/框架已生成表述为完整 deck HTML 转 PPTX 交付能力。

图片清晰度：贴入 PPT 的位图必须高清（默认 ≥2×）；仅用于检查/比对的截图可用 1×，能辨认即可。详见
[global-constraints.md](references/global-constraints.md) 与 [html-to-pptx.md](references/html-to-pptx.md)。
