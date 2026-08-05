#!/usr/bin/env python3
"""Inventory: which black-default blog slugs have real image files already?"""
import re
from pathlib import Path

from PIL import Image

src = open("src/data/blogPosts.js").read()
pairs = re.findall(r"slug:\s*'([^']+)'[^{]*?image:\s*'([^']*)'", src, re.S)
black_slugs = [s for s, img in pairs if "blog-default-black" in img]
print(f"black-default blogs: {len(black_slugs)}")
print("=== existing files for black-default slugs (luma check) ===")
for s in black_slugs:
    p = Path(f"public/images/{s}.jpg")
    if p.exists():
        try:
            im = Image.open(p).convert("L")
            px = list(im.getdata())
            luma = sum(px) / len(px)
            flag = "BLACK!" if luma < 12 else "ok"
            print(f"  {s}.jpg  luma={luma:.0f}  {flag}")
        except Exception as e:
            print(f"  {s}.jpg  UNREADABLE {e}")
    else:
        print(f"  {s}.jpg  (no file)")
