---
name: ppt-html-generator
description: >
  Generate, inspect, and repair PPT-compatible HTML slide decks for Hengda Intelligent
  Control, Chuangxin Digital Intelligence, or Zhengzhou Coal Mining Machinery on a fixed
  1600×900 canvas. First require the user to select the company and a system-installed font,
  then use its bundled,
  pre-extracted master mapping, theme tokens, logos, and media assets as the required visual source;
  scaffold index.html plus a single slide manifest; and provide bottom-center
  current-page, previous, next, and home navigation with arrow-key paging. Always run
  the integrated QA and repair discovered issues. Use for ppt-html, HTML-to-PPT slide
  authoring, 1600×900 HTML slides, 恒达智控母版, 创信数智母版, 郑煤机母版, HTML 幻灯片目录, 幻灯片键盘翻页,
  slide overflow/alignment/image-crop checks, or /ppt-html-generator.
---

# 多品牌 PPT-Compatible HTML Generator

生成、修改和验收可转换为 PowerPoint 的 HTML 幻灯片。把 HTML 作为编辑面，
先确认用户要使用的公司：**恒达智控、创信数智或郑煤机**，再确认字体。未明确公司时，必须先问：
“请确认本次使用哪个公司母版：恒达智控、创信数智，还是郑煤机？”得到选择后才可生成
页面或复制素材。公司确认后，必须询问：
“请确认本次使用字体：微软雅黑、宋体、仿宋，或输入其他已安装字体。该字体必须安装在最终打开
HTML 的操作系统中；未安装时浏览器将回退到其他字体，无法保证效果。”把所选公司的母版映射与素材
作为唯一视觉来源，把整数 `pt` 意图作为字体真值。
原始 PPTX 只作为复核源，不是运行时依赖；若用户临时放回 PPTX，始终只读使用并原地保留，
只有用户明确确认后才可删除。

执行顺序：**确认公司与字体 → 读取/准备母版映射 → 建立目录与清单 → 生成各页 → 全量 QA → 修复 → 回归 → 交付**。
不得把 QA 留给用户，也不得在 QA 未通过时宣布完成。

## 强制交付契约

1. 始终使用所选公司的映射和素材：恒达智控对应
   [references/hengda-template.md](references/hengda-template.md) 与 `assets/hengda/`，创信数智对应
   [references/chuangxin-template.md](references/chuangxin-template.md) 与 `assets/chuangxin/`，郑煤机对应
   [references/zhengmeiji-template.md](references/zhengmeiji-template.md) 与 `assets/zhengmeiji/`。这些目录中的
   manifest 可解析同目录素材或 `assets/shared/` 的逐字节相同公共素材；不得混用公司专属 Logo、
   换成另一套模板，或仅“参考配色”。
2. 先阅读母版映射，再生成页面。不要把原始 PPTX 复制进输出 deck；若复核源存在，只读
   解析且不得擅自删除、移动或覆盖。
3. 每个 deck 必须包含 `index.html`。目录只列每页的**页码、主标题、副标题**，
   不放缩略图、状态标签、布局名、备注或正文摘要。桌面宽度默认每行 5 项；中等宽度
   可降为 2 项，小屏降为 1 项，不得在桌面退回一行 1 项。
4. 使用 `assets/deck.js` 作为唯一页面顺序与目录元数据源；`index.html` 和每页导航都读取它，
   不维护两套顺序。
5. 每页底部中间必须显示“首页 / 上一页 / 当前页 / 下一页”。鼠标可点击；
   `ArrowLeft`、`ArrowUp` 到上一页，`ArrowRight`、`ArrowDown` 到下一页。
6. 导航属于浏览器预览 UI，保留在 HTML 截图验收中，但在打印/PPT 导出时隐藏，
   不得成为 PPT 页面内容。
7. 生成前必须确认字体。提供“微软雅黑、宋体、仿宋”三个默认选项，并允许用户输入其他字体名称；
   必须提示用户：字体仅在最终操作系统已安装时可用，未安装会触发浏览器回退，不能把回退效果
   当作所选字体的验收结果。除非用户明确提供可合法使用的字体文件，否则不得下载、嵌入或伪造字体。
   用户选定后，必须运行 `node scripts/check-system-font.mjs "<fontFamily>"` 检查当前系统；
   成功才可应用字体，失败时要求用户安装或重选，不得静默继续。

## 固定画布与坐标

| 项目 | 值 |
|---|---:|
| HTML 舞台 | `1600 × 900` px |
| PPT 页面 | `13.333″ × 7.5″` |
| 三公司共用母版 | `12192000 × 6858000` EMU |
| 母版坐标换算 | `1 HTML px = 7620 EMU` |
| 字体换算 | `pt = px × 0.6`；`px = pt × 5/3` |

