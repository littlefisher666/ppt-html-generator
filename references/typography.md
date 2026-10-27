# Typography reference for PPT-compatible HTML

## Why integer pt matters

PowerPoint UI and most generators treat font size as **integer points** (sometimes half-points). HTML accepts arbitrary `px` / `rem` / computed fractions. If HTML uses free sizes, export rounding changes:

- line wraps
- card heights
- column balance
- footer collisions

Design in **integer pt**, render in CSS `px` on the 1600×900 stage.

## Stage formula (authoritative)

```text
stage:     1600 × 900 px
ppt size:  13.333in × 7.5in
px_per_in: 120
pt  = px * 72 / 120 = px * 0.6
px  = pt * 120 / 72 = pt * 5/3
```

Not the browser 96dpi rule (`px = pt * 96/72`).

## Recommended roles

### Projection / defense / board decks

| Role | pt | px | CSS token |
|------|---:|---:|-----------|
| Closing display | 44–48 | ~73–80 | `--t-48` or fixed cover class |
| Cover title | 32–36 | ~53–60 | `--t-36` |
| Section title | 28–32 | ~47–53 | `--t-32` / `--t-28` |
| Page h1 | 24 | 40 | `--t-24` |
| h2 | 18 | 30 | `--t-18` |
| h3 / card title | 14–16 | ~23–27 | `--t-14` / `--t-16` |
| Body | 12–14 | 20–~23 | `--t-12` / `--t-14` |
| Caption / tag | 10–11 | ~17–18 | `--t-10` / `--t-11` |
| Footer | 10–11 | ~17–18 | same as caption |

### Dense mode

When content is heavy, **drop one role tier** and tighten padding/gaps:

| Normal | Dense |
|--------|--------|
| h1 24pt | h1 18pt |
| body 12pt | body 11–12pt (prefer keep 12, reduce margins) |
| h3 14pt | h3 12–14pt |
| padding 18–20px | padding 12–14px |

Do **not** dense-mode by inventing `13px` body text.

## Allowed size set (practical)

If the toolchain requires integer CSS px **and** integer export pt, prefer:

```text
px:  17, 20, 23, 27, 30, 40, 47, 53, 60, 67, 80
pt≈: 10, 12, 14, 16, 18, 24, 28, 32, 36, 40, 48
```

Cleanest pairs for both worlds: **20/12, 30/18, 40/24, 60/36, 80/48**.

## Line height

| Context | Multiplier |
|---------|------------|
| Display titles | 1.15–1.25 |
| Page titles | 1.2–1.3 |
| Body / lists | 1.3–1.5 |
| Tables / dense | 1.25–1.4 |

Avoid values like `1.52` unless there is a strong brand reason; simple ratios convert more predictably.

### HTML → PPT 行间距（混合版）

- 权威真值是 `P3/text-nodes.json` 的 `lineHeightPx` 与逐行 `lines[]`；P2 的
  `text-metrics.json` / `coordinate-map.json` 仅作调试参考。
- 必须写精确磅值：`a:lnSpc/a:spcPts val = round(lineHeightPx × 0.6 × 100)`。
- 禁止用 `a:spcPct`：LibreOffice / PowerPoint 会把百分比乘在字体自然行高（微软雅黑约 1.205em）上，
  `line-height: 1.3` 会被放大到约 1.57 倍。
- 多行文字按 `lines[]` 硬换行，不依赖 PPT 软换行；文本框高度 = 行高 × 行数。
- 基线由 `P3/calibration.json` 实测；缺组合时组装必须失败，不得用经验常数替代。

## Letter spacing

- Body Chinese: **0**
- Kickers / section labels: optional slight tracking
- Never rely on tracking to make a title “fit” a single line — shorten the title instead

### HTML → PPT 字间距

- `P3/text-nodes.json` 应记录 `letterSpacingPx`；`normal` / 无效值记为 `0`。
- 同步记录 `letterSpacingPt`（`px * 0.6`）便于直接写 OOXML；保留 `letterSpacingPtExact` 审计精确值。
- 换算：`pt = letterSpacingPx * 0.6`，OOXML run 属性 `a:spc` 的 `val = round(pt * 100)`（单位：1/100 pt）。
- 例：`letter-spacing: 2px` → `1.2pt` → `spc=120`。
- `0` 可不写字符间距；非 0 必须写入。
- 中西文混排行需按 CJK↔西文边界数补偿 LibreOffice 的自动额外间距：
  `−0.25em × 边界数 ÷ 字间数`，限制在 ±0.2em 内；纯中文、纯西文行不补偿。
