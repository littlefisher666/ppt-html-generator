/**
 * P2 DOM 快照：在固定 1600×900 渲染态提取元素坐标与文字真值。
 * 供 P2 截图与 P3 无字背景采集共用，保证截图与文字真值同源。
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./pptx-html-utils.mjs";

const PX_TO_PT = 0.6;

/**
 * 在浏览器页面上下文执行：收集 .slide 可见元素与文字行盒。
 * 注意：此函数会被 Playwright page.evaluate 序列化，不能闭包外部变量。
 */
export function collectSlideElements() {
  const nodes = Array.from(document.querySelectorAll(".slide, .slide *"));
  const ids = new Map(nodes.map((node, index) => [node, node.id || `${node.tagName.toLowerCase()}-${index}`]));

  const rgb = (value) => {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => part.trim());
    if (parts.length < 3) return null;
    const alpha = parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
    if (Number.isFinite(alpha) && alpha <= 0) return null;
    return parts
      .slice(0, 3)
      .map((part) => Number(part).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  };

  const round = (value) => Number(Number(value).toFixed(2));
  const roundBox = (box) => ({
    x: round(box.x),
    y: round(box.y),
    width: round(box.width),
    height: round(box.height),
  });

  const unionRects = (rects) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;
    for (const rect of rects) {
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      found = true;
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
    if (!found) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const directText = (node) =>
    Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.TEXT_NODE)
      .map((child) => child.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  const parseFontFamilies = (fontFamily) =>
    String(fontFamily || "")
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);

  const genericFamilies = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
  const westernOnlyFont = (family) =>
    /times|arial|helvetica|georgia|garamond|cambria|calibri|verdana|tahoma|trebuchet|courier|palatino|symbol|wingdings/i.test(
      family
    );

  // 解析“实际用于该段文字的字体”。含中文时优先返回栈中第一个可用 CJK 字体，
  // 避免 Times New Roman 等西文首字体因系统回退而在 measureText 上“伪匹配”。
  const resolveUsedFont = (style, sampleText) => {
    const families = parseFontFamilies(style.fontFamily);
    const size = style.fontSize || "16px";
    const weight = style.fontWeight || "400";
    const fontStyle = style.fontStyle || "normal";
    const rawSample = String(sampleText || "");
    const matchedSample = rawSample.match(/[\u4e00-\u9fffA-Za-z0-9]{1,12}/);
    const sample = matchedSample?.[0] || rawSample.trim().slice(0, 12) || "字体Aa";
    const hasCjk = /[\u4e00-\u9fff]/.test(sample);

    const isAvailable = (family) => {
      try {
        return Boolean(document.fonts?.check?.(`${fontStyle} ${weight} ${size} "${family}"`));
      } catch (_) {
        return false;
      }
    };

    if (hasCjk) {
      for (const family of families) {
        if (genericFamilies.has(family) || westernOnlyFont(family)) continue;
        if (isAvailable(family)) return family;
      }
    }

    let canvas = null;
    let ctx = null;
    try {
      canvas = document.createElement("canvas");
      ctx = canvas.getContext("2d");
    } catch (_) {
      ctx = null;
    }

    if (ctx) {
      ctx.font = `${fontStyle} ${weight} ${size} ${style.fontFamily}`;
      const target = ctx.measureText(sample).width;
      let best = null;
      let bestDelta = Infinity;
      for (const family of families) {
        if (genericFamilies.has(family)) continue;
        if (hasCjk && westernOnlyFont(family)) continue;
        try {
          ctx.font = `${fontStyle} ${weight} ${size} "${family}"`;
          const width = ctx.measureText(sample).width;
          const delta = Math.abs(width - target);
          if (delta < bestDelta) {
            bestDelta = delta;
            best = family;
          }
          if (delta <= 0.75) return family;
        } catch (_) {
          // ignore invalid family
        }
      }
      if (best && bestDelta <= 2) return best;
    }

    for (const family of families) {
      if (genericFamilies.has(family)) continue;
      if (hasCjk && westernOnlyFont(family)) continue;
      if (isAvailable(family)) return family;
    }

    return families.find((family) => !genericFamilies.has(family) && !(hasCjk && westernOnlyFont(family))) || families[0] || null;
  };

  const contentBoxFromLayout = (layout, style) => {
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0;
    return roundBox({
      x: layout.x + borderLeft + paddingLeft,
      y: layout.y + borderTop + paddingTop,
      width: Math.max(0, layout.width - borderLeft - borderRight - paddingLeft - paddingRight),
      height: Math.max(0, layout.height - borderTop - borderBottom - paddingTop - paddingBottom),
    });
  };

  // 按字符 Range 聚合行：得到换行后的每行文本与几何。
  const extractTextLines = (element) => {
    const lineTolerancePx = 2;
    const lines = [];
    let current = null;
    const range = document.createRange();

    const flush = () => {
      if (!current) return;
      const box = unionRects(current.rects);
      if (!box) {
        current = null;
        return;
      }
      const text = current.text.replace(/\s+/g, " ").trim();
      if (!text) {
        current = null;
        return;
      }
      lines.push({
        index: lines.length,
        text,
        rawText: current.text,
        ...roundBox(box),
      });
      current = null;
    };

    const pushChar = (ch, rect) => {
      if (!rect || (rect.width <= 0 && rect.height <= 0 && ch.trim() === "")) return;
      const top = rect.top;
      const height = rect.height || 0;
      if (!current) {
        current = { text: ch, rects: [rect], top, bottom: top + height };
        return;
      }
      const sameLine =
        Math.abs(top - current.top) <= lineTolerancePx ||
        (top >= current.top - lineTolerancePx && top < current.bottom - lineTolerancePx);
      if (!sameLine) {
        flush();
        current = { text: ch, rects: [rect], top, bottom: top + height };
        return;
      }
      current.text += ch;
      current.rects.push(rect);
      current.top = Math.min(current.top, top);
      current.bottom = Math.max(current.bottom, top + height);
    };

    for (const child of element.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const value = child.textContent || "";
      if (!value) continue;
      for (let index = 0; index < value.length; index += 1) {
        try {
          range.setStart(child, index);
          range.setEnd(child, index + 1);
          const rects = Array.from(range.getClientRects());
          if (!rects.length) continue;
          for (const rect of rects) pushChar(value[index], rect);
        } catch (_) {
          // ignore invalid ranges
        }
      }
    }
    if (typeof range.detach === "function") range.detach();
    flush();
    return lines;
  };

  const textInkBox = (element, lines) => {
    if (lines?.length) {
      return unionRects(lines.map((line) => ({ x: line.x, y: line.y, width: line.width, height: line.height })));
    }
    const rects = [];
    for (const child of element.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const value = child.textContent || "";
      if (!value.replace(/\s+/g, "")) continue;
      let start = 0;
      let end = value.length;
      while (start < end && /\s/.test(value[start])) start += 1;
      while (end > start && /\s/.test(value[end - 1])) end -= 1;
      if (start >= end) continue;
      try {
        const range = document.createRange();
        range.setStart(child, start);
        range.setEnd(child, end);
        rects.push(...Array.from(range.getClientRects()));
        if (typeof range.detach === "function") range.detach();
      } catch (_) {
        // ignore
      }
    }
    return unionRects(rects);
  };

  const lineMetrics = (lines, lineHeightPx) => {
    if (!lines.length) {
      return {
        lineCount: 0,
        wrapOccurred: false,
        avgLineGapPx: null,
        maxLineWidthPx: null,
        totalInkHeightPx: null,
      };
    }
    const gaps = [];
    for (let i = 1; i < lines.length; i += 1) {
      gaps.push(round(lines[i].y - lines[i - 1].y));
    }
    const avgLineGapPx = gaps.length ? round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : lineHeightPx ?? null;
    return {
      lineCount: lines.length,
      wrapOccurred: lines.length > 1,
      avgLineGapPx,
      maxLineWidthPx: round(Math.max(...lines.map((line) => line.width))),
      totalInkHeightPx: round(lines[lines.length - 1].y + lines[lines.length - 1].height - lines[0].y),
    };
  };

  return nodes
    .map((element) => {
      const style = getComputedStyle(element);
      const layout = element.getBoundingClientRect();
      const tag = element.tagName.toLowerCase();
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        layout.width > 0 &&
        layout.height > 0;
      const text = directText(element);
      const isText = Boolean(text) && /^(h[1-6]|p|li|span|a|b|strong|td|th|figcaption|label)$/i.test(tag);
      const isVector = ["svg", "path", "rect", "line", "circle", "polygon"].includes(tag);
      const hasComplexVisual =
        tag === "svg" ||
        style.filter !== "none" ||
        style.maskImage !== "none" ||
        style.clipPath !== "none" ||
        style.backgroundImage.includes("gradient") ||
        style.mixBlendMode !== "normal";

      let conversionType = "shape";
      if (isText) conversionType = "text";
      else if (tag === "img" || tag === "image") conversionType = "image";
      else if (tag === "video" || tag === "source") conversionType = "video";
      else if (tag === "table") conversionType = "table";
      else if (isVector) conversionType = "shape";
      else if (hasComplexVisual) conversionType = "complex-image";

      const layoutBox = roundBox(layout);
      const contentBox = contentBoxFromLayout(layout, style);
      let geometry = layoutBox;
      let boundsSource = "layout-box";
      let inkBox = null;
      let lines = null;
      let metrics = null;
      let textStyle = null;

      if (isText) {
        lines = extractTextLines(element);
        const ink = textInkBox(element, lines);
        if (ink && ink.width > 0 && ink.height > 0) {
          inkBox = roundBox(ink);
          geometry = inkBox;
          boundsSource = "text-ink";
        }

        const fontSizePx = Number.parseFloat(style.fontSize);
        const lineHeightRaw = style.lineHeight;
        const lineHeightPx =
          lineHeightRaw && lineHeightRaw !== "normal" && Number.isFinite(Number.parseFloat(lineHeightRaw))
            ? Number.parseFloat(lineHeightRaw)
            : null;
        const letterSpacingPx = (() => {
          if (!style.letterSpacing || style.letterSpacing === "normal") return 0;
          const value = Number.parseFloat(style.letterSpacing);
          return Number.isFinite(value) ? value : 0;
        })();
        const lineHeightRatio =
          Number.isFinite(fontSizePx) && fontSizePx > 0 && Number.isFinite(lineHeightPx)
            ? Number((lineHeightPx / fontSizePx).toFixed(4))
            : null;
        metrics = lineMetrics(lines, lineHeightPx);
        textStyle = {
          fontFamily: style.fontFamily,
          fontFamilyCss: style.fontFamily,
          fontFamilyUsed: resolveUsedFont(style, text),
          fontSizePx: Number.isFinite(fontSizePx) ? fontSizePx : null,
          fontSizePtExact: Number.isFinite(fontSizePx) ? round(fontSizePx * 0.6) : null,
          fontSizePt: Number.isFinite(fontSizePx) ? Math.round(fontSizePx * 0.6) : null,
          fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
          fontStyle: style.fontStyle,
          lineHeightPx,
          lineHeightRatio,
          lineHeightCss: lineHeightRaw,
          letterSpacingPx,
          letterSpacingPtExact: round(letterSpacingPx * 0.6),
          letterSpacingPt: Math.round(letterSpacingPx * 0.6 * 100) / 100,
          color: rgb(style.color),
          textAlign: style.textAlign,
          verticalAlign: style.verticalAlign,
          whiteSpace: style.whiteSpace,
          wordBreak: style.wordBreak,
          overflowWrap: style.overflowWrap,
          textTransform: style.textTransform,
          writingMode: style.writingMode,
          direction: style.direction,
          textDecorationLine: style.textDecorationLine,
          backgroundColor: rgb(style.backgroundColor),
          borderTopColor: rgb(style.borderTopColor),
          borderTopWidthPx: Number.parseFloat(style.borderTopWidth) || 0,
          borderRightWidthPx: Number.parseFloat(style.borderRightWidth) || 0,
          borderBottomWidthPx: Number.parseFloat(style.borderBottomWidth) || 0,
          borderLeftWidthPx: Number.parseFloat(style.borderLeftWidth) || 0,
          paddingTopPx: Number.parseFloat(style.paddingTop) || 0,
          paddingRightPx: Number.parseFloat(style.paddingRight) || 0,
          paddingBottomPx: Number.parseFloat(style.paddingBottom) || 0,
          paddingLeftPx: Number.parseFloat(style.paddingLeft) || 0,
          borderRadiusPx: Number.parseFloat(style.borderTopLeftRadius) || 0,
          objectFit: style.objectFit,
          overflow: style.overflow,
          boxSizing: style.boxSizing,
        };
      }

      const baseStyle = {
        fontFamily: style.fontFamily,
        fontSizePx: Number.parseFloat(style.fontSize),
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        lineHeightPx:
          style.lineHeight && style.lineHeight !== "normal" && Number.isFinite(Number.parseFloat(style.lineHeight))
            ? Number.parseFloat(style.lineHeight)
            : null,
        lineHeightRatio: (() => {
          const fontSizePx = Number.parseFloat(style.fontSize);
          const lineHeightPx = Number.parseFloat(style.lineHeight);
          if (!Number.isFinite(fontSizePx) || fontSizePx <= 0 || !Number.isFinite(lineHeightPx) || style.lineHeight === "normal") {
            return null;
          }
          return Number((lineHeightPx / fontSizePx).toFixed(4));
        })(),
        letterSpacingPx: (() => {
          if (!style.letterSpacing || style.letterSpacing === "normal") return 0;
          const value = Number.parseFloat(style.letterSpacing);
          return Number.isFinite(value) ? value : 0;
        })(),
        color: rgb(style.color),
        textAlign: style.textAlign,
        verticalAlign: style.verticalAlign,
        backgroundColor: rgb(style.backgroundColor),
        borderTopColor: rgb(style.borderTopColor),
        borderTopWidthPx: Number.parseFloat(style.borderTopWidth) || 0,
        borderRightWidthPx: Number.parseFloat(style.borderRightWidth) || 0,
        borderBottomWidthPx: Number.parseFloat(style.borderBottomWidth) || 0,
        borderLeftWidthPx: Number.parseFloat(style.borderLeftWidth) || 0,
        paddingTopPx: Number.parseFloat(style.paddingTop) || 0,
        paddingRightPx: Number.parseFloat(style.paddingRight) || 0,
        paddingBottomPx: Number.parseFloat(style.paddingBottom) || 0,
        paddingLeftPx: Number.parseFloat(style.paddingLeft) || 0,
        borderRadiusPx: Number.parseFloat(style.borderTopLeftRadius) || 0,
        objectFit: style.objectFit,
        overflow: style.overflow,
        boxSizing: style.boxSizing,
      };

      return {
        id: ids.get(element),
        parentId: (element.parentElement && ids.get(element.parentElement)) || null,
        selector: element.id ? `#${CSS.escape(element.id)}` : tag,
        classes: Array.from(element.classList || []).sort(),
        type: conversionType,
        conversionType,
        visible,
        editable: ["text", "shape", "table"].includes(conversionType),
        source: tag === "img" ? element.getAttribute("src") : null,
        text: isText ? text : null,
        isLeafText: isText,
        boundsSource,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        layoutBox,
        contentBox,
        inkBox,
        boxes: {
          layout: layoutBox,
          content: contentBox,
          ink: inkBox,
        },
        // PPT 可编辑文本框建议用 layout/content；主几何仍保留 text-ink 以兼容既有组装。
        pptTextBoxHint: isText ? "layoutBox" : null,
        lines: isText ? lines : null,
        metrics: isText ? metrics : null,
        zIndex: style.zIndex === "auto" ? null : Number(style.zIndex),
        opacity: Number(style.opacity),
        transform: style.transform === "none" ? null : style.transform,
        style: isText ? { ...baseStyle, ...textStyle } : baseStyle,
        downgrade:
          conversionType === "complex-image"
            ? { required: true, reason: "SVG、滤镜、遮罩、裁切或渐变等浏览器组合视觉" }
            : { required: false },
      };
    })
    .filter((element) => element.visible);
}

