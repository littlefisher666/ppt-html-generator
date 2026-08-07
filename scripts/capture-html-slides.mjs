#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { STAGE_HEIGHT, STAGE_WIDTH, assertDeckInput, prepareSlidePage, resolvePlaywright, startDeckServer } from "./pptx-html-utils.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) { process.stderr.write("用法: node scripts/capture-html-slides.mjs <deck-root>\n"); process.exit(64); }
const deckRoot = path.resolve(input); const deck = await assertDeckInput(deckRoot);
const stageOutput = path.join(deckRoot, "pptx", "P2");
const output = path.join(stageOutput, "html-screenshots"); await mkdir(output, { recursive: true });
const playwright = await resolvePlaywright(deckRoot);
const { chromium } = playwright.module;
process.stdout.write(`使用 Playwright：${playwright.source} (${playwright.modulePath})\n`);
const server = await startDeckServer(deckRoot);
const browser = await chromium.launch({ headless: true, executablePath: playwright.executablePath }); const context = await browser.newContext({ viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT }, deviceScaleFactor: 1 });
const records = [];
try {
  for (const slide of deck.slides) {
    const page = await context.newPage(); const href = slide.href.replace(/^\/+/, ""); const name = path.basename(href).replace(/\.html?$/i, ""); const screenshot = `${String(slide.page).padStart(2, "0")}-${name}.png`;
    await prepareSlidePage(page, new URL(href, server.url).href);
    const dimensions = await page.evaluate(() => {
      const slideElement = document.querySelector(".slide");
      const rect = slideElement?.getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        navigationCount: document.querySelectorAll("[data-ppt-ui], .slide-nav").length,
        slide: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      };
    });
    if (dimensions.width !== STAGE_WIDTH || dimensions.height !== STAGE_HEIGHT) throw new Error(`${slide.href} 截图视口不是 1600×900`);
    if (!dimensions.slide || dimensions.slide.left !== 0 || dimensions.slide.top !== 0 || dimensions.slide.width !== STAGE_WIDTH || dimensions.slide.height !== STAGE_HEIGHT) throw new Error(`${slide.href} 截图舞台未固定为左上对齐的 1600×900`);
    if (dimensions.navigationCount !== 0) throw new Error(`${slide.href} 截图仍含翻页或交互控件`);
    await page.screenshot({ path: path.join(output, screenshot), fullPage: false });
    records.push({ page: slide.page, href: slide.href, title: slide.title || "", screenshot: `html-screenshots/${screenshot}`, width: STAGE_WIDTH, height: STAGE_HEIGHT }); await page.close();
  }
} finally { await browser.close(); await server.close(); }
await writeFile(path.join(stageOutput, "page-map.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), slides: records }, null, 2)}\n`);
process.stdout.write(`已生成 ${records.length} 张 HTML 基准截图：${output}\n`);