不要使用浏览器默认 96dpi 的 `1pt ≈ 1.333px`。导出字体使用：

```text
fontSize_pt = round(css_px * 0.6)
x_in = x_px / 120
y_in = y_px / 120
w_in = w_px / 120
h_in = h_px / 120
```

## 字体与主题

- 公司选择完成后必须确认字体。默认可选项及推荐 CSS 字体栈为：微软雅黑
  `"Microsoft YaHei", "微软雅黑", sans-serif`、宋体
  `"SimSun", "宋体", "Songti SC", serif`、仿宋
  `"FangSong", "仿宋", "STFangsong", serif`。自定义字体使用用户提供的字体名称，并添加合理的
  `serif` 或 `sans-serif` 通用族后备。
- 所选字体必须存在于最终打开 HTML 的操作系统中；当前开发环境存在该字体不代表交付环境存在。
  若无法核验目标系统，只能记录“待目标系统确认”，不得声称字体已可用。不要仅因浏览器显示了文字
  就认定选定字体生效。
- 字体选择后运行 `node scripts/check-system-font.mjs "<fontFamily>"`。该脚本支持 macOS
  （`system_profiler`）、Linux（`fc-list`）和 Windows（PowerShell 的已安装字体集合）；默认字体
  的中英文名称与常见别名会一并匹配。检查失败或当前系统无法枚举字体时，停止并要求用户安装或重选。
- 将选定字体栈同时写入 `assets/ppt.css` 的 `--font-heading`、`--font-body` 和 `--font-ui`；不要在
  页面内单独覆盖字体，保证标题、正文、目录与导航的字体一致。
- 内容页标题按母版 `32pt` 意图，默认使用黑色（`#000000`）；封面标题 `40pt`，封面副标题
  `24pt`，章节标题 `32pt`，封底标题 `80pt`、副标题 `18pt`。
- 内容角色只使用共享整数 pt token。正文按内容角色使用 `14/16/18/20pt`；
  不得用 `15px`、`17px`、半像素或任意页内字号硬塞。
- 只使用 `400/700` 字重和简单行高；标题过长时先缩短文案或换版式。
- 详细换算和反例见 [references/typography.md](references/typography.md)。所选母版的明确字号
  优先于通用建议，但仍必须映射到整数 pt。

## 标准文件结构

```text
ppt-html/
  index.html
  assets/
    ppt.css
    deck.js
    slide.js
    brand/
      cover-campus.jpg
      logo-white.png
      agenda-welding.jpg
      logo-color.png
      section-campus-night.png
      closing-digital-globe.jpg
      theme-texture.jpg
      template-manifest.json
    media/                 # 非母版的项目内容素材
  slides/
    01-cover.html
    02-agenda.html
    03-agenda-continued.html  # 仅目录项超过 12 项时创建
    …
  exports/                 # 可选 QA 截图与量测结果
```

## 生成流程

### 1. 确认公司、字体、内容与输出目录

先确认公司。若用户未指明，必须询问“请确认本次使用哪个公司母版：恒达智控、创信数智，
还是郑煤机？”。将其转换为脚本参数：恒达智控=`hengda`，创信数智=`chuangxin`，
郑煤机=`zhengmeiji`。公司确认后，询问“请确认本次使用字体：微软雅黑、宋体、仿宋，或输入其他
已安装字体。该字体必须安装在最终打开 HTML 的操作系统中；未安装时浏览器会回退，无法保证效果。”
用户选定字体后，将其记为 `fontFamily`，并在交付报告中记录字体名称和目标系统可用性。
立即运行 `node scripts/check-system-font.mjs "<fontFamily>"`：成功后才进入素材准备；失败时向用户
说明当前系统未安装或无法检查该字体，并要求安装或重新选择。该检查只证明当前系统，仍须提示用户
确认最终交付系统也安装了该字体。
随后收集主题、大纲、来源、语言和交付目标。缺省输出到项目现有
`ppt-html/`；若不存在，创建 `ppt-html/`。只在答案会实质改变结构且无法从上下文判断时提问。

### 2. 准备所选公司母版素材

从技能目录运行：

```bash
bash scripts/prepare-brand-assets.sh <deck-output-directory> <hengda|chuangxin|zhengmeiji>
```

脚本先从所选公司的内置目录读取素材，缺失时仅从 `assets/shared/` 读取经 manifest 哈希确认的
公共素材；随后复制 7 个已解析、已语义化命名的素材及来源清单到输出 deck 的 `assets/brand/`。
不得手工截图 Logo、从网络重新下载品牌图、混用公司资源或把绝对路径写进 HTML。

