# 完整页面框架与固定页装配

## 进入条件

P2 已通过，且 coordinate-map.json 已包含元素类型、父子关系与计算样式。

## 必读

1. HTML 转 PPTX 工作流 references/html-to-pptx.md；
2. pptx/P2/coordinate-map.json、P2/baseline-review.md、P1/tasks.md、P2/pptx-stage-gates.md；
3. 若 deck 含目录页：P3/agenda-template.json（可由 build-agenda-template.mjs 生成）。

## 执行

运行：

```bash
node SKILL_DIR/scripts/build-framework-deck.mjs DECK_ROOT
```

该命令会：

1. 按 assets/deck.js 的唯一页序一次性创建 P3/framework-deck.pptx（页数以 deck 实际页数为准，不硬编码 30）。
2. 对全部页面原生生成背景、Logo、标识线/三段横线、主标题、副标题、章节编号和内容安全区；不得使用整页 HTML 截图。
3. 同阶段完成全部固定版式页（封面、目录、章节、封底）的可编辑内容。
4. 内容页仅保留页面框架和空白业务安全区；业务区留给 P4。
5. 目录页固定元素复用 agenda-template.json；条目背景、编号方块、编号和标题保持独立对象。
6. **每一页必须叠加 P2 框线辅助层**：按 coordinate-map.json 的可见元素边界，以洋红色描边矩形（及 id 标签）写入 PPTX；形状名统一前缀 guide-frame:，供几何校验与后续移除。不得省略任一面板页。
7. 写出 P3/framework-model.json 与 P3/framework-review.md（复核文档须记录框线层已写入）。

随后仍须渲染 framework-deck.pptx 并与 P2/html-screenshots 逐页比对；仅结构装配成功时，门禁只能记为“部分完成”。

## P3 检查与交接

只有框架页数正确、固定页完整、内容页标题区对齐、**全部页面含框线辅助层**、framework-review.md 已生成，且完成渲染视觉比对后，才可在 P3/pptx-stage-gates.md 标记 P3 通过。
