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
const output = path.join(deckRoot, "exports", "pptx");
for (const name of ["html-screenshots", "guide-frames", "comparison", "pptx-renders", "page-checks", "subagent-handoffs"]) await mkdir(path.join(output, name), { recursive: true });
const files = {
  "tasks.md": `# HTML 转 PPTX 任务清单\n\n- [ ] P1 输入与运行时\n- [ ] P2 视觉基准与坐标\n- [ ] P3 共享模板\n- [ ] P4 固定版式页\n- [ ] P5 内容页\n- [ ] P6 最终回归与交付\n`,
  "pptx-stage-gates.md": `# PPTX 阶段门禁\n\n| 门禁 | 状态 | 证据/说明 |\n|---|---|---|\n| P1 | 未开始 | |\n| P2 | 未开始 | |\n| P3 | 未开始 | |\n| P4 | 未开始 | |\n| P5 | 未开始 | |\n| P6 | 未开始 | |\n`,
  "input-review.md": `# 输入复核\n\n- Deck：${deckRoot}\n- 标题：${deck.title || "未声明"}\n- 页数：${deck.slides.length}\n- 状态：待补充 G7/等价验收、资源和字体复核。\n`,
};
for (const [name, content] of Object.entries(files)) {
  const target = path.join(output, name);
  try { await stat(target); } catch (error) { if (error?.code === "ENOENT") await writeFile(target, content, "utf8"); else throw error; }
}
process.stdout.write(`PPTX 工作区已就绪：${output}\n`);
