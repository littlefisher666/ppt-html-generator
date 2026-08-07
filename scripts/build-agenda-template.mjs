#!/usr/bin/env node

/**
 * 从 HTML deck 生成目录页模板定义与可配置目录项数据。
 *
 * 固定层（不含 Logo 的背景 + CONTENTS + “目录” + 中部图形）使用技能内置高清图；
 * Logo 从 deck 品牌资源独立放置。右侧目录项的长条背景与左侧编号方块使用内置高清图；
 * 仅编号与标题在后续 framework-deck 中作为可编辑文本。
 *
 * 产物：
 * - pptx/P3/template-assets/agenda-fixed-base.png  （高清固定底图）
 * - pptx/P3/template-assets/agenda-item-bar-*.png（高清条目长条背景）
 * - pptx/P3/template-assets/agenda-item-number-*.png（高清编号方块）
 * - pptx/P3/agenda-template.json
 * - pptx/P3/template-review.md
 * - pptx/P3/fixed-pages-review.md
 *
 * 不单独输出目录页 PPTX；目录页只应作为 framework-deck.pptx 的一部分装配。
 *
 * 用法：node scripts/build-agenda-template.mjs <deck-root>
 */

import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  STAGE_HEIGHT,
  STAGE_WIDTH,
  assertDeckInput,
} from "./pptx-html-utils.mjs";
import { detectDeckBrand } from "./pptx-brand-utils.mjs";
import {
  AGENDA_TEMPLATE_ID,
  DELIVERY_IMAGE_SCALE,
  FIXED,
  MAX_ITEMS_PER_PAGE,
  buildTemplateDefinition,
  computeListLayout,
} from "./agenda-template-model.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/build-agenda-template.mjs <deck-root>\n");
  process.exit(64);
}

const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const outputDir = path.join(deckRoot, "pptx", "P3");
const fixedPagesOutputDir = path.join(deckRoot, "pptx", "P3");
const assetsDir = path.join(outputDir, "template-assets");
await mkdir(assetsDir, { recursive: true });
await mkdir(fixedPagesOutputDir, { recursive: true });

const skillDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.dirname(skillDir);
// 目录固定底图与条目组件不含任何品牌元素，属于所有品牌共用资产。
const staticAgendaAssetsDir = path.join(skillRoot, "assets", "shared", "agenda-template");
const staticAgendaManifestPath = path.join(staticAgendaAssetsDir, "manifest.json");

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function readPngMeta(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("不是有效 PNG：" + filePath);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function loadVerifiedAgendaAssetManifest() {
  const manifest = JSON.parse(await readFile(staticAgendaManifestPath, "utf8"));
  if (manifest.templateId !== AGENDA_TEMPLATE_ID) {
    throw new Error("目录模板资产 templateId 不匹配：期望 " + AGENDA_TEMPLATE_ID);
  }
  if (!manifest.files || typeof manifest.files !== "object") {
    throw new Error("目录模板资产 manifest 缺少 files 哈希记录");
  }
  const accepted = manifest.acceptedBrandLogoSha256 || (manifest.brandLogoSha256 ? { legacy: manifest.brandLogoSha256 } : null);
  if (!accepted || !Object.keys(accepted).length) {
    throw new Error("目录模板资产 manifest 缺少 acceptedBrandLogoSha256");
  }
  for (const [name, expectedHash] of Object.entries(manifest.files)) {
    const sourcePath = path.join(staticAgendaAssetsDir, name);
    if (!(await pathExists(sourcePath))) throw new Error("目录模板内置资产缺失：" + name);
    if ((await sha256(sourcePath)) !== expectedHash) {
      throw new Error("目录模板内置资产哈希不匹配：" + name);
    }
  }
  return manifest;
}

async function assertSupportedBrand(manifest, brand) {
  const accepted = manifest.acceptedBrandLogoSha256 || {};
  const allowedHashes = new Set(Object.values(accepted));
  if (manifest.brandLogoSha256) allowedHashes.add(manifest.brandLogoSha256);
  if (!allowedHashes.has(brand.logoColorSha256)) {
    throw new Error(
      "当前 deck 品牌 Logo 未在目录 chrome 的接受清单中：" + brand.name + " / " + brand.logoColorSha256
    );
  }
}

function assertClose(label, actual, expected, tolerance = 1) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} 与统一目录母版几何不一致：期望 ${expected}±${tolerance}，实际 ${actual}`);
  }
}

function findVisibleClassElement(elements, className) {
  return elements.find((element) => element.visible && Array.isArray(element.classes) && element.classes.includes(className));
}

async function assertAgendaCoordinateMap(pages) {
  const coordinateMapPath = path.join(deckRoot, "pptx", "P2", "coordinate-map.json");
  if (!(await pathExists(coordinateMapPath))) {
    throw new Error("缺少 P2 坐标清单 pptx/P2/coordinate-map.json；请先运行 extract-html-coordinate-map.mjs");
  }
  const map = JSON.parse(await readFile(coordinateMapPath, "utf8"));
  if (map?.canvas?.width !== STAGE_WIDTH || map?.canvas?.height !== STAGE_HEIGHT || !Array.isArray(map.slides)) {
    throw new Error("coordinate-map.json 不是有效的 1600×900 P2 坐标清单；请重新生成");
  }
  for (const page of pages) {
    const sourceSlide = map.slides.find((slide) => slide.page === page.page && slide.href === page.href);
    if (!sourceSlide || !Array.isArray(sourceSlide.elements)) {
      throw new Error(`coordinate-map.json 缺少目录第 ${page.page} 页 ${page.href}；请重新生成 P2 产物`);
    }
    const list = findVisibleClassElement(sourceSlide.elements, "agenda-list");
    if (!list) throw new Error(`${page.href} 的 P2 坐标清单中未找到可见 .agenda-list`);
    assertClose(`${page.href} .agenda-list x`, list.x, FIXED.listAnchor.x);
    assertClose(`${page.href} .agenda-list centerY`, list.y + list.height / 2, FIXED.listAnchor.centerY);

    const logo = sourceSlide.elements.find(
      (element) => element.visible && typeof element.source === "string" && /(?:^|\/)assets\/brand\/logo-color\.png(?:[?#].*)?$/.test(element.source)
    );
    if (!logo) throw new Error(`${page.href} 的 P2 坐标清单中未找到可见彩色 Logo`);
    assertClose(`${page.href} Logo x`, logo.x, FIXED.logo.x);
    assertClose(`${page.href} Logo y`, logo.y, FIXED.logo.y);
    assertClose(`${page.href} Logo width`, logo.width, FIXED.logo.width);
    assertClose(`${page.href} Logo height`, logo.height, FIXED.logo.height);
  }
}

function extractAgendaItems(html) {
  const listMatch = html.match(
    /<ol[^>]*class=["'][^"']*agenda-list[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i
  );
  if (!listMatch) return [];
  const items = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRe.exec(listMatch[1]))) {
    const body = match[1];
    const number = (body.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1] || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const title = (
      body.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] ||
      body.replace(/<b\b[^>]*>[\s\S]*?<\/b>/i, "")
    )
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!number && !title) continue;
    items.push({
      number: number || String(items.length + 1).padStart(2, "0"),
      title: title || "",
    });
  }
  return items;
}

async function loadAgendaPages() {
  const pages = [];
  for (const slide of deck.slides) {
    const href = slide.href.replace(/^\/+/, "");
    const filePath = path.join(deckRoot, href);
    if (!(await pathExists(filePath))) throw new Error("目录/页面文件不存在：" + href);
    const html = await readFile(filePath, "utf8");
    if (!/class=["'][^"']*\blayout-agenda\b[^"']*["']/.test(html)) continue;
    const items = extractAgendaItems(html);
    if (items.length === 0) {
      throw new Error(href + " 是目录页，但未找到 .agenda-list 条目");
    }
    if (items.length > MAX_ITEMS_PER_PAGE) {
      throw new Error(
        href +
          " 含 " +
          items.length +
          " 个目录项，超过单页上限 " +
          MAX_ITEMS_PER_PAGE +
          "；请先创建目录续页并均分"
      );
    }
    const layout = computeListLayout(items.length);
    const renderedItems = layout.itemSlots.map((slot, index) => ({
      ...slot,
      number: items[index].number,
      title: items[index].title,
    }));
    pages.push({
      page: slide.page,
      href,
      title: slide.title || "目录",
      subtitle: slide.subtitle || "",
      templateId: AGENDA_TEMPLATE_ID,
      items,
      layout: {
        metrics: layout.metrics,
        top: layout.top,
        totalHeight: layout.totalHeight,
        centerY: layout.centerY,
      },
      renderedItems,
    });
  }
  return pages;
}

function assertAgendaContinuationDistribution(pages) {
  const totalItems = pages.reduce((total, page) => total + page.items.length, 0);
  const expectedPageCount = Math.ceil(totalItems / MAX_ITEMS_PER_PAGE);
  if (pages.length !== expectedPageCount) {
    throw new Error(
      `目录共 ${totalItems} 项，应使用 ${expectedPageCount} 页目录/续页，实际发现 ${pages.length} 页`
    );
  }
  const base = Math.floor(totalItems / expectedPageCount);
  const remainder = totalItems % expectedPageCount;
  for (let index = 0; index < pages.length; index += 1) {
    const expectedCount = base + (index < remainder ? 1 : 0);
    if (pages[index].items.length !== expectedCount) {
      throw new Error(
        `目录续页分配不均：第 ${pages[index].page} 页应有 ${expectedCount} 项，实际 ${pages[index].items.length} 项；` +
          "请按余数优先分配到前页的规则重新分配"
      );
    }
  }
}

/**
 * 复制经 manifest 哈希验证的统一目录页内置高清模板资产。
 *
 * 固定背景与目录项 chrome 对三品牌统一版式一致，因此不得在
 * 每次转换时启动浏览器重新截图。右上角 Logo 保持为 deck 内可追溯的品牌资源，
 * 由 PPTX 生成器单独放置。
 */
async function prepareAgendaAssets(pages) {
  const scale = DELIVERY_IMAGE_SCALE;
  const fixedPath = path.join(assetsDir, "agenda-fixed-base.png");
  const staticFixedPath = path.join(staticAgendaAssetsDir, "agenda-fixed-base-no-logo.png");
  await copyFile(staticFixedPath, fixedPath);

  const metricsByHeight = new Map();
  for (const page of pages) {
    const metrics = page.layout.metrics;
    metricsByHeight.set(String(metrics.itemHeight), metrics);
  }

  const itemChromes = {};
  for (const [heightKey, metrics] of metricsByHeight.entries()) {
      const safeHeight = String(metrics.itemHeight).replace(/\./g, "p");
      const barPath = path.join(assetsDir, "agenda-item-bar-" + safeHeight + ".png");
      const numberPath = path.join(assetsDir, "agenda-item-number-" + safeHeight + ".png");
      const staticBarPath = path.join(staticAgendaAssetsDir, path.basename(barPath));
      const staticNumberPath = path.join(staticAgendaAssetsDir, path.basename(numberPath));
      await Promise.all([copyFile(staticBarPath, barPath), copyFile(staticNumberPath, numberPath)]);

      const barMeta = await readPngMeta(barPath);
      const numberMeta = await readPngMeta(numberPath);
      const expectedBarW = Math.round(708.66 * scale);
      const expectedBarH = Math.round(metrics.itemHeight * scale);
      const expectedNumberW = Math.round(metrics.itemHeight * scale);
      const expectedNumberH = Math.round(metrics.itemHeight * scale);
      if (Math.abs(barMeta.width - expectedBarW) > 2 || Math.abs(barMeta.height - expectedBarH) > 2) {
        throw new Error(
          "条目长条背景像素尺寸异常：期望约 " +
            expectedBarW +
            "x" +
            expectedBarH +
            "，实际 " +
            barMeta.width +
            "x" +
            barMeta.height
        );
      }
      if (Math.abs(numberMeta.width - expectedNumberW) > 2 || Math.abs(numberMeta.height - expectedNumberH) > 2) {
        throw new Error(
          "编号方块像素尺寸异常：期望约 " +
            expectedNumberW +
            "x" +
            expectedNumberH +
            "，实际 " +
            numberMeta.width +
            "x" +
            numberMeta.height
        );
      }

      itemChromes[heightKey] = {
        itemHeight: metrics.itemHeight,
        bar: {
          path: barPath,
          relativePath: path.relative(outputDir, barPath).replace(/\\/g, "/"),
          width: barMeta.width,
          height: barMeta.height,
          scale,
          logical: {
            width: 708.66,
            height: metrics.itemHeight,
          },
          placeOffset: { x: 0, y: 0 },
        },
        numberBlock: {
          path: numberPath,
          relativePath: path.relative(outputDir, numberPath).replace(/\\/g, "/"),
          width: numberMeta.width,
          height: numberMeta.height,
          scale,
          logical: {
            width: metrics.itemHeight,
            height: metrics.itemHeight,
          },
          placeOffset: {
            x: 0,
            y: 0,
          },
        },
        itemLogical: {
          width: 708.66,
          height: metrics.itemHeight,
        },
      };
      process.stdout.write(
        "  条目组件 itemHeight=" +
          metrics.itemHeight +
          ": " +
          barPath +
          " (" +
          barMeta.width +
          "x" +
          barMeta.height +
          "), " +
          numberPath +
          " (" +
          numberMeta.width +
          "x" +
          numberMeta.height +
          ")\n"
      );
  }

  const fixedMeta = await readPngMeta(fixedPath);
  const expectedW = STAGE_WIDTH * scale;
  const expectedH = STAGE_HEIGHT * scale;
  if (fixedMeta.width !== expectedW || fixedMeta.height !== expectedH) {
    throw new Error(
      "目录固定底图像素尺寸应为 " +
        expectedW +
        "x" +
        expectedH +
        "，实际 " +
        fixedMeta.width +
        "x" +
        fixedMeta.height
    );
  }

  return {
    fixedImage: {
      path: fixedPath,
      relativePath: path.relative(outputDir, fixedPath).replace(/\\/g, "/"),
      width: fixedMeta.width,
      height: fixedMeta.height,
      scale: scale,
      logical: { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_HEIGHT },
      includes: ["background", "contentsWord", "title", "cue"],
    },
    itemChromes: itemChromes,
  };
}

function renderTemplateReview(pages, fixedImage, itemChromes) {
  const chromeList = Object.values(itemChromes);
  const lines = [
    "# 共享模板复核（目录页模板）",
    "",
    "生成时间：" + new Date().toISOString(),
    "模板标识：`" + AGENDA_TEMPLATE_ID + "`",
    "适用页：" + (pages.map((p) => p.page).join(", ") || "无"),
    "固定底图：`" +
      fixedImage.relativePath +
      "`（" +
      fixedImage.width +
      "x" +
      fixedImage.height +
      "，scale=" +
      fixedImage.scale +
      "）",
    "条目组件：" +
      chromeList
        .map(
          (c) =>
            "长条 `" +
            c.bar.relativePath +
            "` + 编号方块 `" +
            c.numberBlock.relativePath +
            "` (itemHeight=" +
            c.itemHeight +
            ", bar=" +
            c.bar.width +
            "x" +
            c.bar.height +
            ", number=" +
            c.numberBlock.width +
            "x" +
            c.numberBlock.height +
            ")"
        )
        .join("; "),
    "装配目标：`framework-deck.pptx` 中的目录页（不单独导出目录 PPTX）",
    "",
    "## 固定元素（内置高清资产）",
    "",
    "背景、CONTENTS、竖排“目录”、中部圆形箭头使用技能内置的无 Logo 高清底图，按 1600x900 逻辑尺寸贴满幻灯片。",
    "右上角彩色 Logo 从 deck 内 `assets/brand/logo-color.png` 独立放置；各目录页/续页复用相同底图与条目组件。",
    "",
    "| 组成 | 说明 |",
    "|---|---|",
    "| 版式背景 | 浅蓝→白色纵向渐变 |",
    "| 彩色 Logo | deck 内品牌资源，独立放置 |",
    "| CONTENTS | 左侧竖排字 |",
    "| 目录标题 | “目 / 录” |",
    "| 中部图形 | 圆形箭头 cue |",
    "",
    "## 可配置槽位",
    "",
    "- 右侧目录项：数量、编号、标题、1–6/7–12 压缩尺寸、列表整体垂直居中",
    "- 条目视觉组件：长条背景与蓝色编号方块为技能内置高清资产，按 itemHeight 成对复用；PPT 分别放置，方块始终按自身方形边界缩放",
    "- 可编辑层：仅编号与主标题文本",
    "- 配置来源：各目录页 HTML `.agenda-list` + `assets/deck.js` 页序",
    "",
    "## 页面绑定",
    "",
  ];
  for (const page of pages) {
    lines.push(
      "- 第 " +
        page.page +
        " 页 `" +
        page.href +
        "`：" +
        page.items.length +
        " 项，compressed=" +
        page.layout.metrics.compressed +
        "，listTop=" +
        page.layout.top
    );
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

function renderFixedPagesReview(pages, fixedImage, itemChromes) {
  const lines = [
    "# 固定版式复核（目录页）",
    "",
    "生成时间：" + new Date().toISOString(),
    "说明：目录页无 Logo 固定背景来自技能内置资产并复制到 `" +
      fixedImage.relativePath +
      "`；右侧长条背景与编号方块为独立高清截图，仅编号/标题可编辑。",
    "",
  ];
  for (const page of pages) {
    const chrome = itemChromes[String(page.layout.metrics.itemHeight)];
    lines.push("## 第 " + page.page + " 页 · " + page.href);
    lines.push("");
    lines.push("- 模板：`" + page.templateId + "`");
    lines.push("- 固定底图：`" + fixedImage.relativePath + "`");
    lines.push(
      "- 条目组件：长条 `" +
        (chrome ? chrome.bar.relativePath : "缺失") +
        "`；编号方块 `" +
        (chrome ? chrome.numberBlock.relativePath : "缺失") +
        "`"
    );
    lines.push("- 目录项数：" + page.items.length);
    lines.push(
      "- 压缩：" +
        (page.layout.metrics.compressed ? "是" : "否") +
        "（height=" +
        page.layout.metrics.itemHeight +
        ", gap=" +
        page.layout.metrics.itemGap +
        "）"
    );
    lines.push(
      "- 列表 top：" + page.layout.top + "（centerY=" + page.layout.centerY + "）"
    );
    lines.push("- 条目：");
    for (const item of page.items) lines.push("  - " + item.number + " " + item.title);
    lines.push("- 结构检查：固定层、条背景和编号方块均为已验证高清资产；编号方块独立放置；仅编号/标题可编辑");
    lines.push("- 待完成：目录页由 build-framework-deck 装配进 framework-deck.pptx，再在后续渲染阶段与 HTML 逐页视觉比对");
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

const pages = await loadAgendaPages();
if (!pages.length) {
  process.stderr.write("未在 deck 中发现 .layout-agenda 目录页，无法生成目录模板。\n");
  process.exit(2);
}

assertAgendaContinuationDistribution(pages);
const brand = await detectDeckBrand(deckRoot);
const assetManifest = await loadVerifiedAgendaAssetManifest();
await assertSupportedBrand(assetManifest, brand);
await assertAgendaCoordinateMap(pages);
const assets = await prepareAgendaAssets(pages);
const fixedImage = assets.fixedImage;
const itemChromes = assets.itemChromes;
const template = buildTemplateDefinition();
const deckName = path.basename(deckRoot);
const model = {
  generatedAt: new Date().toISOString(),
  deckRoot,
  deckTitle: deck.title || deckName,
  brand: { key: brand.key, name: brand.name, logoColorSha256: brand.logoColorSha256 },
  fixedImage: {
    path: fixedImage.path,
    relativePath: fixedImage.relativePath,
    width: fixedImage.width,
    height: fixedImage.height,
    scale: fixedImage.scale,
    logical: fixedImage.logical,
    includes: fixedImage.includes,
  },
  brandLogo: {
    path: path.join(deckRoot, "assets", "brand", "logo-color.png"),
    relativePath: "assets/brand/logo-color.png",
    x: template.fixedElements.logo.x,
    y: template.fixedElements.logo.y,
    width: template.fixedElements.logo.width,
    height: template.fixedElements.logo.height,
  },
  itemChromes,
  template,
  pages,
};

const modelPath = path.join(outputDir, "agenda-template.json");
await writeFile(modelPath, JSON.stringify(model, null, 2) + "\n", "utf8");
await writeFile(
  path.join(outputDir, "template-review.md"),
  renderTemplateReview(pages, fixedImage, itemChromes),
  "utf8"
);
await writeFile(
  path.join(fixedPagesOutputDir, "fixed-pages-review.md"),
  renderFixedPagesReview(pages, fixedImage, itemChromes),
  "utf8"
);

const gatesPath = path.join(outputDir, "pptx-stage-gates.md");
const note =
  "目录模板定义已生成：agenda-template.json + 高清固定底图 " +
  fixedImage.relativePath +
  " + 独立条背景/编号方块；不单独输出目录 PPTX，待 build-framework-deck 装配";
if (await pathExists(gatesPath)) {
  let gates = await readFile(gatesPath, "utf8");
  const next = gates.replace(/^\| P3 \|.*?\|$/m, "| P3 | 部分完成 | " + note + " |");
  if (next !== gates) await writeFile(gatesPath, next, "utf8");
} else {
  await writeFile(
    gatesPath,
    "# P3 阶段门禁\n\n| 门禁 | 状态 | 证据/说明 |\n|---|---|---|\n| P3 | 部分完成 | " + note + " |\n",
    "utf8"
  );
}

process.stdout.write(
  "目录页模板完成：" +
    pages.length +
    " 页，模板 " +
    AGENDA_TEMPLATE_ID +
    "\n" +
    "- 固定底图：" +
    fixedImage.path +
    " (" +
    fixedImage.width +
    "x" +
    fixedImage.height +
    ")\n" +
    "- 条目组件：" +
    Object.keys(itemChromes).length +
    " 档\n" +
    "- 模型：" +
    modelPath +
    "\n" +
    "- 品牌：" + brand.name + " (" + brand.key + ")\n" +
    "- 说明：不单独输出目录 PPTX，目录页由 build-framework-deck.mjs 装配进 framework-deck.pptx\n"
);
