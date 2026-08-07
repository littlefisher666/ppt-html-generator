#!/usr/bin/env node

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

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/extract-html-coordinate-map.mjs <deck-root>\n");
  process.exit(64);
}

const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const output = path.join(deckRoot, "pptx", "P2");
await mkdir(path.join(output, "guide-frames"), { recursive: true });

const playwright = await resolvePlaywright(deckRoot);
const { chromium } = playwright.module;
process.stdout.write(`使用 Playwright：${playwright.source} (${playwright.modulePath})\n`);

const server = await startDeckServer(deckRoot);
const browser = await chromium.launch({ headless: true, executablePath: playwright.executablePath });
const context = await browser.newContext({
  viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT },
  deviceScaleFactor: 1,
});

const slides = [];
try {
  for (const slide of deck.slides) {
    const page = await context.newPage();
    await prepareSlidePage(page, new URL(slide.href.replace(/^\/+/, ""), server.url).href);
    const elements = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".slide, .slide *"));
      const ids = new Map(
        nodes.map((node, index) => [node, node.id || `${node.tagName.toLowerCase()}-${index}`])
      );

      const rgb = (value) => {
        const match = String(value || "").match(/rgba?\(([^)]+)\)/);
        if (!match) return null;
        return match[1]
          .split(",")
          .slice(0, 3)
          .map((part) => Number(part.trim()).toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();
      };

      const directText = (node) =>
        Array.from(node.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

      const roundBox = (box) => ({
        x: Number(box.x.toFixed(2)),
        y: Number(box.y.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
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

      // Tight text ink bounds via Range over direct text nodes.
      const textInkBox = (element) => {
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
          const isText =
            Boolean(text) && /^(h[1-6]|p|li|span|a|b|strong|td|th|figcaption|label)$/i.test(tag);
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
          else if (tag === "img") conversionType = "image";
          else if (tag === "table") conversionType = "table";
          else if (isVector) conversionType = "shape";
          else if (hasComplexVisual) conversionType = "complex-image";

          const layoutBox = roundBox(layout);
          let geometry = layoutBox;
          let boundsSource = "layout-box";
          let inkBox = null;
          if (isText) {
            const ink = textInkBox(element);
            if (ink && ink.width > 0 && ink.height > 0) {
              inkBox = roundBox(ink);
              geometry = inkBox;
              boundsSource = "text-ink";
            }
          }

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
            inkBox,
            zIndex: style.zIndex === "auto" ? null : Number(style.zIndex),
            opacity: Number(style.opacity),
            transform: style.transform === "none" ? null : style.transform,
            style: {
              fontFamily: style.fontFamily,
              fontSizePx: Number.parseFloat(style.fontSize),
              fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
              lineHeightPx: Number.parseFloat(style.lineHeight) || null,
              color: rgb(style.color),
              textAlign: style.textAlign,
              verticalAlign: style.verticalAlign,
              backgroundColor: rgb(style.backgroundColor),
              borderTopColor: rgb(style.borderTopColor),
              borderTopWidthPx: Number.parseFloat(style.borderTopWidth),
              paddingTopPx: Number.parseFloat(style.paddingTop),
              paddingRightPx: Number.parseFloat(style.paddingRight),
              paddingBottomPx: Number.parseFloat(style.paddingBottom),
              paddingLeftPx: Number.parseFloat(style.paddingLeft),
              borderRadiusPx: Number.parseFloat(style.borderTopLeftRadius),
              objectFit: style.objectFit,
              overflow: style.overflow,
              boxSizing: style.boxSizing,
            },
            downgrade:
              conversionType === "complex-image"
                ? { required: true, reason: "SVG、滤镜、遮罩、裁切或渐变等浏览器组合视觉" }
                : { required: false },
          };
        })
        .filter((element) => element.visible);
    });

    const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="none" stroke="#ff00a8" stroke-width="2"/>${elements
      .map(
        (e) =>
          `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="none" stroke="#ff00a8" stroke-width="1"/><text x="${e.x + 2}" y="${e.y + 13}" fill="#ff00a8" font-size="12">${String(e.id).replace(/[<&]/g, "")}</text>`
      )
      .join("")}</svg>`;
    const name = `${String(slide.page).padStart(2, "0")}-${path.basename(slide.href).replace(/\.html?$/i, "")}.svg`;
    await writeFile(path.join(output, "guide-frames", name), frame, "utf8");
    slides.push({
      page: slide.page,
      href: slide.href,
      guideFrame: `guide-frames/${name}`,
      elements,
    });
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

await writeFile(
  path.join(output, "coordinate-map.json"),
  `${JSON.stringify(
    {
      canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620 },
      boundsPolicy: {
        text: "text-ink",
        nonText: "layout-box",
        notes:
          "Leaf text uses Range.getClientRects ink union (excludes element padding/line-box stretch where possible). Non-text keeps getBoundingClientRect layout box. layoutBox/inkBox retained for audit.",
      },
      generatedAt: new Date().toISOString(),
      slides,
    },
    null,
    2
  )}\n`
);
process.stdout.write(`已提取 ${slides.length} 页坐标并生成框线图：${path.join(output, "guide-frames")}\n`);
