/**
 * 目录页模板几何与压缩模型。
 * 固定元素与 HTML 母版一致；仅右侧目录项数量/内容/压缩尺寸可配置。
 * 坐标单位：HTML px（1600×900）；1 px = 7620 EMU；pt = px * 0.6。
 */

export const EMU_PER_PX = 7620;
export const STAGE = { width: 1600, height: 900 };
export const AGENDA_TEMPLATE_ID = "layout-agenda-v5";
export const MAX_ITEMS_PER_PAGE = 12;

/** 贴入 PPT 的交付图默认缩放；检查用截图不得套用此值。 */
export const DELIVERY_IMAGE_SCALE = 2;

/** 模板固定元素：所有目录页必须一致，不得按页改写。
 * v2：背景 + CONTENTS + “目录” + 中部图形 + Logo 合成一张高清底图贴入 PPT；
 * v3：右侧目录项条背景也改为高清截图；仅编号与标题保持可编辑文本。
 * v4：条背景与左侧编号方块分别截图、分别放置，避免调整条目宽高时方块变形。
 * v5：背景与条目组件固化为技能内置资产；Logo 从目标 deck 的品牌资源单独放置。
 */
export const FIXED = {
  compositeImage: {
    id: "agenda-fixed-chrome",
    mode: "hires-image",
    includes: ["background", "contentsWord", "title", "cue"],
    logical: { x: 0, y: 0, width: 1600, height: 900 },
    scale: DELIVERY_IMAGE_SCALE,
    hideSelectors: [".agenda-list", ".slide-nav", "[data-ppt-ui]"],
  },
  background: {
    id: "agenda-bg",
    type: "gradient",
    // 母版 accent2 #297FD5 * lumMod20% * lumOff80% = #D4E5F7，alpha 79% 叠白底 → #DDEAF9
    start: "#DDEAF9",
    end: "#FFFFFF",
    angleDeg: 180,
  },
  logo: {
    id: "agenda-logo",
    selector: ".brand-logo--color",
    x: 1240,
    y: 40.67,
    width: 348.17,
    height: 53.66,
    relativePath: "assets/brand/logo-color.png",
  },
  contentsWord: {
    id: "agenda-word",
    selector: ".agenda-word",
    text: "CONTENTS",
    x: 130.92,
    y: 52.11,
    width: 194.92,
    height: 784,
    fontPt: 80,
    bold: true,
    color: "#629DD1",
    alpha: 0.2,
    vertical: true,
    fontFamily: "宋体",
  },
  title: {
    id: "agenda-title",
    selector: ".agenda-title",
    chars: ["目", "录"],
    x: 330.59,
    y: 252.19,
    width: 157.25,
    height: 383.83,
    fontPt: 66,
    bold: true,
    color: "#629DD1",
    fontFamily: "宋体",
    centerY: 444.11,
  },
  cue: {
    id: "agenda-cue",
    selector: ".agenda-cue",
    x: 384.33,
    y: 419.23,
    width: 49.76,
    height: 49.76,
    borderColor: "rgba(98, 157, 209, 0.5)",
    fillColor: "#629DD1",
    triangle: { width: 10.9, height: 12.64 },
  },
  listAnchor: {
    id: "agenda-list-anchor",
    selector: ".agenda-list",
    x: 680.84,
    width: 708.66,
    centerY: 444.11,
  },
};

/** 右侧目录项基准尺寸（1–6 项）。 */
export const ITEM_BASE = {
  height: 75.59,
  gap: 43.02,
  numberRadius: 12.6,
  paddingY: 6,
  textGap: 41.52,
  numberBorder: 3.33,
  numberFontPt: 28,
  titleFontPt: 18,
  accent1: "#629DD1",
  accent5: "#5AA2AE",
  titleColor: "#111111",
  numberColor: "#FFFFFF",
  fontFamily: "微软雅黑",
};

/**
 * 与 templates/slide.js configureAgendaList 保持一致。
 * 7–12 项等比压缩；12 项收敛到 height=48、gap=12。
 */
