#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const argumentsList = process.argv.slice(2);
const allowReviewSource = argumentsList.includes("--allow-review-source");
const directoryArgument = argumentsList.find((argument) => argument !== "--allow-review-source");
const assetDirectory = path.resolve(directoryArgument || "assets/hengda");
const manifestPath = path.join(assetDirectory, "template-manifest.json");
const reviewSourceName = "恒达智控母版.pptx";

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function fail(message) {
  process.stderr.write(`恒达素材校验失败: ${message}\n`);
  process.exitCode = 1;
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entries = Object.values(manifest.assets || {});

  if (entries.length !== 7) {
    await fail(`manifest 应包含 7 个媒体素材，实际为 ${entries.length} 个`);
  } else {
    const expectedFiles = new Set(["template-manifest.json"]);

    for (const entry of entries) {
      const fileName = entry && entry.file;
      const expectedHash = entry && entry.sha256;
      if (!fileName || !expectedHash || path.basename(fileName) !== fileName) {
        await fail("manifest 中存在无效文件名或哈希");
        break;
      }

      expectedFiles.add(fileName);
      const filePath = path.join(assetDirectory, fileName);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile() || fileStat.size === 0) {
        await fail(`素材为空或不是文件: ${fileName}`);
        break;
      }

      const actualHash = await sha256(filePath);
      if (actualHash !== expectedHash) {
        await fail(`哈希不一致: ${fileName}`);
        break;
      }
    }

    if (!process.exitCode) {
      const actualFiles = (await readdir(assetDirectory)).filter((name) => !name.startsWith("."));
      const unexpected = actualFiles.filter(
        (name) => !expectedFiles.has(name) && !(allowReviewSource && name === reviewSourceName),
      );
      const missing = [...expectedFiles].filter((name) => !actualFiles.includes(name));

      if (unexpected.length) {
        await fail(`存在未登记文件: ${unexpected.join(", ")}`);
      } else if (missing.length) {
        await fail(`缺少文件: ${missing.join(", ")}`);
      } else if (
        allowReviewSource
        && actualFiles.includes(reviewSourceName)
        && await sha256(path.join(assetDirectory, reviewSourceName)) !== manifest.sourceSha256
      ) {
        await fail(`复核源哈希不一致: ${reviewSourceName}`);
      } else {
        const reviewSourceStatus = allowReviewSource && actualFiles.includes(reviewSourceName)
          ? "，复核 PPTX 哈希通过"
          : "";
        process.stdout.write(`恒达素材校验通过: ${assetDirectory}（7/7${reviewSourceStatus}）\n`);
      }
    }
  }
} catch (error) {
  await fail(error instanceof Error ? error.message : String(error));
}
