# 内容页并行复原与逐页检查

## 进入条件

P4 已通过。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. `exports/pptx/coordinate-map.json`、`template-review.md`、`fixed-pages-review.md`、`tasks.md`、`pptx-stage-gates.md`；
3. 当前页面的 HTML、框线图、截图和实际媒体资源。

## 执行

1. 按内容页分配多个 subagent。每个 subagent 只处理分配页面、保存该页检查记录与交接信息；不得并发修改
   共享 PPTX 基础结构、页序、模板元素或坐标清单。共享问题由主代理串行修复，并重测所有受影响页面。
2. 每页先复原文字，校验文字框和可见文本边界位于对应框线内，无异常换行、裁切或重叠。
3. 再复原媒体资源、形状、表格、图表和其他元素，校验边界、媒体比例、层级和框线匹配；复杂或不支持元素的
   降级方式必须记录。
4. 每页通过后立即写入检查记录；不得等全部内容页完成后再集中验收。

## P5 检查与交接

每页写入 `exports/pptx/page-checks/<页码>-<文件名>.md`，记录负责 subagent、文字/媒体/其他元素的目标和实际
边界、框线校验、比例、层级、异常、降级与复测结论。将 subagent 原始交接记录保存到
`exports/pptx/subagent-handoffs/`。所有内容页均通过后，在 `pptx-stage-gates.md` 标记 P5 通过。