### 3. 建立共享基础文件

新 deck 直接复用并按下列目标复制模板：

- `templates/tokens.css` → `assets/ppt.css`
- `templates/deck.js` → `assets/deck.js`
- `templates/slide.js` → `assets/slide.js`
- `templates/index.html` → `index.html`
- `templates/cover-shell.html`、`agenda-shell.html`、`section-shell.html`、
  `slide-shell.html`、`closing-shell.html` → 对应角色页面的起点

复制 `tokens.css` 后，立即将所选 `fontFamily` 写入 `--font-heading`、`--font-body` 和
`--font-ui`。仅保留所选字体名与通用族后备；不得保留其他默认字体在前面抢占匹配顺序。

已有 deck 先读取现有 CSS、JS、目录和页面清单，在原实现上增补；不要引入平行的导航器、
第二份 manifest 或另一套视觉语言。

### 4. 先写页面计划，再写 `assets/deck.js`

为每页确定：叙事目的、主标题、副标题、恒达版式类型、主要素材和密度。一个页面只承担一个
主要观点。按最终顺序一次性写入 `window.PPT_HTML_DECK.slides`：

```javascript
window.PPT_HTML_DECK = {
  title: "演示文稿标题",
  slides: [
    { page: 1, href: "slides/01-cover.html", title: "主标题", subtitle: "副标题" },
    { page: 2, href: "slides/02-agenda.html", title: "主标题", subtitle: "副标题" }
  ]
};
```

约束：

- `page` 必须从 1 连续递增，并与数组顺序、文件名前缀一致。
- `href` 必须是从 deck 根目录出发的相对路径，文件必须存在。
- `title`、`subtitle` 必须与页面可见标题一致；无副标题时保留空字符串。
- 新增、删除、重排、改名页面时只更新这份清单，并验证目录和导航自动同步。
- 目录项超过 12 个时，必须在内容页之前新增目录续页，并把目录项按目录页数量**均分**；
  目录页数量为 `ceil(目录项数 / 12)`，每页依次分配 `floor(N / 页数)` 项，余数从第一页
  开始每页加 1 项。例如 13 项拆为 `7 + 6`，25 项拆为 `9 + 8 + 8`。每个目录页都必须
  写入 `deck.js`，以便导航和页码自动连续。

### 5. 选择并落实恒达版式

按内容角色使用模板 CSS 版式类：

| 页面角色 | CSS 类 | 必用素材/母版元素 |
|---|---|---|
| 封面 | `.layout-cover` | 园区效果图、蓝色叠层、白色 Logo |
| 目录 | `.layout-agenda` | 彩色 Logo、母版竖排标题与最多 12 行目录结构；超过 12 项创建均分的目录续页；焊接图默认隐藏 |
| 章节 | `.layout-section` | 园区夜景、蓝色叠层、白色 Logo |
| 标题与内容 | `.layout-content` | 母版三段横线、右上彩色 Logo、标题/正文区 |
| 仅标题 | `.layout-title-only` | 同一内容页母版 chrome |
| 封底 | `.layout-closing` | 数字地球、蓝色叠层、白色 Logo |

不要只贴 Logo 后自由设计。内容页必须保留母版标题区、三段横线、Logo 位置和正文安全区；
封面/章节/封底必须使用对应版式素材和遮罩关系。模板不支持内容时，优先选择最接近的母版
版式并在正文安全区内组合语义块，不改造品牌 chrome。

版式的不可变约束：

- 封面标题使用母版标题框并按内容自然换行，标题框按底对齐；不得为了贴近横线而手工
  插入 `<br>` 或强制拆成两行。最后一行底部与 `y=461.4px` 横线保持约 9px 间距，不能因
  单行或多行标题留下大块空白。
- 目录页严格保留母版对象的可见性：版式级背景使用由浅蓝到白色的纵向渐变；焊接图及其
  两层前景渐变在 OOXML 中均为 `hidden="1"`，默认不得显示。左侧保留竖排
  `CONTENTS` 和“目—圆形箭头—录”组合；两个汉字、外圆共用中心轴且上下间距对称，
  圆内必须是向右的等边三角形，三角形包围盒与圆心在水平、垂直方向完全重合。右侧每个
  目录页最多保留 12 行圆角条目；超过时创建目录续页并均分条目，不能在单页隐藏、截断或
  继续堆叠。
  数字块为 `75.59×75.59px` 圆角方块，不改成圆形、卡片分栏或自创目录标题区。
