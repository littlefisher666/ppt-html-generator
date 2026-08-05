import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
  const resolved = await resolvePlaywright(deckRoot);
  return resolved.module;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}


async function importPlaywrightModule(modulePath) {
  const href = modulePath.startsWith("file:") ? modulePath : pathToFileURL(modulePath).href;
  const module = await import(href);
  const resolved = module?.chromium?.launch ? module : module?.default?.chromium?.launch ? module.default : null;
  if (!resolved?.chromium?.launch) {
    throw new Error(`已找到 playwright 模块，但接口不可用：${modulePath}`);
  }
  return resolved;
}

async function resolveGlobalPlaywrightModulePath() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  try {
    const { stdout } = await execFileAsync("npm", ["root", "-g"], {
      encoding: "utf8",
      timeout: 15000,
    });
    const globalRoot = String(stdout || "").trim();
    if (!globalRoot) return null;
    const modulePath = path.join(globalRoot, "playwright", "index.js");
    if (await pathExists(modulePath)) return modulePath;
  } catch {
    // ignore and fall through
  }
  return null;
}

/**
 * 按固定优先级解析 Playwright：
 * 1. deck 本地：<deck-root>/node_modules/playwright
 * 2. 全局 npm：`npm root -g`/playwright
 * 找到包后，只接受该包的 chromium.executablePath() 指向的浏览器。不得扫描缓存选择其他 revision，
 * 也不得接受 PLAYWRIGHT_EXECUTABLE_PATH 或系统 Chrome / Edge；否则基准截图不可复现。
 */
export async function resolvePlaywright(deckRoot) {
  const root = path.resolve(deckRoot);
  const candidates = [
    {
      source: "deck-local",
      modulePath: path.join(root, "node_modules", "playwright", "index.js"),
      installHint: `在 deck 根目录执行 npm install --save-dev playwright && npx playwright install chromium`,
    },
  ];

  const globalModulePath = await resolveGlobalPlaywrightModulePath();
  if (globalModulePath) {
    candidates.push({
      source: "global",
      modulePath: globalModulePath,
      installHint: `使用全局 Playwright 安装浏览器：npx --yes playwright install chromium`,
    });
  }

  const inspected = [];
  for (const candidate of candidates) {
    if (!(await pathExists(candidate.modulePath))) {
      inspected.push(`${candidate.source}: 包不存在 (${candidate.modulePath})`);
      continue;
    }
    try {
      const module = await importPlaywrightModule(candidate.modulePath);
      const executablePath = module.chromium.executablePath();
      const browserReady = await pathExists(executablePath);
      if (!browserReady) {
        inspected.push(`${candidate.source}: 包可用，但 Chromium 未安装 (${module.chromium.executablePath()})`);
        continue;
      }
      return {
        source: candidate.source,
        modulePath: candidate.modulePath,
        executablePath,
        executableSource: "package-default",
        browserReady: true,
        module,
      };
    } catch (error) {
      inspected.push(`${candidate.source}: 加载失败 (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  const hasLocalPackage = await pathExists(path.join(root, "node_modules", "playwright", "index.js"));
  const hasGlobalPackage = Boolean(globalModulePath);
  const lines = [
    "未找到可启动的 Playwright Chromium。",
    "检查顺序：1) deck 本地 node_modules/playwright；2) 全局 npm 安装的 playwright。",
    ...inspected.map((item) => `- ${item}`),
  ];
  if (!hasLocalPackage && !hasGlobalPackage) {
    lines.push("两处均未安装 playwright 包。优先在 deck 根目录执行：npm install --save-dev playwright && npx playwright install chromium");
    lines.push("或全局安装：npm install -g playwright && npx playwright install chromium");
  } else {
    lines.push("已找到 playwright 包，但对应 Chromium 未就绪。请只补装浏览器，不要重复安装包：");
    if (hasLocalPackage) lines.push(`- deck 本地：cd ${root} && npx playwright install chromium`);
    if (hasGlobalPackage) lines.push("- 全局：npx --yes playwright install chromium");
  }
  throw new Error(lines.join("\n"));
}

export async function prepareSlidePage(page, url) {
  await page.emulateMedia({ media: "screen", reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(async () => {
    const style = document.createElement("style");
    style.setAttribute("data-ppt-capture-style", "true");
    style.textContent = `
      html,body{margin:0!important;width:1600px!important;min-width:1600px!important;max-width:1600px!important;height:900px!important;min-height:900px!important;max-height:900px!important;overflow:hidden!important}
      .viewport{position:fixed!important;inset:0!important;width:1600px!important;height:900px!important;overflow:hidden!important}
      .frame{position:absolute!important;left:0!important;top:0!important;width:1600px!important;height:900px!important;transform:none!important}
      .stage,.slide{width:1600px!important;height:900px!important;transform:none!important}
      [data-ppt-ui],.slide-nav{display:none!important}
      *,*::before,*::after{animation:none!important;transition:none!important}
    `;
    document.head.append(style);
    document.querySelectorAll("[data-ppt-ui], .slide-nav").forEach((element) => element.remove());
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
