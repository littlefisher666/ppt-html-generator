#!/usr/bin/env node

import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outputArgument = process.argv[2];

if (!outputArgument || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/init-deck-scaffold.mjs <deck-output-directory>\n");
  process.exit(64);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.resolve(scriptDirectory, "..");
const templateDirectory = path.join(skillDirectory, "templates");
const outputDirectory = path.resolve(outputArgument);

const copies = [
  [path.join(templateDirectory, "tokens.css"), path.join(outputDirectory, "assets", "ppt.css")],
  [path.join(templateDirectory, "deck.js"), path.join(outputDirectory, "assets", "deck.js")],
  [path.join(templateDirectory, "slide.js"), path.join(outputDirectory, "assets", "slide.js")],
  [path.join(templateDirectory, "index.html"), path.join(outputDirectory, "index.html")],
  [path.join(templateDirectory, "content"), path.join(outputDirectory, "templates", "content")],
  [path.join(templateDirectory, "cover-shell.html"), path.join(outputDirectory, "templates", "cover-shell.html")],
  [path.join(templateDirectory, "agenda-shell.html"), path.join(outputDirectory, "templates", "agenda-shell.html")],
  [path.join(templateDirectory, "section-shell.html"), path.join(outputDirectory, "templates", "section-shell.html")],
  [path.join(templateDirectory, "slide-shell.html"), path.join(outputDirectory, "templates", "slide-shell.html")],
  [path.join(templateDirectory, "closing-shell.html"), path.join(outputDirectory, "templates", "closing-shell.html")],
];

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

const occupied = [];
for (const [, target] of copies) {
  if (await exists(target)) occupied.push(path.relative(outputDirectory, target));
}

if (occupied.length) {
  process.stderr.write(`拒绝覆盖已有文件: ${occupied.join(", ")}\n`);
  process.exit(65);
}

for (const [source, target] of copies) {
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, errorOnExist: true, force: false });
}

await mkdir(path.join(outputDirectory, "slides"), { recursive: true });
await mkdir(path.join(outputDirectory, "assets", "media"), { recursive: true });
process.stdout.write(`已初始化 deck 静态模板: ${outputDirectory}\n`);
