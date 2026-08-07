#!/usr/bin/env node

/**
 * 构建统一版式 HTML deck 的 P3 共享母版 PPTX（恒达/创信/郑煤机）。
 *
 * 本脚本只复原跨页复用的背景、Logo、内容页 chrome 与固定安全区，
 * 不填充封面/章节/封底私有文字，也不复原内容页正文。目录模板仍由
 * build-agenda-template.mjs 专门生成。
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { assertDeckInput, STAGE_HEIGHT, STAGE_WIDTH } from "./pptx-html-utils.mjs";
import { brandAssetPaths, detectDeckBrand } from "./pptx-brand-utils.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/build-shared-template.mjs <deck-root>\\n");
  process.exit(64);
}

const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const outputDir = path.join(deckRoot, "pptx", "P3");
const coordinateMapPath = path.join(deckRoot, "pptx", "P2", "coordinate-map.json");
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pythonBuilder = path.join(scriptsDir, "build-shared-template-pptx.py");
const brandVerifier = path.join(scriptsDir, "verify-hengda-assets.mjs");

async function exists(filePath) {
  try { await stat(filePath); return true; } catch { return false; }
}

function hasLayout(html, layout) {
  return new RegExp(`class=["'][^"']*\\b${layout}\\b[^"']*["']`, "i").test(html);
}

async function findLayoutPages() {
  const groups = { cover: [], section: [], content: [], closing: [], agenda: [] };
  for (const slide of deck.slides) {
    const href = slide.href.replace(/^\/+/, "");
    const html = await readFile(path.join(deckRoot, href), "utf8");
    for (const layout of Object.keys(groups)) {
      if (hasLayout(html, `layout-${layout}`)) groups[layout].push({ page: slide.page, href });
    }
  }
  return groups;
}

function requireCoordinates(map, page, expectedSelector) {
  const record = map.slides?.find((item) => item.page === page);
  if (!record) throw new Error(`P2 坐标清单缺少第 ${page} 页`);
  if (!record.elements?.some((element) => element.selector === expectedSelector && element.visible)) {
    throw new Error(`P2 坐标清单第 ${page} 页缺少可见 ${expectedSelector} 元素`);
  }
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || `${command} 退出码 ${code}`)));
  });
}

if (!(await exists(coordinateMapPath))) {
  throw new Error("缺少 P2 产物 pptx/P2/coordinate-map.json；请先完成 P2。");
}
const coordinateMap = JSON.parse(await readFile(coordinateMapPath, "utf8"));
if (coordinateMap.canvas?.width !== STAGE_WIDTH || coordinateMap.canvas?.height !== STAGE_HEIGHT) {
  throw new Error("P2 坐标画布不是 1600×900，拒绝构建共享母版。");
}

const layouts = await findLayoutPages();
for (const kind of ["cover", "section", "content", "closing"]) {
  if (!layouts[kind].length) throw new Error(`deck 中未找到 .layout-${kind} 页面`);
  requireCoordinates(coordinateMap, layouts[kind][0].page, "section");
}

const detectedBrand = await detectDeckBrand(deckRoot);
const brand = brandAssetPaths(deckRoot);
for (const [label, filePath] of Object.entries(brand)) {
  if (!(await exists(filePath)) && !["agendaHidden", "texture"].includes(label)) {
    throw new Error("缺少品牌资源 " + detectedBrand.name + "/" + label + "：" + filePath);
  }
}
const brandCheck = await runProcess("node", [brandVerifier, path.join(deckRoot, "assets", "brand"), "--deck", deckRoot]);
if (brandCheck.stdout) process.stdout.write(brandCheck.stdout);
if (brandCheck.stderr) process.stderr.write(brandCheck.stderr);

await mkdir(outputDir, { recursive: true });
const model = {
  generatedAt: new Date().toISOString(),
  deckRoot,
  deckTitle: deck.title,
  canvas: { width: STAGE_WIDTH, height: STAGE_HEIGHT, emuPerPixel: 7620 },
  brand,
  brandInfo: { key: detectedBrand.key, name: detectedBrand.name, logoColorSha256: detectedBrand.logoColorSha256 },
  layouts,
  templateId: detectedBrand.key + "-shared-chrome-v1",
  templates: {
    cover: {
      sourcePages: layouts.cover.map((item) => item.page),
      fixedElements: ["cover-campus.jpg", "blue-overlay", "logo-white.png", "cover-rule", "cover-title-box", "cover-subtitle-box", "cover-meta-anchor"],
    },
    section: {
      sourcePages: layouts.section.map((item) => item.page),
      fixedElements: ["section-campus-night.png", "blue-overlay", "logo-white.png", "section-content-anchor", "section-divider"],
    },
    content: {
      sourcePages: layouts.content.map((item) => item.page),
      fixedElements: ["white-background", "logo-color.png", "master-rule-fade", "master-rule-blue", "master-rule-light", "heading-safe-area", "content-safe-area"],
    },
    closing: {
      sourcePages: layouts.closing.map((item) => item.page),
      fixedElements: ["closing-digital-globe.jpg", "blue-overlay", "logo-white.png", "closing-content-anchor", "closing-divider"],
    },
  },
};
const modelPath = path.join(outputDir, "shared-template.json");
const pptxPath = path.join(outputDir, "shared-templates.pptx");
await writeFile(modelPath, JSON.stringify(model, null, 2) + "\n", "utf8");
const result = await runProcess("python3", [pythonBuilder, modelPath, pptxPath]);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

const review = [
  "# P3 共享母版复核",
  "",
  `生成时间：${model.generatedAt}`,
  `模板标识：\`${model.templateId}\``,
  `共享模板 PPTX：\`${path.basename(pptxPath)}\``,
  "",
  "| 模板 | 来源页面 | 固定元素 | P3/P4 可配置区域 |",
  "|---|---|---|---|",
  `| 封面 | ${layouts.cover.map((item) => item.page).join(", ")} | 品牌背景、渐变遮罩、白色 Logo、横线、标题/副标题/信息框锚点 | 标题、副标题、单位与周期文字 |`,
  `| 章节 | ${layouts.section.map((item) => item.page).join(", ")} | 夜景背景、渐变遮罩、白色 Logo、章节内容锚点与分隔线 | 章节号、标题、副标题 |`,
  `| 内容页 | ${layouts.content.map((item) => item.page).join(", ")} | 白底、彩色 Logo、三段横线、标题区和正文安全区 | 标题、副标题及正文内容区 |`,
  `| 封底 | ${layouts.closing.map((item) => item.page).join(", ")} | 数字地球背景、渐变遮罩、白色 Logo、结束语锚点与分隔线 | 结束语、副标题、单位文字 |`,
  "",
  "目录页固定层及目录项槽位由 agenda-template.json 管理，并由 build-framework-deck.mjs 装配进 framework-deck；不在本共享模板 PPTX 中重复生成，也不单独输出目录 PPTX。",
  "共享模板只包含固定视觉层和空白锚点；P3 页面框架装配器填入标题和固定页私有文本，P4 填入内容页业务区。",
  "",
].join("\n");
await writeFile(path.join(outputDir, "shared-template-review.md"), review, "utf8");

const templateReviewPath = path.join(outputDir, "template-review.md");
const sharedHeading = "## 共享母版（封面、章节、内容页 chrome、封底）";
const sharedSummary = sharedHeading + "\n\n" + review.split("\n").slice(6).join("\n");
const existingTemplateReview = (await exists(templateReviewPath)) ? await readFile(templateReviewPath, "utf8") : "# 共享模板复核\n\n";
if (!existingTemplateReview.includes(sharedHeading)) {
  await writeFile(templateReviewPath, existingTemplateReview.replace(/\s*$/, "\n\n") + sharedSummary, "utf8");
}

process.stdout.write(`共享模板完成：${pptxPath}\n- 模型：${modelPath}\n- 复核：${path.join(outputDir, "shared-template-review.md")}\n`);
