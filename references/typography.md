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

## Letter spacing

- Body Chinese: **0**
- Kickers / section labels: optional slight tracking
- Never rely on tracking to make a title “fit” a single line — shorten the title instead

## Font stacks

Editable cross-platform example (serif award/tech deck):

```css
--font: "Songti SC", "SimSun", "STSong", "NSimSun",
        "Source Han Serif SC", "Noto Serif CJK SC", serif;
```

Sans technical deck example:

```css
--font: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC",
        "Helvetica Neue", Arial, sans-serif;
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
