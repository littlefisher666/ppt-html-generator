# 将既有 HTML 转为 PPTX

本工作流面向已经生成并通过 HTML 验收的 deck：读取其实际 HTML、共享 CSS、图片和 `assets/deck.js`，转换为
`.pptx`。它不负责重新设计或修复 HTML 内容；输入不合格时，回到 [HTML 生成工作流](html-generation.md) 修复。

## 当前状态

完整 deck 转换器尚未全部落地。当前已实现：

1. P1/P2 预处理：工作区初始化、HTML 截图、坐标提取与框线图脚本；
2. **恒达智控目录页模板转换（P3/P4 的目录子集）**：从 HTML deck 提取 `.layout-agenda` 页的目录数据，使用经哈希复核的恒达
   固定层资产生成统一目录模板与可配置右侧目录项，输出可编辑 PPTX 及结构复核文档。

命令：

```bash
node <skill>/scripts/build-agenda-template.mjs <deck-root>
```

产物位于 `<deck>/exports/pptx/`：`agenda-template.json`、`template-review.md`、`fixed-pages-review.md`、
`<deck-name>-agenda.pptx`。封面、章节、封底、内容页的通用 PPTX 复原，以及 P6 自动渲染/视觉比对主链路仍
待实现。任一未落地门禁不得标记为通过。

## L2 视觉预览校验与执行环境

本工作流要求完成 L2 视觉预览校验：将 PPTX 渲染为逐页 PNG，再由大模型与 HTML 原始截图、叠加图和差异图
逐页比对。**建议优先在 Codex 中执行**，因为 Codex 的 Presentations runtime 已集成 `artifact-tool` 及 PPTX
渲染辅助工具，可直接完成这一循环。

在其他 AI IDE 中，必须依照[非 Codex 渲染后端](pptx-renderer-backends.md)安装 LibreOffice，并使用其无界面导出
PDF、再栅格化为逐页 PNG 的自动化链路。不要依据用户日常使用的 WPS 或 Microsoft PowerPoint 选择渲染方案；
二者不得承担 L2 自动渲染验收。安装或冒烟验证失败时，P1 不通过，不得因渲染不便跳过 L2 或改用人工导出。

若选择 Codex Presentations runtime，P6 的渲染命令由 `python3` 执行 `render_slides.py`；因此完整交付前必须
验证 `python3` 可执行，并通过 Presentations runtime 的初始化流程确认该脚本所需 Python 包与渲染工具可用。
这不是把 Python 作为所有 HTML 工作的前置条件：P1/P2 的内置预处理脚本只需要 Node.js 与本地 Playwright。

## 每次必读

开始或恢复任何 PPTX 转换工作前，必须完整阅读：

1. [全局硬约束](global-constraints.md)；
2. 当前要执行的 PPTX 阶段文档；
3. 已有 `exports/pptx/tasks.md`、`exports/pptx/pptx-stage-gates.md`，以及当前阶段的交接产物（如存在）；
4. 输入 HTML deck 的 `assets/deck.js`、`exports/final-regression.md` 与 `exports/stage-gates.md`；
5. 涉及字体、坐标或最终验收时，分别阅读 [typography.md](typography.md) 与 [qa-checklist.md](qa-checklist.md)。

恢复会话时，以磁盘中的 PPTX 门禁记录、任务清单和交接文件为准，不依赖聊天上下文或执行者记忆。

## 人工阶段确认模式

在执行 P1 前，执行者必须向用户确认：**是否需要在每个阶段完成后人工介入确认**。将用户选择写入
`exports/pptx/pptx-stage-gates.md` 的任务配置；恢复任务时沿用该记录，除非用户明确变更。不得因执行者偏好
默认开启或关闭该模式。

| 用户选择 | 执行方式 |
|---|---|
| 是，逐阶段确认 | 每个 P1–P6 的自动检查和证据产物完成后，先报告本阶段结论，再暂停等待用户明确批准；只有收到批准后，才能将该阶段记为通过并进入下一阶段。 |
| 否，不逐阶段确认 | 每个阶段仍须完成自动门禁、保存证据和失败定位，但可在门禁通过后自动进入下一阶段；最终交付前仍须按 P6 给出完整人工复核材料。 |

