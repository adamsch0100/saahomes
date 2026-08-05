#!/usr/bin/env python3
"""Generate real hero images for the two concession cheat-sheet blogs.
Hero layout per content-image-creation skill: dark bg (survives black/60% overlay),
bold white + gold text, stat callouts, SAA bottom bar. 1200x800, JPEG q95.
"""
from PIL import Image, ImageDraw, ImageFont

GOLD = (207, 179, 110)
GOLD_LIGHT = (235, 215, 160)
WHITE = (255, 255, 255)
LIGHT_GRAY = (200, 205, 215)
MED_GRAY = (107, 114, 128)
DARK_GRAY = (31, 41, 55)
DARK_END = (25, 33, 48)

W, H = 1200, 800

FD = "/usr/share/fonts/truetype"
serif_bold = ImageFont.truetype(f"{FD}/dejavu/DejaVuSerif-Bold.ttf", 52)
serif_num = ImageFont.truetype(f"{FD}/dejavu/DejaVuSerif-Bold.ttf", 44)
sans_bold = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Bold.ttf", 24)
sans_reg = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Regular.ttf", 18)
sans_small = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Bold.ttf", 15)
sans_bar = ImageFont.truetype(f"{FD}/liberation/LiberationSans-Regular.ttf", 15)

def ctext(d, cx, y, text, font, fill):
    bb = d.textbbox((0, 0), text, font=font)
    d.text((cx - (bb[2] - bb[0]) // 2, y), text, fill=fill, font=font)

def build(category, title_line1, title_line2, subtitle, stats, output):
    # Dark gradient background
    img = Image.new("RGB", (W, H), DARK_GRAY)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(DARK_GRAY[0] + (DARK_END[0] - DARK_GRAY[0]) * t)
        g = int(DARK_GRAY[1] + (DARK_END[1] - DARK_GRAY[1]) * t)
        b = int(DARK_GRAY[2] + (DARK_END[2] - DARK_GRAY[2]) * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))

    # Gold top accent
    d.rectangle([(0, 0), (W, 4)], fill=GOLD)
    # Left gold vertical accent
    d.rectangle([(40, 56), (47, 210)], fill=GOLD)

    # Category chip
    chip = category
    bb = d.textbbox((0, 0), chip, font=sans_small)
    pad = 10
    tw = (bb[2] - bb[0]) + pad * 2
    d.rounded_rectangle([(70, 56), (70 + tw, 56 + 34)], radius=6, fill=GOLD)
    d.text((70 + pad, 56 + (34 - (bb[3] - bb[1])) // 2 - 2), chip, fill=(17, 24, 39), font=sans_small)

    # Title
    d.text((70, 110), title_line1, fill=WHITE, font=serif_bold)
    d.text((70, 176), title_line2, fill=GOLD, font=serif_bold)

    # Subtitle
    d.text((70, 258), subtitle, fill=LIGHT_GRAY, font=sans_bold)

    # Gold divider
    d.rectangle([(70, 306), (330, 308)], fill=GOLD)

    # Stat callouts: (number, label) pairs
    n = len(stats)
    gap = 24
    x0, y0 = 70, 350
    cw = (W - 2 * x0 - (n - 1) * gap) // n
    chh = 150
    for i, (num, label) in enumerate(stats):
        x = x0 + i * (cw + gap)
        d.rectangle([(x, y0), (x + cw, y0 + chh)], outline=(60, 72, 92), width=1)
        d.rectangle([(x, y0), (x + cw, y0 + 5)], fill=GOLD)
        ctext(d, x + cw // 2, y0 + 26, num, serif_num, WHITE)
        # label centered, wrapped if long
        words = label.split()
        lines = []
        cur = ""
        for w in words:
            t = (cur + " " + w).strip()
            bb = d.textbbox((0, 0), t, font=sans_small)
            if bb[2] - bb[0] <= cw - 16 and cur:
                cur = t
            else:
                if cur:
                    lines.append(cur)
                cur = w
        lines.append(cur)
        yy = y0 + 92
        for ln in lines[:2]:
            ctext(d, x + cw // 2, yy, ln, sans_small, LIGHT_GRAY)
            yy += 24

    # Bottom bar
    bar_y = H - 48
    d.rectangle([(0, bar_y), (W, H)], fill=(17, 24, 39))
    d.rectangle([(0, bar_y - 2), (W, bar_y)], fill=GOLD)
    d.text((35, bar_y + 15), "SAA HOMES  |  Schwartz & Associates  |  Coldwell Banker Realty",
           fill=GOLD, font=sans_bar)
    right = "(970) 999-1407  ·  saahomes.com"
    bb = d.textbbox((0, 0), right, font=sans_bar)
    d.text((W - 35 - (bb[2] - bb[0]), bar_y + 15), right, fill=LIGHT_GRAY, font=sans_bar)

    img.save(output, quality=95)
    print("saved", output)


CAPS = [
    ("6%", "FHA"),
    ("6%", "USDA"),
    ("4%", "VA"),
    ("3–9%", "Conventional"),
]

build("BUYER TIPS", "Buyer Concession", "Cheat Sheet",
      "How much sellers can pay toward your closing costs — by loan type",
      CAPS, "public/images/buyer-concession-cheat-sheet-northern-colorado.jpg")

build("SELLER TIPS", "Seller Concession", "Cheat Sheet",
      "Max contribution by loan type — negotiate every offer with confidence",
      CAPS, "public/images/seller-concession-cheat-sheet-northern-colorado.jpg")
