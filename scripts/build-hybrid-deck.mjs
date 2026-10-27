#!/usr/bin/env node

/**
 * P3 混合版组装：
 * 1) 从 P3/text-nodes.json 生成全页文字计划（含封面/章节/目录/结束页）
 * 2) 以 P3/backgrounds 的 2× 背景图（可编辑文字已隐藏）+ 原生文本框生成 PPTX
 *
 * 转换策略：
 * - 背景是位图，文字原生可编辑；竖排与半透明装饰文字保留在背景中（bitmapOnly）；
 * - 基线位置按 P3/calibration.json 实测校正（LibreOffice 渲染探针）；
 * - 行距写成精确磅值，避免 spcPct 被字体自然行高放大；
 * - 同一文本节点内各行 x 不一致（行内混排）时，按行拆成独立文本框；
 * - 按 CJK↔西文边界数补偿字间距，抵消 LibreOffice 的自动中西文间距。
 */

import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { assertDeckInput } from "./pptx-html-utils.mjs";
import { buildTextSpec, detectLayout } from "./text-plan-lib.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/build-hybrid-deck.mjs <deck-root>\n");
  process.exit(64);
}

const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const stageDir = path.join(deckRoot, "pptx", "P3");
const textNodesPath = path.join(stageDir, "text-nodes.json");
const backgroundManifestPath = path.join(stageDir, "backgrounds", "manifest.json");
const calibrationPath = path.join(stageDir, "calibration.json");
const planPath = path.join(stageDir, "text-plan.json");

function sanitizeName(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return text.slice(0, 80) || "deck";
}

const deckTitle = deck.title || path.basename(deckRoot);
const outputPath = path.join(stageDir, `${sanitizeName(deckTitle)}（混合版）.pptx`);
const reviewPath = path.join(stageDir, "hybrid-build-review.md");
const pythonScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "apply-hybrid-text-plan.py");

const FONT_ASCENT_RATIO = 1.058;
const CJK_LATIN_BOUNDARY_EM = 0.25;

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function runPython(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `python exit ${code}`));
    });
  });
}

function isCjkChar(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  );
}

/**
 * LibreOffice 在每个 CJK↔西文边界插入约 0.25em 自动间距。
 * 空格本身不触发（国 国 无增量），但会跳过空格继续判断（国 1 国 仍是 2 个边界）；
 * 除 CJK/全角与空白外一律按西文计（数字、ASCII、· 等）。
 */
function countBoundaries(text) {
  let count = 0;
  let prev = 0;
  for (const ch of String(text || "")) {
    if (/\s/.test(ch)) continue;
    const cls = isCjkChar(ch) ? 1 : 2;
    if (prev && cls !== prev) count += 1;
    prev = cls;
  }
  return count;
}

function resolveSpacingPx(lineTexts, fontSizePx, cssLetterSpacingPx) {
  let boundaries = 0;
  let gaps = 0;
  for (const text of lineTexts) {
    boundaries += countBoundaries(text);
    gaps += Math.max(0, String(text).length - 1);
  }
  const base = Number(cssLetterSpacingPx) || 0;
  if (!boundaries || !gaps) return base;
  const correction = -(CJK_LATIN_BOUNDARY_EM * fontSizePx * boundaries) / gaps;
  const clamped = Math.max(-0.2 * fontSizePx, Math.min(0.2 * fontSizePx, correction));
  const total = base + clamped;
  return Math.abs(total) < 0.05 ? 0 : Number(total.toFixed(3));
}

