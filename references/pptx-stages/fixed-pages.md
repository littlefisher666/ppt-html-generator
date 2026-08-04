# 固定版式页面复原

## 进入条件

P3 已通过。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. `exports/pptx/coordinate-map.json`、`template-review.md`、`tasks.md`、`pptx-stage-gates.md`；
3. 对应 HTML 页、框线图和品牌母版映射。

## 执行

复原封面、目录、过渡页和封底的文字及页面私有固定元素。每个文字框和可见文本边界必须与框线图一致；检查
字体、换行、裁切、重叠和层级。页数、标题、副标题和目录条目只能以 `assets/deck.js` 和实际 HTML 为准。

## P4 检查与交接

写入 `exports/pptx/fixed-pages-review.md`，按页记录元素边界、文字校验、框线匹配、异常及复测结论。所有固定
版式页通过后，在 `pptx-stage-gates.md` 标记 P4 通过。