逐阶段确认时，阶段报告至少包含：门禁编号与结论、已检查的页面或元素范围、关键证据路径、发现的差异或降级项、
建议的下一步。用户可批准、要求返工，或要求补充检查。用户要求返工或检查失败时，必须在
`pptx-stage-gates.md` 中记录问题归属阶段、原因、修复动作和需重跑的后续门禁；不得进入下一阶段。

确认的目的是尽早定位问题：P1 聚焦输入、资源和运行环境，P2 聚焦 HTML 基准截图与坐标，P3 聚焦共享模板
与目录页模板，P4 聚焦固定版式（目录页仅填充右侧可配置目录项），P5 聚焦逐页内容复原，P6 聚焦最终渲染与
视觉回归。报告必须引用对应阶段的证据，而不是只报告“PPTX 最终效果不符合预期”。

### 启动时只允许的确认

P1 前，默认只询问一次“是否需要每个阶段人工介入确认”。

禁止再额外询问“目标产物偏好”，包括但不限于：

- 视觉一致基线版：整页截图铺进 PPT，观感最接近 HTML，文字不可直接编辑
- 原生文字可编辑版：尽量还原为可编辑文本框，复杂装饰可能降级为图片

转换策略已由本工作流固定，不作为启动确认项。除非用户主动提出要改交付形态，否则不得把上述二选一作为阻塞问题。

默认固定策略：

1. 文字、基础形状和必要表格优先生成可编辑 PPT 元素。
2. 复杂图表、组合装饰和浏览器专属效果可按页或组件降级为足够分辨率的图片，并在报告中记录降级原因。
3. P2 的整页 HTML 截图只作为视觉基准、定位和比对证据，不得把“整页截图铺满即交付”当作默认最终产物。
4. 若用户后续明确要求改成“整页截图基线交付”或其他形态，再按用户指令调整，并写入 `pptx-stage-gates.md` 与
   `conversion-report.md`。

## 输入契约

转换前必须确认以下条件：

1. 输入是一个实际存在的 HTML deck 根目录，包含 `index.html`、`assets/ppt.css`、`assets/deck.js`、
   `assets/slide.js` 和 `slides/`；页面顺序只能读取 `assets/deck.js`。
2. HTML deck 已完成 HTML 生成工作流的 G7，且 `exports/final-regression.md` 与
   `exports/stage-gates.md` 均可证明通过；若是外部已有 deck，至少应提供等价的页面清单、1600×900
   截图和资源可读性验证。
3. 画布必须是 `1600 × 900` px，目标页面为 `13.333″ × 7.5″`，坐标换算固定为
   `1 HTML px = 7620 EMU`。字体换算遵循 [typography.md](typography.md)。
4. 所有资源必须使用 deck 内相对路径，且可读取；不得依赖外部 URL、绝对路径、临时浏览器状态或未登记的
   base64 资源。
5. 转换前读取 [全局硬约束](global-constraints.md)，并保留品牌固定背景、Logo、标题区和内容安全区；
   不得通过转换过程替换品牌素材或重排页面。

## 实现边界

- 转换器读取真实 HTML DOM、计算样式和 `deck.js`，不能另维护页序或内容 manifest。
- 转换策略固定为“可编辑优先、复杂元素可降级”：文字、基础形状和必要表格优先生成可编辑 PPT 元素；复杂图表、
  组合装饰和浏览器专属效果可按页或组件渲染为足够分辨率的图片嵌入，并在转换报告中记录元素标识、页码、
  降级原因和可编辑性影响。不得在启动时让用户在“整页截图基线版 / 原生可编辑版”之间二选一。
- 无法以原生元素或显式降级保持视觉一致的 CSS/元素、字体缺失且无已接受替代方案、资源读取失败、溢出、
  截图与 PPTX 明显不一致均为转换失败，必须明确报告；不得静默忽略元素或以空白替代。
- 转换产物与 HTML 源码分开保存，禁止覆盖 HTML 页面、资源、门禁记录或检查点。
- 转换功能不得改变 HTML deck 的 G1–G7 状态；PPTX 验收拥有独立记录。

## 图片清晰度策略

转换过程中的图片按用途区分清晰度，不得混用：