function comboKey(style) {
  return `${style.fontSizePt}|${Number(style.lineHeightRatio)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildLineSpecs(baseSpec, textNode, calibration) {
  const style = textNode.style || {};
  const lines = Array.isArray(textNode.lines) ? textNode.lines : [];
  const em = Number(style.fontSizePx);
  const lineHeightPx = Number(style.lineHeightPx);
  const key = comboKey(style);
  const combo = calibration.byCombo[key];
  if (!combo) {
    throw new Error(`第 ${baseSpec.page} 页 ${textNode.id}：calibration 缺少组合 ${key}`);
  }
  if (Math.abs(Number(combo.lineHeightPx) - lineHeightPx) > 0.05) {
    throw new Error(
      `第 ${baseSpec.page} 页 ${textNode.id}：标定行高 ${combo.lineHeightPx} 与采集行高 ${lineHeightPx} 不一致`
    );
  }
  const ascentPx = Math.round(FONT_ASCENT_RATIO * em);
  const boxYFor = (line) => Number((line.y + ascentPx - Number(combo.baselineFromBox)).toFixed(2));

  const xDiffers =
    lines.length > 1 && lines.some((line) => Math.abs(Number(line.x) - Number(lines[0].x)) > 2);
  const gapDiffers =
    lines.length > 1 &&
    lines.some(
      (line, index) => Math.abs(Number(line.y) - Number(lines[0].y) - index * lineHeightPx) > 2
    );
  const needsSplit = lines.length > 1 && (xDiffers || gapDiffers);

  const applyCommon = (spec, lineTexts) => {
    spec.style.lineSpacingPx = Number(lineHeightPx.toFixed(3));
    spec.style.verticalAlign = "top";
    const spacing = resolveSpacingPx(lineTexts, em, spec.style.letterSpacingPx);
    spec.style.letterSpacingPx = spacing;
    spec.style.letterSpacingPt = Number((spacing * 0.6).toFixed(2));
    spec.write = {
      textMode: "plain",
      wordWrap: false,
      useHardLineBreaks: lineTexts.length > 1,
      lineCount: lineTexts.length,
      linesForWrite: lineTexts,
    };
    spec.text = lineTexts.join("\n");
    spec.calibration = {
      combo: key,
      baselineFromBox: combo.baselineFromBox,
      lineHeightPx: combo.lineHeightPx,
      neededAscentPx: ascentPx,
      split: needsSplit,
    };
    return spec;
  };

  if (!needsSplit) {
    const spec = applyCommon(clone(baseSpec), lines.map((line) => line.text));
    const maxWidth = Math.max(...lines.map((line) => Number(line.width) || 0), 1);
    spec.box = {
      x: Number(Number(lines[0].x).toFixed(2)),
      y: boxYFor(lines[0]),
      width: Number(maxWidth.toFixed(2)),
      height: Number((lineHeightPx * lines.length).toFixed(2)),
      source: "p3-calibrated",
    };
    return [spec];
  }

  return lines.map((line, index) => {
    const spec = applyCommon(clone(baseSpec), [line.text]);
    spec.id = `${baseSpec.id}#L${index}`;
    spec.shapeName = `${baseSpec.shapeName}#L${index}`;
    spec.lines = [line];
    spec.metrics = { lineCount: 1, wrapOccurred: false };
    spec.box = {
      x: Number(Number(line.x).toFixed(2)),
      y: boxYFor(line),
      width: Number(Math.max(Number(line.width) || 0, 1).toFixed(2)),
      height: Number(lineHeightPx.toFixed(2)),
      source: "p3-calibrated-split",
    };
    return spec;
  });
}

if (!(await pathExists(textNodesPath))) {
  throw new Error("缺少 P3/text-nodes.json；请先运行 capture-hybrid-backgrounds.mjs");
}
if (!(await pathExists(backgroundManifestPath))) {
  throw new Error("缺少 P3/backgrounds/manifest.json；请先运行 capture-hybrid-backgrounds.mjs");
}
if (!(await pathExists(calibrationPath))) {
  throw new Error("缺少 P3/calibration.json；请先运行 calibrate-hybrid-text.py");
}

const textNodes = JSON.parse(await readFile(textNodesPath, "utf8"));
const backgroundManifest = JSON.parse(await readFile(backgroundManifestPath, "utf8"));
const calibration = JSON.parse(await readFile(calibrationPath, "utf8"));
const backgroundByPage = new Map(backgroundManifest.pages.map((item) => [item.page, item]));

const slides = [];
let textCount = 0;
let splitCount = 0;
const skipped = [];

for (const deckSlide of deck.slides) {
  const metricsSlide = (textNodes.slides || []).find(
    (item) => item.page === deckSlide.page && item.href === deckSlide.href
  );
  if (!metricsSlide) {
    throw new Error(`text-nodes 缺少第 ${deckSlide.page} 页 ${deckSlide.href}`);
  }
  const background = backgroundByPage.get(deckSlide.page);
  if (!background) {
    throw new Error(`backgrounds 缺少第 ${deckSlide.page} 页`);
  }
  if (background.href !== deckSlide.href) {
    throw new Error(`第 ${deckSlide.page} 页背景与 deck.js 页序不一致：${background.href} ≠ ${deckSlide.href}`);
  }

  const html = await readFile(path.join(deckRoot, deckSlide.href.replace(/^\/+/, "")), "utf8");
  const layout = detectLayout(html) || "content";
  const texts = [];

  for (const textNode of metricsSlide.texts || []) {
    if (textNode.bitmapOnly) {
      skipped.push({
        page: deckSlide.page,
        id: textNode.id,
        reason: `bitmap-only:${textNode.bitmapOnly}`,
        text: textNode.text,
      });
      continue;
    }
    const box = textNode.boxes?.layout || {};
    if (!(Number(box.width) > 0) || !(Number(box.height) > 0)) {
      skipped.push({ page: deckSlide.page, id: textNode.id, reason: "zero-size-box", text: textNode.text });
      continue;
    }
    const baseSpec = buildTextSpec(textNode, { page: deckSlide.page, layout, role: "all" });
    baseSpec.source = "P3/text-nodes.json";
    const specs = buildLineSpecs(baseSpec, textNode, calibration);
    if (specs.length > 1) splitCount += 1;
    for (const spec of specs) {
      texts.push(spec);
      textCount += 1;
    }
  }

  slides.push({
    page: deckSlide.page,
    href: deckSlide.href,
    title: deckSlide.title || "",
    subtitle: deckSlide.subtitle || "",
    layout,
    background: background.background,
    backgroundWidth: background.width,
    backgroundHeight: background.height,
    textCount: texts.length,
    texts,
  });
}

