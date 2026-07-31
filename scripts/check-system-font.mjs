#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const requestedFont = process.argv.slice(2).join(" ").trim();
const aliases = new Map([
  ["微软雅黑", ["Microsoft YaHei", "微软雅黑"]],
  ["Microsoft YaHei", ["Microsoft YaHei", "微软雅黑"]],
  ["宋体", ["SimSun", "宋体", "宋體", "Songti SC", "STSong"]],
  ["SimSun", ["SimSun", "宋体", "宋體", "Songti SC", "STSong"]],
  ["仿宋", ["FangSong", "仿宋", "仿宋_GB2312", "STFangsong"]],
  ["FangSong", ["FangSong", "仿宋", "仿宋_GB2312", "STFangsong"]],
]);

function normalize(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function listSystemFonts() {
  if (process.platform === "linux") {
    const { stdout } = await execFileAsync("fc-list", ["--format", "%{family}\\n"], { maxBuffer: 16 * 1024 * 1024 });
    return stdout.split(/[,\n]/).map((name) => name.trim()).filter(Boolean);
  }

  if (process.platform === "darwin") {
    const { stdout } = await execFileAsync("system_profiler", ["SPFontsDataType", "-detailLevel", "mini"], { maxBuffer: 32 * 1024 * 1024 });
    return stdout
      .split("\n")
      .map((line) => line.trim().match(/^(?:Full Name|Family):\s*(.+)$/)?.[1])
      .filter(Boolean);
  }

  if (process.platform === "win32") {
    const command = "Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }";
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", command], { maxBuffer: 16 * 1024 * 1024 });
    return stdout.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  }

  throw new Error(`暂不支持的操作系统：${process.platform}`);
}

if (!requestedFont) {
  process.stderr.write("用法: node scripts/check-system-font.mjs <字体名称>\n");
  process.exit(64);
}

try {
  const installedFonts = await listSystemFonts();
  const installedByNormalizedName = new Map(installedFonts.map((name) => [normalize(name), name]));
  const candidates = aliases.get(requestedFont) || [requestedFont];
  const matched = candidates.map((name) => installedByNormalizedName.get(normalize(name))).find(Boolean);

  if (matched) {
    process.stdout.write(`字体可用：${requestedFont}（当前 ${process.platform} 系统匹配：${matched}）\n`);
  } else {
    process.stderr.write(`字体不可用：当前 ${process.platform} 系统未找到“${requestedFont}”。请安装该字体或重新选择。\n`);
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`字体检查失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
