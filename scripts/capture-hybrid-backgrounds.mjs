#!/usr/bin/env node

/**
 * P3 混合版采集：
 * 1) 逐文本节点采集完整文字真值（不依赖元素白名单，混合内容父元素也不丢字）
 * 2) 隐藏全部文字字形（保留占位、图形、图片与伪元素），2× 截图为 JPEG
 *
 * 输出：pptx/P3/text-nodes.json、pptx/P3/backgrounds/*.jpg、backgrounds/manifest.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  assertDeckInput,
  prepareSlidePage,
  resolvePlaywright,
  startDeckServer,
} from "./pptx-html-utils.mjs";
import { slideArtifactName } from "./p2-dom-snapshot.mjs";

const SCALE = 2;
const JPEG_QUALITY = 92;

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/capture-hybrid-backgrounds.mjs <deck-root>\n");
  process.exit(64);
}

const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const stageDir = path.join(deckRoot, "pptx", "P3");
const backgroundDir = path.join(stageDir, "backgrounds");
await mkdir(backgroundDir, { recursive: true });

/** 页面内执行：采集完整文字真值。 */
function collectTextNodes() {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
  const WESTERN_ONLY = /times|arial|helvetica|georgia|garamond|cambria|calibri|verdana|tahoma|trebuchet|courier|palatino|symbol|wingdings/i;
  const round = (value) => Number(Number(value).toFixed(2));
  const roundBox = (box) => ({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });

  const unionRects = (rects) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;
    for (const rect of rects) {
      if (!rect || (rect.width <= 0 && rect.height <= 0)) continue;
      found = true;
      minX = Math.min(minX, rect.left !== undefined ? rect.left : rect.x);
      minY = Math.min(minY, rect.top !== undefined ? rect.top : rect.y);
      maxX = Math.max(maxX, (rect.left !== undefined ? rect.left : rect.x) + rect.width);
      maxY = Math.max(maxY, (rect.top !== undefined ? rect.top : rect.y) + rect.height);
    }
    if (!found) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const colorAlpha = (value) => {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/);
    if (!match) return 1;
    const parts = match[1].split(",").map((part) => part.trim());
    const alpha = parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
    return Number.isFinite(alpha) ? alpha : 1;
  };

  const toHex = (value) => {
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

  const resolveFont = (style, sample) => {
    const families = String(style.fontFamily || "")
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    const hasCjk = /[\u4e00-\u9fff]/.test(sample);
    for (const family of families) {
      if (GENERIC.has(family)) continue;
      if (hasCjk && WESTERN_ONLY.test(family)) continue;
      try {
        if (document.fonts?.check?.(`${style.fontStyle} ${style.fontWeight} 16px "${family}"`)) return family;
      } catch (_) {
        // ignore
      }
    }
    return families.find((family) => !GENERIC.has(family) && !(hasCjk && WESTERN_ONLY.test(family))) || families[0] || null;
  };

  const extractLines = (node) => {
    const value = node.nodeValue || "";
    const lines = [];
    let current = null;
    const range = document.createRange();
    const tolerance = 2;

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
      lines.push({ index: lines.length, text, rawText: current.text, ...roundBox(box) });
      current = null;
    };
    for (let index = 0; index < value.length; index += 1) {
      try {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
      } catch (_) {
        continue;
      }
      const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
      if (!rects.length) continue;
      for (const rect of rects) {
        if (!current) {
          current = { text: value[index], rects: [rect], top: rect.top, bottom: rect.top + rect.height };
          continue;
        }
        const sameLine =
          Math.abs(rect.top - current.top) <= tolerance ||
          (rect.top >= current.top - tolerance && rect.top < current.bottom - tolerance);
        if (!sameLine) {
          flush();
          current = { text: value[index], rects: [rect], top: rect.top, bottom: rect.top + rect.height };
          continue;
        }
        current.text += value[index];
        current.rects.push(rect);
        current.top = Math.min(current.top, rect.top);
        current.bottom = Math.max(current.bottom, rect.top + rect.height);
      }
    }
    flush();
    if (typeof range.detach === "function") range.detach();
    return lines;
  };

  const root = document.querySelector(".slide") || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts = [];
  let order = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue || "";
    if (!value.replace(/[\s\u00a0]+/g, "")) continue;
    const element = node.parentElement;
    if (!element || element.namespaceURI === SVG_NS) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) continue;

    // 竖排文字的方向与字位无法用横排文本框还原；半透明文字丢 alpha 会明显变深。
    // 这两类文字保留在背景位图中，不生成原生文本框。
    const alpha = colorAlpha(style.color);
    const bitmapOnly = String(style.writingMode || "").startsWith("vertical")
      ? "vertical-writing"
      : alpha < 0.99
        ? "translucent"
        : null;

    const lines = extractLines(node);
    if (!lines.length) continue;
    const box = unionRects(lines);
    if (!box || box.width <= 0 || box.height <= 0) continue;

    const fontSizePx = Number.parseFloat(style.fontSize);
    const lineHeightRaw = style.lineHeight;
    const lineHeightPx =
      lineHeightRaw && lineHeightRaw !== "normal" && Number.isFinite(Number.parseFloat(lineHeightRaw))
        ? Number.parseFloat(lineHeightRaw)
        : null;
    const letterSpacingPx =
      !style.letterSpacing || style.letterSpacing === "normal" ? 0 : Number.parseFloat(style.letterSpacing) || 0;
    const gaps = [];
    for (let i = 1; i < lines.length; i += 1) gaps.push(round(lines[i].y - lines[i - 1].y));
    const text = lines.map((line) => line.text).join(" ");
    const tag = element.tagName.toLowerCase();
    const classList = Array.from(element.classList);
    const selector = classList.length ? `${tag}.${classList.join(".")}` : tag;

    texts.push({
      id: `t${order + 1}`,
      selector,
      classes: classList,
      text,
      bitmapOnly,
      boundsSource: "text-line-box",
      pptTextBoxHint: "layoutBox",
      x: round(box.x),
      y: round(box.y),
      width: round(box.width),
      height: round(box.height),
      boxes: {
        layout: roundBox(box),
        content: roundBox(box),
        ink: roundBox(box),
      },
      style: {
        fontFamilyCss: style.fontFamily,
        fontFamilyUsed: resolveFont(style, text),
        fontSizePx: Number.isFinite(fontSizePx) ? fontSizePx : null,
        fontSizePtExact: Number.isFinite(fontSizePx) ? round(fontSizePx * 0.6) : null,
        fontSizePt: Number.isFinite(fontSizePx) ? Math.round(fontSizePx * 0.6) : null,
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        fontStyle: style.fontStyle,
        color: toHex(style.color),
        textAlign: style.textAlign,
        verticalAlign: style.verticalAlign,
        lineHeightPx,
        lineHeightRatio:
          Number.isFinite(fontSizePx) && fontSizePx > 0 && Number.isFinite(lineHeightPx)
            ? Number((lineHeightPx / fontSizePx).toFixed(4))
            : null,
        letterSpacingPx,
        letterSpacingPtExact: round(letterSpacingPx * 0.6),
        letterSpacingPt: Math.round(letterSpacingPx * 0.6 * 100) / 100,
        whiteSpace: style.whiteSpace,
        wordBreak: style.wordBreak,
        overflowWrap: style.overflowWrap,
        textTransform: style.textTransform,
        direction: style.direction,
        writingMode: style.writingMode,
      },
      lines,
      metrics: {
        lineCount: lines.length,
        wrapOccurred: lines.length > 1,
        avgLineGapPx: gaps.length ? round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : lineHeightPx,
        maxLineWidthPx: round(Math.max(...lines.map((line) => line.width))),
        totalInkHeightPx: round(lines[lines.length - 1].y + lines[lines.length - 1].height - lines[0].y),
      },
    });
    order += 1;
  }

  return texts;
}

