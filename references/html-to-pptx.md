# 将既有 HTML 转为 PPTX

本工作流面向已经生成且结构完整的 deck：读取其实际 HTML、共享 CSS、图片和 `assets/deck.js`，转换为
`.pptx`。它不负责重新设计或修复 HTML 内容；输入不合格时，回到 [HTML 生成工作流](html-generation.md) 修复。

转换只有**混合版**一条流程：每页用“可编辑文字字形已隐藏”的 2× 背景位图承载卡片、渐变、图表与装饰，
再按 HTML 实测几何叠加原生文本框。旧的原生组装流程（原 P3–P5）已移除，不再作为可选方案或回退路径。

## 当前状态

当前可用链路：

1. P1/P2 预处理：工作区初始化、HTML 基准截图、`page-map.json`；
2. **P3 混合版转换**：`capture-hybrid-backgrounds.mjs`（文字真值 + 无字背景）→
   `calibrate-hybrid-text.py`（基线标定）→ `build-hybrid-deck.mjs`（文字计划 + PPTX 组装）→
   `render-pptx-slides.py` + `compare-pptx-html.py`（渲染与逐页比对）。

混合版使用 `P3` 作为阶段目录；不再使用 P4/P5。已有 deck 若保留旧的 P3–P5 原生流程产物，先归档再运行，
避免旧 P3 框架文件与新 P3 混合版产物混在一起。

## 标准命令

```bash
DECK=<deck-root>
S=<skill>/scripts

# P1 初始化
node "$S/init-pptx-workspace.mjs" "$DECK"

# P2 基准截图与页面映射
node "$S/capture-html-slides.mjs" "$DECK"

# P3 采集文字真值 + 无字 2× 背景
node "$S/capture-hybrid-backgrounds.mjs" "$DECK"

# P3 基线标定
python3 "$S/calibrate-hybrid-text.py" \
  "$DECK/pptx/P3/text-nodes.json" "$DECK/pptx/P3/calibration.json"

# P3 文字计划 + 组装 PPTX
node "$S/build-hybrid-deck.mjs" "$DECK"

# P3 渲染逐页 PNG
python3 "$S/render-pptx-slides.py" "$DECK" \
  "$DECK/pptx/P3/<deck-title>（混合版）.pptx" "$DECK/pptx/P3/pptx-renders"

# P3 与 P2 截图逐页比对
cd "$DECK" && python3 "$S/compare-pptx-html.py" . \
  pptx/P3/pptx-renders pptx/P3/comparison
```

顺序不可交换：采集产物是标定输入，标定结果是组装的硬依赖；缺少 `calibration.json` 时组装必须失败。
输出文件名取 `assets/deck.js` 的 `title`，无需手改。

## L2 视觉预览校验与执行环境

本工作流要求完成 L2 视觉预览校验：将 PPTX 渲染为逐页 PNG，再与 HTML 原始截图、叠加图和差异图
逐页比对。**建议优先在 Codex 中执行**，因为 Codex 的 Presentations runtime 已集成 `artifact-tool` 及 PPTX
渲染辅助工具，可直接完成这一循环。

在其他 AI IDE 中，必须依照[非 Codex 渲染后端](pptx-renderer-backends.md)安装 LibreOffice，并使用其无界面导出
PDF、再栅格化为逐页 PNG 的自动化链路。不要依据用户日常使用的 WPS 或 Microsoft PowerPoint 选择渲染方案；
二者不得承担 L2 自动渲染验收。安装或冒烟验证失败时，P1 不通过，不得因渲染不便跳过 L2 或改用人工导出。

若选择 Codex Presentations runtime，渲染命令由 `python3` 执行 `render_slides.py`；因此完整交付前必须
验证 `python3` 可执行，并通过 Presentations runtime 的初始化流程确认该脚本所需 Python 包与渲染工具可用。
这不是把 Python 作为所有 HTML 工作的前置条件：P1/P2 的内置预处理脚本只需要 Node.js 与本地 Playwright。

## 每次必读

开始或恢复任何 PPTX 转换工作前，必须完整阅读：

1. [全局硬约束](global-constraints.md)；
2. 当前要执行的阶段文档；
3. 已有阶段目录中的任务清单、门禁记录与交接产物（如存在）；
4. 输入 HTML deck 的 `assets/deck.js`；
5. 涉及字体、坐标或最终验收时，分别阅读 [typography.md](typography.md) 与 [qa-checklist.md](qa-checklist.md)。

