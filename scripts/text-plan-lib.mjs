/**
 * 文字规格构造库：由 P3/text-nodes.json 的逐文本节点真值生成 PPT 文本框规格。
 * detectLayout() 识别页面版式，buildTextSpec() 输出字体、行距、硬换行与基础边界。
 */

import { preferredPptFontFromStyle } from "./pptx-html-utils.mjs";

const LAYOUTS = ["cover", "agenda", "section", "content", "closing", "title-only"];

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function detectLayout(html) {
  for (const layout of LAYOUTS) {
    const re = new RegExp(`class=["'][^"']*\\blayout-${layout}\\b[^"']*["']`, "i");
    if (re.test(html)) return layout === "title-only" ? "content" : layout;
  }
  return null;
}

function normalizeAlign(value) {
  const align = String(value || "left").toLowerCase();
  if (align === "start" || align === "left" || align === "justify") return "left";
  if (align === "center" || align === "middle") return "center";
  if (align === "end" || align === "right") return "right";
  return "left";
}

function normalizeAnchor(value) {
  const anchor = String(value || "top").toLowerCase();
  if (anchor === "middle" || anchor === "center" || anchor === "central") return "middle";
  if (anchor === "bottom" || anchor === "base" || anchor === "baseline") return "top";
  return "top";
}

function pickBox(textNode) {
  const boxes = textNode.boxes || {};
  // 有 padding 时优先 content，避免文字贴边/压线，观感上更像“溢出”。
  if (boxes.content && boxes.layout) {
    const padX = Number(boxes.layout.width) - Number(boxes.content.width);
    const padY = Number(boxes.layout.height) - Number(boxes.content.height);
    if ((Number.isFinite(padX) && padX >= 8) || (Number.isFinite(padY) && padY >= 8)) {
      return { ...boxes.content, source: "content" };
    }
  }
  if (textNode.pptTextBoxHint === "contentBox" && boxes.content) {
    return { ...boxes.content, source: "content" };
  }
  if (boxes.layout) return { ...boxes.layout, source: "layout" };
  if (boxes.content) return { ...boxes.content, source: "content" };
  return {
    x: textNode.x,
    y: textNode.y,
    width: textNode.width,
    height: textNode.height,
    source: "fallback",
  };
}

function fallbackLineHeightRatio(fontSizePt) {
  if (fontSizePt >= 28) return 1.2;
  if (fontSizePt >= 18) return 1.25;
  return 1.3;
}

function lineTexts(textNode) {
  const lines = Array.isArray(textNode.lines) ? textNode.lines : [];
  const fromLines = lines
    .map((line) => decodeEntities(line?.text ?? line?.rawText ?? ""))
    .map((text) => text.replace(/\s+$/g, ""))
    .filter((text, index, arr) => text.length > 0 || arr.length === 1);
  if (fromLines.length) return fromLines;
  const whole = decodeEntities(textNode.text || "").replace(/\s+$/g, "");
  return whole ? [whole] : [""];
}

function estimatePptLineWidthPx(text, fontSizePx, letterSpacingPx = 0) {
  const size = Number(fontSizePx) > 0 ? Number(fontSizePx) : 16;
  const spacing = Number(letterSpacingPx) || 0;
  const raw = String(text || "");
  let units = 0;
  for (const ch of raw) {
    const code = ch.codePointAt(0) || 0;
    if (ch === " " || ch === "\t") units += 0.35;
    else if (code <= 0x007f) units += 0.58;
    else if (code >= 0xff00 && code <= 0xffef) units += 1.05;
    else units += 1.05;
  }
  const chars = Math.max(raw.length, 1);
  return units * size + spacing * Math.max(chars - 1, 0);
}

function maxLineWidthPx(textNode, fallbackWidth, style = {}) {
  const lines = Array.isArray(textNode.lines) ? textNode.lines : [];
  const fontSizePx = Number(style.fontSizePx) || Number(style.fontSizePt || 0) / 0.6 || 16;
  const letterSpacingPx = Number(style.letterSpacingPx) || 0;
  let maxWidth = 0;
  for (const line of lines) {
    const browserWidth = Number(line?.width);
    const lineText = decodeEntities(line?.text ?? line?.rawText ?? "");
    const estimate = estimatePptLineWidthPx(lineText, fontSizePx, letterSpacingPx);
    const candidate = Math.max(
      Number.isFinite(browserWidth) && browserWidth > 0 ? browserWidth * 1.08 : 0,
      estimate,
    );
    if (candidate > maxWidth) maxWidth = candidate;
  }
  const inkWidth = Number(textNode.boxes?.ink?.width);
  if (Number.isFinite(inkWidth) && inkWidth > 0) {
    maxWidth = Math.max(maxWidth, inkWidth * 1.08);
  }
  if (maxWidth <= 0) {
    const whole = decodeEntities(textNode.text || "");
    if (whole) maxWidth = estimatePptLineWidthPx(whole, fontSizePx, letterSpacingPx);
  }
  if (maxWidth > 0) return maxWidth;
  return Number.isFinite(fallbackWidth) ? fallbackWidth : 0;
}

