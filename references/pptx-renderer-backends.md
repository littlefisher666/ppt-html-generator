# 非 Codex PPTX 渲染后端

本文件只在未使用 Codex Presentations runtime 时使用。非 Codex 环境统一要求安装 LibreOffice，并将其作为
PPTX 自动渲染后端；不使用 WPS 或 Microsoft PowerPoint 的自动化接口。WPS 和 Microsoft PowerPoint 可以用于
打开、编辑或人工抽查 PPTX，但不得承担 L2 自动渲染验收。

目标是在每次 PPTX 修复后，全自动重新导出逐页 PNG，让大模型执行 L2 视觉比对，尽量避免人工介入。

## 安装与选择

1. 记录操作系统、版本、LibreOffice 版本和安装来源；无需询问用户日常使用 WPS 还是 Microsoft PowerPoint。
   同时检查 HTML/PPTX 所需字体在此渲染环境可用；发生字体替代时，记录替代字体、受影响页面和是否接受该替代。
2. 检测 `soffice` 或 `libreoffice` 是否可执行；若缺失，必须安装 LibreOffice，安装失败则 P1 失败，不得以
   WPS、PowerPoint 或人工导出替代自动验收。
3. 可优先使用系统包管理器安装：macOS 使用 `brew install --cask libreoffice`；Windows 使用
   `winget install --id TheDocumentFoundation.LibreOffice`；Linux 使用发行版包管理器安装 `libreoffice`。若
   包管理器不可用，可从 LibreOffice 官方安装包安装，并记录实际安装方式。
4. 使用 LibreOffice 无界面模式将最小 PPTX 导出为 PDF，再使用已确定的 PDF 栅格化工具逐页生成
   `1600 × 900` PNG。优先使用 `pdftoppm`；也可使用已验证的 ImageMagick 或同等本地工具。工具必须可重复
   执行；缺失时安装并记录安装来源。不得将非 16:9 页面拉伸为目标尺寸，必须先修正页面尺寸或按等比例渲染。
5. 用最小 PPTX 冒烟验证：检查 PDF 可生成、PNG 页数与 PPTX 一致、页序稳定、每张 PNG 为 `1600 × 900`，并
   实际查看至少一张渲染图，确认不是空白页、错误字体或明显渲染失败。
6. 验证通过后，将实际导出命令、PDF 栅格化命令和输出命名写入
   `exports/pptx/render-backend-plan.md`。每次 PPTX 修复后，必须重新生成全部 PNG；不得复用旧渲染图。

## 自动化链路

```text
<deck-name>.pptx
  → LibreOffice（headless）导出 PDF
  → PDF 栅格化工具导出逐页 PNG（1600 × 900）
  → pptx-renders/slide-<页码>.png
```

具体命令随操作系统和已安装 PDF 工具而定，但必须在 P1 的冒烟验证中实际执行成功。`render-backend-plan.md`
必须记录 LibreOffice 命令、PDF 栅格化命令、PDF 页尺寸、PNG 尺寸和实际字体/替代字体。不得在未验证导出结果的
情况下声称后端可自动工作；不得把一次性的人工导出误记为自动化方案。

## `render-backend-plan.md` 最小内容

```markdown
# PPTX 渲染后端方案

- 操作系统：macOS 15
- 后端：LibreOffice + PDF 栅格化工具
- LibreOffice：24.8｜Homebrew Cask
- 字体：Times New Roman、<中文字体>｜替代：无
- 自动化：`soffice --headless` → PDF → PNG
- 输入：`exports/pptx/<deck-name>.pptx`
- 输出：`exports/pptx/pptx-renders/slide-<页码>.png`（1600 × 900）
- 冒烟验证：通过｜命令与时间
- 冒烟结果：PDF 页数/尺寸、PNG 页数/尺寸、抽查页视觉结果
- 复测：每次 PPTX 写入后，重新导出全部页面，再运行叠加/差异图与大模型审查
- 人工介入：无
```