恢复会话时，以磁盘中的门禁记录、任务清单和交接文件为准，不依赖聊天上下文或执行者记忆。

## 阶段目录与回滚

`<deck>/pptx/` 下只使用以下阶段目录：

```text
<deck>/pptx/
├── P1/  # 输入、运行时与渲染后端复核
├── P2/  # HTML 基准截图与页面映射
└── P3/  # 文字真值、无字背景、基线标定、文字计划、PPTX、渲染与比对
```

阶段产物、门禁记录、截图、报告和交接材料必须写入所属阶段目录；禁止平铺在 `pptx/` 根目录，也禁止把
其他阶段的证据写入 P1。需要回滚时，先登记受影响范围，再删除该阶段目录及所有依赖它的后续阶段目录；
不得只删除根目录中的零散文件。

## 人工阶段确认模式

在执行 P1 前，执行者必须向用户确认：**是否需要在每个阶段完成后人工介入确认**。将用户选择写入
`pptx/P1/pptx-stage-gates.md` 的任务配置；恢复任务时沿用该记录，除非用户明确变更。不得因执行者偏好
默认开启或关闭该模式。

| 用户选择 | 执行方式 |
|---|---|
| 是，逐阶段确认 | P1、P2、P3 的自动检查与证据产物完成后，先报告本阶段结论，再暂停等待用户明确批准；只有收到批准后，才能将该阶段记为通过并进入下一阶段。 |
| 否，不逐阶段确认 | 每个阶段仍须完成自动门禁、保存证据和失败定位，但可在门禁通过后自动进入下一阶段；最终交付前仍须完成 P3 的逐页人工复核材料。 |

逐阶段确认时，阶段报告至少包含：门禁编号与结论、已检查的页面范围、关键证据路径、发现的差异或无法复原项、
建议的下一步。用户可批准、要求返工，或要求补充检查。用户要求返工或检查失败时，必须在
对应 `P<n>/pptx-stage-gates.md` 中记录问题归属阶段、原因、修复动作和需重跑的后续门禁；不得进入下一阶段。

确认的目的是尽早定位问题：P1 聚焦输入、资源与运行环境，P2 聚焦 HTML 基准截图与页序，P3 聚焦文字真值、
无字背景、基线标定、组装与逐页视觉回归。

### 启动时只允许的确认

P1 前，默认只询问一次“是否需要每个阶段人工介入确认”。转换形态已固定为混合版（位图底板 + 原生文字），
不再询问“原生可编辑版 / 整页截图版”等形态。若用户主动要求其他交付形态，才按用户指令调整并写入
`P1/pptx-stage-gates.md` 与 `P3/acceptance.md`。

## 混合版硬约束

最终 PPTX 的每一页由“无字背景位图 + 原生文本框”组成，必须同时满足：

1. 背景中可编辑文字的字形已隐藏（`hiddenTextNodes + bitmapOnlyTextNodes = 采集节点数`，脚本内置断言）；
2. 标题、正文、表格文字、页脚等仍为原生文本框，不得把可编辑文字烧进背景；
3. 竖排（`writing-mode: vertical-*`）与字符 alpha < 0.99 的文字经 `bitmapOnly` 登记后保留在位图中，
   验收记录须逐项列明；
4. 背景固定 2×（≥3200×1800）、JPEG q92，不得使用 P2 的 1× 检查截图；
5. 逐页 side/overlay/diff 审看通过，并在 `P3/acceptance.md` 与 `P3/pptx-stage-gates.md` 记录结论与限制。

背景位图只能来自 `capture-hybrid-backgrounds.mjs`。任何带文字截图、隐藏文字截图或外部截图都不得作为
交付底板。

## 输入契约

转换前必须确认以下条件：

1. 输入是一个实际存在的 HTML deck 根目录，包含 `index.html`、`assets/ppt.css`、`assets/deck.js`、
   `assets/slide.js` 和 `slides/`；页面顺序只能读取 `assets/deck.js`。
2. HTML deck 应具备可读取的页面清单、1600×900 基准截图和资源可读性验证；这些证据可在 P2 阶段生成并保存，
   不要求存在 HTML 生成阶段的 G7 结论或其过程文件。
3. 画布必须是 `1600 × 900` px，目标页面为 `13.333″ × 7.5″`，坐标换算固定为
   `1 HTML px = 7620 EMU`。字体换算遵循 [typography.md](typography.md)。
4. 所有资源必须使用 deck 内相对路径，且可读取；不得依赖外部 URL、绝对路径、临时浏览器状态或未登记的
   base64 资源。
