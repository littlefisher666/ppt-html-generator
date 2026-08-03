# 内容页实现与逐页检查

## 进入条件

G5 已通过。必须读取 `exports/image-inventory.md` 和 `exports/media-frame-review.md`。

## 执行

仅在此阶段填入内容页正文、表格、数据卡和说明文字。标题、正文、表格、图像必须是独立语义盒；复用共享
class/token，不写页内字号。内容留在母版安全区，底部预留导航 UI；内容页保留标题区、三段横线、Logo。

每完成一个内容页，立即在 1600×900 下执行单页检查并写入
`exports/page-checks/<页码>-<文件名>.md`。未通过不得标记该页完成，不得等待所有页面写完再集中检查。

## G6 单页检查

1. 截图视觉审看：保存原始尺寸截图，审看并放大正文末行、表格、图注、卡片底栏与导航邻近区。每个文字、
   项目符号、标签、图注和末行必须完整可读，无缺笔画、半行、低对比遮蔽或可见重叠。
2. DOM 几何量测：比较文字及文本后代联合边界与父内容盒，检查 `scrollHeight/clientHeight/overflow`；所有
   可见元素满足 `left ≥ 0`、`top ≥ 0`、`right ≤ 1600`、`bottom ≤ 900`；正文、图表、图片、图注与导航
   可见边界不得相交。
3. 静态扫描：检查 HTML/CSS 的 `overflow: hidden/clip`、`line-clamp`、`text-overflow: ellipsis`、异常固定高度、
   负边距与叠层定位。受众可见文字不得依赖这些规则塞入固定空间。
4. 图片量测：对照清单读取 `naturalWidth × naturalHeight` 和 `getBoundingClientRect()` 渲染尺寸，计算
   `scaleX`、`scaleY`。`|scaleX - scaleY| / max(scaleX, scaleY) ≤ 1%`；渲染图片与媒体框的比例相对源图偏差
   均 ≤ 1%。确认 `object-fit: contain` 或等价实现，未使用 `fill`、`cover`、裁切祖先或负边距隐藏画面。

截图视觉结论优先于 DOM 与静态扫描。每页记录逐图源图尺寸、渲染尺寸、媒体框尺寸、缩放比、比例偏差、
`object-fit`、截图结论、三层检查结果、问题与复测结论；不得只写“图片正常”。

## 并行协作与 G6 门禁

所用 IDE 支持多个 subagent 时，必须按页面分配多个子代理并行检查。子代理只检查分配页面、保存该页记录并报告结果；不得并发修改
`assets/ppt.css`、`assets/deck.js`、`assets/slide.js`、`index.html` 或其他共享文件。共享文件修复由主代理
串行完成，再重测所有受影响页面。

所有内容页通过后运行：

```bash
node scripts/verify-hengda-assets.mjs <deck>/assets/brand --deck <deck>
```

记录固定背景与品牌资源校验结果；共享 CSS、页序或 `deck.js` 改动后重测受影响页面，必要时回退 G3。