const plan = {
  version: 2,
  stage: "P3",
  mode: "bitmap-background + native-text",
  title: deckTitle,
  source: {
    textNodes: "pptx/P3/text-nodes.json",
    backgrounds: "pptx/P3/backgrounds/manifest.json",
    calibration: "pptx/P3/calibration.json",
  },
  canvas: { width: 1600, height: 900, emuPerPixel: 7620, pxToPt: 0.6 },
  policy: {
    allTextEditable: true,
    allGlyphsRemovedFromBackground: true,
    bitmapOnlyTextKeptInBackground: true,
    wordWrap: false,
    hardBreaksFromLines: true,
    exactLineSpacingPx: true,
    baselineCalibrated: true,
    splitInlineLines: true,
    cjkLatinSpacingCompensation: true,
    textBoxSource: "P3/text-nodes.json line geometry",
  },
  generatedAt: new Date().toISOString(),
  summary: { pages: slides.length, texts: textCount, splitNodes: splitCount, skipped: skipped.length },
  slides,
  skipped,
};

await mkdir(stageDir, { recursive: true });
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

const result = await runPython([pythonScript, backgroundManifestPath, planPath, outputPath]);
const payload = JSON.parse(String(result.stdout || "{}").trim() || "{}");

const review = [
  "# P3 混合版组装复核",
  "",
  "- 形态：位图背景 + 原生文本框（文字可编辑可检索；竖排与半透明装饰文字保留在位图中）",
  `- 页数：${plan.summary.pages}`,
  `- 原生文本框：${payload.writtenTexts ?? plan.summary.texts}`,
  `- 行内混排拆行：${plan.summary.splitNodes} 个文本节点`,
  `- 保留在位图中的文字节点：${plan.skipped.filter((item) => String(item.reason).startsWith("bitmap-only")).length}`,
  `- 背景图：${backgroundManifest.pages.length} 张，${backgroundManifest.scale}× JPEG q${backgroundManifest.jpegQuality}`,
  `- 输出：\`pptx/P3/${path.basename(outputPath)}\``,
  "",
  "## 位置与排版校正",
  "",
  "1. 基线：`y = 行矩形 top + 字体 ascent - 标定 baselineFromBox`，`calibration.json` 由 LibreOffice 渲染探针实测。",
  "2. 行距：写 `a:spcPts` 精确磅值；`a:spcPct` 会被字体自然行高放大 ~1.2×。",
  "3. 行内混排：同一文本节点各行 x 不同或行距异常时，按行拆成独立文本框。",
  "4. 字距：按 CJK↔西文边界数 × 0.25em 做负字距补偿，抵消 LibreOffice 自动中西文间距。",
  "",
  "## 约束",
  "",
  "1. 背景图必须来自 `capture-hybrid-backgrounds.mjs`，且可编辑文字的字形已被隐藏；不得使用带文字的整页截图。",
  "2. 竖排（vertical-rl）与半透明文字不做原生文本框：横排文本框无法还原字形方向，PPTX 也不支持文本框内文字 alpha，故保留在位图背景中。",
  "3. 文字规格只允许来自 `P3/text-nodes.json`，不得手写字号/颜色/坐标。",
  "4. 所有文本框关闭自动换行与自动缩字。",
  "5. 表格、图表、卡片底纹仍保留在背景位图中；只有文字可编辑。",
  "",
];
await writeFile(reviewPath, `${review.join("\n")}\n`, "utf8");

process.stdout.write(
  `P3 混合版组装完成：\n` +
    `- plan: ${planPath}\n` +
    `- deck: ${outputPath}\n` +
    `- review: ${reviewPath}\n` +
    `- pages: ${payload.pages ?? plan.summary.pages}，texts: ${payload.writtenTexts ?? "?"}，split: ${plan.summary.splitNodes}\n`
);
