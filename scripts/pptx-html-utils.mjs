import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 900;

export async function readDeckManifest(deckRoot) {
  const manifestPath = path.join(deckRoot, "assets", "deck.js");
  const source = await readFile(manifestPath, "utf8");
  const window = {};
  new Function("window", `"use strict";\n${source}`)(window);
  const deck = window.PPT_HTML_DECK;
  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) {
    throw new Error("assets/deck.js 未声明包含至少一页的 window.PPT_HTML_DECK.slides");
  }
  const pages = new Set();
  const hrefs = new Set();
  for (const slide of deck.slides) {
    if (!Number.isInteger(slide.page) || slide.page < 1 || typeof slide.href !== "string") {
      throw new Error("assets/deck.js 中每一页必须含正整数 page 与字符串 href");
    }
    if (pages.has(slide.page) || hrefs.has(slide.href)) throw new Error("assets/deck.js 含重复 page 或 href");
    pages.add(slide.page); hrefs.add(slide.href);
  }
  return deck;
}

export async function assertDeckInput(deckRoot) {
  for (const relativePath of ["index.html", "assets/ppt.css", "assets/deck.js", "assets/slide.js", "slides"]) {
    try { await stat(path.join(deckRoot, relativePath)); }
    catch { throw new Error(`缺少 deck 输入：${relativePath}`); }
  }
  return readDeckManifest(deckRoot);
}

export async function startDeckServer(deckRoot) {
  const root = path.resolve(deckRoot);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
      const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      const filePath = path.resolve(root, relativePath);
      if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) throw new Error("非法路径");
      const content = await readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extension] || "application/octet-stream";
      response.writeHead(200, { "content-type": mime, "cache-control": "no-store" }); response.end(content);
    } catch (error) {
      response.writeHead(error?.code === "ENOENT" ? 404 : 400, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  return { url: `http://127.0.0.1:${address.port}/`, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

export async function loadLocalPlaywright(deckRoot) {
  try {
    const modulePath = path.join(deckRoot, "node_modules", "playwright", "index.js");
    return await import(modulePath);
  } catch {
    throw new Error("未找到 deck 根目录的 playwright。本工具只使用项目本地依赖；请在 deck 根目录执行 npm install --save-dev playwright，并执行 npx playwright install chromium。");
  }
}

export async function prepareSlidePage(page, url) {
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(async () => {
    const style = document.createElement("style");
    style.textContent = `html,body,.viewport{width:1600px!important;height:900px!important;overflow:hidden!important}.frame{left:0!important;top:0!important;transform:none!important}.stage{transform:none!important}.slide-nav{display:none!important}*,*::before,*::after{animation:none!important;transition:none!important}`;
    document.head.append(style);
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
