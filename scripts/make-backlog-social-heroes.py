#!/usr/bin/env python3
"""Create branded social hero images (1200x800) for the Aug 17 2026 backlog packs."""
from PIL import Image, ImageDraw, ImageFont
import os

GOLD = (207, 179, 110)
GOLD_LIGHT = (235, 215, 160)
WHITE = (255, 255, 255)
OFF_WHITE = (248, 249, 250)
DARK = (17, 24, 39)
DARK_GRAY = (31, 41, 55)
MED_GRAY = (107, 114, 128)
LIGHT_GRAY = (243, 244, 246)
DARK_BG_TOP = (31, 41, 55)
DARK_BG_BOT = (25, 33, 48)

W, H = 1200, 800
FONT_DIR = "/usr/share/fonts/truetype"

title_font = ImageFont.truetype(f"{FONT_DIR}/dejavu/DejaVuSerif-Bold.ttf", 52)
title_font_sm = ImageFont.truetype(f"{FONT_DIR}/dejavu/DejaVuSerif-Bold.ttf", 42)
subtitle_font = ImageFont.truetype(f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf", 24)
body_font = ImageFont.truetype(f"{FONT_DIR}/liberation/LiberationSans-Regular.ttf", 20)
small_f = ImageFont.truetype(f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf", 16)
badge_f = ImageFont.truetype(f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf", 20)
stat_num = ImageFont.truetype(f"{FONT_DIR}/dejavu/DejaVuSerif-Bold.ttf", 60)
stat_lab = ImageFont.truetype(f"{FONT_DIR}/liberation/LiberationSans-Bold.ttf", 20)

OUT = "public/images"

def dark_bg(img):
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(DARK_BG_TOP[0] + (DARK_BG_BOT[0] - DARK_BG_TOP[0]) * t)
        g = int(DARK_BG_TOP[1] + (DARK_BG_BOT[1] - DARK_BG_TOP[1]) * t)
        b = int(DARK_BG_TOP[2] + (DARK_BG_BOT[2] - DARK_BG_TOP[2]) * t)
        d.line([(0, y), (W, y)], fill=(r, g, b))

def bottom(d):
    bar_y = H - 48
    d.rectangle([(0, bar_y), (W, H)], fill=DARK_GRAY)
    d.rectangle([(0, bar_y), (W, bar_y + 2)], fill=GOLD)
    d.text((35, bar_y + 14), "SAA HOMES  |  Schwartz & Associates  |  Coldwell Banker Realty", fill=GOLD, font=small_f)
    d.text((W - 35, bar_y + 14), "(970) 999-1407  ·  saahomes.com", fill=LIGHT_GRAY, font=small_f, anchor="rt")

def center_text(d, x, y, text, font, color):
    bb = d.textbbox((0, 0), text, font=font)
    d.text((x - (bb[2] - bb[0]) // 2, y), text, fill=color, font=font)

def chip(d, label, x, y):
    bb = d.textbbox((0, 0), label, font=badge_f)
    w, h = bb[2] - bb[0] + 40, bb[3] - bb[1] + 16
    d.rectangle([(x, y), (x + w, y + h)], fill=GOLD)
    d.text((x + 20, y + 8), label, fill=DARK, font=badge_f)
    return x + w

def hero(filename, chip_label, title_lines, subtitle, stats=None):
    img = Image.new("RGB", (W, H))
    dark_bg(img)
    d = ImageDraw.Draw(img)
    d.rectangle([(0, 0), (W, 2)], fill=GOLD)
    d.rectangle([(35, 70), (42, 210)], fill=GOLD)
    chip(d, chip_label, 60, 40)
    y = 120
    for line in title_lines:
        d.text((60, y), line, fill=WHITE, font=title_font)
        y += 64
    d.text((60, y + 6), subtitle, fill=LIGHT_GRAY, font=subtitle_font)
    y += 56
    d.rectangle([(60, y), (300, y + 2)], fill=GOLD)
    y += 40
    if stats:
        n = len(stats)
        gap = 40
        card_w = (W - 2 * 60 - (n - 1) * gap) // n
        for i, (num, lab) in enumerate(stats):
            x0 = 60 + i * (card_w + gap)
            d.rectangle([(x0, y), (x0 + card_w, y + 90)], outline=GOLD, width=1)
            center_text(d, x0 + card_w // 2, y + 10, num, stat_num, GOLD)
            center_text(d, x0 + card_w // 2, y + 78, lab, stat_lab, WHITE)
    bottom(d)
    path = os.path.join(OUT, filename)
    img.save(path, "JPEG", quality=95)
    print(f"created {path}")

# 1. Neighborhood guides megapack
hero("noco-neighborhood-guides-2026.jpg", "NEW GUIDES · AUG 2026",
     ["49 New Neighborhood Guides", "Across Northern Colorado"],
     "Erie · Brighton · Estes Park · Red Feather Lakes · Fort Lupton · Lyons · Bellvue · Carbon Valley",
     stats=[("49", "NEW GUIDES"), ("8", "COMMUNITIES"), ("317", "TOTAL GUIDES")])

# 2. Best realtor posts
hero("best-realtor-noco-2026.jpg", "REAL ESTATE AGENTS · 2026",
     ["Best Realtors in", "Northern Colorado"],
     "Loveland · Greeley · Longmont — how to pick the right agent",
     stats=[("3", "CITY GUIDES"), ("20+", "YEARS LOCAL"), ("5.0★", "CLIENT RATING")])

# 3. Recently sold data
hero("recently-sold-noco-2026.jpg", "SELLERS · LIVE DATA",
     ["Recently Sold Homes", "Across Northern Colorado"],
     "Real MLS closed data on every city page — see what homes actually sell for",
     stats=[("27", "CITY PAGES"), ("LIVE", "MLS DATA"), ("CLOSED", "SALES")])

# 4. Assumable mortgages
hero("assumable-mortgages-noco.jpg", "MORTGAGES · 2026",
     ["Assumable Mortgages:", "Lower-Rate Listings"],
     "Take over a seller's low rate — new hub + buyer guide",
     stats=[("2.5-3%", "2022 RATES"), ("SAVE", "ON REFI COSTS"), ("NEW", "HUB")])

# 5. Veterans program
hero("veterans-noco-2026.jpg", "VETERANS · SAA PLEDGE",
     ["Serving Those Who Served", "Northern Colorado"],
     "0.5% back pledge + VA loan guide + military relocation guide",
     stats=[("0.5%", "BACK ON CLOSE"), ("VA LOAN", "GUIDE"), ("100%", "PLEDGE")])

print("done")