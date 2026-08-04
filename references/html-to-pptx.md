# 将既有 HTML 转为 PPTX

本工作流面向已经生成并通过 HTML 验收的 deck：读取其实际 HTML、共享 CSS、图片和 `assets/deck.js`，转换为
`.pptx`。它不负责重新设计或修复 HTML 内容；输入不合格时，回到 [HTML 生成工作流](html-generation.md) 修复。

## 当前状态

转换器尚未实现。本文件定义后续实现的范围、输入契约和验收门槛，避免在实现前把“可转 PPT”误表述为
"已经可以生成 PPTX"。技能已内置 P1/P2 的工作区初始化、HTML 截图、坐标提取与框线图脚本；PPTX 生成、
渲染及最终视觉比对逻辑仍待实现。任一必需脚本或命令尚未落地并实际验证时，对应门禁不得标记为通过。HTML
截图、PPTX 渲染与视觉比对使用的运行时工具和交接产物以各阶段文档为准。

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
- 文字、基础形状和必要表格优先生成可编辑 PPT 元素；复杂图表、组合装饰和浏览器专属效果可按页或组件
  渲染为足够分辨率的图片嵌入，并在转换报告中记录元素标识、页码、降级原因和可编辑性影响。
- 无法以原生元素或显式降级保持视觉一致的 CSS/元素、字体缺失且无已接受替代方案、资源读取失败、溢出、
  截图与 PPTX 明显不一致均为转换失败，必须明确报告；不得静默忽略元素或以空白替代。
- 转换产物与 HTML 源码分开保存，禁止覆盖 HTML 页面、资源、门禁记录或检查点。
- 转换功能不得改变 HTML deck 的 G1–G7 状态；PPTX 验收拥有独立记录。

## 建议产物与验收门禁

转换器实现后，默认在 `<deck>/exports/pptx/` 生成以下产物：

| 产物 | 用途 |
|---|---|
| `<deck-name>.pptx` | 最终 PowerPoint 文件 |
| `tasks.md` | PPTX 转换任务清单与返工记录 |
| `pptx-stage-gates.md` | P1–P6 门禁状态、证据路径和返工说明 |
| `coordinate-map.json` | HTML 元素边界、层级及坐标换算记录 |
| `page-map.json` | `deck.js` 页序、HTML 文件、HTML 截图、PPTX 页号与 PPTX 渲染图的唯一映射 |
| `conversion-report.md` | 输入、命令、页数、元素降级、字体/资源状态和失败项 |
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

## 阶段路由与门禁

严格按下表顺序执行 P1–P6。每个阶段通过后才能进入下一阶段；失败必须回到问题所属阶段修复，并重跑所有
受影响门禁。PPTX 门禁独立于 HTML 的 G1–G7，不得覆盖或改写 HTML 门禁记录。

| 门禁 | 阶段 | 必读文档 | 必填交接/证据 |
|---|---|---|---|
| P1 | 输入与转换基础条件 | [pptx-stages/foundation.md](pptx-stages/foundation.md) | `exports/pptx/tasks.md`、`input-review.md`、`runtime-dependency-review.md`、`render-backend-plan.md`、`pptx-stage-gates.md` |
| P2 | 视觉基准与定位模型 | [pptx-stages/visual-baseline.md](pptx-stages/visual-baseline.md) | `html-screenshots/`、`guide-frames/`、`coordinate-map.json`、`page-map.json`、`baseline-review.md` |
| P3 | 共享模板复原 | [pptx-stages/shared-template.md](pptx-stages/shared-template.md) | `template-review.md` |
| P4 | 固定版式页面复原 | [pptx-stages/fixed-pages.md](pptx-stages/fixed-pages.md) | `fixed-pages-review.md` |
| P5 | 内容页并行复原与逐页检查 | [pptx-stages/content-pages.md](pptx-stages/content-pages.md) | `page-checks/`、`subagent-handoffs/` |
| P6 | 去辅助层、最终回归与 PPTX 交付 | [pptx-stages/finalization.md](pptx-stages/finalization.md) | `<deck-name>.pptx`、`pptx-renders/`、`comparison/`、`conversion-report.md`、`pptx-validation.md` |

每个转换任务必须维护 `exports/pptx/pptx-stage-gates.md`，记录门禁编号、检查项、通过/失败、证据路径或命令
输出，以及失败后的修复说明。记录缺失或缺项，视为阶段未完成。

在上述命令和验收实现前，本技能只能生成“可作为转换输入的 HTML”，不能承诺输出 `.pptx`。

## 已内置的通用预处理命令

以下命令位于本技能的 `scripts/`，应直接调用，禁止在任务目录临时重写同类脚本。三个命令均只读取输入
deck，并只在 `<deck>/exports/pptx/` 写入独立转换产物，不改动 HTML 源码。

```bash
node <skill>/scripts/init-pptx-workspace.mjs <deck-root>
node <skill>/scripts/capture-html-slides.mjs <deck-root>
node <skill>/scripts/extract-html-coordinate-map.mjs <deck-root>
```

截图与坐标脚本固定从 `<deck-root>/node_modules/playwright` 加载项目本地 Playwright，并使用其 Chromium；缺失
时先按 P1 安装并验证，不能回退到全局浏览器。截图脚本固定以本地 HTTP 服务、`deck.js` 页序、1600×900、
`deviceScaleFactor: 1`、`prefers-reduced-motion: reduce` 运行，并生成 `page-map.json`。坐标脚本从同一渲染
条件提取可见 DOM 元素及计算样式，生成 `coordinate-map.json` 与逐页 SVG 框线图。它们是通用基线工具，不负责
决定哪些复杂元素应转为可编辑 PPT 元素或降级为图片。