- 内容页三段横线的层级固定为：渐隐长线在底，深蓝线在中，浅蓝线在顶；不得让渐隐线
  覆盖深蓝或浅蓝线。

### 6. 编写页面 HTML

每页使用固定舞台：

```html
<div class="viewport">
  <div class="frame">
    <div class="stage">
      <section class="slide layout-content"><!-- 页面内容 --></section>
    </div>
  </div>
</div>
```

执行以下规则：

- 复用共享 class 和 token；不写页内 `font-size`。
- 把标题、正文、表格、图像写成独立语义盒，方便后续映射为 PPT shape。
- 内容页正文留在母版安全区，底部额外预留导航 UI 区域；不要用全局裁切掩盖溢出。
- 照片可裁切时用 `cover`；必须完整显示时用 `contain`；结构图只有明确允许形变时才用 `fill`。
- 母版素材只从 `assets/brand/` 引用，项目内容素材只从 `assets/media/` 引用。
- 每页先加载 `../assets/deck.js`，再加载 `../assets/slide.js`。`slide.js` 自动注入导航；
  不在每页复制导航逻辑。

### 7. 验证目录与导航

逐项验证：

- `index.html` 恰好生成 N 个条目；每个条目只有页码、主标题、副标题。
- 目录项超过 12 个时，核对已创建相应数量的目录续页，目录项均分且每页不超过 12 项；
  所有目录项与内容页一一对应，没有隐藏或遗漏。
- 在桌面视口核对目录为 5 列；在中等/小屏视口核对 2/1 列响应式降级。
- 每个条目链接到正确页面；清单内没有缺页、重复页码或孤立 HTML。
- 每页底部中间显示正确的 `当前页 / 总页数`。
- 首页、上一页、下一页链接正确；第一页禁用上一页，最后一页禁用下一页。
- 四个方向键映射正确；在 `input`、`textarea`、`select` 或可编辑元素中不劫持按键。
- 导航在打印/PPT 导出样式中隐藏。

### 8. 自动执行 QA 并修复（强制）

每次生成或修改后运行集成 QA：

1. 在逻辑 `1600×900`、`transform: none` 下检查全部页面。
2. 优先复用项目 `scripts/audit-ppt-html.mjs`；不存在时按
   [references/qa-checklist.md](references/qa-checklist.md) 完成静态扫描、DOM 量测、
   交互测试和截图验收。
3. 运行 `node scripts/verify-hengda-assets.mjs <deck>/assets/brand`，确认内置素材
   `7/7`、哈希一致且没有未登记文件。
4. 为每页渲染原始尺寸截图并逐页查看。自动检查“0 问题”不能替代截图结论。
5. 检查模板忠实度、所有文字/祖先裁切、重叠、画布越界、图片策略、底部空白、目录顺序和导航。
6. 优先通过缩短文案、调整结构、增加区域高度和重分配 grid/flex 修复；不得以非法小字、
   `line-clamp`、省略号或全局 `overflow: hidden` 掩盖失败。
7. 共享 CSS/token/导航变化后全 deck 回归；局部内容变化至少重测本页和受影响页面。

问题定位可使用 [references/issue-catalog.md](references/issue-catalog.md)，但不能跳过完整回归。

## 交付报告

简要报告：

```markdown
## ppt-html 检查报告
- 母版映射：所选公司的 `references/{hengda|chuangxin|zhengmeiji}-template.md`
- 画布：1600×900
- 页数：N
- 目录：N 项，与 deck.js 一致；超过 12 项时已均分到目录续页
- 导航：首页/上一页/下一页/四方向键通过
- 结果：通过 / 有问题已修 / 仍有阻塞

### 资源
- 所选公司内置素材：7/7（manifest 校验：通过/失败）
- 项目 media：X（与引用一致：是/否）
- 外部路径：0
- 字体：`fontFamily`（目标操作系统已安装：是 / 用户待确认）

### 截图
- exports/audit-xxx/
```

若仍有阻塞，写明页码、证据和需要的决定；不要静默豁免。

## 禁止模式

1. 未确认公司、未读取对应母版映射或未复制所选公司内置素材就生成另一套“相似蓝色”设计。
2. 只复用 Logo，不复用对应母版结构、版式素材和字体/颜色意图。
3. 在 `index.html` 放缩略图、摘要、标签或页面正文。
4. 每页复制一套顺序或导航代码，导致目录与翻页不一致。
5. 页面内写任意字号、绝对外部媒体路径、base64 复制素材或未登记资源。
6. 用缩小字体、截断、隐藏溢出来伪装修复成功。
7. 导航覆盖正文、母版页脚或被导出到 PPT。