5. 转换前读取 [全局硬约束](global-constraints.md)，并保留品牌固定背景、Logo、标题区和内容安全区；
   不得通过转换过程替换品牌素材或重排页面。

## 实现边界

- 转换器读取真实 HTML DOM、计算样式和 `deck.js`，不能另维护页序或内容 manifest。
- 文字几何以 P3 采集的逐文本节点真值为唯一来源：`P3/text-nodes.json` 记录字体、字号、颜色、行距、
  字距、三套边界与 `lines[]`；`P3/text-plan.json` 记录拆行、字距补偿与 `bitmapOnly` 例外。
- 背景由同一渲染态生成，卡片、图表、图标、渐变与装饰保持 HTML 观感；代价是这些元素不可单独编辑。
- 字体缺失且无已接受替代方案、资源读取失败、背景中出现可编辑文字重影、文字越界或重叠、
  截图与 PPTX 明显不一致，均为转换失败，必须明确报告；不得静默忽略或以空白替代。
- 转换产物与 HTML 源码分开保存，禁止覆盖 HTML 页面、资源、门禁记录或检查点。
- 转换功能不得改变 HTML deck 的 G1–G7 状态；PPTX 验收拥有独立记录。

## 图片清晰度策略

| 用途 | 清晰度要求 | 默认参数 | 典型产物 |
|---|---|---|---|
| 交付底板 | **高清**，投影与放大仍锐利 | 逻辑 1600×900 对应 ≥3200×1800（`deviceScaleFactor = 2`），JPEG q92 | `P3/backgrounds/` |
| 仅用于检查/比对 | 可较低，能辨认文字与布局即可 | `deviceScaleFactor = 1`（1600×900） | `P2/html-screenshots/`、`P3/pptx-renders/` 比对底图 |

规则：

1. 凡最终写入 `.pptx` 的位图，必须按交付高清标准生成或选用源图；禁止把检查用 1× 截图贴进 PPT。
2. P2 的 HTML 基准截图保持 1×，只用于定位与 L2 比对，不承担交付贴图职责。
3. 高清交付图与检查截图分路径保存，不得混用。

## 产物与验收门禁

| 产物 | 用途 |
|---|---|
| `P1/tasks.md` | 转换任务清单与返工记录 |
| `P1/input-review.md`、`P1/runtime-dependency-review.md`、`P1/render-backend-plan.md` | 输入、依赖与渲染后端复核 |
| `P1/pptx-stage-gates.md` | P1 门禁与人工阶段确认模式 |
| `P2/html-screenshots/` | 1× HTML 基准截图 |
| `P2/page-map.json` | `deck.js` 页序、HTML 文件与 HTML 截图的唯一映射 |
| `P2/baseline-review.md`、`P2/pptx-stage-gates.md` | 基准复核与门禁 |
| `P3/text-nodes.json`、`P3/backgrounds/` | 逐文本节点真值与“可编辑字形已隐藏”的 2× 背景 |
| `P3/calibration.json`、`P3/calibration/` | 字号/行高组合的基线标定结果与探针证据 |
| `P3/text-plan.json`、`P3/hybrid-build-review.md` | 文本几何、拆行/字距补偿、`bitmapOnly` 例外与组装复核 |
| `P3/<deck-title>（混合版）.pptx` | 交付文件（位图底板 + 原生文字） |
| `P3/pptx-renders/`、`P3/comparison/` | 逐页渲染、side/overlay/diff 与 MAD 摘要 |
| `P3/acceptance.md` | 验收记录、遗留限制与复现命令 |
| `P3/pptx-stage-gates.md` | P3 门禁、失败修复与阶段批准记录 |

转换完成前至少验证：

1. PPTX 页面数量、顺序、标题和文件映射与 `assets/deck.js` 一致。
2. 页面尺寸为 `13.333″ × 7.5″`，且页面元素坐标与 HTML 1600×900 画布的换算一致。
3. 背景位图齐全、为 2×、且不含可编辑文字重影；`bitmapOnly` 节点数与采集记录一致。
4. 文字计划满足 `summary.texts = 采集节点数 − skipped + splitNodes`，所有文本框使用精确行距与硬换行。
5. 对 HTML 原始截图与 PPTX 渲染图逐页进行视觉比对，重点检查文字换行、裁切、重叠、颜色、层级和位置。
6. 发现不一致时，修复采集/标定/组装或回退修复 HTML，再重新转换和验收；未通过不得交付 PPTX。

