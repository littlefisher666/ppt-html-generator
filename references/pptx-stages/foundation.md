# 输入与转换基础条件

## 进入条件

尚未创建或修改正式交付 PPTX。

## 必读

1. [HTML 转 PPTX 工作流](../html-to-pptx.md)；
2. [全局硬约束](../global-constraints.md)；
3. 输入 deck 的 `assets/deck.js`、`exports/final-regression.md`、`exports/stage-gates.md`；
4. [字体与坐标](../typography.md)。
5. [非 Codex 渲染后端选择](../pptx-renderer-backends.md)。

## 执行

1. 确认输入 deck 存在、页序唯一来源为 `assets/deck.js`，且 HTML G7 或等价外部验收已通过。
2. 确认页面为 `1600 × 900` px、目标 PPTX 为 `13.333″ × 7.5″`，并记录坐标与字体换算规则。
3. 确认所有引用资源可读取、使用相对路径，且目标字体在 PPTX 生成和渲染环境均可用，或已有明确且已接受的
   替代方案。
4. 在转换器项目根目录检测本地 `playwright` npm 包和 Chromium 浏览器。必须使用项目本地依赖，禁止依赖全局
   安装或机器上偶然存在的浏览器。
5. 若 npm 包缺失，直接在转换器项目根目录执行 `npm install --save-dev playwright`；若 Chromium 缺失，执行
   `npx playwright install chromium`。安装失败即 P1 失败，不得跳过 P2 所需的截图能力。
6. 安装或检测完成后，实际启动一次 `playwright.chromium`，验证可创建无头浏览器、`1600 × 900` 页面和
   `deviceScaleFactor: 1` 的浏览器上下文；仅包可解析但浏览器不能启动，视为失败。
7. 选择一个 PPTX 渲染后端，并确认它能以稳定页序输出逐页 PNG，供大模型与 HTML 截图比较。仅在 Codex
   Presentations runtime 可完成 setup 且最小 PPTX 实际渲染成功时，才可选择内置 `artifact-tool`；运行 setup
   脚本初始化临时工作区。它链接的是 Codex 内置运行时，不得以 `npm install @oai/artifact-tool` 替代。
8. 未检测到 Codex runtime，或 Codex runtime 的 setup / 最小渲染验证失败时，严格按
   `pptx-renderer-backends.md` 检测并安装 LibreOffice；不得询问或依据用户使用 WPS 还是 Microsoft PowerPoint，
   也不得使用其自动化接口替代。生成 LibreOffice 导出 PDF 与 PDF 栅格化为 PNG 的可重复命令方案，并写入
   `exports/pptx/render-backend-plan.md`。
9. 使用所选后端完成最小渲染验证：Codex 后端须确认渲染命令、页数、页序、PNG 尺寸与至少一张实际渲染图；
   LibreOffice 后端还须按后端选择文档确认 PDF、PDF 栅格化、字体/替代字体和 PNG。安装、初始化或验证失败即
   P1 失败，不得继续 P2，也不得以人工导出绕过。
10. 在 `exports/pptx/tasks.md` 创建本次转换任务清单，覆盖 P1–P6、逐页内容复原、返工和最终验收。
11. 创建 `exports/pptx/pptx-stage-gates.md`，记录 P1 检查结果。

## P1 检查与交接

写入 `exports/pptx/input-review.md`，至少记录输入路径、页数与页序、HTML 门禁证据、页面尺寸、资源/字体状态、
转换输出目录和阻塞项。另写入 `exports/pptx/runtime-dependency-review.md`，记录 Playwright/npm 包版本、Chromium
版本、检测或安装命令、无头浏览器启动验证结果，以及所选 PPTX 渲染后端、版本、初始化/导出操作、最小渲染
验证结果和失败项。若选用 `artifact-tool`，额外记录其运行时路径、版本、setup 命令和工作区导入结果；若选用
LibreOffice，额外记录 PDF 栅格化工具、字体/替代字体、PDF 页尺寸及其验证结果。
另写入 `exports/pptx/render-backend-plan.md`：若选用 `artifact-tool`，记录运行时版本、setup 与渲染命令；若
选用 LibreOffice，记录 LibreOffice 与 PDF 栅格化工具的版本及安装来源、自动化方式、实际命令、输出命名和每轮
复测方式。`tasks.md`、三份记录与 `pptx-stage-gates.md` 齐全且通过后，方可进入 P2。