export function computeItemMetrics(count) {
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`目录项数量必须是 1–${MAX_ITEMS_PER_PAGE} 的整数，收到：${count}`);
  }
  if (n > MAX_ITEMS_PER_PAGE) {
    throw new Error(`单个目录页最多 ${MAX_ITEMS_PER_PAGE} 项；请创建目录续页并均分`);
  }

  if (n <= 6) {
    return {
      count: n,
      compressed: false,
      compression: 0,
      itemHeight: ITEM_BASE.height,
      itemGap: ITEM_BASE.gap,
      numberRadius: ITEM_BASE.numberRadius,
      paddingY: ITEM_BASE.paddingY,
      textGap: ITEM_BASE.textGap,
      numberBorder: ITEM_BASE.numberBorder,
      numberFontPt: ITEM_BASE.numberFontPt,
      titleFontPt: ITEM_BASE.titleFontPt,
      scale: 1,
    };
  }

  const compression = (n - 6) / 6;
  const itemHeight = ITEM_BASE.height - 27.59 * compression;
  const itemGap = ITEM_BASE.gap - 31.02 * compression;
  const scale = itemHeight / ITEM_BASE.height;
  return {
    count: n,
    compressed: true,
    compression: Number(compression.toFixed(6)),
    itemHeight: Number(itemHeight.toFixed(2)),
    itemGap: Number(itemGap.toFixed(2)),
    numberRadius: Number((ITEM_BASE.numberRadius * scale).toFixed(2)),
    paddingY: Number((ITEM_BASE.paddingY * scale).toFixed(2)),
    textGap: Number((ITEM_BASE.textGap * scale).toFixed(2)),
    numberBorder: Number((ITEM_BASE.numberBorder * scale).toFixed(2)),
    numberFontPt: 20,
    titleFontPt: ITEM_BASE.titleFontPt,
    scale: Number(scale.toFixed(6)),
  };
}

export function computeListLayout(count) {
  const metrics = computeItemMetrics(count);
  const totalHeight =
    metrics.count * metrics.itemHeight + Math.max(0, metrics.count - 1) * metrics.itemGap;
  const top = Number((FIXED.listAnchor.centerY - totalHeight / 2).toFixed(2));
  const items = [];
  for (let i = 0; i < metrics.count; i += 1) {
    const y = Number((top + i * (metrics.itemHeight + metrics.itemGap)).toFixed(2));
    items.push({
      index: i,
      x: FIXED.listAnchor.x,
      y,
      width: FIXED.listAnchor.width,
      height: metrics.itemHeight,
      numberBox: {
        x: FIXED.listAnchor.x,
        y,
        width: metrics.itemHeight,
        height: metrics.itemHeight,
        radius: metrics.numberRadius,
        border: metrics.numberBorder,
      },
      titleBox: {
        x: Number((FIXED.listAnchor.x + metrics.itemHeight + metrics.textGap).toFixed(2)),
        y,
        width: Number(
          (FIXED.listAnchor.width - metrics.itemHeight - metrics.textGap - 12).toFixed(2)
        ),
        height: metrics.itemHeight,
      },
    });
  }
  return {
    metrics,
    top,
    totalHeight: Number(totalHeight.toFixed(2)),
    centerY: FIXED.listAnchor.centerY,
    itemSlots: items,
  };
}

export function pxToEmu(px) {
  return Math.round(Number(px) * EMU_PER_PX);
}

export function pxToPt(px) {
  return Math.round(Number(px) * 0.6);
}

export function buildTemplateDefinition() {
  return {
    templateId: AGENDA_TEMPLATE_ID,
    canvas: { ...STAGE, emuPerPixel: EMU_PER_PX },
    fixedElements: FIXED,
    fixedRender: {
      mode: "hires-image",
      description:
        "背景+CONTENTS+目录+中部图形使用内置高清底图；Logo 从 deck 品牌资源独立放置；右侧条背景与编号方块为内置高清组件，仅编号/标题可编辑",
      deliveryScale: DELIVERY_IMAGE_SCALE,
    },
    itemBase: ITEM_BASE,
    configurableSlots: {
      rightAgendaItems: {
        maxPerPage: MAX_ITEMS_PER_PAGE,
        fields: ["number", "title"],
        sizing: "1-6 base; 7-12 proportional compression; bar and number block = separate hires images",
        verticalAlign: "center to title centerY 444.11",
        chrome: {
          bar: "template-assets/agenda-item-bar-*.png",
          numberBlock: "template-assets/agenda-item-number-*.png",
        },
      },
    },
  };
}