## 阶段路由与门禁

严格按下表顺序执行 P1、P2、P3。每个阶段通过后才能进入下一阶段；失败必须回到问题所属阶段修复，并重跑
受影响的后续门禁。PPTX 门禁独立于 HTML 的 G1–G7，不得覆盖或改写 HTML 门禁记录。

| 门禁 | 阶段 | 必读文档 | 必填交接/证据 |
|---|---|---|---|
| P1 | 输入与转换基础条件 | [pptx-stages/foundation.md](pptx-stages/foundation.md) | `P1/tasks.md`、`P1/input-review.md`、`P1/runtime-dependency-review.md`、`P1/render-backend-plan.md`、`P1/pptx-stage-gates.md` |
| P2 | 视觉基准与页面映射 | [pptx-stages/visual-baseline.md](pptx-stages/visual-baseline.md) | `P2/html-screenshots/`、`P2/page-map.json`、`P2/baseline-review.md`、`P2/pptx-stage-gates.md` |
| P3 | 混合版转换与验收 | [pptx-stages/hybrid.md](pptx-stages/hybrid.md) | `P3/text-nodes.json`、`P3/backgrounds/`、`P3/calibration.json`、`P3/text-plan.json`、`P3/<deck-title>（混合版）.pptx`、`P3/pptx-renders/`、`P3/comparison/`、`P3/hybrid-build-review.md`、`P3/acceptance.md`、`P3/pptx-stage-gates.md` |

每个转换任务必须在各自 `P<n>/pptx-stage-gates.md` 维护本阶段门禁；P1 文件先记录是否启用逐阶段人工确认。
每份记录必须包含门禁编号、检查项、通过/失败、证据路径或命令输出，以及失败后的修复说明。启用逐阶段确认时，
还必须记录用户的批准、返工或补充检查结论；没有明确批准的阶段不得标记为通过。记录缺失或缺项，视为阶段未完成。

只有 P1/P2/P3 门禁全部通过、逐页视觉审看完成（启用逐阶段确认时还需用户批准）后，才能宣称
“已完成 HTML 转 PPTX 交付”。

## 已内置命令

以下命令位于本技能的 `scripts/`，应直接调用，禁止在任务目录临时重写同类脚本。它们只读取输入 deck，
并将产物写入所属阶段目录，不改动 HTML 源码。

```bash
node <skill>/scripts/init-pptx-workspace.mjs <deck-root>
node <skill>/scripts/capture-html-slides.mjs <deck-root>
node <skill>/scripts/capture-hybrid-backgrounds.mjs <deck-root>
python3 <skill>/scripts/calibrate-hybrid-text.py \
  <deck-root>/pptx/P3/text-nodes.json <deck-root>/pptx/P3/calibration.json
node <skill>/scripts/build-hybrid-deck.mjs <deck-root>
python3 <skill>/scripts/render-pptx-slides.py <deck-root> <pptx> <output-dir>
python3 <skill>/scripts/compare-pptx-html.py <deck-root> <pptx-renders-dir> <comparison-dir>
```

截图与坐标脚本通过 `resolvePlaywright()` 按固定顺序解析 Playwright：

1. deck 本地：`<deck-root>/node_modules/playwright`；
2. deck 所在项目根目录：`<project-root>/node_modules/playwright`；
3. 全局 npm：`npm root -g` 下的 `playwright`。

找到包后，还必须确认该版本对应的 Playwright Chromium 可执行文件已存在；只有“包和浏览器都可用”才算就绪。
三处都没有可用包时才安装 npm 包；若项目根目录存在，则优先在那里安装；包存在但浏览器缺失时只补装 Chromium。
不得因为本机安装了 Google Chrome / Edge 就跳过 Playwright Chromium，也不得在已有匹配 revision 缓存时
强制重复下载。

`capture-html-slides.mjs` 固定以本地 HTTP 服务、`deck.js` 页序、1600×900、`deviceScaleFactor: 1`、
`prefers-reduced-motion: reduce` 运行，并在 `P2/` 生成 `page-map.json`。它同时写出的坐标/metrics 文件
仅作调试参考，混合版不依赖。

混合版链路由 `capture-hybrid-backgrounds.mjs`（采集 + 无字背景）、`calibrate-hybrid-text.py`（基线标定）、
`build-hybrid-deck.mjs`（计划 + 组装）组成；调用顺序、参数与门禁见
[pptx-stages/hybrid.md](pptx-stages/hybrid.md)。不要另写采集或组装脚本。
