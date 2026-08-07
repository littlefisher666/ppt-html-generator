# 共享模板复原

## 进入条件

P2 已通过，框线图和坐标清单已就绪。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. [全局硬约束](../global-constraints.md)；
3. `pptx/P2/coordinate-map.json`、`P2/baseline-review.md`、`P1/tasks.md`、`P2/pptx-stage-gates.md`；
4. 所选公司母版映射和品牌资源。

## 执行

复原背景、Logo、标题区、横线及其他跨页共享模板元素。元素应来自输入 deck 的真实资源和坐标清单，不得重绘
或替换品牌素材。逐项将 PPTX 元素的可见边界、比例、层级与框线图对比；不支持的样式必须记录为显式降级。

对已通过恒达智控 Logo 哈希校验、且 P2 坐标清单验证了 Logo 与 `.agenda-list` 几何的 deck，先运行 `node <skill>/scripts/build-agenda-template.mjs <deck-root>` 生成目录页专用版式模板，再运行 `node <skill>/scripts/build-shared-template.mjs <deck-root>` 生成封面、章节、内容页 chrome、封底四类共享模板。共享模板构建器必须读取真实 HTML、`deck.js` 与 P2 `coordinate-map.json`，复原品牌背景、Logo、渐变遮罩、横线与固定安全区；随后由 P3 页面框架装配器填充全部页面标题与固定页私有内容，P5 仅填充内容页业务区。

目录页仍遵守 [目录页模板契约](../html-to-pptx.md#目录页模板契约)：

1. 从全部 `.layout-agenda` 页读取目录数据，使用经 manifest 哈希验证的恒达固定资产生成可复用目录模板；全部目录页与目录续页共用该模板。
2. 版式渐变背景、左侧 `CONTENTS`、竖排“目录”标题和中部圆形箭头使用无 Logo **高清底图**（默认 scale=2，3200×1800）；
   彩色 Logo 从 deck 品牌资源独立放置，右侧列表容器仍作为可配置槽位锚点。
3. 右侧目录项的长条背景和编号方块使用内置的高清分档资产，并在 PPT 中独立放置；模板只把
   编号/标题文本与条目数量留作可配置，不要在模板中固化具体条目文本。编号方块必须按自身方形边界缩放。
4. 默认隐藏的母版备选背景保持隐藏，除非用户明确要求启用，且仍通过模板统一控制。

## 本子阶段检查与交接

写入 `pptx/P3/template-review.md` 与 `P3/shared-template-review.md`，记录每个共享元素的来源、页面范围、目标/实际边界、比例、层级、框线校验结果和降级项。对目录模板另记：模板标识、来源 HTML 页、固定元素清单、适用页范围、右侧可配置槽位说明。
共享母版与目录模板只是 P3 前置产物，不能单独把 P3 标为通过。完整页面框架装配见 page-framework.md，主命令：node SKILL_DIR/scripts/build-framework-deck.mjs DECK_ROOT
