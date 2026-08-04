# 生成可转 PPT 的 HTML

本工作流用于生成、修改和验收可转换为 PowerPoint 的 1600×900 HTML 幻灯片 deck。它只负责 HTML
产物，不负责生成 `.pptx`；需要转换已完成 HTML 时，转入 [HTML 转 PPTX 工作流](html-to-pptx.md)。

## 每次必读

开始任何 HTML deck 工作前，必须完整阅读：

1. [全局硬约束](global-constraints.md)；
2. [任务清单管理](stages/task-management.md)；
3. [演示叙事与视觉方向](visual-direction.md)；
4. 当前要执行的阶段文档；
5. 若创建或恢复检查点，[检查点与恢复](stages/checkpoint-recovery.md)；
6. 已有 deck 的 `tasks.md`、`exports/stage-gates.md`，以及当前阶段的交接产物（如存在）。

不得因只读阶段文档而跳过全局硬约束。恢复会话时，以磁盘中的门禁记录和交接文件为准，不依赖聊天上下文
或执行者记忆。

## 可恢复任务清单

`tasks.md` 的创建、动态拆分、勾选、返工与恢复规则，均在
[任务清单管理](stages/task-management.md) 中执行。它贯穿 G1–G7，不替代阶段门禁，也不作为可跳过的独立
门禁。

| 环节 | 执行时机 | 必读文档 | 产物 |
|---|---|---|---|
| T0 任务清单管理 | G1 前创建；每阶段前、完成/失败/返工时更新 | [stages/task-management.md](stages/task-management.md) | `<deck>/tasks.md` |

## 阶段路由与门禁

严格按下表顺序执行。每阶段通过后才能进入下一阶段；失败必须回到问题所属阶段修复，并重跑后续受影响门禁。
阶段编号只用于流程与记录，阶段文档文件名不绑定编号。

| 门禁 | 阶段 | 必读文档 | 必填交接/证据 |
|---|---|---|---|
| G1 | 基础条件 | [stages/foundation.md](stages/foundation.md) | `exports/stage-gates.md` |
| G2 | 母版与资源 | [stages/brand-assets.md](stages/brand-assets.md) | 资源校验输出 |
| G3 | 全 deck 骨架、目录与导航 | [stages/deck-skeleton.md](stages/deck-skeleton.md) | `exports/deck-skeleton-review.md`、`exports/visual-strategy.md` |
| G4 | 内容页计划与图片清单 | [stages/content-inventory.md](stages/content-inventory.md) | `exports/image-inventory.md` |
| G5 | 媒体框预留 | [stages/media-frame-layout.md](stages/media-frame-layout.md) | `exports/media-frame-review.md` |
| G6 | 内容页实现与逐页检查 | [stages/content-page-check.md](stages/content-page-check.md) | `exports/page-checks/` |
| G7 | 全 deck 回归与 HTML 交付 | [stages/deck-regression.md](stages/deck-regression.md) | `exports/final-regression.md` |

每个 deck 必须维护 `exports/stage-gates.md`，记录阶段编号、检查项、通过/失败、证据路径或命令输出，以及
失败后的修复说明。记录缺失或缺项，视为未完成。

## 检查点与文件级恢复

门禁记录只证明曾经检查过，不能恢复被后续阶段覆盖的源码。每个 deck 必须依照
[检查点与恢复](stages/checkpoint-recovery.md) 在 G5 通过后创建完整 deck 检查点，并在每页 G6 通过后创建
页面检查点。恢复时只能使用已哈希复核的检查点；必须归档恢复前状态、使后续受影响任务和门禁失效，并从
指定阶段重新检查。不得用 Git 工作区状态或聊天记录代替检查点。

## 共享参考与脚手架

- 公司母版映射：恒达智控 [hengda-template.md](hengda-template.md)、创信数智
  [chuangxin-template.md](chuangxin-template.md)、郑煤机 [zhengmeiji-template.md](zhengmeiji-template.md)。
- 静态基础模板位于 `templates/`；新 deck 必须用 `scripts/init-deck-scaffold.mjs` 复制后复用，禁止每次重新生成
  基础 CSS、导航、目录与页面 shell。仅页面数据、正文、媒体和确有必要的新页面类型可按任务生成。
- 字体与坐标换算：[typography.md](typography.md)。
- 最终 QA 细节：[qa-checklist.md](qa-checklist.md)。
- 问题定位：[issue-catalog.md](issue-catalog.md)。

不得把 QA 留给用户，也不得在 G7 未通过时宣布 HTML deck 完成。
