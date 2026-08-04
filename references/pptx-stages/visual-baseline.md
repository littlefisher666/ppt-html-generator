# 视觉基准与定位模型

## 进入条件

P1 已通过。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. [全局硬约束](../global-constraints.md)；
3. `exports/pptx/input-review.md`、`runtime-dependency-review.md`、`tasks.md`、`pptx-stage-gates.md`；
4. 输入 deck 的 `assets/deck.js`、页面 HTML 与共享 CSS。

## 执行

### 截图方式（固定）

必须使用 **Playwright Chromium** 的无头浏览器截图，由技能内置的
`scripts/capture-html-slides.mjs` 统一执行；不得使用人工截图、浏览器开发者工具截图、系统截屏或其他浏览器。
脚本必须在 deck 根目录启动本地静态 HTTP 服务器，再按 `assets/deck.js` 的唯一页序逐页访问，不能按文件系统
遍历或直接打开 `file://` 路径。

每页渲染必须满足以下固定参数：

- Chromium 视口 `1600 × 900`，`deviceScaleFactor: 1`，输出 PNG 必须恰为 `1600 × 900` px；
- 使用 `prefers-reduced-motion: reduce`，并在页面加载后冻结 CSS 动画和 transition，确保截图可复现；
- 等待页面 `load`、`document.fonts.ready` 和连续两帧 `requestAnimationFrame` 后截图；任一资源、字体或页面脚本
  加载失败即失败，不得以未完成渲染的截图继续；
- 使用可见视口截图（`fullPage: false`），不得裁切、缩放、拼接或后处理；
- 输出命名为 `<页码两位数>-<slide 文件名>.png`，例如 `05-device-status.png`，保存至
  `exports/pptx/html-screenshots/`。

转换器实现时必须将 Playwright 及其 Chromium 版本、实际执行命令、服务器地址和截图失败项写入
`exports/pptx/baseline-review.md`。P1 的 `runtime-dependency-review.md` 未通过，或截图脚本未落地并验证时，
P2 不得标记为通过。

P1 通过后执行（`<skill>` 为本技能目录）：

```bash
node <skill>/scripts/capture-html-slides.mjs <deck-root>
node <skill>/scripts/extract-html-coordinate-map.mjs <deck-root>
```

前者同时根据 `assets/deck.js` 写入 `page-map.json`；后者写入 `coordinate-map.json` 和 SVG 框线图。任何一个
命令失败都必须修复输入或运行时，不得用临时脚本或手工产物替代。

### 建立基准与定位模型

1. 使用上述固定方式为每个 HTML 页面截图，保存至 `exports/pptx/html-screenshots/`，并记录页码、文件名、尺寸和
   生成时间。
2. 创建同页数、同页面尺寸的 PPTX，将每页截图作为临时视觉基准层铺入对应页面；校验页序、尺寸和位置。整页
   截图仅用于复原和比对，不得作为最终成品内容。
3. 从实际 DOM 与计算样式提取模板元素、文字、媒体和其他可见元素的边界、层级和类型，写入
   `exports/pptx/coordinate-map.json`；每个元素至少记录稳定标识、页码、类型、可见性、可编辑性、来源、
   `x/y/width/height`、层级、变换/裁切/透明度及降级方式（如有）。生成逐页框线图至
   `exports/pptx/guide-frames/` 并作为临时 PPTX 辅助层。
4. 按 `assets/deck.js` 页序创建 `exports/pptx/page-map.json`，一一记录页号、HTML 文件、HTML 截图、PPTX 页号和
   PPTX 渲染图的目标路径；后续阶段只能按该映射比对，禁止依赖文件名自然排序。

## P2 检查与交接

写入 `exports/pptx/baseline-review.md`，逐页记录截图、PPTX 基准层、框线图和坐标清单的页序/尺寸/路径，以及
提取失败或不支持元素。所有页面一一对应、坐标清单和页面映射均可读取后，在 `pptx-stage-gates.md` 标记 P2 通过。
