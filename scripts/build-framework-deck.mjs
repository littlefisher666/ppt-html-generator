#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { STAGE_HEIGHT, STAGE_WIDTH, assertDeckInput } from "./pptx-html-utils.mjs";
import { brandAssetPaths, detectDeckBrand } from "./pptx-brand-utils.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/build-framework-deck.mjs DECK_ROOT\n");
  process.exit(64);
}

const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const outputDir = path.join(deckRoot, "pptx", "P3");
const coordinateMapPath = path.join(deckRoot, "pptx", "P2", "coordinate-map.json");
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pythonBuilder = path.join(scriptsDir, "build-framework-deck-pptx.py");
const sharedBuilder = path.join(scriptsDir, "build-shared-template.mjs");
const agendaBuilder = path.join(scriptsDir, "build-agenda-template.mjs");
const LAYOUTS = ["cover", "agenda", "section", "content", "closing", "title-only"];

async function pathExists(target) {
  try { await stat(target); return true; } catch { return false; }
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || command + " exit " + code));
    });
  });
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html) {
  return decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function firstMatch(html, re) {
  const match = html.match(re);
  return match ? match[1] : "";
}

function allMatches(html, re) {
  const values = [];
  let match;
  const pattern = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  while ((match = pattern.exec(html))) values.push(match[1]);
  return values;
}

function detectLayout(html) {
  for (const layout of LAYOUTS) {
    const re = new RegExp("class=[\"'][^\"']*\\blayout-" + layout + "\\b[^\"']*[\"']", "i");
    if (re.test(html)) return layout === "title-only" ? "content" : layout;
  }
  return null;
}

function extractCover(html) {
  const titleBox = firstMatch(html, /<div[^>]*class=["'][^"']*cover-title-box[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const title = stripTags(firstMatch(titleBox || html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
  const subtitle = stripTags(firstMatch(html, /<p[^>]*class=["'][^"']*subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
  const metaBlock = firstMatch(html, /<div[^>]*class=["'][^"']*cover-meta[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const metaLines = allMatches(metaBlock || "", /<p\b[^>]*>([\s\S]*?)<\/p>/i).map(stripTags).filter(Boolean);
  return { title, subtitle, metaLines };
}

function extractSection(html) {
  return {
    sectionNumber: stripTags(firstMatch(html, /<strong[^>]*class=["'][^"']*section-number[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i)),
    title: stripTags(firstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)),
    subtitle: stripTags(firstMatch(html, /<p[^>]*class=["'][^"']*subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)),
  };
}

function extractContent(html) {
  const heading = firstMatch(html, /<header[^>]*class=["'][^"']*slide-heading[^"']*["'][^>]*>([\s\S]*?)<\/header>/i) || html;
  return {
    title: stripTags(firstMatch(heading, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)),
    subtitle: stripTags(firstMatch(heading, /<p[^>]*class=["'][^"']*subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)),
  };
}

function extractClosing(html) {
  const content = firstMatch(html, /<main[^>]*class=["'][^"']*closing-content[^"']*["'][^>]*>([\s\S]*?)<\/main>/i) || html;
  const title = stripTags(firstMatch(content, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i));
  const subtitle = stripTags(firstMatch(content, /<p[^>]*class=["'][^"']*subtitle[^"']*["'][^>]*>([\s\S]*?)<\/p>/i));
  const paragraphs = allMatches(content, /<p\b[^>]*>([\s\S]*?)<\/p>/i).map(stripTags).filter(Boolean);
  const org = paragraphs.find((line) => line && line !== subtitle) || "";
  return { title, subtitle, org };
}

async function loadCoordinateMap() {
  if (!(await pathExists(coordinateMapPath))) throw new Error("missing P2 coordinate-map.json");
  const map = JSON.parse(await readFile(coordinateMapPath, "utf8"));
  if (map?.canvas?.width !== STAGE_WIDTH || map?.canvas?.height !== STAGE_HEIGHT || !Array.isArray(map.slides)) {
    throw new Error("invalid P2 coordinate-map canvas");
  }
  return map;
}

async function ensurePrerequisiteTemplates(pages) {
  // Shared chrome is painted directly by the framework builder.
  // Optional shared-template artifacts are reused when present.
  const sharedModelPath = path.join(outputDir, "shared-template.json");
  const hasAgenda = pages.some((page) => page.layout === "agenda");
  const agendaModelPath = path.join(outputDir, "agenda-template.json");
  if (hasAgenda && !(await pathExists(agendaModelPath))) {
    process.stdout.write("目录模板缺失，先运行 build-agenda-template.mjs ...\n");
    const result = await runProcess("node", [agendaBuilder, deckRoot]);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return {
    sharedModelPath: (await pathExists(sharedModelPath)) ? sharedModelPath : null,
    agendaModelPath: hasAgenda ? agendaModelPath : null,
  };
}

async function parsePages() {
  const pages = [];
  for (const slide of deck.slides) {
    const href = slide.href.replace(/^\/+/, "");
    const filePath = path.join(deckRoot, href);
    if (!(await pathExists(filePath))) throw new Error("missing page " + href);
    const html = await readFile(filePath, "utf8");
    const layout = detectLayout(html);
    if (!layout) throw new Error(href + " unknown layout");
    const base = {
      page: slide.page,
      href,
      deckTitle: slide.title || "",
      layout,
      title: "",
      subtitle: "",
      sectionNumber: "",
      metaLines: [],
      org: "",
      businessSafeArea: layout === "content",
    };
    if (layout === "cover") Object.assign(base, extractCover(html));
    else if (layout === "section") Object.assign(base, extractSection(html));
    else if (layout === "content") Object.assign(base, extractContent(html));
    else if (layout === "closing") Object.assign(base, extractClosing(html));
    else if (layout === "agenda") {
      base.title = slide.title || "agenda";
      base.subtitle = slide.subtitle || "";
    }
    if (layout !== "agenda" && !base.title) throw new Error(href + " missing title");
    pages.push(base);
  }
  return pages;
}

function assertCoordinateCoverage(map, pages) {
  for (const page of pages) {
    if (!map.slides.find((item) => item.page === page.page && item.href === page.href)) {
      throw new Error("coordinate-map missing page " + page.page + " " + page.href);
    }
  }
}

function renderFrameworkReview(model, pptxName) {
  const fixed = model.pages.filter((p) => p.layout !== "content");
  const content = model.pages.filter((p) => p.layout === "content");
  const lines = [
    "# P3 完整页面框架复核",
    "",
    "生成时间：" + model.generatedAt,
    "输入 deck：" + model.deckRoot,
    "页面总数：" + model.summary.totalPages,
    "品牌：" + (model.brandInfo ? model.brandInfo.name + " (" + model.brandInfo.key + ")" : "未识别"),
    "框架 PPTX：" + pptxName,
    "",
    "## 范围结论",
    "",
    "- 已按 deck.js 页序一次性装配全部页面框架",
    "- 固定页已写入可编辑文字与固定视觉层",
    "- 内容页仅保留 chrome、标题区与空白业务安全区",
    "- 每页已叠加 P2 框线辅助层（形状名前缀 guide-frame:，终稿阶段移除）",
    "- 自动渲染视觉比对仍依赖 P1 渲染后端，不得仅凭本产物把 P3 标为通过",
    "",
    "## 版式统计",
    "",
    "| 版式 | 页数 | 页码 |",
    "|---|---:|---|",
  ];
  for (const layout of ["cover", "agenda", "section", "content", "closing"]) {
    const matched = model.pages.filter((p) => p.layout === layout);
    lines.push("| " + layout + " | " + (model.summary.layoutCounts[layout] || 0) + " | " + (matched.map((p) => p.page).join(", ") || "-") + " |");
  }
  lines.push("", "## 固定页", "", "| 页码 | 版式 | 主标题/关键文案 |", "|---:|---|---|");
  for (const page of fixed) {
    let detail = page.title || "";
    if (page.layout === "agenda") detail = "目录项见 agenda-template.json 第 " + page.page;
    else if (page.layout === "section") detail = [page.sectionNumber, page.title, page.subtitle].filter(Boolean).join(" / ");
    else if (page.layout === "cover") detail = [page.title, page.subtitle, ...(page.metaLines || [])].filter(Boolean).join(" / ");
    else detail = [page.title, page.subtitle, page.org].filter(Boolean).join(" / ");
    lines.push("| " + page.page + " | " + page.layout + " | " + detail + " |");
  }
  lines.push("", "## 内容页框架", "", "| 页码 | 标题 | 副标题 |", "|---:|---|---|");
  for (const page of content) {
    lines.push("| " + page.page + " | " + (page.title || "-") + " | " + (page.subtitle || "-") + " |");
  }
  lines.push("", "## 后续门禁", "", "1. 使用 P1 渲染后端渲染 framework-deck.pptx", "2. 与 P2/html-screenshots 逐页比对", "3. 视觉通过后才可在 P3/pptx-stage-gates.md 标通过", "");
  return lines.join("\n");
}

await mkdir(outputDir, { recursive: true });
const coordinateMap = await loadCoordinateMap();
const pages = await parsePages();
assertCoordinateCoverage(coordinateMap, pages);
const prereq = await ensurePrerequisiteTemplates(pages);
const detectedBrand = await detectDeckBrand(deckRoot);
const brandPaths = brandAssetPaths(deckRoot);
const brand = {
  coverBackground: brandPaths.coverBackground,
  sectionBackground: brandPaths.sectionBackground,
  closingBackground: brandPaths.closingBackground,
  logoWhite: brandPaths.logoWhite,
  logoColor: brandPaths.logoColor,
};
for (const [label, filePath] of Object.entries(brand)) {
  if (!(await pathExists(filePath))) throw new Error("缺少品牌资源 " + detectedBrand.name + "/" + label + "：" + filePath);
}
const layoutCounts = { cover: 0, agenda: 0, section: 0, content: 0, closing: 0 };
for (const page of pages) layoutCounts[page.layout] = (layoutCounts[page.layout] || 0) + 1;
const guideByPage = new Map(
  (coordinateMap.slides || []).map((item) => [item.page, item.guideFrame || null])
);
for (const page of pages) {
  page.guideFrame = guideByPage.get(page.page) || null;
  if (!page.guideFrame) {
    throw new Error("coordinate-map missing guideFrame for page " + page.page + " " + page.href);
  }
}
const model = {
  generatedAt: new Date().toISOString(),
  deckRoot,
  deckTitle: deck.title || path.basename(deckRoot),
  canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620 },
  brand,
  brandInfo: { key: detectedBrand.key, name: detectedBrand.name, logoColorSha256: detectedBrand.logoColorSha256 },
  sharedTemplatePath: prereq.sharedModelPath,
  agendaTemplatePath: prereq.agendaModelPath,
  coordinateMapPath,
  includeGuideFrames: true,
  pages,
  summary: {
    totalPages: pages.length,
    fixedPageCount: pages.filter((p) => p.layout !== "content").length,
    contentPageCount: pages.filter((p) => p.layout === "content").length,
    layoutCounts,
    guideFramePages: pages.filter((p) => p.guideFrame).length,
  },
};
const modelPath = path.join(outputDir, "framework-model.json");
const pptxPath = path.join(outputDir, "framework-deck.pptx");
await writeFile(modelPath, JSON.stringify(model, null, 2) + "\n", "utf8");
const result = await runProcess("python3", [pythonBuilder, modelPath, pptxPath]);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
const reviewPath = path.join(outputDir, "framework-review.md");
await writeFile(reviewPath, renderFrameworkReview(model, "framework-deck.pptx"), "utf8");
const gatesPath = path.join(outputDir, "pptx-stage-gates.md");
const note = "framework-deck.pptx 已装配 " + model.summary.totalPages + " 页（固定页 " + model.summary.fixedPageCount + " / 内容页框架 " + model.summary.contentPageCount + " / 框线层 " + model.summary.guideFramePages + "）；证据 framework-model.json / framework-review.md；待渲染视觉比对后才可标通过";
if (await pathExists(gatesPath)) {
  const gates = await readFile(gatesPath, "utf8");
  const next = gates.replace(/^\| P3 \|.*?\|$/m, "| P3 | 部分完成 | " + note + " |");
  if (next !== gates) await writeFile(gatesPath, next, "utf8");
} else {
  await writeFile(gatesPath, "# P3 阶段门禁\n\n| 门禁 | 状态 | 证据/说明 |\n|---|---|---|\n| P3 | 部分完成 | " + note + " |\n", "utf8");
}
process.stdout.write([
  "页面框架装配完成：" + model.summary.totalPages + " 页",
  "- 模型：" + modelPath,
  "- PPTX：" + pptxPath,
  "- 复核：" + reviewPath,
  "- 品牌：" + detectedBrand.name + " (" + detectedBrand.key + ")",
  "- 固定页：" + model.summary.fixedPageCount + "；内容页框架：" + model.summary.contentPageCount,
  "- 框线辅助层：已写入全部 " + model.summary.guideFramePages + " 页（guide-frame:*）",
  "",
].join("\n"));