| 用途 | 清晰度要求 | 默认参数 | 典型产物 |
|---|---|---|---|
| 贴入 PPT 的交付图 | **高清**，保证投影/编辑仍锐利 | 全页逻辑 1600×900 时像素 ≥ 3200×1800（`deviceScaleFactor = 2`） | 目录固定底图、复杂组件降级图、需嵌入的品牌/内容图 |
| 仅用于检查/比对的截图 | 可较低，能辨认文字与布局即可 | `deviceScaleFactor = 1`（1600×900） | `html-screenshots/`、框线辅助、差异审阅底图 |

规则：

1. 凡最终写入 `.pptx` 的位图，必须按交付高清标准生成或选用源图；禁止把检查用 1× 截图直接贴进 PPT。
2. P2 的 HTML 基准截图默认保持 1×，用于定位与 L2 比对，不承担交付贴图职责。
3. 高清交付图与检查截图分路径保存；目录固定底图默认写在 `exports/pptx/template-assets/`。

## 目录页模板契约

当前内置目录模板**仅支持恒达智控母版**：运行时会校验 `assets/brand/logo-color.png` 的 SHA-256 与
`assets/shared/agenda-template/manifest.json`；不匹配时必须失败，不能套用到创信数智、郑煤机或自定义母版。

目录页（含目录续页）必须先生成并复用统一的 PPT 目录模板，再按页填充右侧目录项。禁止把每张目录页
当成彼此独立的整页重绘：固定页面元素从模板继承，页面之间只允许目录项数据与尺寸参数不同。

### 必须生成的模板

1. 在共享模板阶段（P3）对通过品牌与资产校验、且 P2 `coordinate-map.json` 已验证 Logo 与 `.agenda-list` 几何的恒达
   `.layout-agenda` 生成可复用目录版式模板；同一 deck 的全部目录页与目录续页共用该模板。
2. 模板固定元素的几何、层级、颜色、字体与 HTML 母版一致；不得在逐页复原时重新估算或“近似还原”
   这些固定元素。
3. 模板产物与引用关系写入 `template-review.md`：模板标识、来源 HTML 页、固定元素清单、适用页范围、
   右侧可配置槽位说明。

### 模板固定元素（不可按页改动）

以下固定元素必须合成**一张高清底图**贴入 PPT（逻辑尺寸 1600×900，像素默认 3200×1800，`scale=2`），所有
目录页/续页复用同一底图，不得按页用文本框或矢量重绘这些元素：

| 固定元素 | 来源 | 约束 |
|---|---|---|
| 版式背景 | 技能内置 `assets/shared/agenda-template/agenda-fixed-base-no-logo.png` | 无 Logo 高清底图；浅蓝 → 白色纵向渐变 |
| 彩色 Logo | deck 的 `.brand-logo--color` / `assets/brand/logo-color.png` | 作为独立品牌资源放置；位置与比例与母版一致 |
| 左侧 CONTENTS | 内置无 Logo 高清底图 | 竖排与母版一致 |
| “目录”标题 | 内置无 Logo 高清底图 | “目 / 录”共容器 |
| 中部圆形箭头 | 内置无 Logo 高清底图 | 圆心与标题中心共轴 |
| 右侧列表容器原点 | 已验证的恒达目录模板几何 | 不在底图内；作为可配置槽位的布局锚点 |

默认隐藏的母版备选背景（如焊接图、隐藏渐变层）保持隐藏；只有用户明确要求启用时才显示，且仍须通过
模板统一控制，不得在单页私自打开。

转换器将技能内置的无 Logo 高清底图复制为
`exports/pptx/template-assets/agenda-fixed-base.png`，并从目标 deck 的品牌资源单独放置右上角 Logo；
不得为固定元素启动浏览器重复截图。

### 唯一可配置区：右侧目录项

目录模板只开放右侧目录项为可配置槽位。配置来源只能是 `assets/deck.js` 与实际 HTML 目录页，不得手写
另一套目录清单。

| 可配置项 | 规则 |
|---|---|
| 目录项数量 | 单页 1–12 项；超过 12 项必须使用目录续页并按页均分，不得截断或隐藏 |
| 目录项内容 | 仅编号与主标题；不新增副标题、图标、卡片变体或其他组件 |
| 目录项尺寸与间距 | 1–6 项使用母版基准尺寸；7–12 项按数量等比压缩高度、编号块、圆角与行距 |
| 列表整体位置 | 条目作为整体相对左侧“目录”中心线垂直居中；数量变化时只调整列表 top，不改固定元素 |
| 续页分配 | 页数为 `ceil(N / 12)`，余数优先从前页分配；每页仍共用同一目录模板 |

