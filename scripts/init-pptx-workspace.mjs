#!/usr/bin/env node

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertDeckInput } from "./pptx-html-utils.mjs";

const input = process.argv[2];
if (!input || process.argv.length !== 3) {
  process.stderr.write("用法: node scripts/init-pptx-workspace.mjs <deck-root>\n"); process.exit(64);
}
const deckRoot = path.resolve(input);
const deck = await assertDeckInput(deckRoot);
const output = path.join(deckRoot, "pptx");
for (const name of ["P1", "P2/html-screenshots", "P3/backgrounds", "P3/calibration", "P3/pptx-renders", "P3/comparison"]) {
  await mkdir(path.join(output, name), { recursive: true });
}
const files = {
  "P1/tasks.md": `# HTML 转 PPTX 任务清单\n\n- [ ] P1 输入与运行时\n- [ ] P2 视觉基准与页面映射\n- [ ] P3 文字真值采集与无字背景\n- [ ] P3 基线标定\n- [ ] P3 文字计划与 PPTX 组装\n- [ ] P3 渲染、逐页比对与验收记录\n`,
  "P1/input-review.md": `# 输入复核\n\n- Deck：${deckRoot}\n- 标题：${deck.title || "未声明"}\n- 页数：${deck.slides.length}\n- 状态：待补充 G7/等价验收、资源和字体复核。\n`,
};
for (const stage of ["P1", "P2", "P3"]) {
  files[`${stage}/pptx-stage-gates.md`] = `# ${stage} 阶段门禁\n\n| 门禁 | 状态 | 证据/说明 |\n|---|---|---|\n| ${stage} | 未开始 | |\n`;
}
for (const [name, content] of Object.entries(files)) {
  const target = path.join(output, name);
  try { await stat(target); } catch (error) { if (error?.code === "ENOENT") await writeFile(target, content, "utf8"); else throw error; }
}
process.stdout.write(`PPTX 工作区已就绪：${output}\n`);
