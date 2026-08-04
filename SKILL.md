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

## 共用参考

- 全局约束：[global-constraints.md](references/global-constraints.md)
- 品牌母版映射：[恒达智控](references/hengda-template.md)、[创信数智](references/chuangxin-template.md)、[郑煤机](references/zhengmeiji-template.md)
- 字体与坐标：[typography.md](references/typography.md)
- 最终 QA：[qa-checklist.md](references/qa-checklist.md)
- 问题定位：[issue-catalog.md](references/issue-catalog.md)

当前 PPTX 转换能力处于实现阶段。开始实现或测试转换逻辑时，以“HTML 转 PPTX 工作流”为准；在转换器和
验收命令落地前，不得声称已具备实际转换能力。
