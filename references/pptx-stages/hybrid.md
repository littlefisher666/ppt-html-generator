# 混合版交付：位图背景 + 原生文字（P3）

P3 是 HTML 转 PPTX 的**唯一流程**：把每页渲染为“可编辑文字已隐藏”的高清背景图，再按
HTML 实测几何叠加原生文本框。它用位图承载卡片、渐变、图标、图表与装饰，用原生文本框承载所有
正文与标题，从而同时获得接近 HTML 的观感与可编辑文字。

旧的原生组装流程（原 P3–P5）已移除，不存在“原生版 / 混合版”二选一。启动时不再询问交付形态；
执行者只需说明固定边界：文字可编辑，底板元素不可单独编辑。

## 适用与边界

| 适合 | 不适用（需另立方案） |
|---|---|
| 卡片、渐变、图标、图表、CSS 特效密集，需要高度还原 HTML | 背景/图形也必须可编辑，或需要大幅改版重排 |
| 交付重点是“看起来与 HTML 一致”，文字仍需可改可搜 | 有严格的纯矢量 / 可访问性要求 |

## 与 P1/P2 的关系

1. 复用 P1/P2：输入校验、`P2/html-screenshots/`、`P2/page-map.json` 是比对基准与页序真值。
2. P3 产物全部写入 `pptx/P3/`，不得覆盖或改写 P1/P2 的证据。
3. P3 的验收独立成门禁，不改变 HTML 的 G1–G7。
4. 混合版产物统一写入 `pptx/P3/`；已有 deck 若保留旧 P3–P5 原生流程目录，先归档再运行。

## 标准流程

前置：P1/P2 已通过，`pptx/P2/page-map.json` 与 `pptx/P2/html-screenshots/` 存在；第 5 步的比对
直接读取它们。缺 P2 时先运行 `init-pptx-workspace.mjs` 与 `capture-html-slides.mjs`。

```bash
DECK=<deck-root>
S=<skill>/scripts

# 1. 采集文字真值 + 隐藏可编辑字形的 2× 背景
node "$S/capture-hybrid-backgrounds.mjs" "$DECK"

# 2. 按字号/行高组合标定 LibreOffice 基线
python3 "$S/calibrate-hybrid-text.py" \
  "$DECK/pptx/P3/text-nodes.json" "$DECK/pptx/P3/calibration.json"

# 3. 生成文字计划并组装 PPTX（内部调用 apply-hybrid-text-plan.py）
node "$S/build-hybrid-deck.mjs" "$DECK"

# 4. 渲染逐页 PNG
python3 "$S/render-pptx-slides.py" "$DECK" \
  "$DECK/pptx/P3/<deck-title>（混合版）.pptx" "$DECK/pptx/P3/pptx-renders"

# 5. 与 HTML 截图逐页比对
cd "$DECK" && python3 "$S/compare-pptx-html.py" . pptx/P3/pptx-renders pptx/P3/comparison
```

顺序不可交换：采集产物是标定输入，标定结果是组装的硬依赖；缺少 `calibration.json` 时组装必须失败。
输出文件名取 `assets/deck.js` 的 `title`，无需手改。

## 产物

| 路径 | 用途 |
|---|---|
| `P3/text-nodes.json` | 逐文本节点真值：字体/字号/颜色/行距/字距/三套边界/逐行矩形/`bitmapOnly` |
| `P3/backgrounds/*@2x.jpg` | 3200×1800、q92 背景；可编辑文字已隐藏 |
| `P3/backgrounds/manifest.json` | 页序、背景文件、隐藏/保留节点计数 |
| `P3/calibration.json` | 每个字号/行高组合的 `baselineFromBox`、行高与探针数据 |
| `P3/calibration/` | 标定探针 PPTX/PDF/PNG，供复核 |
| `P3/text-plan.json` | 逐页文本规格、拆分与字距补偿记录、`skipped` 列表 |
| `P3/<deck-title>（混合版）.pptx` | 交付 PPTX |
| `P3/hybrid-build-review.md` | 组装参数与规则复核 |
| `P3/pptx-renders/`、`P3/comparison/` | 渲染图、side/overlay/diff 与 MAD 摘要 |
| `P3/acceptance.md` | 交付验收记录：页数、文本框数、字体、MAD、遗留限制、复现命令 |
| `P3/pptx-stage-gates.md` | P3 门禁、交付边界说明与返工记录 |

## 采集规则

1. 以文本节点为单位（`TreeWalker`），用 `Range.getClientRects()` 取逐行矩形；不依赖元素白名单，
   混合内容父元素中的直接文字也不会漏采。
2. 隐藏字形用 `visibility:hidden`，不用 `color:transparent`：后者会连带隐藏 `::before/::after`
   的装饰字形（流程箭头等）。
3. 两类文字**不生成原生文本框**，字形保留在位图中，节点标记 `bitmapOnly`：
   - `writing-mode` 为 `vertical-*`：横排文本框无法还原侧转字形与竖排行距；
   - 文字颜色 alpha `< 0.99`：PPTX 文本框不支持字符级透明度，按实色绘制会明显变深。
4. 隐藏数 + 保留数必须等于采集数，否则整页失败；不静默跳过。
5. 背景固定 2×（3200×1800）、JPEG q92；检查用截图仍为 1×，两者不得混用。

