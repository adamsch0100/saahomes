#!/usr/bin/env python3
"""Generate branded hero images for every blog still using blog-default-black.jpg
and wire them into src/data/blogPosts.js.

Dark-background hero layout per the content-image-creation skill (survives the
black/60% overlay): gold top accent, category chip, auto-sized wrapped title
(last line gold), excerpt subtitle, gold divider, SAA bottom bar.
Files are slug-named in public/images/ (keyword-optimized per design system).
"""
import ast
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

GOLD = (207, 179, 110)
WHITE = (255, 255, 255)
LIGHT = (200, 205, 215)
DARK = (17, 24, 39)
DARK_GRAY = (31, 41, 55)
DARK_END = (25, 33, 48)

W, H = 1200, 800
FD = "/usr/share/fonts/truetype"

F_CHIP = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Bold.ttf", 15)
F_SUB = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Regular.ttf", 22)
F_BAR = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Regular.ttf", 15)


def js_str(s):
    """Evaluate the inner content of a single-quoted JS string literal."""
    return ast.literal_eval("'" + s + "'")


def wrap(d, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        bb = d.textbbox((0, 0), t, font=font)
        if cur and bb[2] - bb[0] <= max_w:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_hero(slug, title, cat, subtitle, out):
    img = Image.new("RGB", (W, H), DARK_GRAY)
    d = ImageDraw.Draw(img)
    # dark gradient background
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(DARK_GRAY[i] + (DARK_END[i] - DARK_GRAY[i]) * t) for i in range(3)))
    # gold top accent + left bar
    d.rectangle([(0, 0), (W, 4)], fill=GOLD)
    d.rectangle([(40, 52), (47, 196)], fill=GOLD)
    # category chip
    bb = d.textbbox((0, 0), cat, font=F_CHIP)
    tw = (bb[2] - bb[0]) + 22
    d.rounded_rectangle([(70, 52), (70 + tw, 86)], radius=6, fill=GOLD)
    d.text((81, 59), cat, fill=DARK, font=F_CHIP)
    # title: pick the largest font that fits <= 3 lines
    lines, font = [], F_CHIP
    for size in (52, 46, 40, 34):
        font = ImageFont.truetype(f"{FD}/dejavu/DejaVuSerif-Bold.ttf", size)
        lines = wrap(d, title, font, W - 180)
        if len(lines) <= 3 and all(d.textbbox((0, 0), ln, font=font)[2] <= W - 180 for ln in lines):
            break
    y = 112
    for i, ln in enumerate(lines):
        fill = GOLD if (len(lines) > 1 and i == len(lines) - 1) else WHITE
        d.text((70, y), ln, fill=fill, font=font)
        y += size + 14
    # subtitle (max 2 lines)
    sublines = wrap(d, subtitle, F_SUB, W - 180)[:2]
    y += 16
    for ln in sublines:
        d.text((70, y), ln, fill=LIGHT, font=F_SUB)
        y += 31
    # gold divider
    d.rectangle([(70, y + 8), (330, y + 10)], fill=GOLD)
    # bottom bar
    bar_y = H - 48
    d.rectangle([(0, bar_y), (W, H)], fill=DARK)
    d.rectangle([(0, bar_y - 2), (W, bar_y)], fill=GOLD)
    d.text((35, bar_y + 15), "SAA HOMES  |  Schwartz & Associates  |  Coldwell Banker Realty", fill=GOLD, font=F_BAR)
    right = "(970) 999-1407  ·  saahomes.com"
    bb = d.textbbox((0, 0), right, font=F_BAR)
    d.text((W - 35 - (bb[2] - bb[0]), bar_y + 15), right, fill=LIGHT, font=F_BAR)
    img.save(out, quality=95)


def main():
    src = open("src/data/blogPosts.js", encoding="utf-8").read()
    # slug, title, excerpt(optional), category, image — in file order
    entries = re.findall(
        r"slug:\s*'([^']+)'[^{]*?title:\s*'((?:[^'\\]|\\.)*)'"
        r"[^{]*?(?:excerpt:\s*'((?:[^'\\]|\\.)*)'[^{]*?)?"
        r"category:\s*'((?:[^'\\]|\\.)*)'[^{]*?image:\s*'([^']*)'",
        src,
        re.S,
    )
    black = [e for e in entries if "blog-default-black" in e[4]]
    print(f"black-default entries parsed: {len(black)}")

    wired, generated = [], []
    for slug, title, excerpt, cat, _img in black:
        t = js_str(title)
        c = js_str(cat) or "SAA Homes"
        p = Path(f"public/images/{slug}.jpg")
        if p.exists():
            try:
                im = Image.open(p).convert("L")
                px = list(im.getdata())
                if sum(px) / len(px) > 12:
                    wired.append(slug)
                    continue
            except Exception:
                pass
        e = js_str(excerpt) if excerpt else ""
        sub = e.replace("\n", " ").strip()
        if len(sub) > 120:
            sub = sub[:117].rsplit(" ", 1)[0] + "…"
        draw_hero(slug, t, c, sub, str(p))
        generated.append(slug)

    # wire: replace black-default image lines with the real per-slug path
    lines = src.split("\n")
    cur_slug = None
    replaced = 0
    out_lines = []
    for line in lines:
        m = re.search(r"slug:\s*'([^']+)'", line)
        if m:
            cur_slug = m.group(1)
        if "blog-default-black" in line and cur_slug:
            new = f"    image: '/images/{cur_slug}.jpg',"
            out_lines.append(new)
            replaced += 1
        else:
            out_lines.append(line)
    Path("src/data/blogPosts.js").write_text("\n".join(out_lines), encoding="utf-8")

    print(f"wired existing files: {len(wired)} -> {sorted(wired)}")
    print(f"generated new heroes: {len(generated)}")
    print(f"blogPosts.js image lines replaced: {replaced}")


if __name__ == "__main__":
    main()
