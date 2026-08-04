---
name: ppt-html-generator
description: >
  Create, modify, and validate PPT-compatible 1600×900 HTML slide decks, or convert an
  existing validated HTML deck into PPTX with staged visual verification. Use for ppt-html,
  HTML-to-PPT slide authoring, HTML 转 PPTX, PPTX visual validation, 恒达智控母版,
  创信数智母版, 郑煤机母版, or /ppt-html-generator.
---

# PPT-Compatible HTML 生成与 HTML 转 PPTX

本技能提供两项彼此独立的功能。开始工作前先阅读本文件，再根据任务类型完整阅读对应功能文档；不要把
HTML 生成流程和 PPTX 转换流程混用。

| 功能 | 适用场景 | 操作文档 |
|---|---|---|
| 生成可转 PPT 的 HTML | 新建、修改、检查 1600×900 的品牌 HTML 幻灯片 deck | [HTML 生成工作流](references/html-generation.md) |
| 将既有 HTML 转为 PPTX | 输入已生成并已验收的 HTML deck，产出可交付的 `.pptx` | [HTML 转 PPTX 工作流](references/html-to-pptx.md) |

## 运行时依赖

- 仅生成或检查 HTML：Node.js；涉及截图和坐标提取时，另需 deck 根目录本地安装的 Playwright 与 Chromium。
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

当前已内置转换前的工作区初始化、HTML 基准截图、DOM 坐标提取与框线图工具。它们用于稳定产出 P1/P2 的
输入与证据，尚不包含将 DOM 写成可编辑 PPTX、PPTX 自动渲染或最终视觉比对的转换器；不得声称已具备完整
HTML 转 PPTX 交付能力。
