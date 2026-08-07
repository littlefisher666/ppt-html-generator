#!/usr/bin/env node

/**
 * PPTX 转换用品牌识别：三品牌版式/几何统一，差异主要在 Logo 与场景背景。
 * 以 deck 内 assets/brand/logo-color.png 的 SHA-256 匹配技能内置 manifest。
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BRAND_KEYS = ["hengda", "chuangxin", "zhengmeiji"];

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function pathExists(target) {
  try { await stat(target); return true; } catch { return false; }
}

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

export async function loadSkillBrandManifest(brandKey) {
  const manifestPath = path.join(skillRoot, "assets", brandKey, "template-manifest.json");
  if (!(await pathExists(manifestPath))) throw new Error("缺少品牌 manifest：" + brandKey);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return {
    key: brandKey,
    name: manifest.brand,
    manifestPath,
    manifest,
    logoColorSha256: manifest.assets?.logoColor?.sha256,
    logoWhiteSha256: manifest.assets?.logoWhite?.sha256,
  };
}

export async function listSupportedBrands() {
  const brands = [];
  for (const key of BRAND_KEYS) brands.push(await loadSkillBrandManifest(key));
  return brands;
}

export async function detectDeckBrand(deckRoot) {
  const brandDir = path.join(deckRoot, "assets", "brand");
  const logoColorPath = path.join(brandDir, "logo-color.png");
  const logoWhitePath = path.join(brandDir, "logo-white.png");
  if (!(await pathExists(logoColorPath))) throw new Error("缺少 deck 品牌彩色 Logo：assets/brand/logo-color.png");
  if (!(await pathExists(logoWhitePath))) throw new Error("缺少 deck 品牌白色 Logo：assets/brand/logo-white.png");

  const logoHash = await sha256File(logoColorPath);
  const whiteHash = await sha256File(logoWhitePath);
  const brands = await listSupportedBrands();
  const matched = brands.find((item) => item.logoColorSha256 === logoHash);
  if (!matched) {
    const known = brands.map((item) => item.name + "(" + item.key + ")").join("、");
    throw new Error("无法识别 deck 品牌：assets/brand/logo-color.png 哈希 " + logoHash + " 不在已支持品牌清单中。当前支持：" + known);
  }
  if (matched.logoWhiteSha256 && matched.logoWhiteSha256 !== whiteHash) {
    throw new Error("品牌 " + matched.name + " 的白色 Logo 哈希与技能内置 manifest 不一致；请使用 prepare-brand-assets 复制官方素材");
  }

  const deckManifestPath = path.join(brandDir, "template-manifest.json");
  let deckManifest = matched.manifest;
  if (await pathExists(deckManifestPath)) {
    const local = JSON.parse(await readFile(deckManifestPath, "utf8"));
    if (local.brand && local.brand !== matched.name) {
      throw new Error("deck 内 template-manifest.json 品牌为 " + local.brand + "，与 Logo 识别结果 " + matched.name + " 不一致");
    }
    deckManifest = local;
  }

  return {
    key: matched.key,
    name: matched.name,
    manifest: deckManifest,
    skillManifest: matched.manifest,
    logoColorPath,
    logoWhitePath,
    brandDir,
    logoColorSha256: logoHash,
    logoWhiteSha256: whiteHash,
  };
}

export function brandAssetPaths(deckRoot) {
  const brandDir = path.join(deckRoot, "assets", "brand");
  return {
    coverBackground: path.join(brandDir, "cover-campus.jpg"),
    sectionBackground: path.join(brandDir, "section-campus-night.png"),
    closingBackground: path.join(brandDir, "closing-digital-globe.jpg"),
    logoWhite: path.join(brandDir, "logo-white.png"),
    logoColor: path.join(brandDir, "logo-color.png"),
    agendaHidden: path.join(brandDir, "agenda-welding.jpg"),
    texture: path.join(brandDir, "theme-texture.jpg"),
  };
}