/**
 * 把非空文本节点包进 visibility:hidden 的 inline span。
 * 不用 color:transparent，否则 ::before/::after 的字形装饰（如流程箭头）会一起消失。
 * 竖排与半透明文字不做原生文本框，字形必须留在背景里，跳过隐藏。
 */
function hideTextGlyphs() {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const root = document.querySelector(".slide") || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let hidden = 0;
  let kept = 0;
  for (const node of nodes) {
    if (!node.nodeValue || !node.nodeValue.replace(/[\s\u00a0]+/g, "")) continue;
    if (!node.parentElement || node.parentElement.namespaceURI === SVG_NS) continue;
    const style = getComputedStyle(node.parentElement);
    const alphaMatch = String(style.color).match(/rgba?\(([^)]+)\)/);
    const alphaParts = alphaMatch ? alphaMatch[1].split(",") : [];
    const alpha = alphaParts.length > 3 ? Number.parseFloat(alphaParts[3]) : 1;
    if (String(style.writingMode || "").startsWith("vertical") || (Number.isFinite(alpha) && alpha < 0.99)) {
      kept += 1;
      continue;
    }
    const holder = document.createElement("span");
    holder.setAttribute("data-hybrid-hidden-text", "true");
    holder.style.visibility = "hidden";
    node.parentNode.insertBefore(holder, node);
    holder.appendChild(node);
    hidden += 1;
  }
  return { hidden, kept };
}