## 文字几何与排版规则

以 `em = fontSizePx`、`L = lineHeightPx` 表示 HTML 采集值：

1. 字号：`fontSizePt = round(em × 0.6)`，颜色写 `style.color`（大写 hex），字体写实际命中字体。
2. 行距：写 `a:lnSpc/a:spcPts val = round(L × 0.6 × 100)`。不要用 `spcPct`，LibreOffice 会把
   百分比乘在字体自然行高（微软雅黑约 1.205em）上，1.2 倍会被放大成约 1.45 倍。
3. 基线：`boxY = line.y + round(1.058 × em) − baselineFromBox`。`line.y` 是 Range 内容框顶，
   1.058 是 Chrome 的字体 ascent 比例，`baselineFromBox` 由标定实测。
4. 文本框：`x = line.x`，`width = 该节点最长行宽`，`height = L × 行数`；关闭自动换行与自动缩字，
   多行一律用 `lines[]` 硬换行，不依赖 PPT 软换行。
5. 行内混排：同一文本节点内某行 `x` 与首行相差 >2px，或行距偏离 `L` >2px 时，按行拆成独立文本框
   （典型场景：加粗前缀 + 正文同段，第二行从卡片左缘重新起排）。
6. 中西文混排：LibreOffice 在每个 CJK↔西文边界额外加约 0.25em。按
   `−0.25em × 边界数 ÷ 字间数` 施加负字距（限制在 ±0.2em 内）抵消；纯中文/纯西文行不需要补偿。
7. 竖直对齐一律 `top`，文本框边距为 0；不得用居中/自动行距“目测对齐”。

## 基线标定

1. 扫描 `text-nodes.json` 中出现的全部 `(fontSizePt, lineHeightRatio)` 组合，去重排序。
2. 每个组合渲染一条两行探针（`国国国国`），使用与实际一致的精确行距，灰度底便于找墨迹行。
3. 以行暗度剖面在 `boxY + L` 附近最亮行切分两行，取每行墨迹上下沿：
   `baseline = ((inkTop + 0.7806em) + (inkBottom − 0.1313em)) / 2`。
4. `baselineFromBox` 与 `baselineGapObserved` 一并写入 `calibration.json`；行距漂移 >1px 视为标定失败。
5. 标定依赖 LibreOffice + `pdftoppm`，与 P3 验收渲染后端一致；更换渲染器必须重新标定。

## 验收门禁（P3）

必须全部满足，并在 `P3/pptx-stage-gates.md` 留下证据：

1. 页数、页序与 `assets/deck.js` 一致；`page-map` 中每页都有对应背景与渲染图。
2. `writtenTexts` 等于 `summary.texts`，并满足
   `采集节点数 − summary.skipped + summary.splitNodes`；`skipped`（`bitmap-only:*`）
   逐项列明页码、节点 ID 与原因。
3. 逐页查看 side/overlay/diff：无缺字、裁切、重叠、串位；竖排字不得被横排绘制，半透明字不得变深。
4. 正文/表格/标签关键行实测 `dy = 0`、`|dx| ≤ 1px`；标题允许 ≤2px 栅格化差异。
5. 全页 MAD 只作回归辅助指标，不得单独作为通过依据；必须结合逐页图像审看。
6. `P3/acceptance.md` 与 `P3/pptx-stage-gates.md` 登记：位图底板清单、`bitmapOnly` 节点及原因、
   字体依赖、未实测的渲染器与交付边界说明。

## 已知限制（交付时必须向用户说明）

1. 基线标定基于 LibreOffice；未在 Microsoft PowerPoint / WPS 中实测，换渲染器可能出现 ≤2px 的垂直位移。
2. 28pt 级标题在 LibreOffice 渲染中常比 HTML 低约 1–2px；正文可做到 `dy=0`。
3. 中西文混排的字距是整行补偿，个别边界仍有 ±2–4px 的间隙分布差异。
4. `bitmapOnly` 的竖排/半透明装饰文字不可编辑；卡片、色块、图表、图标也不可编辑。
5. 修改文字不会重排底板：文字变长可能溢出卡片，需人工缩短或改回 HTML 重转。
6. 背景为 2× JPEG，放大到 200% 以上可见轻微压缩痕迹；正常投影无影响。
7. 目标系统缺少 deck 字体时，PowerPoint 会回退替换，几何需重新验收。

## 失败判定

出现以下任一情况，P3 判失败，必须修复采集/标定/组装后整页重跑：

- 背景中残留可编辑文字（与原生文本框重影），或原生文本框缺失；
- 竖排文字被横排绘制、半透明文字变实色；
- 文字越出卡片边界、相互重叠、被底板色块截断；
- `calibration.json` 缺组合或组装时行高与采集值不一致；
- 有页面未渲染、页序错位或比对缺失。

## 交付边界与后续变更

1. P3 是默认且唯一的转换流程，不需要在开始时询问“原生版 / 混合版”。
2. 交付前必须向用户说明：文字可编辑，卡片、色块、图表、图标与装饰不可单独编辑；说明内容写入
   `P3/acceptance.md`，不要求用户逐阶段批准混合版形态。
3. 用户后续要求底板元素也可编辑时，需要重新设计转换方案；不得把局部补画的形状或整页截图
   宣称为“全部可编辑”，也不存在可回退的旧原生流程。
