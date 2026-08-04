# 共享模板复原

## 进入条件

P2 已通过，框线图和坐标清单已就绪。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. [全局硬约束](../global-constraints.md)；
3. `exports/pptx/coordinate-map.json`、`baseline-review.md`、`tasks.md`、`pptx-stage-gates.md`；
4. 所选公司母版映射和品牌资源。

## 执行

复原背景、Logo、标题区、横线及其他跨页共享模板元素。元素应来自输入 deck 的真实资源和坐标清单，不得重绘
或替换品牌素材。逐项将 PPTX 元素的可见边界、比例、层级与框线图对比；不支持的样式必须记录为显式降级。

## P3 检查与交接

写入 `exports/pptx/template-review.md`，记录每个共享元素的来源、页面范围、目标/实际边界、比例、层级、框线
校验结果和降级项。全部共享元素通过后，在 `pptx-stage-gates.md` 标记 P3 通过。