/** 框线图只画定位有用的节点：文字、图片/视频，以及无子定位节点时的内容元素。 */
const GUIDE_STRUCTURAL_TAGS = new Set([
  "section",
  "main",
  "header",
  "footer",
  "nav",
  "article",
  "aside",
  "colgroup",
  "col",
  "thead",
  "tbody",
  "tfoot",
  "tr",
]);

const GUIDE_STRUCTURAL_CLASS_RE =
  /^(slide|layout-|page-fill|slide-content|slide-heading|statement-layout|split-|flow-row|tag-row|page-grid|content-grid|grid-row|grid-col|agenda-content)/i;

// Logo、目录页左侧 CONTENT/目录、母版装饰线等不进框线图。
const GUIDE_EXCLUDE_CLASS_RE =
  /(^|\s)(brand-logo|brand-logo--white|brand-logo--color|agenda-word|agenda-title|agenda-cue|master-rule|master-rule__fade|master-rule__blue|master-rule__light|cover-rule__blue|cover-rule__fade|cover-rule__light|section-divider|closing-divider)(\s|$)/i;

// 这些是“大容器壳”：当内部已有文字/图片等定位框时，不再画外框。
const GUIDE_SHELL_CLASS_RE =
  /(^|\s|-)(mini-card|kpi-card|kpi-row|kpi|note-box|level-item|summary-bar|media-frame|flow-step|roadmap-item|dim-card|panel|card-shell)(\s|-|$)/i;