右侧目录项采用 **独立高清长条背景 + 独立高清编号方块 + 可编辑编号/标题**：

1. 长条背景与编号方块按 `itemHeight` 预置于
   `assets/shared/agenda-template/agenda-item-bar-*.png` 与 `agenda-item-number-*.png`，转换器复制为
   `exports/pptx/template-assets/` 下的同名文件；不得为这些固定组件启动浏览器重复截图。
2. PPT 中每条目录项先贴对应档位的长条背景，再按独立边界贴编号方块，最后叠可编辑编号文本与标题文本；不得用原生渐变/主题色
   形状重绘条背景或编号方块，也不得把两张图合并后按条目整体非等比缩放。
3. 编号：白字、常规字重，字号 1–6 项 28pt、7–12 项 20pt，落在编号块几何内居中。
4. 标题：`#111111`、18pt、微软雅黑、常规字重、垂直居中；从编号块右侧 + textGap 起排。
5. 7–12 项压缩时必须截取/复用对应 `itemHeight` 档位的长条背景与编号方块；禁止把基准组件简单非等比拉伸凑合。编号方块的投放宽高必须相等。

P4 复原固定版式页时，目录页只允许改写上述可配置槽位；若发现固定元素在页间不一致，判为模板复原失败，
回到 P3 修复目录模板后重跑受影响门禁。

## 建议产物与验收门禁

转换器实现后，默认在 `<deck>/exports/pptx/` 生成以下产物：

| 产物 | 用途 |
|---|---|
| `<deck-name>.pptx` | 最终 PowerPoint 文件 |
| `tasks.md` | PPTX 转换任务清单与返工记录 |
| `pptx-stage-gates.md` | 人工阶段确认模式、P1–P6 门禁状态、证据路径、用户确认记录和返工说明 |
| `coordinate-map.json` | HTML 元素边界、层级及坐标换算记录 |
| `page-map.json` | `deck.js` 页序、HTML 文件、HTML 截图、PPTX 页号与 PPTX 渲染图的唯一映射 |
| `conversion-report.md` | 输入、命令、页数、元素降级、字体/资源状态和失败项 |
| `template-review.md` 中的目录模板记录 | 目录版式模板标识、固定元素校验、右侧目录项配置与续页分配 |
| `pptx-renders/` | 由已选渲染器生成的 PPTX 每页 PNG |
| `comparison/` | HTML/PPTX 的逐页叠加图、差异图及视觉审查记录 |
| `pptx-validation.md` | 页序、尺寸、资源、视觉比对与人工复核结论 |

转换完成前至少验证：

1. PPTX 页面数量、顺序、标题和文件映射与 `assets/deck.js` 一致。
2. 页面尺寸为 `13.333″ × 7.5″`，且页面元素坐标与 HTML 1600×900 画布的换算一致。
3. 所有图片、固定背景和 Logo 均存在、比例正确、未拉伸或裁切；字体可用或已明确记录替代方案。
4. 对 HTML 原始截图与已选渲染器生成的 PPTX 渲染图逐页进行视觉比对，重点检查文字换行、裁切、重叠、颜色、
   层级和图片比例。
5. 发现不一致时，修复转换逻辑或回退修复 HTML，再重新转换和验收；未通过不得交付 PPTX。
6. 全部目录页与目录续页共用同一目录模板；固定元素跨页一致，仅右侧目录项数量、内容与压缩尺寸可不同，
   且列表整体垂直居中与 1–12 项压缩规则与 HTML 一致。

## 阶段路由与门禁

严格按下表顺序执行 P1–P6。每个阶段通过后才能进入下一阶段；失败必须回到问题所属阶段修复，并重跑所有
受影响门禁。PPTX 门禁独立于 HTML 的 G1–G7，不得覆盖或改写 HTML 门禁记录。

