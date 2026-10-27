# 视觉基准与页面映射

## 进入条件

P1 已通过。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. [全局硬约束](../global-constraints.md)；
3. `pptx/P1/input-review.md`、`P1/runtime-dependency-review.md`、`P1/tasks.md`、`P1/pptx-stage-gates.md`；
4. 输入 deck 的 `assets/deck.js`、页面 HTML 与共享 CSS。

## 执行

### 截图方式（固定）

必须使用 **Playwright Chromium** 的无头浏览器截图，由技能内置的
`scripts/capture-html-slides.mjs` 统一执行；不得使用人工截图、浏览器开发者工具截图、系统截屏或其他浏览器。
脚本必须在 deck 根目录启动本地静态 HTTP 服务器，再按 `assets/deck.js` 的唯一页序逐页访问，不能按文件系统
遍历或直接打开 `file://` 路径。

每页渲染必须满足以下固定参数：

- Chromium 视口 `1600 × 900`，`deviceScaleFactor: 1`，输出 PNG 必须恰为 `1600 × 900` px；
  这是**检查用截图**，清晰度以可辨认为准，不得当作贴入 PPT 的交付图；
- 截图模式会固定 `.viewport > .frame > .stage > .slide` 至左上对齐的 `1600 × 900`，覆盖预览脚本的缩放和留白；截图中不得出现右侧或下侧空白；
- 截图前会移除 `[data-ppt-ui]`（包括 `.slide-nav`）标记的交互 UI；翻页按钮等预览控件不得进入基准图；
- 使用 `prefers-reduced-motion: reduce`，并在页面加载后冻结 CSS 动画和 transition，确保截图可复现；
- 等待页面 `load`、`document.fonts.ready` 和连续两帧 `requestAnimationFrame` 后截图；任一资源、字体或页面脚本
  加载失败即失败，不得以未完成渲染的截图继续；
- 使用可见视口截图（`fullPage: false`），不得裁切、缩放、拼接或后处理；
- 输出命名为 `<页码两位数>-<slide 文件名>.png`，例如 `05-device-status.png`，保存至
  `pptx/P2/html-screenshots/`。

P1 通过后执行（`<skill>` 为本技能目录）：

```bash
node <skill>/scripts/capture-html-slides.mjs <deck-root>
```

该命令在同一轮 Playwright 渲染中完成 HTML 基准截图与 `page-map.json`，并顺带写出坐标/文字 metrics
（`coordinate-map.json`、`text-metrics.json`）与 SVG 框线图；混合版流程不依赖这些额外产物，仅作调试参考。
任一关键产物（截图或 `page-map.json`）缺失、页数不符或截图尺寸不是 1600×900，P2 不得通过。

### 建立页面映射

1. 按 `assets/deck.js` 页序为每个 HTML 页面截图，保存至 `pptx/P2/html-screenshots/`，记录页码、文件名、
   尺寸和生成时间。
2. 校验 `pptx/P2/page-map.json`：页号连续、`href` 与实际文件一致、每页都有 `screenshot` 字段；后续 P3
   只按该映射比对，禁止依赖文件名自然排序。
3. 确认 HTML 截图中没有残留导航按钮、缩放留白或被截断的页面；有则修复截图条件后整页重跑。
4. 将 Playwright 与 Chromium 版本、实际命令、服务器地址、页数与失败项写入 `pptx/P2/baseline-review.md`。

## P2 检查与交接

`P2/html-screenshots/` 页数、尺寸、页序与 `deck.js` 一致，`page-map.json` 可读且逐页有截图路径，
`baseline-review.md` 记录完整后，在 `P2/pptx-stage-gates.md` 标记 P2 通过。
