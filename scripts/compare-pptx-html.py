#!/usr/bin/env python3
"""Build side-by-side / overlay / diff images for PPTX vs HTML screenshots."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat

TARGET = (1600, 900)


def load_rgb(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    if img.size != TARGET:
        img = ImageOps.fit(img, TARGET, method=Image.Resampling.LANCZOS)
    return img


def mean_abs_diff(a: Image.Image, b: Image.Image) -> float:
    diff = ImageChops.difference(a, b)
    stat = ImageStat.Stat(diff)
    # average of channel means
    return float(sum(stat.mean) / max(len(stat.mean), 1))


def max_sample(a: Image.Image, b: Image.Image) -> int:
    diff = ImageChops.difference(a, b)
    stat = ImageStat.Stat(diff)
    return int(max(stat.extrema[i][1] for i in range(len(stat.extrema))))


def make_side(html_img: Image.Image, ppt_img: Image.Image, label_left: str, label_right: str) -> Image.Image:
    canvas = Image.new("RGB", (TARGET[0] * 2, TARGET[1] + 36), (18, 22, 30))
    canvas.paste(html_img, (0, 36))
    canvas.paste(ppt_img, (TARGET[0], 36))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None
    draw.text((12, 10), label_left, fill=(220, 230, 240), font=font)
    draw.text((TARGET[0] + 12, 10), label_right, fill=(220, 230, 240), font=font)
    return canvas


def make_overlay(html_img: Image.Image, ppt_img: Image.Image) -> Image.Image:
    # red=html, cyan=ppt style blend for misalignment visibility
    h = html_img.convert("RGBA")
    p = ppt_img.convert("RGBA")
    tint_h = Image.new("RGBA", TARGET, (255, 60, 60, 0))
    tint_p = Image.new("RGBA", TARGET, (40, 180, 255, 0))
    mixed_h = Image.blend(h, Image.alpha_composite(h, tint_h), 0.25)
    mixed_p = Image.blend(p, Image.alpha_composite(p, tint_p), 0.25)
    return Image.blend(mixed_h.convert("RGB"), mixed_p.convert("RGB"), 0.5)


def make_diff(html_img: Image.Image, ppt_img: Image.Image) -> Image.Image:
    diff = ImageChops.difference(html_img, ppt_img)
    # boost visibility
    boosted = diff.point(lambda v: min(255, int(v * 3)))
    return boosted


def main() -> int:
    if len(sys.argv) != 4:
        sys.stderr.write(
            "用法: python3 scripts/compare-pptx-html.py <deck-root> <pptx-renders-dir> <comparison-dir>\n"
        )
        return 64

    deck_root = Path(sys.argv[1]).resolve()
    renders_dir = Path(sys.argv[2]).resolve()
    out_dir = Path(sys.argv[3]).resolve()
    page_map_path = deck_root / "pptx" / "P2" / "page-map.json"
    if not page_map_path.is_file():
        raise FileNotFoundError(f"缺少 page-map: {page_map_path}")

    page_map = json.loads(page_map_path.read_text(encoding="utf-8"))
    slides = page_map.get("slides") or []
    overlay_dir = out_dir / "overlay"
    diff_dir = out_dir / "diff"
    overlay_dir.mkdir(parents=True, exist_ok=True)
    diff_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    missing = []
    for slide in slides:
        page = int(slide["page"])
        href = slide.get("href")
        html_rel = slide.get("screenshot")
        if not html_rel:
            missing.append({"page": page, "reason": "page-map missing screenshot"})
            continue
        html_path = deck_root / "pptx" / "P2" / html_rel
        ppt_path = renders_dir / f"slide-{page}.png"
        if not html_path.is_file():
            missing.append({"page": page, "reason": f"missing html shot {html_path}"})
            continue
        if not ppt_path.is_file():
            missing.append({"page": page, "reason": f"missing ppt render {ppt_path}"})
            continue

        html_img = load_rgb(html_path)
        ppt_img = load_rgb(ppt_path)
        mad = mean_abs_diff(html_img, ppt_img)
        mx = max_sample(html_img, ppt_img)

        side = make_side(html_img, ppt_img, f"HTML p{page}", f"PPTX p{page}")
        overlay = make_overlay(html_img, ppt_img)
        diff = make_diff(html_img, ppt_img)

        side_name = f"{page:02d}-side.png"
        overlay_name = f"{page:02d}-overlay.png"
        diff_name = f"{page:02d}-diff.png"
        side.save(overlay_dir / side_name)
        overlay.save(overlay_dir / overlay_name)
        diff.save(diff_dir / diff_name)

        # layout guess from href
        layout = "content"
        low = str(href or "").lower()
        for key in ("cover", "agenda", "section", "closing"):
            if key in low:
                layout = key
                break

        rows.append(
            {
                "page": page,
                "href": href,
                "layout": layout,
                "mad": round(mad, 3),
                "maxSample": mx,
                "screenshot": str(ppt_path.relative_to(deck_root / "pptx") if ppt_path.is_relative_to(deck_root / "pptx") else ppt_path),
                "htmlShot": str(Path("P2") / html_rel),
                "side": f"comparison/overlay/{side_name}",
                "overlay": f"comparison/overlay/{overlay_name}",
                "diff": f"comparison/diff/{diff_name}",
            }
        )

    rows.sort(key=lambda item: item["page"])
    mads = [item["mad"] for item in rows]
    summary = {
        "count": len(rows),
        "missing": missing,
        "mean_mad": round(sum(mads) / len(mads), 3) if mads else None,
        "median_mad": round(sorted(mads)[len(mads) // 2], 3) if mads else None,
        "top": sorted(rows, key=lambda item: item["mad"], reverse=True)[:10],
        "pages": rows,
    }
    (out_dir / "comparison-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    md = [
        "# PPTX vs HTML 视觉比对摘要",
        "",
        f"- 对比页数: {summary['count']}",
        f"- 缺失: {len(missing)}",
        f"- mean MAD: {summary['mean_mad']}",
        f"- median MAD: {summary['median_mad']}",
        "",
        "> MAD 仅作辅助指标；最终仍需人工/模型查看 side/overlay/diff 图。",
        "",
        "## MAD 最高页",
        "",
    ]
    for item in summary["top"][:10]:
        md.append(
            f"- 第 {item['page']} 页 `{item.get('href')}` MAD={item['mad']} | side=`{item['side']}` | diff=`{item['diff']}`"
        )
    if missing:
        md.extend(["", "## 缺失", ""])
        for item in missing:
            md.append(f"- 第 {item['page']} 页: {item['reason']}")
    (out_dir / "comparison-summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "comparisonDir": str(out_dir),
                "count": summary["count"],
                "missing": len(missing),
                "mean_mad": summary["mean_mad"],
                "median_mad": summary["median_mad"],
            },
            ensure_ascii=False,
        )
    )
    return 1 if missing else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001
        sys.stderr.write(f"{error}\n")
        raise SystemExit(1)