| 门禁 | 阶段 | 必读文档 | 必填交接/证据 |
|---|---|---|---|
| P1 | 输入与转换基础条件 | [pptx-stages/foundation.md](pptx-stages/foundation.md) | `exports/pptx/tasks.md`、`input-review.md`、`runtime-dependency-review.md`、`render-backend-plan.md`、`pptx-stage-gates.md` |
| P2 | 视觉基准与定位模型 | [pptx-stages/visual-baseline.md](pptx-stages/visual-baseline.md) | `html-screenshots/`、`guide-frames/`、`coordinate-map.json`、`page-map.json`、`baseline-review.md` |
| P3 | 共享模板复原（含目录页模板） | [pptx-stages/shared-template.md](pptx-stages/shared-template.md) | `template-review.md`（含目录模板固定元素与可配置槽位） |
| P4 | 固定版式页面复原 | [pptx-stages/fixed-pages.md](pptx-stages/fixed-pages.md) | `fixed-pages-review.md`（目录页仅校验右侧目录项配置） |
| P5 | 内容页并行复原与逐页检查 | [pptx-stages/content-pages.md](pptx-stages/content-pages.md) | `page-checks/`、`subagent-handoffs/` |
| P6 | 去辅助层、最终回归与 PPTX 交付 | [pptx-stages/finalization.md](pptx-stages/finalization.md) | `<deck-name>.pptx`、`pptx-renders/`、`comparison/`、`conversion-report.md`、`pptx-validation.md` |

每个转换任务必须维护 `exports/pptx/pptx-stage-gates.md`，先记录是否启用逐阶段人工确认，再记录每个门禁的
编号、检查项、通过/失败、证据路径或命令输出，以及失败后的修复说明。启用逐阶段人工确认时，还必须记录用户的
批准、返工或补充检查结论；没有明确批准的阶段不得标记为通过。记录缺失或缺项，视为阶段未完成。

目录页模板链路已可输出 `.pptx`；完整 deck 的封面/内容页/最终回归链路未完成前，不得把整个 deck 宣称为
“已完成 HTML 转 PPTX 交付”。

## 已内置的通用预处理命令

以下命令位于本技能的 `scripts/`，应直接调用，禁止在任务目录临时重写同类脚本。三个命令均只读取输入
deck，并只在 `<deck>/exports/pptx/` 写入独立转换产物，不改动 HTML 源码。

```bash
node <skill>/scripts/init-pptx-workspace.mjs <deck-root>
node <skill>/scripts/capture-html-slides.mjs <deck-root>
node <skill>/scripts/extract-html-coordinate-map.mjs <deck-root>
node <skill>/scripts/build-agenda-template.mjs <deck-root>
```

`build-agenda-template.mjs` 仅用于经验证的恒达智控目录母版：读取 deck 内全部 `.layout-agenda` 页的编号与标题，校验
Logo、`assets/shared/agenda-template/manifest.json`，并要求 P2 `coordinate-map.json` 中的 Logo 与 `.agenda-list` 几何匹配
已验证母版，再复制无 Logo 固定高清底图及独立条目组件，调用 `build-agenda-pptx.py` 写出 PPTX。它不从任意 HTML 推断
固定元素几何；不匹配的品牌或母版必须失败。需要系统可用的 `python3` 与 `python-pptx`。

截图与坐标脚本通过 `resolvePlaywright()` 按固定顺序解析 Playwright：

1. deck 本地：`<deck-root>/node_modules/playwright`；
2. 全局 npm：`npm root -g` 下的 `playwright`。

找到包后，还必须确认该版本对应的 Playwright Chromium 可执行文件已存在；只有“包和浏览器都可用”才算就绪。
两处都没有可用包时才安装 npm 包；包存在但浏览器缺失时只补装 Chromium。不得因为本机安装了 Google Chrome /
Edge 就跳过 Playwright Chromium，也不得在已有匹配 revision 缓存时强制重复下载。

截图脚本固定以本地 HTTP 服务、`deck.js` 页序、1600×900、`deviceScaleFactor: 1`、`prefers-reduced-motion:
reduce` 运行，并生成 `page-map.json`。坐标脚本从同一渲染条件提取可见 DOM 元素及计算样式，生成
`coordinate-map.json` 与逐页 SVG 框线图。它们是通用基线工具，不负责决定哪些复杂元素应转为可编辑 PPT 元素或
降级为图片。
