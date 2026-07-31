# 全局硬约束

本文件对所有阶段生效。每次执行阶段前必须阅读；任何阶段文档均不得放宽这些约束。

## 品牌、母版与资源

- 只能使用所选公司的映射与素材：恒达智控对应 `references/hengda-template.md` 与 `assets/hengda/`；
  创信数智对应 `references/chuangxin-template.md` 与 `assets/chuangxin/`；郑煤机对应
  `references/zhengmeiji-template.md` 与 `assets/zhengmeiji/`。必须先阅读映射再生成页面。
- 内置素材仅可从所选公司目录或经 manifest 哈希确认、逐字节相同的 `assets/shared/` 解析；不得混用
  公司专属 Logo、只参考配色或另造相似模板。
- 封面、过渡页（章节页）和封底背景图不可替换：必须分别使用 `assets/brand/cover-campus.jpg`、
  `assets/brand/section-campus-night.png`、`assets/brand/closing-digital-globe.jpg`。不得用用户图、
  项目图、网络图、渐变、CSS 覆盖层替换、遮蔽或重定义，也不得修改三个 layout 的背景图片引用。
- 母版素材只从 `assets/brand/` 引用；项目内容素材只从 `assets/media/` 引用；禁止绝对路径、外部路径、
  base64 复制素材和未登记资源。原始 PPTX 只读且原地保留，除非用户明确要求删除。

## 画布、字体与视觉结构

- 固定舞台为 `1600 × 900` px；PPT 页面 `13.333″ × 7.5″`；`1 HTML px = 7620 EMU`。
  字体换算为 `pt = px × 0.6`、`px = pt × 5/3`，不得使用浏览器默认 pt 换算。
- 公司确认后必须确认字体并运行 `node scripts/check-system-font.mjs "<fontFamily>"`。未通过时停止；
  目标系统字体状态未知时只能记录待确认。所选字体栈同时写入 `assets/ppt.css` 的三个 font token。
- 只使用共享整数 pt token、`400/700` 字重和简单行高。内容页标题遵循母版 `32pt` 意图；正文只用
  `14/16/18/20pt` 内容角色。详细规则见 `references/typography.md`。
- 内容页必须保留标题区、三段横线、右上彩色 Logo、正文安全区；封面/章节/封底必须使用对应母版
  结构。不得移动/重绘品牌 Logo、母版横线或固定背景以制造另一套视觉系统。

## 共享结构与导航

- 每个 deck 必须含 `index.html`、`assets/ppt.css`、`assets/deck.js`、`assets/slide.js`；页面顺序和
  目录元数据唯一来源是 `assets/deck.js`。
- 目录只显示页码、主标题、副标题；桌面 5 列，中等/小屏 2/1 列。每页底部必须有首页、上一页、
  当前页、下一页；四方向键翻页。导航在截图中保留，在打印/PPT 导出时隐藏。
- 不得维护平行 manifest、平行导航器或页内复制的导航逻辑。

## 失败处理与交付

- 不得用非法小字、`line-clamp`、省略号、全局 `overflow: hidden`、裁切或隐藏溢出来伪装修复。
- 每阶段通过后才可推进；任意共享 CSS、字体、导航、母版资源、页序或 `deck.js` 改动，都必须重测
  受影响阶段。G7 未通过不得交付。