const GUIDE_CONTENT_CLASS_RE =
  /(^|\s|-)(panel-title|chip|badge|cover-|section-number|closing-|tag)(\s|-|$)/i;

function hasVisibleSurface(element) {
  const style = element.style || {};
  const bg = style.backgroundColor || style.background || null;
  const border =
    Number(style.borderTopWidthPx || 0) +
    Number(style.borderRightWidthPx || 0) +
    Number(style.borderBottomWidthPx || 0) +
    Number(style.borderLeftWidthPx || 0);
  if (bg && String(bg).toUpperCase() !== "TRANSPARENT") return true;
  if (border > 0) return true;
  return false;
}

function isLogoElement(element) {
  const classes = Array.isArray(element.classes) ? element.classes : [];
  if (classes.some((name) => /brand-logo|^logo$/i.test(String(name)))) return true;
  const source = String(element.source || "");
  if (/logo/i.test(source)) return true;
  const selector = String(element.selector || "");
  if (/logo/i.test(selector)) return true;
  return false;
}

function isFullCanvasElement(element) {
  const w = Number(element.width) || 0;
  const h = Number(element.height) || 0;
  return w >= STAGE_WIDTH - 8 && h >= STAGE_HEIGHT - 8;
}

function elementClassText(element) {
  return (Array.isArray(element.classes) ? element.classes : []).join(" ");
}

