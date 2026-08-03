# 检查点与恢复

本规则为 deck 提供文件级回退能力。检查点是已验收状态的只读副本，不是仅写在
`stage-gates.md` 中的“通过”标记，也不以 Git 状态替代。除非用户明确要求，不得删除或覆盖既有
检查点；恢复前必须先创建当前状态的恢复前归档。

## 目录与元数据

所有检查点都放在 `<deck>/exports/checkpoints/`，不得放入 `assets/`、`slides/` 或输出根目录的其他
位置。目录中保存的文件使用相对 deck 根目录的原始路径：

```text
exports/checkpoints/
├── G5/<检查点 ID>/
│   ├── index.html
│   ├── slides/
│   ├── assets/
│   ├── exports/visual-strategy.md
│   ├── exports/image-inventory.md
│   ├── exports/media-frame-review.md
│   └── checkpoint.json
├── G6/<页码>-<文件名>/<检查点 ID>/
│   ├── slides/<页码>-<文件名>.html
│   ├── checkpoint.json
│   └── exports/page-checks/<页码>-<文件名>.md
└── history/<时间>-before-restore-<检查点 ID>/
```

检查点 ID 使用 `<阶段>-passed-YYYYMMDD-HHMMSS`。`checkpoint.json` 至少记录：ID、创建时间、来源
阶段、范围（`deck` 或 `page`）、页码（页面级时必填）、状态、保存的相对路径、每个文件的 SHA-256、
依赖的门禁和交接证据路径。G5 deck 检查点还必须记录唯一 manifest 的页序及当时的内容页列表。

```json
{
  "id": "G5-passed-20260803-143025",
  "stage": "G5",
  "scope": "deck",
  "status": "passed",
  "createdAt": "2026-08-03T14:30:25+08:00",
  "pages": [{ "page": 4, "path": "slides/04-overview.html" }],
  "evidence": ["exports/visual-strategy.md", "exports/image-inventory.md", "exports/media-frame-review.md"],
  "files": [{ "path": "slides/04-overview.html", "sha256": "<sha256>" }],
  "brandValidation": "<证据路径或命令输出路径>"
}
```

G5 deck 检查点必须包含：`index.html`、全部 `slides/`、`assets/ppt.css`、`assets/deck.js`、
`assets/slide.js`、当前已引用的 `assets/media/` 文件，以及 `visual-strategy.md`、
`image-inventory.md`、`media-frame-review.md`。不复制 `assets/brand/`：它受独立品牌 manifest 与哈希
校验保护；元数据必须记录其校验结果。不得把 `tasks.md` 或 `stage-gates.md` 作为可直接覆盖的恢复文件，
两者必须在恢复后按本规则生成新的状态记录。

G6 页面检查点在该页单页检查通过后创建，包含该页 HTML、该页检查记录和其依赖的项目媒体文件哈希。
它用于后续恢复已验收的 G6 页面；将页面恢复到 G5 时，使用同一页在 G5 deck 检查点内的 HTML，而非 G6
页面检查点。

## 创建时机与校验

1. G5 的所有检查及 `media-frame-review.md` 已通过后、在开始任何 G6 内容填充前，创建一个完整 G5 deck
   检查点；检查点写入成功且文件哈希复核一致后，才可在 `stage-gates.md` 标记 G5 通过。
2. 每个内容页完成 G6 单页检查并写入 `page-checks/` 后，立即创建该页 G6 检查点，再勾选该页的单页检查
   任务。页面级检查点不得包含或覆盖共享文件。
3. 页序、目录、共享导航、字体 token、共享 CSS、`assets/deck.js`、`assets/slide.js`、`index.html` 或母版
   资源发生修改前，必须先创建一个覆盖共享文件的 deck 检查点；该变更的恢复范围不得伪装成页面级。
4. 建立后对照 `checkpoint.json` 复核路径和 SHA-256；缺文件、哈希不符或范围不完整时，检查点无效，不得
   用于推进门禁或恢复。

## 恢复判定

先根据变更范围选择最小且完整的检查点，不得凭聊天上下文猜测版本：

| 变更或问题 | 可恢复范围 | 起点与复测 |
|---|---|---|
| 仅一个 `slides/<页>.html` 的页面私有内容/布局 | 该页在 G5 deck 检查点内的 HTML | 该页回到 G5，取消该页所有 G6 项，重新生成并完成该页 G6 检查 |
| 一个已通过 G6 的页面需要恢复到其已验收版本 | 对应 G6 页面检查点 | 恢复该页 HTML 与检查记录；确认共享文件哈希未变后才可保留其他 G6 状态 |
| G6 全量内容或多个页面均需推倒重做 | 完整 G5 deck 检查点 | 恢复全部源码与 G5 交接证据，G6/G7 全部失效，从 G6 开始 |
| 共享 CSS、字体、导航、`deck.js`、`slide.js`、`index.html` 或母版资源有改动 | 覆盖共享文件的最近 deck 检查点 | 所有受影响 G6 页面及 G7 失效；默认全 deck 重测 G6 |
| 页序、目录或共享导航关系有改动 | 最近 G3 deck 检查点；无此检查点则按 G3 重建 | G3 及之后的受影响门禁失效，重走 G3–G7 |

页面级恢复只在共享文件的当前 SHA-256 与该页面依赖的 G5 检查点一致时允许。否则按共享变更处理，不能只
恢复一个页面。

## 恢复操作与记录

1. 读取目标检查点的 `checkpoint.json`，复核状态为 `passed`、范围匹配、路径存在且哈希一致。
2. 将当前将被替换的文件复制到
   `exports/checkpoints/history/<时间>-before-restore-<检查点 ID>/`，并写入恢复前元数据；不得直接删除
   旧文件或旧检查记录。
3. 仅从目标检查点恢复元数据列出的文件。恢复完成后再次计算 SHA-256，必须与目标检查点一致；品牌资源
   仍需运行既有品牌资源校验。
4. 在 `stage-gates.md` 新增一条恢复记录：恢复时间、原因、检查点 ID、恢复范围、恢复前归档路径、哈希
   复核结果、失效门禁及需重跑的阶段。历史“通过”记录不得改写为当前通过。
5. 在 `tasks.md` 取消所有失效项的勾选，追加独立的“恢复”“修复”“复测”项；旧的 `page-checks` 或
   `final-regression.md` 移入上述 history 目录并注明已失效。只有新版本的证据落盘后才可再次勾选。
6. 从表中指定的阶段重新执行。恢复文件并不等于自动通过门禁；G7 失效时不得交付。

恢复记录可使用以下结构；其中“当前状态”必须明确标为 `invalidated`，而不是删除历史记录：

```markdown
## 恢复｜2026-08-03 14:45

- 原因：第 06 页 G6 内容版式不符合预期
- 检查点：`G5-passed-20260803-143025`
- 范围：`slides/06-architecture.html`
- 恢复前归档：`exports/checkpoints/history/20260803-144500-before-restore-G5-passed-20260803-143025/`
- 哈希复核：通过
- 当前状态：G6 第 06 页 `invalidated`；G6 阶段汇总与 G7 `invalidated`
- 后续：从第 06 页 G6 内容实现、单页检查和页面检查点创建继续
```