function buildSafeBox(textNode, style, lineCount) {
  const sourceBox = pickBox(textNode);
  const fontSizePx = Number(style.fontSizePx) || Number(style.fontSizePt || 0) / 0.6 || 16;
  const lineHeightPx =
    Number(style.lineHeightPx) > 0
      ? Number(style.lineHeightPx)
      : fontSizePx * (Number(style.lineHeightRatio) > 0 ? Number(style.lineHeightRatio) : 1.3);
  const widthSafety = Math.max(14, Math.round(fontSizePx * 0.85));
  const heightSafety = Math.max(8, Math.round(lineHeightPx * 0.45));
  const maxLineW = maxLineWidthPx(textNode, Number(sourceBox.width) || 0, style);
  const neededWidth = maxLineW > 0 ? maxLineW + widthSafety : Number(sourceBox.width) || 0;
  const layoutWidth = Number(textNode.boxes?.layout?.width);
  const baseWidth = Number(sourceBox.width) || 0;
  const modestExtra = Math.max(
    widthSafety * 2,
    Math.min(96, Math.round(baseWidth * 0.2) || widthSafety * 2),
  );
  const softCap = Math.max(
    neededWidth,
    baseWidth + modestExtra,
    Number.isFinite(layoutWidth) ? layoutWidth + Math.round(fontSizePx * 0.6) : 0,
  );
  const width = Math.max(baseWidth, Math.min(Math.max(neededWidth, baseWidth), softCap));
  const neededHeight = Math.max(lineCount, 1) * lineHeightPx + heightSafety;
  const layoutHeight = Number(textNode.boxes?.layout?.height);
  const baseHeight = Number(sourceBox.height) || 0;
  const heightSoftCap = Math.max(
    neededHeight,
    baseHeight + heightSafety,
    Number.isFinite(layoutHeight) ? layoutHeight + heightSafety : 0,
  );
  const height = Math.max(baseHeight, Math.min(Math.max(neededHeight, baseHeight), heightSoftCap));
  return {
    x: Number(sourceBox.x),
    y: Number(sourceBox.y),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    source: sourceBox.source || (textNode.pptTextBoxHint === "contentBox" ? "content" : "layout"),
    widthSafety,
    heightSafety,
    maxLineWidth: Number(maxLineW.toFixed(2)),
    neededWidth: Number(neededWidth.toFixed(2)),
    neededHeight: Number(neededHeight.toFixed(2)),
  };
}


export function buildTextSpec(textNode, { page, layout, role }) {
  const style = textNode.style || {};
  const fontSizePt =
    Number.isFinite(style.fontSizePt) ? style.fontSizePt : Math.round((Number(style.fontSizePx) || 0) * 0.6);
  const lineHeightRatio =
    Number.isFinite(style.lineHeightRatio) && style.lineHeightRatio > 0
      ? style.lineHeightRatio
      : fallbackLineHeightRatio(fontSizePt);
  const fontName = preferredPptFontFromStyle(style);
  if (!fontName) {
    throw new Error(`页 ${page} 文本 ${textNode.id} 无法解析 PPT 字体`);
  }
  if (!Number.isFinite(fontSizePt) || fontSizePt <= 0) {
    throw new Error(`页 ${page} 文本 ${textNode.id} 缺少有效 fontSizePt`);
  }
  if (!style.color) {
    throw new Error(`页 ${page} 文本 ${textNode.id} 缺少颜色`);
  }
  const linesForWrite = lineTexts(textNode);
  const lineCount = Math.max(
    linesForWrite.length,
    Array.isArray(textNode.lines) ? textNode.lines.length : 0,
    1,
  );
    const box = buildSafeBox(
    textNode,
    {
      ...style,
      fontSizePt,
      lineHeightRatio,
      fontSizePx: style.fontSizePx ?? fontSizePt / 0.6,
      letterSpacingPx: style.letterSpacingPx ?? 0,
    },
    lineCount,
  );
  const useHardLineBreaks = linesForWrite.length > 1;
  // Force wordWrap=false; multi-line uses hard breaks from lines[].
  const wordWrap = false;

  return {
    id: textNode.id,
    shapeName: `p3-text:${String(page).padStart(2, "0")}:${textNode.id}`,
    page,
    layout,
    role,
    source: "P3/text-nodes.json",
    text: useHardLineBreaks ? linesForWrite.join("\n") : decodeEntities(textNode.text || ""),
    lines: Array.isArray(textNode.lines) ? textNode.lines.map((line) => ({ ...line })) : [],
    metrics: textNode.metrics || null,
    box: {
      x: Number(box.x),
      y: Number(box.y),
      width: Number(box.width),
      height: Number(box.height),
      source: box.source,
      widthSafety: box.widthSafety,
      heightSafety: box.heightSafety,
      maxLineWidth: box.maxLineWidth,
      neededWidth: box.neededWidth,
      neededHeight: box.neededHeight,
    },
    inkBox: textNode.boxes?.ink || null,
    style: {
      fontFamilyCss: style.fontFamilyCss || style.fontFamily || null,
      fontFamilyUsed: style.fontFamilyUsed || null,
      fontName,
      fontSizePx: style.fontSizePx ?? null,
      fontSizePt,
      fontSizePtExact: style.fontSizePtExact ?? null,
      fontWeight: style.fontWeight ?? 400,
      bold: Number(style.fontWeight || 400) >= 600,
      color: String(style.color).replace(/^#/, "").toUpperCase(),
      textAlign: normalizeAlign(style.textAlign),
      verticalAlign: normalizeAnchor(style.verticalAlign),
      lineHeightPx: style.lineHeightPx ?? null,
      lineHeightRatio,
      letterSpacingPx: style.letterSpacingPx ?? 0,
      letterSpacingPt: style.letterSpacingPt ?? Number(((style.letterSpacingPx || 0) * 0.6).toFixed(2)),
      whiteSpace: style.whiteSpace || null,
      wordBreak: style.wordBreak || null,
      overflowWrap: style.overflowWrap || null,
    },
    write: {
      // 多行优先按 HTML lines[] 硬换行，避免 PPT 引擎二次断行导致溢出。
      // 单行关闭 wordWrap；文本框宽高带安全余量。
      textMode: "plain",
      wordWrap,
      useHardLineBreaks,
      lineCount,
      linesForWrite,
    },
  };
}
