# 母版与资源

## 进入条件

G1 已通过。先阅读所选公司的母版映射文件。

## 执行

从技能目录运行：

```bash
bash scripts/prepare-brand-assets.sh <deck-output-directory> <hengda|chuangxin|zhengmeiji>
```

脚本复制 7 个已解析母版素材与 manifest 到 `<deck>/assets/brand/`。新 deck 随后从模板建立
`assets/ppt.css`、`assets/deck.js`、`assets/slide.js`、`index.html` 和各页面 shell；将确认的组合字体栈写入
三个 font token。每个 token 均以固定西文字体 `Times New Roman` 开头，后接已确认的中文字体栈。已有 deck
必须在原实现上增补，不引入平行结构。

紧接着运行：

```bash
node scripts/init-deck-scaffold.mjs <deck-output-directory>
```

该脚本只复制静态基础模板，遇到 `assets/ppt.css`、`assets/deck.js`、`assets/slide.js`、`index.html` 或
`templates/` 已存在即失败，绝不覆盖既有 deck。复制后仅替换 `ppt.css` 的三个字体 token；目录、导航、母版
chrome 和基础内容组件必须直接复用。不得重新生成这些基础文件，也不得将整套静态 CSS 粘贴进页面内。

## G2 检查与记录

运行：

```bash
node scripts/verify-hengda-assets.mjs <deck>/assets/brand
```

记录所用映射、7/7 资源和 manifest 哈希通过输出。失败时重新准备正确资源；不得进入页面骨架。
同时记录脚手架初始化输出；初始化失败或漏失基础文件时，G2 不通过。