function isGuideChromeElement(element) {
  return GUIDE_EXCLUDE_CLASS_RE.test(elementClassText(element));
}

function isGuideShellElement(element) {
  const type = element.type || element.conversionType || "";
  const tag = String(element.selector || "").replace(/^#.*$/, "").split(/[.#\[]/)[0].toLowerCase();
  const classText = elementClassText(element);
  if (type === "table" || tag === "table") return true;
  if (GUIDE_SHELL_CLASS_RE.test(classText)) return true;
  if ((type === "complex-image" || type === "shape") && (tag === "li" || /agenda-item/i.test(classText))) return true;
  return false;
}

export function isGuideFrameElement(element, options = {}) {
  if (!element || element.visible === false) return false;
  if (options.excludedIds instanceof Set && options.excludedIds.has(element.id)) return false;

  const type = element.type || element.conversionType || "";
  const tag = String(element.selector || "").replace(/^#.*$/, "").split(/[.#\[]/)[0].toLowerCase();
  const classes = Array.isArray(element.classes) ? element.classes : [];
  const classText = classes.join(" ");

  if (isLogoElement(element)) return false;
  if (isGuideChromeElement(element)) return false;
  if (isFullCanvasElement(element)) return false;

  // 1) 文字定位：保留叶子文本（含 P3 主副标题）
  if (type === "text") return element.isLeafText !== false;

  // 2) 图片/视频资源定位
  if (type === "image" || type === "video" || tag === "img" || tag === "video" || tag === "source") {
    return true;
  }

  // 3) 线条
  if (type === "line") return true;

  // 表格/复杂视觉先入候选，select 阶段再按子节点去壳
  if (type === "table" || type === "complex-image") return true;

  if (GUIDE_STRUCTURAL_TAGS.has(tag)) return false;
  if (classes.some((name) => GUIDE_STRUCTURAL_CLASS_RE.test(name))) return false;
  const w = Number(element.width) || 0;
  const h = Number(element.height) || 0;
  if (w >= STAGE_WIDTH - 8 && h >= 500) return false;

  if (type === "shape") {
    if (GUIDE_CONTENT_CLASS_RE.test(classText)) return true;
    if (GUIDE_SHELL_CLASS_RE.test(classText)) return true;
    if (hasVisibleSurface(element)) return true;
    return false;
  }

  return false;
}

function collectGuideExcludedIds(elements) {
  const list = elements || [];
  const byId = new Map(list.map((element) => [element.id, element]));
  const excluded = new Set();

  const markSubtree = (rootId) => {
    if (!rootId || excluded.has(rootId)) return;
    excluded.add(rootId);
    for (const element of list) {
      if (element.parentId === rootId) markSubtree(element.id);
    }
  };

  for (const element of list) {
    const classText = elementClassText(element);
    if (isLogoElement(element)) {
      markSubtree(element.id);
      continue;
    }
    if (isGuideChromeElement(element)) {
      excluded.add(element.id);
      continue;
    }
    const text = String(element.text || "").replace(/\s+/g, "").trim();
    if (/^CONTENTS?$/i.test(text) || text === "目录" || text === "目" || text === "录") {
      let cur = element;
      let guard = 0;
      let agendaSide = false;
      while (cur && guard < 20) {
        const parentClass = elementClassText(cur);
        if (/(^|\s)(agenda-word|agenda-title|agenda-cue|agenda-content)(\s|$)/i.test(parentClass)) {
          agendaSide = true;
          break;
        }
        const parent = cur.parentId ? byId.get(cur.parentId) : null;
        if (!parent) break;
        cur = parent;
        guard += 1;
      }
      if (agendaSide) excluded.add(element.id);
    }
  }
  return excluded;
}

function childrenOf(list, parentId) {
  return list.filter((element) => element.parentId === parentId);
}

function hasPositioningDescendant(list, rootId, isPositionLeaf) {
  const stack = childrenOf(list, rootId);
  const seen = new Set();
  while (stack.length) {
    const node = stack.pop();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    if (isPositionLeaf(node)) return true;
    stack.push(...childrenOf(list, node.id));
  }
  return false;
}

export function selectGuideFrameElements(elements) {
  const list = elements || [];
  const excludedIds = collectGuideExcludedIds(list);
  const base = list.filter((element) => isGuideFrameElement(element, { excludedIds }));
  const baseIds = new Set(base.map((element) => element.id));

  const isPositionLeaf = (element) => {
    const type = element.type || element.conversionType || "";
    if (type === "text" || type === "image" || type === "video") {
      return baseIds.has(element.id) || isGuideFrameElement(element, { excludedIds });
    }
    if (!isGuideShellElement(element) && (type === "shape" || type === "line" || type === "complex-image")) {
      return baseIds.has(element.id);
    }
    return false;
  };

  return base.filter((element) => {
    if (!isGuideShellElement(element)) return true;
    // 大容器壳：内部已有文字/图片等定位框时不画外框
    if (hasPositioningDescendant(list, element.id, isPositionLeaf)) return false;
    return true;
  });
}

export function buildGuideFrameSvg(elements) {
  const boxes = [];
  const guideElements = selectGuideFrameElements(elements);
  for (const element of guideElements) {
    const stroke =
      element.type === "text" ? "#ff00a8" : element.type === "image" || element.type === "video" ? "#00a86b" : "#ff7a00";
    boxes.push(
      `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="none" stroke="${stroke}" stroke-width="1"/>` +
        `<text x="${element.x + 2}" y="${element.y + 13}" fill="${stroke}" font-size="12">${String(element.id).replace(/[<&]/g, "")}</text>`
    );
    if (element.type === "text" && Array.isArray(element.lines)) {
      for (const line of element.lines) {
        boxes.push(
          `<rect x="${line.x}" y="${line.y}" width="${line.width}" height="${line.height}" fill="none" stroke="#00c2ff" stroke-width="0.75" stroke-dasharray="3 2"/>`
        );
      }
    }
  }
  // 不再绘制 1600×900 画布外框；viewBox 仅作坐标系。
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">${boxes.join("")}</svg>`;
}

export function buildCoordinateMapDocument(slides, extra = {}) {
  return {
    canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620, pxToPt: PX_TO_PT },
    boundsPolicy: {
      text: "text-ink",
      nonText: "layout-box",
      pptTextBox: "layout-box",
      notes:
        "Leaf text primary x/y/width/height uses ink union for visual alignment audits. boxes.layout/content/ink are all retained. PPT editable text boxes should start from boxes.layout (or content when padding matters). lines[] records actual wrap results from browser Range metrics.",
    },
    textMetricsPolicy: {
      lines: "per-character Range aggregation with 2px top tolerance",
      fontFamilyUsed: "document.fonts.check against computed font stack",
      lineHeight: "prefer computed px + ratio; normal stays null for role fallback",
      letterSpacing: "normal/invalid => 0",
    },
    generatedAt: new Date().toISOString(),
    ...extra,
    slides,
  };
}

export function buildTextMetricsDocument(slides, extra = {}) {
  return {
    canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620, pxToPt: PX_TO_PT },
    generatedAt: new Date().toISOString(),
    ...extra,
    slides: slides.map((slide) => ({
      page: slide.page,
      href: slide.href,
      screenshot: slide.screenshot || null,
      guideFrame: slide.guideFrame || null,
      texts: (slide.elements || [])
        .filter((element) => element.type === "text" && element.isLeafText)
        .map((element) => ({
          id: element.id,
          parentId: element.parentId,
          selector: element.selector,
          classes: element.classes,
          text: element.text,
          boundsSource: element.boundsSource,
          pptTextBoxHint: element.pptTextBoxHint,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          boxes: element.boxes,
          style: {
            fontFamilyCss: element.style.fontFamilyCss || element.style.fontFamily,
            fontFamilyUsed: element.style.fontFamilyUsed || null,
            fontSizePx: element.style.fontSizePx,
            fontSizePtExact:
              element.style.fontSizePtExact ??
              (Number.isFinite(element.style.fontSizePx) ? Number((element.style.fontSizePx * PX_TO_PT).toFixed(2)) : null),
            fontSizePt:
              element.style.fontSizePt ??
              (Number.isFinite(element.style.fontSizePx) ? Math.round(element.style.fontSizePx * PX_TO_PT) : null),
            fontWeight: element.style.fontWeight,
            fontStyle: element.style.fontStyle || "normal",
            color: element.style.color,
            textAlign: element.style.textAlign,
            verticalAlign: element.style.verticalAlign,
            lineHeightPx: element.style.lineHeightPx,
            lineHeightRatio: element.style.lineHeightRatio,
            letterSpacingPx: element.style.letterSpacingPx,
            letterSpacingPtExact:
              element.style.letterSpacingPtExact ?? Number(((element.style.letterSpacingPx || 0) * PX_TO_PT).toFixed(2)),
            letterSpacingPt:
              element.style.letterSpacingPt ?? Number(((element.style.letterSpacingPx || 0) * PX_TO_PT).toFixed(2)),
            whiteSpace: element.style.whiteSpace || null,
            wordBreak: element.style.wordBreak || null,
            overflowWrap: element.style.overflowWrap || null,
            textTransform: element.style.textTransform || null,
            writingMode: element.style.writingMode || null,
            direction: element.style.direction || null,
          },
          lines: element.lines || [],
          metrics: element.metrics || null,
        })),
    })),
  };
}

