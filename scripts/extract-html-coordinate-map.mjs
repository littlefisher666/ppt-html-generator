#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { STAGE_HEIGHT, STAGE_WIDTH, assertDeckInput, prepareSlidePage, resolvePlaywright, startDeckServer } from "./pptx-html-utils.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) { process.stderr.write("用法: node scripts/extract-html-coordinate-map.mjs <deck-root>\n"); process.exit(64); }
const deckRoot = path.resolve(input); const deck = await assertDeckInput(deckRoot); const output = path.join(deckRoot, "exports", "pptx"); await mkdir(path.join(output, "guide-frames"), { recursive: true });
const playwright = await resolvePlaywright(deckRoot);
const { chromium } = playwright.module;
process.stdout.write(`使用 Playwright：${playwright.source} (${playwright.modulePath})\n`);
const server = await startDeckServer(deckRoot); const browser = await chromium.launch({ headless: true, executablePath: playwright.executablePath }); const context = await browser.newContext({ viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT }, deviceScaleFactor: 1 });
const slides = [];
try {
  for (const slide of deck.slides) {
    const page = await context.newPage(); await prepareSlidePage(page, new URL(slide.href.replace(/^\/+/, ""), server.url).href);
    const elements = await page.evaluate(() => Array.from(document.querySelectorAll(".slide, .slide *")).map((element, index) => {
      const style = getComputedStyle(element); const box = element.getBoundingClientRect(); const visible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
      const tag = element.tagName.toLowerCase(); const type = tag === "img" ? "image" : ["svg", "path", "rect", "line", "circle", "polygon"].includes(tag) ? "vector" : /^(h[1-6]|p|li|span|a|div|td|th)$/.test(tag) && element.textContent.trim() ? "text" : "shape";
      return { id: element.id || `${tag}-${index}`, selector: element.id ? `#${CSS.escape(element.id)}` : tag, classes: Array.from(element.classList || []).sort(), type, visible, editable: type === "text" || type === "shape", source: tag === "img" ? element.getAttribute("src") : null, text: type === "text" ? element.textContent.trim().replace(/\s+/g, " ") : null, x: Number(box.x.toFixed(2)), y: Number(box.y.toFixed(2)), width: Number(box.width.toFixed(2)), height: Number(box.height.toFixed(2)), zIndex: style.zIndex === "auto" ? null : Number(style.zIndex), opacity: Number(style.opacity), transform: style.transform === "none" ? null : style.transform };
    }).filter((element) => element.visible));
    const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="none" stroke="#ff00a8" stroke-width="2"/>${elements.map((e) => `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="none" stroke="#ff00a8" stroke-width="1"/><text x="${e.x + 2}" y="${e.y + 13}" fill="#ff00a8" font-size="12">${String(e.id).replace(/[<&]/g, "")}</text>`).join("")}</svg>`;
    const name = `${String(slide.page).padStart(2, "0")}-${path.basename(slide.href).replace(/\.html?$/i, "")}.svg`; await writeFile(path.join(output, "guide-frames", name), frame, "utf8"); slides.push({ page: slide.page, href: slide.href, guideFrame: `guide-frames/${name}`, elements }); await page.close();
  }
} finally { await browser.close(); await server.close(); }
await writeFile(path.join(output, "coordinate-map.json"), `${JSON.stringify({ canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620 }, generatedAt: new Date().toISOString(), slides }, null, 2)}\n`);
process.stdout.write(`已提取 ${slides.length} 页坐标并生成框线图：${path.join(output, "guide-frames")}\n`);
