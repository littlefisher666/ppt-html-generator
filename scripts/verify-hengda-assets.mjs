#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const argumentsList = process.argv.slice(2);
const allowReviewSource = argumentsList.includes("--allow-review-source");
const sharedDirectoryIndex = argumentsList.indexOf("--shared-dir");
const sharedDirectoryArgument = sharedDirectoryIndex === -1
  ? undefined
  : argumentsList[sharedDirectoryIndex + 1];
const deckDirectoryIndex = argumentsList.indexOf("--deck");
const deckDirectoryArgument = deckDirectoryIndex === -1
  ? undefined
  : argumentsList[deckDirectoryIndex + 1];
const directoryArgument = argumentsList.find(
  (argument, index) => argument !== "--allow-review-source"
    && argument !== "--shared-dir"
    && argument !== "--deck"
    && !(sharedDirectoryIndex !== -1 && index === sharedDirectoryIndex + 1)
    && !(deckDirectoryIndex !== -1 && index === deckDirectoryIndex + 1),
);
const assetDirectory = path.resolve(directoryArgument || "assets/hengda");
const sharedAssetDirectory = sharedDirectoryArgument && path.resolve(sharedDirectoryArgument);
const deckDirectory = deckDirectoryArgument && path.resolve(deckDirectoryArgument);
const manifestPath = path.join(assetDirectory, "template-manifest.json");

const fixedRoleBackgrounds = [
  ["layout-cover", "cover-campus.jpg"],
  ["layout-section", "section-campus-night.png"],
  ["layout-closing", "closing-digital-globe.jpg"],
];

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function fail(message, brand = "品牌") {
  process.stderr.write(`${brand}素材校验失败: ${message}\n`);
  process.exitCode = 1;
}

async function resolveAsset(fileName) {
  const localPath = path.join(assetDirectory, fileName);
  try {
    if ((await stat(localPath)).isFile()) return localPath;
  } catch {}

  if (sharedAssetDirectory) {
    const sharedPath = path.join(sharedAssetDirectory, fileName);
    try {
      if ((await stat(sharedPath)).isFile()) return sharedPath;
    } catch {}
  }

  throw new Error(`缺少素材: ${fileName}`);
}

async function verifyFixedRoleBackgrounds() {
  if (!deckDirectory) return;

  const cssPath = path.join(deckDirectory, "assets", "ppt.css");
  const css = await readFile(cssPath, "utf8");
  for (const [role, fileName] of fixedRoleBackgrounds) {
    const blocks = css.match(new RegExp(`\\.${role}\\s*\\{[^}]*\\}`, "gs")) || [];
    const expectedUrl = `./brand/${fileName}`;
    if (blocks.length !== 1 || !blocks[0].includes("background-image") || !blocks[0].includes(expectedUrl)) {
      throw new Error(`${role} 必须且只能引用 ${expectedUrl}`);
    }
  }

  const slideDirectory = path.join(deckDirectory, "slides");
  const slideFiles = (await readdir(slideDirectory)).filter((name) => name.endsWith(".html"));
  for (const slideFile of slideFiles) {
    const html = await readFile(path.join(slideDirectory, slideFile), "utf8");
    for (const [role] of fixedRoleBackgrounds) {
      const matchingTags = html.match(/<[^>]+>/g) || [];
      const hasInlineOverride = matchingTags.some(
        (tag) => tag.includes(role) && /style=["'][^"']*background/i.test(tag),
      );
      const hasStyleOverride = new RegExp(
        `<style[^>]*>[\\s\\S]*?\\.${role}\\s*\\{[^}]*background`,
        "i",
      ).test(html);
      if (hasInlineOverride || hasStyleOverride) {
        throw new Error(`${slideFile} 中的 .${role} 不得用页面样式覆盖背景图`);
      }
    }
  }
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const brand = manifest.brand || "恒达智控";
  const reviewSourceName = manifest.sourceFile || "恒达智控母版.pptx";
  const entries = Object.values(manifest.assets || {});

  if (entries.length !== 7) {
    await fail(`manifest 应包含 7 个媒体素材，实际为 ${entries.length} 个`, brand);
  } else {
    const expectedFiles = new Set(["template-manifest.json"]);

    for (const entry of entries) {
      const fileName = entry && entry.file;
      const expectedHash = entry && entry.sha256;
      if (!fileName || !expectedHash || path.basename(fileName) !== fileName) {
        await fail("manifest 中存在无效文件名或哈希", brand);
        break;
      }

      expectedFiles.add(fileName);
      const filePath = await resolveAsset(fileName);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile() || fileStat.size === 0) {
        await fail(`素材为空或不是文件: ${fileName}`, brand);
        break;
      }

      const actualHash = await sha256(filePath);
      if (actualHash !== expectedHash) {
        await fail(`哈希不一致: ${fileName}`, brand);
        break;
      }
    }

    if (!process.exitCode) {
      const actualFiles = (await readdir(assetDirectory)).filter((name) => !name.startsWith("."));
      const unexpected = actualFiles.filter(
        (name) => !expectedFiles.has(name) && !(allowReviewSource && name === reviewSourceName),
      );
      if (unexpected.length) {
        await fail(`存在未登记文件: ${unexpected.join(", ")}`, brand);
      } else if (
        allowReviewSource
        && actualFiles.includes(reviewSourceName)
        && await sha256(path.join(assetDirectory, reviewSourceName)) !== manifest.sourceSha256
      ) {
        await fail(`复核源哈希不一致: ${reviewSourceName}`, brand);
      } else {
        await verifyFixedRoleBackgrounds();
        const reviewSourceStatus = allowReviewSource && actualFiles.includes(reviewSourceName)
          ? "，复核 PPTX 哈希通过"
          : "";
        const deckStatus = deckDirectory ? "，封面/过渡页/封底背景锁定通过" : "";
        process.stdout.write(`${brand}素材校验通过: ${assetDirectory}（7/7${reviewSourceStatus}${deckStatus}）\n`);
      }
    }
  }
} catch (error) {
  await fail(error instanceof Error ? error.message : String(error));
}