export async function writeP2SnapshotArtifacts({ deckRoot, slides, playwrightInfo = null, pageMapRecords = null }) {
  const output = path.join(deckRoot, "pptx", "P2");
  await mkdir(path.join(output, "guide-frames"), { recursive: true });

  const coordinateMap = buildCoordinateMapDocument(slides, {
    playwright: playwrightInfo,
  });
  const textMetrics = buildTextMetricsDocument(slides, {
    playwright: playwrightInfo,
  });

  await writeFile(path.join(output, "coordinate-map.json"), `${JSON.stringify(coordinateMap, null, 2)}\n`);
  await writeFile(path.join(output, "text-metrics.json"), `${JSON.stringify(textMetrics, null, 2)}\n`);

  if (pageMapRecords) {
    await writeFile(
      path.join(output, "page-map.json"),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), slides: pageMapRecords }, null, 2)}\n`
    );
  }

  return {
    output,
    coordinateMapPath: path.join(output, "coordinate-map.json"),
    textMetricsPath: path.join(output, "text-metrics.json"),
    guideFramesDir: path.join(output, "guide-frames"),
    textCount: textMetrics.slides.reduce((sum, slide) => sum + slide.texts.length, 0),
  };
}

export function slideArtifactName(slide) {
  return `${String(slide.page).padStart(2, "0")}-${path.basename(slide.href).replace(/\.html?$/i, "")}`;
}
