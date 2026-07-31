# 创信数智母版映射

本映射与 `assets/chuangxin/` 中的品牌专属素材、以及 manifest 所列的 `assets/shared/` 公共素材，是
创信数智版本的权威来源。原始 PPTX 仅作只读复核，不复制进输出 deck。

- 解析源 SHA-256：`411b6647335f5e19e87675781541c0ae6731eeb0b98d59790b4b157fe027d13a`
- 页面：`12192000 × 6858000` EMU（16:9），映射为 `1600 × 900`，即 `7620 EMU/px`。
- 结构：1 个母版、9 个版式、0 个普通幻灯片、7 个浏览器可用媒体素材。
- 与恒达母版的版式、主题色、字体意图和几何坐标相同；完整通用规则见
  [hengda-template.md](hengda-template.md)。仅替换为本目录的创信数智 Logo 和场景素材。

| PPT 版式 | HTML 类 | 素材 |
|---|---|---|
| 封面 | `.layout-cover` | `cover-campus.jpg`、`logo-white.png` |
| 目录 | `.layout-agenda` | `agenda-welding.jpg`（默认隐藏）、`logo-color.png` |
| 章节 | `.layout-section` | `section-campus-night.png`、`logo-white.png` |
| 内容 / 仅标题 | `.layout-content` / `.layout-title-only` | `logo-color.png` |
| 封底 | `.layout-closing` | `closing-digital-globe.jpg`、`logo-white.png` |

Logo 必须使用实际 PNG 且保持 `contain`；封面、章节、封底照片使用 `cover`。不得混用其他
公司的素材。