const playwright = await resolvePlaywright(deckRoot);
const { chromium } = playwright.module;
process.stdout.write(`使用 Playwright：${playwright.source} (${playwright.modulePath})\n`);

const server = await startDeckServer(deckRoot);
const browser = await chromium.launch({ headless: true, executablePath: playwright.executablePath });
const context = await browser.newContext({
  viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
  deviceScaleFactor: SCALE,
});

const pages = [];
const textSlides = [];

try {
  for (const slide of deck.slides) {
    const page = await context.newPage();
    const href = slide.href.replace(/^\/+/, "");
    const name = slideArtifactName(slide);

    await prepareSlidePage(page, new URL(href, server.url).href);

    const dims = await page.evaluate(() => {
      const rect = document.querySelector(".slide")?.getBoundingClientRect();
      return rect && { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
    });
    if (!dims || dims.width !== STAGE_WIDTH || dims.height !== STAGE_HEIGHT || dims.left !== 0 || dims.top !== 0) {
      throw new Error(`${slide.href} 舞台不是左上对齐的 1600×900：${JSON.stringify(dims)}`);
    }

    // 先取文字真值，再隐藏字形截图：两者同一渲染态。
    const texts = await page.evaluate(collectTextNodes);
    if (!texts.length) throw new Error(`${slide.href} 未采集到任何文字节点`);
    const missingColor = texts.filter((item) => !item.style.color);
    if (missingColor.length) {
      throw new Error(`${slide.href} 有 ${missingColor.length} 个文字节点缺少有效颜色`);
    }

    const hidden = await page.evaluate(hideTextGlyphs);
    if (hidden.hidden + hidden.kept !== texts.length) {
      throw new Error(
        `${slide.href} 采集 ${texts.length} 个文字节点，隐藏 ${hidden.hidden}、保留 ${hidden.kept}；两者之和必须一致`
      );
    }

    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );

    const file = `${name}@${SCALE}x.jpg`;
    await page.screenshot({
      path: path.join(backgroundDir, file),
      type: "jpeg",
      quality: JPEG_QUALITY,
      fullPage: false,
    });

    pages.push({
      page: slide.page,
      href: slide.href,
      title: slide.title || "",
      background: `P3/backgrounds/${file}`,
      hiddenTextNodes: hidden.hidden,
      bitmapOnlyTextNodes: hidden.kept,
      width: STAGE_WIDTH * SCALE,
      height: STAGE_HEIGHT * SCALE,
    });
    textSlides.push({
      page: slide.page,
      href: slide.href,
      title: slide.title || "",
      screenshot: `P2/html-screenshots/${name}.png`,
      texts,
    });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const generatedAt = new Date().toISOString();
const manifest = {
  stage: "P3",
  purpose: "hybrid-background",
  scale: SCALE,
  jpegQuality: JPEG_QUALITY,
  canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
  generatedAt,
  playwright: { source: playwright.source, modulePath: playwright.modulePath, executablePath: playwright.executablePath },
  pages,
};
await writeFile(path.join(backgroundDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const textNodes = {
  canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620, pxToPt: 0.6 },
  generatedAt,
  source: "capture-hybrid-backgrounds.mjs (per text node, Range geometry)",
  policy: {
    granularity: "text-node",
    geometry: "union of Range client rects per line; hard breaks from lines[]",
    note: "P2/text-metrics.json 以元素为单位且受标签白名单限制，会漏掉混合内容父元素中的直接文字；P3 以文本节点为单位，保证不漏字。",
  },
  slides: textSlides,
};
await writeFile(path.join(stageDir, "text-nodes.json"), `${JSON.stringify(textNodes, null, 2)}\n`, "utf8");

const totalTexts = textSlides.reduce((sum, slide) => sum + slide.texts.length, 0);
process.stdout.write(
  `已生成 ${pages.length} 张无文字背景与 ${totalTexts} 个文字节点：\n` +
    `- ${backgroundDir}\n` +
    `- ${path.join(stageDir, "text-nodes.json")}\n`
);
