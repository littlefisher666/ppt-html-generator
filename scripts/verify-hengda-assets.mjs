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
const directoryArgument = argumentsList.find(
  (argument, index) => argument !== "--allow-review-source"
    && argument !== "--shared-dir"
    && !(sharedDirectoryIndex !== -1 && index === sharedDirectoryIndex + 1),
);
const assetDirectory = path.resolve(directoryArgument || "assets/hengda");
const sharedAssetDirectory = sharedDirectoryArgument && path.resolve(sharedDirectoryArgument);
const manifestPath = path.join(assetDirectory, "template-manifest.json");

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
        const reviewSourceStatus = allowReviewSource && actualFiles.includes(reviewSourceName)
          ? "，复核 PPTX 哈希通过"
          : "";
        process.stdout.write(`${brand}素材校验通过: ${assetDirectory}（7/7${reviewSourceStatus}）\n`);
      }
    }
  }
} catch (error) {
  await fail(error instanceof Error ? error.message : String(error));
}