- 中文 tracking 引擎差异可接受微小偏差；若已改变标签/标题疏密观感或换行，仍判失败。

### HTML → PPT 文本框与换行真值（混合版）

- 文字几何唯一来源是 `P3/text-nodes.json`：每个文本节点含 `boxes.layout/content/ink`、
  `lines[]`（逐行文本与行盒）以及字体、字号、颜色、字重、行距、字距。
- 混合版按 `lines[]` 的逐行矩形定位：`x = line.x`、`width = 节点最长行宽`；
  `bitmapOnly` 节点（竖排或半透明）不生成文本框。
- `fontSizePt = round(fontSizePx × 0.6)`；字体写实际命中字体（`fontFamilyUsed`），不得写死字体名。
- 行内混排按行拆框：某行 `x` 与首行相差 >2px，或行距偏离 `lineHeightPx` >2px 时拆成独立文本框，
  拆出的框标记 `source: p3-calibrated-split`。
- 结构化主检顺序：内容完整性 → 字体/字号/颜色 → 文本框位置大小 → 行数/断行 → 行距/字距 → 截图比对。
- 验收计数：`summary.texts = 采集节点数 − skipped + splitNodes`，并逐页查看 side/overlay/diff。

## Font stacks

### 本技能的固定中西文字体规则

所有 deck 的西文固定使用 `Times New Roman`；中文使用用户已确认的中文字体。三个角色 token
`--font-heading`、`--font-body`、`--font-ui` 必须使用完全相同的组合栈，并将 `Times New Roman`
置于首位，再接中文主字体与跨平台中文回退。例如用户选择宋体时：

```css
--font: "Times New Roman", "SimSun", "宋体", "Songti SC", "STSong", "华文宋体", serif;
```

不得为标题、正文或 UI 单独改用其他西文字体。运行字体检查时，所选中文字体和 `Times New Roman`
必须同时通过。

Editable cross-platform example (serif award/tech deck):

```css
--font: "Times New Roman", "Songti SC", "SimSun", "STSong", "NSimSun",
        "Source Han Serif SC", "Noto Serif CJK SC", serif;
```

Sans technical deck example:

```css
--font: "Times New Roman", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
```

Rules:

1. Put the **target delivery OS** primary face first if known
2. Always provide Windows + Mac + generic fallbacks
3. If the final PPT must match exactly, plan **font embedding** or full-page image export
4. Do not mix a serif HTML stack with a silent sans fallback in PPT without checking reflow

## Weight mapping

| CSS | PPT |
|-----|-----|
| 400 / normal | Regular |
| 700 / bold | Bold |
| 500–600 | Treat as Regular unless face has real weights |
| 800–900 | Treat as Bold; prefer write `700` in CSS |

## Export mapping cheat sheet

```javascript
function pxToPt(px) {
  return Math.round(px * 0.6);
}

function pxToIn(px) {
  return px / 120;
}

function lineHeightToSpcPct(lineHeightPx, fontSizePx) {
  return Math.round((lineHeightPx / fontSizePx) * 100000);
}

function letterSpacingToSpc(letterSpacingPx) {
  // OOXML a:spc uses 1/100 pt
  return Math.round(letterSpacingPx * 0.6 * 100);
}
```

Examples on this canvas:

| CSS px | pt export |
|-------:|----------:|
| 40 | 24 |
| 30 | 18 |
| 20 | 12 |
| 16.67 | 10 |
| 23.33 | 14 |
| 60 | 36 |
| 16 | 10 (9.6→10) — **avoid**; use 20 for body |
| 24 | 14 (14.4→14) — prefer 30 for true 18pt hierarchy |

## Common failure modes

1. **Body 16px (9.6pt)** looks acceptable in browser, weak on projector, jumps to 10pt in PPT
2. **Dense pages with 15/17px** create a random pt cloud after rounding
3. **letter-spacing + weight 800** hierarchy collapses on standard CJK PPT fonts
4. **Using 96dpi math** makes the whole deck ~25% wrong in perceived type size vs geometry
