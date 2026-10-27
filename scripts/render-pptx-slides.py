#!/usr/bin/env python3
"""Render PPTX pages to 1600x900 PNGs using P1 backend plan or fallbacks."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def parse_render_script_from_plan(plan_text: str) -> Path | None:
    # Prefer fenced command containing render_slides.py
    for match in re.finditer(r"([\"']/[^\"'\n]+render_slides\.py[\"']|[^\s\"']+render_slides\.py)", plan_text):
        raw = match.group(1).strip().strip("'\"")
        path = Path(raw)
        if path.is_file():
            return path
    return None


def discover_render_slides() -> Path | None:
    home = Path.home()
    roots = [
        home / ".codex/plugins/cache/openai-primary-runtime/presentations",
        home / ".codex/plugins/cache",
    ]
    candidates: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        candidates.extend(root.rglob("render_slides.py"))
    # Prefer newest mtime
    candidates = [p for p in candidates if p.is_file()]
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def render_with_script(script: Path, pptx: Path, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    # clean old slides
    for old in out_dir.glob("slide-*.png"):
        old.unlink()
    cmd = [
        sys.executable,
        str(script),
        str(pptx),
        "--output_dir",
        str(out_dir),
        "--width",
        "1600",
        "--height",
        "900",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"render_slides failed ({proc.returncode}):\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )
    slides = sorted(out_dir.glob("slide-*.png"), key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)))
    return {
        "backend": "render_slides.py",
        "script": str(script),
        "command": cmd,
        "pages": len(slides),
        "outputDir": str(out_dir),
        "stdout": (proc.stdout or "")[-2000:],
    }


def render_with_libreoffice(pptx: Path, out_dir: Path) -> dict:
    soffice = Path("/Applications/LibreOffice.app/Contents/MacOS/soffice")
    if not soffice.is_file():
        soffice_bin = shutil.which("soffice") or shutil.which("libreoffice")
        if not soffice_bin:
            raise FileNotFoundError("未找到 LibreOffice soffice")
        soffice = Path(soffice_bin)
    pdftoppm = shutil.which("pdftoppm")
    if not pdftoppm:
        raise FileNotFoundError("未找到 pdftoppm")

    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("slide-*.png"):
        old.unlink()

    with tempfile.TemporaryDirectory(prefix="p5-lo-") as tmp:
        tmp_path = Path(tmp)
        cmd_pdf = [
            str(soffice),
            "--headless",
            "--nologo",
            "--nolockcheck",
            "--nodefault",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            "--outdir",
            str(tmp_path),
            str(pptx),
        ]
        proc = subprocess.run(cmd_pdf, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(f"LibreOffice 导出 PDF 失败: {proc.stderr or proc.stdout}")
        pdfs = list(tmp_path.glob("*.pdf"))
        if not pdfs:
            raise RuntimeError("LibreOffice 未生成 PDF")
        pdf = pdfs[0]
        prefix = tmp_path / "page"
        cmd_png = [pdftoppm, "-png", "-r", "120", str(pdf), str(prefix)]
        proc2 = subprocess.run(cmd_png, capture_output=True, text=True)
        if proc2.returncode != 0:
            raise RuntimeError(f"pdftoppm 失败: {proc2.stderr or proc2.stdout}")

        # normalize names and resize to 1600x900
        from PIL import Image, ImageOps

        pages = sorted(tmp_path.glob("page-*.png"), key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)))
        if not pages:
            pages = sorted(tmp_path.glob("page*.png"))
        for index, page in enumerate(pages, start=1):
            img = Image.open(page).convert("RGB")
            fitted = ImageOps.fit(img, (1600, 900), method=Image.Resampling.LANCZOS)
            fitted.save(out_dir / f"slide-{index}.png")

    slides = list(out_dir.glob("slide-*.png"))
    return {
        "backend": "libreoffice+pdftoppm",
        "script": str(soffice),
        "command": cmd_pdf,
        "pages": len(slides),
        "outputDir": str(out_dir),
    }


def main() -> int:
    if len(sys.argv) not in (3, 4):
        sys.stderr.write(
            "用法: python3 scripts/render-pptx-slides.py <deck-root-or-_-> <pptx> <output-dir>\n"
        )
        return 64

    if len(sys.argv) == 4:
        deck_root = None if sys.argv[1] in {"-", "_"} else Path(sys.argv[1]).resolve()
        pptx = Path(sys.argv[2]).resolve()
        out_dir = Path(sys.argv[3]).resolve()
    else:
        deck_root = None
        pptx = Path(sys.argv[1]).resolve()
        out_dir = Path(sys.argv[2]).resolve()

    script = None
    if deck_root is not None:
        plan = deck_root / "pptx" / "P1" / "render-backend-plan.md"
        if plan.is_file():
            script = parse_render_script_from_plan(plan.read_text(encoding="utf-8"))
    if script is None:
        script = discover_render_slides()

    if script is not None:
        try:
            payload = render_with_script(script, pptx, out_dir)
            print(json.dumps(payload, ensure_ascii=False))
            return 0
        except Exception as error:  # noqa: BLE001
            sys.stderr.write(f"主渲染路径失败，尝试 LibreOffice：{error}\n")

    payload = render_with_libreoffice(pptx, out_dir)
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001
        sys.stderr.write(f"{error}\n")
        raise SystemExit(1)
