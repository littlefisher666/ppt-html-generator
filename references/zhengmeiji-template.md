# 郑煤机母版映射

本映射与 `assets/zhengmeiji/` 中的品牌专属素材、以及 manifest 所列的 `assets/shared/` 公共素材，是
郑煤机版本的权威来源。原始 PPTX 仅作只读复核，不复制进输出 deck。

- 解析源 SHA-256：`342b2a4c4dd879ba40b9490cfb57cbea415b6c01573e7cd8c3e1381c6068e76d`
- 页面：`12192000 × 6858000` EMU（16:9），映射为 `1600 × 900`，即 `7620 EMU/px`。
- 结构：1 个母版、9 个版式、0 个普通幻灯片、7 个浏览器可用媒体素材，另有 1 个 WDP
  兼容性源文件未作为 HTML 运行时资源使用。
- 与恒达母版的版式、主题色、字体意图和几何坐标相同；完整通用规则见
  [hengda-template.md](hengda-template.md)。仅替换为本目录的郑煤机 Logo 和场景素材。

| PPT 版式 | HTML 类 | 素材 |
|---|---|---|
| 封面 | `.layout-cover` | `cover-campus.jpg`、`logo-white.png` |
| 目录 | `.layout-agenda` | `agenda-welding.jpg`（默认隐藏）、`logo-color.png` |
| 章节 | `.layout-section` | `section-campus-night.png`、`logo-white.png` |
| 内容 / 仅标题 | `.layout-content` / `.layout-title-only` | `logo-color.png` |
| 封底 | `.layout-closing` | `closing-digital-globe.jpg`、`logo-white.png` |

Logo 必须使用实际 PNG 且保持 `contain`；封面、章节、封底照片使用 `cover`。不得混用其他
公司的素材。
