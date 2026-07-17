#!/usr/bin/env python3
"""
SAA Homes — YouTube Video Publisher
====================================
Generates branded text-overlay videos from blog/market-update content
and publishes them to YouTube. Fully automated pipeline.

Pipeline:
  blog data → branded slides (Pillow) → video assembly (FFmpeg) → YouTube upload

Usage:
  # Generate video only (no upload)
  python3 scripts/youtube-video-publisher.py generate \\
    --title "July 2026 Northern Colorado Market Update" \\
    --slug "northern-colorado-market-update-july-2026" \\
    --excerpt "Home prices held steady..." \\
    --points "Median price: $525K (+3% YoY)"|"Inventory: 2.1 months supply"|"Days on market: 34" \\
    --date "2026-07-01" \\
    --output-dir ./video-output

  # Full publish (generate + upload)
  python3 scripts/youtube-video-publisher.py publish \\
    --blog-slug "northern-colorado-market-update-july-2026" \\
    --credentials client_secret.json \\
    --output-dir ./video-output

  # Upload existing video
  python3 scripts/youtube-video-publisher.py upload \\
    --video ./video-output/output.mp4 \\
    --title "..." \\
    --description "..." \\
    --credentials client_secret.json \\
    --publish
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ─── Brand Configuration ────────────────────────────────────────────────────

BRAND = {
    "name": "Schwartz and Associates",
    "short_name": "SAA Homes",
    "url": "https://saahomes.com",
    "phone": "(970) 999-1407",
    "colors": {
        "bg_top": "#1a1a1a",
        "bg_bottom": "#2a2520",        # Warm dark — slight brown undertone
        "gold": "#CFB36E",             # Primary accent
        "gold_light": "#E8D5A8",       # Lighter gold for subtle elements
        "white": "#FFFFFF",
        "off_white": "#F0EDE8",        # Warm off-white for body text
        "muted": "#9C9A96",            # Secondary text
        "divider": "#CFB36E40",        # Gold at 25% opacity
        "cta_bg": "#CFB36E",           # CTA button gold
        "cta_text": "#1a1a1a",         # Dark text on gold
    },
    "fonts": {
        "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "serif_bold": "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    },
    "logo_path": os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "video-assets", "logo.png"
    ),
    "slide_duration": 8.0,            # Seconds per slide — more time per point
    "crossfade_duration": 0.8,        # Transition overlap (unused with hard cuts)
    "fps": 30,
    "resolution": (1920, 1080),
}

# ─── Color Utilities ────────────────────────────────────────────────────────

def hex_to_rgb(hex_color):
    """Parse hex color (#RRGGBB or #RRGGBBAA) to (R, G, B[, A])."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 8:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4, 6))
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def hex_to_rgba(hex_color, alpha=255):
    """Parse hex color and override alpha."""
    r, g, b = hex_to_rgb(hex_color)[:3]
    return (r, g, b, alpha)

def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB tuples."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

# ─── Slide Generation ───────────────────────────────────────────────────────

class SlideRenderer:
    """Renders branded slides for YouTube video content."""

    def __init__(self, brand=None):
        self.brand = brand or BRAND
        self.W, self.H = self.brand["resolution"]
        self.c = self.brand["colors"]
        f = self.brand["fonts"]

        self._load_fonts(f)
        self._load_logo()

    def _load_fonts(self, f):
        """Load font variants at different sizes — larger sizes for readability."""
        self.fonts = {}
        sizes = {
            "display": 92,    # Big stat numbers
            "title_lg": 64,   # Blog title
            "title_md": 48,   # Section header / CTA phone
            "body_lg": 40,    # Slide heading
            "body_md": 32,    # Body / supporting text
            "body_sm": 26,    # Date, labels
            "caption": 22,    # Small labels, counters
        }
        for name, size in sizes.items():
            try:
                self.fonts[f"{name}_bold"] = ImageFont.truetype(f["bold"], size)
                self.fonts[f"{name}_regular"] = ImageFont.truetype(f["regular"], size)
            except Exception as e:
                print(f"Warning: Could not load font at size {size}: {e}", file=sys.stderr)
                self.fonts[f"{name}_bold"] = ImageFont.load_default()
                self.fonts[f"{name}_regular"] = ImageFont.load_default()

        # Serif for accent / title text
        try:
            self.fonts["serif_title"] = ImageFont.truetype(f["serif_bold"], 68)
        except Exception:
            self.fonts["serif_title"] = self.fonts["title_lg_bold"]

    def _load_logo(self):
        """Load brand logo, resized to fit. Handles palette-mode PNGs with transparency."""
        self.logo = None
        logo_path = self.brand["logo_path"]
        if os.path.exists(logo_path):
            try:
                logo = Image.open(logo_path)
                # Convert palette (P) to RGBA, preserving transparency
                if logo.mode == "P":
                    logo = logo.convert("RGBA")
                elif logo.mode != "RGBA":
                    logo = logo.convert("RGBA")
                # Scale logo to ~130px height
                ratio = 130 / logo.height
                new_w = int(logo.width * ratio)
                self.logo = logo.resize((new_w, 130), Image.LANCZOS)
            except Exception as e:
                print(f"Warning: Could not load logo: {e}", file=sys.stderr)

    def _create_gradient_background(self, color_top, color_bottom):
        """Create a vertical gradient background."""
        img = Image.new("RGB", (self.W, self.H))
        top = hex_to_rgb(color_top)
        bottom = hex_to_rgb(color_bottom)
        for y in range(self.H):
            t = y / self.H
            color = lerp_color(top, bottom, t)
            for x in range(self.W):
                img.putpixel((x, y), color)
        return img

    def _add_branding_elements(self, draw):
        """Add persistent brand elements to every slide (logo, bottom bar, URL)."""
        # ── Bottom accent line ──
        line_y = self.H - 80
        draw.rectangle([(120, line_y), (self.W - 120, line_y + 2)],
                       fill=hex_to_rgb(self.c["divider"]))

        # ── URL at bottom right ──
        url_text = self.brand["url"]
        url_font = self.fonts["caption_regular"]
        bbox = draw.textbbox((0, 0), url_text, font=url_font)
        url_w = bbox[2] - bbox[0]
        draw.text((self.W - 120 - url_w, line_y + 12), url_text,
                  font=url_font, fill=hex_to_rgb(self.c["muted"]))

        # ── Logo at top left ──
        if self.logo:
            self.logo_paste_x = 60
            self.logo_paste_y = 40
            # Scale existing alpha by 0.65 to keep logo subtle, preserving transparency
            r, g, b, a = self.logo.split()
            a = a.point(lambda x: max(0, int(x * 0.65)))
            logo_faded = Image.merge("RGBA", (r, g, b, a))
            img = draw._image
            img.paste(logo_faded, (self.logo_paste_x, self.logo_paste_y), logo_faded)

    def _wrap_text(self, text, font, max_width):
        """Wrap text to fit within max_width pixels."""
        words = text.split()
        lines = []
        current_line = []
        for word in words:
            test_line = " ".join(current_line + [word])
            bbox = font.getbbox(test_line)
            if bbox and (bbox[2] - bbox[0]) <= max_width:
                current_line.append(word)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
        if current_line:
            lines.append(" ".join(current_line))
        return lines

    def _draw_centered_text(self, draw, text, font, y, color, max_width, line_spacing=1.4):
        """Draw centered, wrapped text. Returns the bottom y position."""
        lines = self._wrap_text(text, font, max_width)
        line_height = int(font.size * line_spacing)
        total_height = len(lines) * line_height
        start_y = y - total_height // 2

        for i, line in enumerate(lines):
            bbox = font.getbbox(line)
            line_w = bbox[2] - bbox[0]
            x = (self.W - line_w) // 2
            draw.text((x, start_y + i * line_height), line,
                      font=font, fill=hex_to_rgb(color))
        return start_y + len(lines) * line_height

    def _draw_upper_centered(self, draw, text, font, y, color, max_width, line_spacing=1.4):
        """Draw centered, wrapped text starting at y (not centered on y)."""
        lines = self._wrap_text(text, font, max_width)
        line_height = int(font.size * line_spacing)
        for i, line in enumerate(lines):
            bbox = font.getbbox(line)
            line_w = bbox[2] - bbox[0]
            x = (self.W - line_w) // 2
            draw.text((x, y + i * line_height), line,
                      font=font, fill=hex_to_rgb(color))
        return y + len(lines) * line_height

    # ═══════════════════════════════════════════════════════════════
    # SLIDE: Title
    # ═══════════════════════════════════════════════════════════════
    def render_title_slide(self, title, subtitle="", date_str=""):
        """Opening title slide — impactful headline with brand context."""
        img = self._create_gradient_background(self.c["bg_top"], self.c["bg_bottom"])
        draw = ImageDraw.Draw(img)
        self._add_branding_elements(draw)

        # ── Gold divider above title ──
        draw.rectangle([(self.W // 2 - 50, 290), (self.W // 2 + 50, 290 + 3)],
                       fill=hex_to_rgb(self.c["gold"]))

        # ── Title (centered, serif, white) ──
        title_font = self.fonts["serif_title"]
        self._draw_centered_text(draw, title, title_font, 380,
                                 self.c["white"], self.W - 200)

        # ── Subtitle (gold) ──
        if subtitle:
            sub_font = self.fonts["body_md_bold"]
            self._draw_centered_text(draw, subtitle, sub_font, 510,
                                     self.c["gold"], self.W - 300)

        # ── Date ──
        if date_str:
            date_font = self.fonts["body_sm_regular"]
            try:
                parsed = datetime.strptime(date_str, "%Y-%m-%d")
                display_date = parsed.strftime("%B %d, %Y")
            except ValueError:
                display_date = date_str
            self._draw_centered_text(draw, display_date, date_font, self.H - 140,
                                     self.c["muted"], self.W - 200)

        return img

    # ═══════════════════════════════════════════════════════════════
    # SLIDE: Content / Key Point
    # ═══════════════════════════════════════════════════════════════
    def render_content_slide(self, heading, body="", slide_number=1, total_slides=1):
        """Content slide — heading as the takeaway, body as supporting detail."""
        img = self._create_gradient_background(self.c["bg_top"], self.c["bg_bottom"])
        draw = ImageDraw.Draw(img)
        self._add_branding_elements(draw)

        # ── Slide counter ──
        counter_font = self.fonts["caption_regular"]
        counter_text = f"{slide_number} / {total_slides}"
        bbox = draw.textbbox((0, 0), counter_text, font=counter_font)
        draw.text((self.W - 120 - (bbox[2] - bbox[0]), 55), counter_text,
                  font=counter_font, fill=hex_to_rgb(self.c["muted"]))

        # ── Gold accent divider ──
        draw.rectangle([(self.W // 2 - 35, 200), (self.W // 2 + 35, 200 + 3)],
                       fill=hex_to_rgb(self.c["gold"]))

        # ── Heading (gold, bold) ──
        head_font = self.fonts["body_lg_bold"]
        self._draw_centered_text(draw, heading, head_font, 310,
                                 self.c["gold"], self.W - 220)

        # ── Body text (off-white, more detail) ──
        if body:
            body_font = self.fonts["body_md_regular"]
            self._draw_centered_text(draw, body, body_font, 440,
                                     self.c["off_white"], self.W - 320, line_spacing=1.6)

        return img

    # ═══════════════════════════════════════════════════════════════
    # SLIDE: Big Stat Number
    # ═══════════════════════════════════════════════════════════════
    def render_stat_slide(self, value, label, context="", slide_number=1, total_slides=1):
        """Stat slide — one big number that drives the point home."""
        img = self._create_gradient_background(self.c["bg_top"], self.c["bg_bottom"])
        draw = ImageDraw.Draw(img)
        self._add_branding_elements(draw)

        # ── Slide counter ──
        counter_font = self.fonts["caption_regular"]
        counter_text = f"{slide_number} / {total_slides}"
        bbox = draw.textbbox((0, 0), counter_text, font=counter_font)
        draw.text((self.W - 120 - (bbox[2] - bbox[0]), 55), counter_text,
                  font=counter_font, fill=hex_to_rgb(self.c["muted"]))

        # ── Gold divider above stat ──
        draw.rectangle([(self.W // 2 - 35, 210), (self.W // 2 + 35, 210 + 3)],
                       fill=hex_to_rgb(self.c["gold"]))

        # ── Big number (gold, extra large) ──
        stat_font = self.fonts["display_bold"]
        self._draw_centered_text(draw, value, stat_font, 350,
                                 self.c["gold"], self.W - 150)

        # ── Label (white) ──
        label_font = self.fonts["title_md_bold"]
        self._draw_centered_text(draw, label, label_font, 470,
                                 self.c["white"], self.W - 250)

        # ── Context / explanation (off-white) ──
        if context:
            ctx_font = self.fonts["body_md_regular"]
            self._draw_centered_text(draw, context, ctx_font, 560,
                                     self.c["off_white"], self.W - 350, line_spacing=1.5)

        return img

    # ═══════════════════════════════════════════════════════════════
    # SLIDE: Insight / Takeaway
    # ═══════════════════════════════════════════════════════════════
    def render_insight_slide(self, heading, body="", slide_number=1, total_slides=1):
        """Insight slide — deeper analysis or actionable takeaway."""
        img = self._create_gradient_background(self.c["bg_top"], self.c["bg_bottom"])
        draw = ImageDraw.Draw(img)
        self._add_branding_elements(draw)

        # ── Slide counter ──
        counter_font = self.fonts["caption_regular"]
        counter_text = f"{slide_number} / {total_slides}"
        bbox = draw.textbbox((0, 0), counter_text, font=counter_font)
        draw.text((self.W - 120 - (bbox[2] - bbox[0]), 55), counter_text,
                  font=counter_font, fill=hex_to_rgb(self.c["muted"]))

        # ── Gold accent ──
        draw.rectangle([(self.W // 2 - 35, 180), (self.W // 2 + 35, 180 + 3)],
                       fill=hex_to_rgb(self.c["gold"]))

        # ── "KEY INSIGHT" label ──
        label_font = self.fonts["caption_bold"]
        self._draw_centered_text(draw, "KEY INSIGHT", label_font, 215,
                                 self.c["gold_light"], self.W - 400)

        # ── Heading (gold, bold) ──
        head_font = self.fonts["body_lg_bold"]
        self._draw_centered_text(draw, heading, head_font, 320,
                                 self.c["gold"], self.W - 220)

        # ── Body text ──
        if body:
            body_font = self.fonts["body_md_regular"]
            self._draw_centered_text(draw, body, body_font, 450,
                                     self.c["off_white"], self.W - 320, line_spacing=1.6)

        return img

    # ═══════════════════════════════════════════════════════════════
    # SLIDE: Call to Action
    # ═══════════════════════════════════════════════════════════════
    def render_cta_slide(self):
        """Closing CTA — clear, actionable next step for viewers."""
        img = self._create_gradient_background(self.c["bg_top"], self.c["bg_bottom"])
        draw = ImageDraw.Draw(img)
        self._add_branding_elements(draw)

        # ── Gold accent ──
        draw.rectangle([(self.W // 2 - 40, 240), (self.W // 2 + 40, 240 + 3)],
                       fill=hex_to_rgb(self.c["gold"]))

        # ── Headline ──
        head_font = self.fonts["title_md_bold"]
        self._draw_centered_text(draw, "Ready to make your move?", head_font,
                                 320, self.c["gold_light"], self.W - 250)

        # ── Sub-message ──
        sub_font = self.fonts["body_md_regular"]
        self._draw_centered_text(draw,
                                "Let's talk about your Northern Colorado real estate goals",
                                sub_font, 400, self.c["off_white"], self.W - 350)

        # ── Phone number (large, white) ──
        phone_font = self.fonts["display_bold"]
        self._draw_centered_text(draw, self.brand["phone"], phone_font,
                                 500, self.c["white"], self.W - 150)

        # ── URL below ──
        url_font = self.fonts["body_lg_regular"]
        self._draw_centered_text(draw, self.brand["url"], url_font,
                                 580, self.c["gold"], self.W - 200)

        # ── Bottom note ──
        note_font = self.fonts["caption_regular"]
        self._draw_centered_text(draw,
                                "Schwartz and Associates — Northern Colorado Real Estate",
                                note_font, self.H - 140, self.c["muted"], self.W - 200)

        return img

    def render_slideshow(self, slides):
        """Combine slides into a list of PIL Images."""
        images = []
        for render_fn in slides:
            img = render_fn()
            images.append(img)
        return images


# ─── Audio Generation (Python + FFmpeg) ──────────────────────────────────────

def create_background_audio(duration_seconds, output_path, slug=None, sample_rate=44100):
    """
    Generate background music for the video.

    Priority:
    1. Per-slug clean music at /seed/assets/music/{slug}.mp3
    2. background-music-1.mp3 through -4.mp3 in video-assets/
    3. Legacy background-music.mp3
    4. Generated lo-fi beats (fallback)
    """
    import random
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(script_dir, "video-assets")

    # Priority 1: Per-slug clean music from seed assets
    if slug:
        seed_path = f"/seed/assets/music/{slug}.mp3"
        if os.path.exists(seed_path):
            music_files = [str(seed_path)]
            print(f"  Background music: {slug}.mp3 (seed clean track)")
            # Fall through to the shared processing below
        else:
            music_files = []
    else:
        music_files = []

    # Find available background tracks (1-4) if no seed music
    for i in range(1, 5):
        path = os.path.join(assets_dir, f"background-music-{i}.mp3")
        if os.path.exists(path):
            music_files.append(path)

    # Also check legacy background-music.mp3
    legacy = os.path.join(assets_dir, "background-music.mp3")
    if legacy not in music_files and os.path.exists(legacy):
        music_files.append(legacy)

    if music_files:
        # Pick a random track (avoid the last-used one if possible)
        last_file = os.path.join(assets_dir, ".last_music_track")
        last_pick = None
        if os.path.exists(last_file):
            last_pick = open(last_file).read().strip()

        candidates = [f for f in music_files if f != last_pick] or music_files
        music_file = random.choice(candidates)

        # Save this pick
        with open(last_file, "w") as f:
            f.write(music_file)

        track_name = os.path.basename(music_file)
        print(f"  Background music: {track_name}")

        # Get music duration
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", music_file],
            capture_output=True, text=True
        )
        info = json.loads(probe.stdout)
        music_duration = float(info["format"]["duration"])

        if music_duration >= duration_seconds - 1:
            # Music is long enough — just trim
            cmd = [
                "ffmpeg", "-y",
                "-i", music_file,
                "-t", str(duration_seconds),
                "-af", "loudnorm=I=-14:LRA=4:TP=-2",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ac", "2",
                output_path
            ]
        else:
            # Music is shorter — loop it
            # Create a concat list for looping
            import tempfile
            with tempfile.TemporaryDirectory() as tmpdir:
                concat_file = os.path.join(tmpdir, "loop.txt")
                # Calculate how many loops needed
                loops_needed = int(duration_seconds / music_duration) + 2
                with open(concat_file, "w") as f:
                    for _ in range(loops_needed):
                        f.write(f"file '{music_file}'\n")

                cmd = [
                    "ffmpeg", "-y",
                    "-f", "concat", "-safe", "0",
                    "-i", concat_file,
                    "-t", str(duration_seconds),
                    "-af", "loudnorm=I=-14:LRA=4:TP=-2",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-ac", "2",
                    output_path
                ]

        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return output_path

    # ── Fallback: Python-generated lo-fi beats ──
    import math
    import struct
    import tempfile

    bpm = 75
    beat_interval = 60.0 / bpm          # 0.8 seconds per beat
    total_samples = int(duration_seconds * sample_rate)

    # Pre-allocate stereo buffer (list of floats, interleaved L/R)
    samples = [0.0] * (total_samples * 2)

    def add_sample(idx, left, right=0.0):
        """Add to stereo sample at index idx (0-based per-channel)."""
        if 0 <= idx < total_samples:
            samples[idx * 2] += left
            samples[idx * 2 + 1] += right or left

    # ── 1. Chord pad (C major: C3=130.81, E3=164.81, G3=196.00) ──
    # Slow volume wobble (0.15 Hz) for movement
    for i in range(total_samples):
        t = i / sample_rate
        wobble = 0.7 + 0.3 * math.sin(2 * math.pi * 0.15 * t)
        pad = (
            0.20 * math.sin(2 * math.pi * 130.81 * t) +
            0.15 * math.sin(2 * math.pi * 164.81 * t) +
            0.12 * math.sin(2 * math.pi * 196.00 * t) +
            0.06 * math.sin(2 * math.pi * 261.63 * t)  # C4 for sparkle
        ) * wobble
        add_sample(i, pad * 0.35, pad * 0.35)

    # ── 2. Bass (C2 = 65.41 Hz) ──
    for i in range(total_samples):
        t = i / sample_rate
        bass = 0.30 * math.sin(2 * math.pi * 65.41 * t) + 0.10 * math.sin(2 * math.pi * 32.70 * t)
        add_sample(i, bass * 0.30, bass * 0.30)

    # ── 3. Kick drum on every beat ──
    beat_samples = int(beat_interval * sample_rate)
    num_beats = int(duration_seconds / beat_interval) + 1

    for beat in range(num_beats):
        start = int(beat * beat_interval * sample_rate)
        kick_len = min(int(0.15 * sample_rate), total_samples - start)  # 150ms kick

        for j in range(kick_len):
            idx = start + j
            env = math.exp(-j / (sample_rate * 0.04))  # 40ms decay
            # Pitch drop: 150Hz → 55Hz
            pitch = 150.0 - 95.0 * (j / kick_len)
            kick = env * 0.5 * math.sin(2 * math.pi * pitch * j / sample_rate)
            add_sample(idx, kick, kick)

    # ── 4. Soft snare/clap on beats 2 and 4 ──
    noise_buf = None  # Will generate on demand
    for beat in range(num_beats):
        # Beat 2 and 4 (1-indexed: 2 and 4)
        if beat % 4 not in (1, 3):
            continue
        start = int(beat * beat_interval * sample_rate)
        snare_len = min(int(0.10 * sample_rate), total_samples - start)

        # Generate filtered noise for this snare hit
        for j in range(snare_len):
            idx = start + j
            env = math.exp(-j / (sample_rate * 0.03))  # 30ms decay
            noise = env * 0.15 * (2.0 * (j % 101) / 100.0 - 1.0)  # Pseudo-noise
            # Low-pass: simple averaging
            add_sample(idx, noise * 0.3, noise * 0.3)

    # ── 5. Fade in/out ──
    fade_in_samples = int(3.0 * sample_rate)
    fade_out_start = max(0, total_samples - int(4.0 * sample_rate))

    for i in range(total_samples):
        if i < fade_in_samples:
            gain = i / fade_in_samples
            samples[i * 2] *= gain
            samples[i * 2 + 1] *= gain
        elif i >= fade_out_start:
            gain = (total_samples - i) / (total_samples - fade_out_start)
            samples[i * 2] *= gain
            samples[i * 2 + 1] *= gain

    # ── 6. Normalize peak to 0 dB ──
    peak = max(abs(max(samples)), abs(min(samples)))
    if peak > 0:
        norm_gain = 0.95 / peak
        samples = [s * norm_gain for s in samples]

    # ── Write WAV via temp file, then encode to AAC ──
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
        # WAV header
        data_size = len(samples) * 2  # 16-bit stereo
        with open(wav_path, "wb") as wav:
            # RIFF header
            wav.write(b"RIFF")
            wav.write(struct.pack("<I", 36 + data_size))
            wav.write(b"WAVE")
            # fmt chunk
            wav.write(b"fmt ")
            wav.write(struct.pack("<IHHIIHH", 16, 1, 2, sample_rate,
                                  sample_rate * 2 * 16 // 8, 2 * 16 // 8, 16))
            # data chunk
            wav.write(b"data")
            wav.write(struct.pack("<I", data_size))
            for s in samples:
                # Clamp and convert to 16-bit
                s = max(-1.0, min(1.0, s))
                wav.write(struct.pack("<h", int(s * 32767)))

    # Encode with FFmpeg to AAC at proper level (loudnorm to -14 LUFS)
    cmd = [
        "ffmpeg", "-y",
        "-i", wav_path,
        "-af", "loudnorm=I=-14:LRA=4:TP=-2",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ac", "2",
        output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True)

    # Clean up temp WAV
    try:
        os.unlink(wav_path)
    except Exception:
        pass

    return output_path


def assemble_video(slide_images, output_path, music_path=None, brand=None):
    """
    Assemble slides into an MP4 video.

    Renders each slide as a video segment, then concatenates with
    a crossfade transition between each pair using FFmpeg's xfade filter.
    Falls back to hard cuts if xfade is unavailable.
    """
    brand = brand or BRAND
    sd = brand["slide_duration"]
    fps = brand["fps"]
    W, H = brand["resolution"]

    with tempfile.TemporaryDirectory() as tmpdir:
        # Save each slide as PNG
        slide_paths = []
        for i, img in enumerate(slide_images):
            path = os.path.join(tmpdir, f"slide_{i:04d}.png")
            img.save(path, "PNG")
            slide_paths.append(path)

        num_slides = len(slide_paths)

        # Strategy: render each slide to a constant-framerate video,
        # then chain them with FFmpeg's concat demuxer (hard cuts).
        # This is the most reliable approach across FFmpeg versions.

        segments_dir = tempfile.mkdtemp(dir=tmpdir)
        segment_paths = []

        for i, slide_path in enumerate(slide_paths):
            seg_path = os.path.join(segments_dir, f"seg_{i:04d}.mp4")
            segment_paths.append(seg_path)

            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-framerate", str(fps),
                "-i", slide_path,
                "-c:v", "libx264",
                "-t", str(sd),
                "-pix_fmt", "yuv420p",
                "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                       f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
                "-r", str(fps),
                "-preset", "medium",
                "-crf", "18",
                "-an",
                seg_path
            ]
            subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)

        # Concatenate segments with concat demuxer
        concat_file = os.path.join(tmpdir, "concat.txt")
        with open(concat_file, "w") as f:
            for seg_path in segment_paths:
                f.write(f"file '{seg_path}'\n")

        video_noaudio = os.path.join(tmpdir, "video_noaudio.mp4")
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            "-an",
            video_noaudio
        ]
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)

        # Add background audio
        if music_path and os.path.exists(music_path):
            cmd = [
                "ffmpeg", "-y",
                "-i", video_noaudio,
                "-i", music_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
                output_path
            ]
        else:
            actual_duration = sd * num_slides
            music_temp = os.path.join(tmpdir, "ambient.m4a")
            create_background_audio(actual_duration, music_temp)

            cmd = [
                "ffmpeg", "-y",
                "-i", video_noaudio,
                "-i", music_temp,
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
                output_path
            ]

        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=180)

    return output_path


# ─── YouTube Upload ─────────────────────────────────────────────────────────

def get_authenticated_service(client_secret_file, token_file=None):
    """
    Authenticate and return YouTube API service.

    Uses OAuth 2.0 with local webserver flow for initial auth,
    then stores/uses refresh token for unattended operation.
    """
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request
    import pickle

    SCOPES = ["https://www.googleapis.com/auth/youtube.upload",
              "https://www.googleapis.com/auth/youtube.force-ssl"]

    token_path = token_file or os.path.join(
        os.path.dirname(client_secret_file),
        "youtube_token.pickle"
    )

    credentials = None

    # Load saved credentials
    if os.path.exists(token_path):
        try:
            with open(token_path, "rb") as f:
                credentials = pickle.load(f)
        except Exception:
            credentials = None

    # Refresh if expired
    if credentials and credentials.expired and credentials.refresh_token:
        try:
            credentials.refresh(Request())
            # Save refreshed credentials
            with open(token_path, "wb") as f:
                pickle.dump(credentials, f)
        except Exception:
            credentials = None

    # First-time auth — use console flow (works without redirect URIs)
    if not credentials or not credentials.valid:
        if not os.path.exists(client_secret_file):
            print(f"ERROR: Client secret file not found: {client_secret_file}")
            print("Follow the setup instructions to get credentials.")
            sys.exit(1)

        flow = InstalledAppFlow.from_client_secrets_file(
            client_secret_file, SCOPES
        )

        flow.redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'

        print("=" * 60)
        print("  YouTube API Authorization Required")
        print("=" * 60)
        print()
        print("  Step 1: Click the URL below and sign in with")
        print("          the Google account that owns")
        print("          youtube.com/@SAAHomes")
        print()
        print("  Step 2: Click 'Continue' to grant permissions")
        print()
        print("  Step 3: Copy the authorization code shown")
        print("          and paste it below")
        print()
        print("=" * 60)
        print()

        auth_url, _ = flow.authorization_url(prompt="consent")
        print(f"  {auth_url}")
        print()

        code = input("  Paste authorization code: ").strip()
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Save for future use
        with open(token_path, "wb") as f:
            pickle.dump(credentials, f)
        print(f"Token saved to {token_path}")

    return build("youtube", "v3", credentials=credentials)


def upload_video(youtube, video_path, title, description, tags=None,
                 category_id="25", privacy_status="public"):
    """
    Upload a video to YouTube via the Data API v3.

    Category 25 = "Real Estate"
    """
    from googleapiclient.http import MediaFileUpload

    body = {
        "snippet": {
            "title": title[:100],  # YouTube max 100 chars
            "description": description[:5000],
            "tags": (tags or [])[:500],
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
        }
    }

    media = MediaFileUpload(
        video_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=1024 * 1024,  # 1MB chunks for large files
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    print("Uploading to YouTube... (this may take a while)")
    while response is None:
        status, response = request.next_chunk()
        if status:
            progress = int(status.progress() * 100)
            print(f"  Upload progress: {progress}%", end="\r", flush=True)

    print()
    video_id = response.get("id")
    print(f"✅ Uploaded: https://youtu.be/{video_id}")
    return video_id


# ─── Blog Data Extraction ───────────────────────────────────────────────────

def get_blog_post_by_slug(slug):
    """
    Load blog post data from the site's data files.
    Reads blogPosts.js and finds the matching slug.
    """
    # Import the data file directly
    import importlib.util
    import sys as _sys

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _sys.path.insert(0, repo_root)

    try:
        # Try dynamic import
        spec = importlib.util.spec_from_file_location(
            "blogPosts",
            os.path.join(repo_root, "src", "data", "blogPosts.js"),
        )
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            posts = getattr(module, "blogPosts", [])
            for post in posts:
                if post.get("slug") == slug:
                    return post
    except Exception as e:
        print(f"Warning: Could not import blogPosts.js directly: {e}", file=sys.stderr)

    # Fallback: read and parse the JS file manually
    try:
        js_path = os.path.join(repo_root, "src", "data", "blogPosts.js")
        with open(js_path, "r") as f:
            content = f.read()

        # Find the blog post array
        posts_text = re.search(r'export const blogPosts\s*=\s*\[(.*?)\];', content, re.DOTALL)
        if not posts_text:
            return None

        # Find the specific post by slug
        slug_pattern = rf"slug:\s*'{re.escape(slug)}'"
        match = re.search(slug_pattern, posts_text.group(1))
        if not match:
            return None

        # Get everything from the start of this post object to the slug
        # Find the opening brace closest to and before the slug
        post_start = posts_text.group(1).rfind("{", 0, match.start())
        if post_start == -1:
            return None

        post_text = posts_text.group(1)[post_start:]

        # Extract fields from the post text
        def extract_field(name, text):
            """Extract a single-quoted field value, handling escaped quotes."""
            p = re.search(rf"{name}:\s*'((?:[^'\\]|\\.)*)'", text)
            return p.group(1) if p else ""

        title = extract_field("title", post_text)
        excerpt = extract_field("excerpt", post_text)
        post_date = extract_field("date", post_text)

        # Check for youtubeId
        yt_id = extract_field("youtubeId", post_text)

        # Extract sections (headings + first paragraph of each)
        sections = []
        # Find all section blocks within this post
        section_pattern = r"\{\s*heading:\s*'([^']*)'[\s\S]*?paragraphs:\s*\[([^\]]*)\]"
        for sec_match in re.finditer(section_pattern, post_text):
            heading = sec_match.group(1)
            para_text = sec_match.group(2)
            # Get first paragraph
            first_para = ""
            para_match = re.search(r"'((?:[^'\\]|\\.)*)'", para_text)
            if para_match:
                first_para = para_match.group(1)[:200]
            if heading:
                sections.append({"heading": heading, "paragraphs": [first_para] if first_para else []})

        # Build a post dict with what we can parse
        post: dict = {
            "slug": slug,
            "title": title or slug.replace("-", " ").title(),
            "excerpt": excerpt or "",
            "date": post_date or "",
        }
        if sections:
            post["sections"] = sections
        if yt_id:
            post["youtubeId"] = yt_id

        return post
    except Exception as e:
        print(f"Warning: Could not parse blogPosts.js: {e}", file=sys.stderr)

    return None


def get_neighborhood_by_slug(slug):
    """
    Load neighborhood data from src/data/neighborhoods.js by slug.
    Returns a dict with neighborhood info or None.
    """
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    js_path = os.path.join(repo_root, "src", "data", "neighborhoods.js")

    if not os.path.exists(js_path):
        return None

    try:
        with open(js_path, "r") as f:
            content = f.read()

        # Find the opening brace for this neighborhood entry
        idx = content.find(f"slug: '{slug}'")
        if idx == -1:
            return None
        brace_start = content.rfind('{', 0, idx)
        if brace_start == -1:
            return None

        # Match braces to find block boundaries
        depth = 0
        in_str = False
        str_char = None
        i = brace_start
        while i < len(content):
            ch = content[i]
            prev = content[i-1] if i > 0 else ''
            if in_str:
                if ch == str_char and prev != '\\':
                    in_str = False
            else:
                if ch in ("'", '"'):
                    in_str = True
                    str_char = ch
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        block = content[brace_start:i+1]
                        break
            i += 1
        else:
            return None

        def extract(field):
            m = re.search(rf"{field}:\s*'([^']*)'", block)
            if m:
                return m.group(1)
            m = re.search(rf"{field}:\s*\[([^\]]+)\]", block)
            if m:
                items = re.findall(r"'([^']*)'", m.group(1))
                return items
            return None

        nh = re.findall(r"\{ title:\s*'([^']*)', description:\s*'([^']*)'", block)
        highlights = [{"title": h[0], "description": h[1]} for h in nh]

        schools_raw = re.findall(r"\{\s*name:\s*'([^']*)',\s*type:\s*'([^']*)',\s*level:\s*'([^']*)'", block)
        schools = [{"name": s[0], "type": s[1], "level": s[2]} for s in schools_raw]

        city_slug_match = re.search(r"citySlug:\s*'([^']*)'", block)

        return {
            "name": extract("name"),
            "slug": slug,
            "citySlug": city_slug_match.group(1) if city_slug_match else "",
            "description": extract("description"),
            "features": extract("features") or [],
            "neighborhoodHighlights": highlights,
            "schools": schools,
            "priceRangeDescription": extract("priceRangeDescription"),
            "hoaDescription": extract("hoaDescription"),
            "schoolDistrict": extract("schoolDistrict"),
        }
    except Exception as e:
        print(f"Warning: Could not parse neighborhoods.js: {e}", file=sys.stderr)
        return None


def extract_key_points(post, max_points=6):
    """
    Extract key talking points from a blog post.
    Returns a list of strings suitable for slides.
    """
    points = []

    # Try to get sections from the post
    sections_data = post.get("sections", [])

    if sections_data:
        for section in sections_data:
            heading = section.get("heading", "")
            paragraphs = section.get("paragraphs", [])
            if heading:
                # Get first sentence from first paragraph as key detail
                detail = ""
                if paragraphs:
                    first_sent = paragraphs[0].split(".")[0][:120]
                    if len(first_sent) > 30:
                        detail = first_sent + "."
                points.append({"heading": heading, "detail": detail})
            if len(points) >= max_points:
                break

    if not points:
        # Fallback: use excerpt as the point
        excerpt = post.get("excerpt", "")
        if excerpt:
            # Split into multiple sentences as separate points
            sentences = [s.strip() for s in re.split(r'[.!?]+', excerpt) if len(s.strip()) > 30]
            for s in sentences[:max_points]:
                points.append({"heading": s[:80] + ("..." if len(s) > 80 else ""), "detail": ""})

    # If still no points, create from title/category
    if not points:
        title = post.get("title", "Northern Colorado Real Estate")
        category = post.get("category", "")
        points = [
            {"heading": title[:80], "detail": f"Learn about {category}"},
        ]

    return points


# ─── Video Generation (Orchestration) ───────────────────────────────────────

def build_standard_slides(post, renderer, key_points):
    """
    Build the standard set of slides for a blog post video.
    Mixes content, stat, and insight slides based on point content.
    """
    slides = []

    # 1. Title slide
    title = post.get("title", "Northern Colorado Real Estate Update")
    date_str = post.get("date", "")
    slides.append(
        lambda t=title, d=date_str: renderer.render_title_slide(
            title=t,
            subtitle="Schwartz and Associates",
            date_str=d,
        )
    )

    # 2. Mixed content slides — auto-detect stat vs content vs insight
    total = len(key_points)
    for i, point in enumerate(key_points):
        heading = point.get("heading", "")
        detail = point.get("detail", "")
        n = i + 1

        # Detect if this is a stat point (contains numbers/percentages/currency)
        has_number = bool(re.search(r'[\d%,.$]', heading))
        is_stat = has_number and len(heading) < 40

        if is_stat:
            slides.append(
                lambda v=heading, l=detail or "", c="", n=n, t=total:
                renderer.render_stat_slide(
                    value=v, label=l, context=c,
                    slide_number=n, total_slides=t,
                )
            )
        elif i % 3 == 2:  # Every 3rd non-stat point is an insight
            slides.append(
                lambda h=heading, b=detail, n=n, t=total:
                renderer.render_insight_slide(
                    heading=h, body=b,
                    slide_number=n, total_slides=t,
                )
            )
        else:
            slides.append(
                lambda h=heading, b=detail, n=n, t=total:
                renderer.render_content_slide(
                    heading=h, body=b,
                    slide_number=n, total_slides=t,
                )
            )

    # 3. CTA slide
    slides.append(lambda: renderer.render_cta_slide())

    return slides


def build_market_update_slides(post, renderer, key_points=None):
    """
    Build slides optimized for market update posts.
    Mixes stat slides (big numbers) with insight slides (analysis).
    """
    slides = []
    title = post.get("title", "Northern Colorado Market Update")
    date_str = post.get("date", "")

    # Title slide
    slides.append(
        lambda t=title, d=date_str: renderer.render_title_slide(
            title=t,
            subtitle="Market Update",
            date_str=d,
        )
    )

    # Extract points
    if key_points is None or not key_points[0].get("heading"):
        key_points = extract_key_points(post, max_points=6)
    total = len(key_points)

    for i, point in enumerate(key_points):
        heading = point.get("heading", "")
        detail = point.get("detail", "")
        n = i + 1

        # Detect stat vs content vs insight
        has_number = bool(re.search(r'[\d%,.$]', heading))
        is_stat = has_number and len(heading) < 45

        if is_stat:
            slides.append(
                lambda v=heading, l=detail, c="", n=n, t=total:
                renderer.render_stat_slide(
                    value=v, label=l, context=c,
                    slide_number=n, total_slides=t,
                )
            )
        elif i == total - 1:  # Last point before CTA → insight/takeaway
            slides.append(
                lambda h=heading, b=detail, n=n, t=total:
                renderer.render_insight_slide(
                    heading=h, body=b,
                    slide_number=n, total_slides=t,
                )
            )
        else:
            slides.append(
                lambda h=heading, b=detail, n=n, t=total:
                renderer.render_content_slide(
                    heading=h, body=b,
                    slide_number=n, total_slides=t,
                )
            )

    # CTA slide
    slides.append(lambda: renderer.render_cta_slide())

    return slides


def build_neighborhood_slides(neighborhood, renderer):
    """
    Build slides for a neighborhood overview video (~30-45 seconds).
    """
    slides = []
    name = neighborhood.get("name", "Neighborhood Guide")
    city = neighborhood.get("citySlug", "").replace("-", " ").title()
    description = neighborhood.get("description", "")
    features = neighborhood.get("features", [])
    highlights = neighborhood.get("neighborhoodHighlights", [])

    # 1. Title slide
    slides.append(
        lambda n=name, c=city: renderer.render_title_slide(
            title=n,
            subtitle=f"{c} | Schwartz and Associates",
            date_str="Neighborhood Guide",
        )
    )

    # 2. Description slide
    if description:
        slides.append(
            lambda d=description, n=name, c=city: renderer.render_content_slide(
                heading=f"About {n}",
                body=d,
                slide_number=2, total_slides=5,
            )
        )

    # 3. Highlight slides (up to 3)
    for i, h in enumerate(highlights[:3]):
        slides.append(
            lambda h=h, n=i+1: renderer.render_insight_slide(
                heading=h.get("title", ""),
                body=h.get("description", ""),
                slide_number=3+n, total_slides=5,
            )
        )

    # 4. Features slide
    if features:
        feat_text = " · ".join(features[:5])
        slides.append(
            lambda f=feat_text, n=name: renderer.render_content_slide(
                heading=f"What makes {n} special",
                body=f,
                slide_number=4, total_slides=5,
            )
        )

    # 5. CTA slide
    slides.append(
        lambda: renderer.render_cta_slide()
    )

    return slides


def get_attribution_for_slug(slug):
    """
    Read music manifest and find the CC-BY attribution block for a given slug.
    Returns None if no matching track or manifest missing.
    Every track in /seed/assets/music/ requires attribution in the video description.
    """
    manifest_path = "/seed/assets/music/manifest.json"
    if not os.path.exists(manifest_path):
        return None
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
        for track in manifest.get("tracks", []):
            if track.get("assigned_slug") == slug:
                return track.get("attribution_block")
    except Exception:
        pass
    return None


def build_description(post, video_url=""):
    """
    Build a YouTube description with links back to the source.
    URL is placed FIRST so it's visible in the collapsed view.
    Includes CC-BY music attribution when applicable.
    """
    title = post.get("title", "Northern Colorado Real Estate")
    excerpt = post.get("excerpt", "")
    slug = post.get("slug", "")
    blog_url = f"https://saahomes.com/blog/{slug}/"
    phone = "(970) 999-1407"

    lines = [
        f"🔗 {blog_url}",
        "",
        f"📖 Read the full article ↑",
        "",
        "───",
        "",
        title,
        "",
        excerpt,
        "",
        "───",
        "",
        "Schwartz and Associates | SAA Homes",
        "Northern Colorado Real Estate",
        "",
        f"📞 {phone}",
        "🏠 https://saahomes.com",
        "",
        "Follow us:",
        "Facebook: https://www.facebook.com/schwartzandassociateshomes",
        "Instagram: https://www.instagram.com/saa_homes/",
        "YouTube: https://youtube.com/@SAAHomes",
        "",
        "───",
        "",
        "#NorthernColoradoRealEstate #FortCollins #Loveland #Windsor #Greeley "
        "#ColoradoRealEstate #SAAHomes #SchwartzAndAssociates",
    ]

    # Append CC-BY music attribution if available
    attribution = get_attribution_for_slug(slug)
    if attribution:
        lines.extend([
            "",
            "───",
            "",
            attribution,
        ])

    return "\n".join(lines)


def build_tags(post):
    """Build YouTube tags from post content."""
    title = post.get("title", "")
    slug = post.get("slug", "")
    category = post.get("category", "")

    base_tags = [
        "Northern Colorado real estate",
        "Fort Collins real estate",
        "Loveland real estate",
        "Windsor Colorado",
        "Greeley real estate",
        "Colorado homes for sale",
        "SAA Homes",
        "Schwartz and Associates",
    ]

    # Extract city names from title/slug
    cities = ["Fort Collins", "Loveland", "Windsor", "Greeley", "Timnath",
              "Wellington", "Johnstown", "Eaton", "Berthoud", "Longmont",
              "Boulder", "Severance", "Evans"]
    for city in cities:
        if city.lower() in title.lower() or city.lower().replace(" ", "-") in slug.lower():
            base_tags.extend([
                f"{city} real estate",
                f"homes for sale {city}",
                f"moving to {city}",
            ])

    if "chfa" in slug.lower() or "chfa" in title.lower():
        base_tags.extend([
            "CHFA Colorado",
            "down payment assistance Colorado",
            "first time home buyer Colorado",
        ])

    if "market" in slug.lower():
        base_tags.extend([
            "Colorado housing market",
            "Northern Colorado market update",
            "home prices Colorado",
        ])

    return base_tags


# ─── Main CLI ───────────────────────────────────────────────────────────────

def cmd_generate(args):
    """Generate a video from blog post data, no upload."""
    renderer = SlideRenderer()

    title = args.title
    slug = args.slug
    excerpt = args.excerpt
    date = args.date
    points_raw = args.points
    output_dir = args.output_dir
    is_market = args.market_update

    os.makedirs(output_dir, exist_ok=True)

    # Parse points
    if points_raw:
        key_points = []
        for p in points_raw.split("|"):
            p = p.strip()
            if "|" in p:  # Has heading|detail format? No, we split on | above
                pass
            key_points.append({"heading": p, "detail": ""})
    else:
        key_points = [{"heading": "Northern Colorado Real Estate", "detail": ""}]

    post = {
        "title": title,
        "slug": slug,
        "excerpt": excerpt or "",
        "date": date or "",
    }

    if is_market or "market" in slug.lower():
        slide_fns = build_market_update_slides(post, renderer, key_points=key_points)
    else:
        if not key_points[0]["heading"]:
            key_points = extract_key_points(post)
        slide_fns = build_standard_slides(post, renderer, key_points)

    slides = [fn() for fn in slide_fns]

    # Determine output filename
    output_filename = f"{slug}.mp4"
    output_path = os.path.join(output_dir, output_filename)

    # Generate background music
    sd = BRAND["slide_duration"]
    n = len(slides)
    total_duration = sd * n
    music_path = os.path.join(output_dir, f"{slug}_audio.m4a")
    print(f"Generating background audio ({total_duration:.1f}s)...")
    create_background_audio(total_duration, music_path, slug=slug)

    # Assemble video
    print(f"Assembling video with {n} slides...")
    assemble_video(slides, output_path, music_path=music_path)

    # Clean up temp audio
    if os.path.exists(music_path):
        os.remove(music_path)

    # Duration per slide display
    actual_duration = total_duration
    mins, secs = divmod(int(actual_duration), 60)

    print(f"\n✅ Video generated: {output_path}")
    print(f"   Duration: {mins}:{secs:02d}")
    print(f"   Slides: {n}")
    print(f"   Resolution: {BRAND['resolution'][0]}x{BRAND['resolution'][1]}")

    return output_path


def cmd_upload(args):
    """Upload an existing video to YouTube."""
    video_path = args.video
    title = args.title
    description = args.description
    credentials = args.credentials
    privacy = "public" if args.publish else "unlisted"
    tags = args.tags

    if not os.path.exists(video_path):
        print(f"ERROR: Video not found: {video_path}")
        sys.exit(1)

    if not os.path.exists(credentials):
        print(f"ERROR: Credentials not found: {credentials}")
        sys.exit(1)

    print(f"Authenticating with YouTube API...")
    youtube = get_authenticated_service(credentials)

    tag_list = [t.strip() for t in tags.split(",")] if tags else []
    print(f"Uploading: {title}")
    print(f"Privacy: {privacy}")
    print(f"Tags: {', '.join(tag_list[:8])}{'...' if len(tag_list) > 8 else ''}")

    video_id = upload_video(
        youtube, video_path, title, description,
        tags=tag_list, privacy_status=privacy,
    )

    print(f"\n✅ Published: https://youtu.be/{video_id}")
    return video_id


def cmd_publish(args):
    """Full pipeline: generate video from blog post + upload to YouTube."""
    slug = args.blog_slug
    credentials = args.credentials
    output_dir = args.output_dir
    publish = args.publish

    os.makedirs(output_dir, exist_ok=True)

    # 1. Load blog post
    print(f"Loading blog post: {slug}")
    post = get_blog_post_by_slug(slug)
    if not post:
        print(f"ERROR: Blog post not found for slug '{slug}'")
        print("Make sure the slug exists in src/data/blogPosts.js")
        sys.exit(1)

    print(f"  Title: {post.get('title', 'N/A')}")
    print(f"  Date: {post.get('date', 'N/A')}")

    # 2. Generate video
    renderer = SlideRenderer()
    key_points = extract_key_points(post)

    is_market = "market" in slug.lower()
    if is_market:
        slide_fns = build_market_update_slides(post, renderer)
    else:
        slide_fns = build_standard_slides(post, renderer, key_points)

    slides = [fn() for fn in slide_fns]

    output_filename = f"{slug}.mp4"
    output_path = os.path.join(output_dir, output_filename)

    sd = BRAND["slide_duration"]
    n = len(slides)
    total_duration = sd * n
    music_path = os.path.join(output_dir, f"{slug}_audio.m4a")
    print(f"\nGenerating background audio ({total_duration:.1f}s)...")
    create_background_audio(total_duration, music_path)

    print(f"Assembling video with {n} slides...")
    assemble_video(slides, output_path, music_path=music_path)

    if os.path.exists(music_path):
        os.remove(music_path)

    mins, secs = divmod(int(total_duration), 60)
    print(f"\n✅ Video generated: {output_path} ({mins}:{secs:02d})")

    # 3. Upload to YouTube
    if credentials and os.path.exists(credentials):
        print(f"\nAuthenticating with YouTube API...")
        youtube = get_authenticated_service(credentials)

        title = post.get("title", slug.replace("-", " ").title())
        description = build_description(post)
        tags = build_tags(post)
        privacy = "public" if publish else "unlisted"

        print(f"Uploading: {title}")
        video_id = upload_video(
            youtube, output_path, title, description,
            tags=tags, privacy_status=privacy,
        )

        youtube_url = f"https://youtu.be/{video_id}"
        print(f"\n✅ Published: {youtube_url}")

        # Save metadata
        meta_path = os.path.join(output_dir, f"{slug}_meta.json")
        with open(meta_path, "w") as f:
            json.dump({
                "slug": slug,
                "title": title,
                "youtube_url": youtube_url,
                "youtube_id": video_id,
                "video_path": output_path,
                "date": post.get("date", ""),
                "privacy": privacy,
            }, f, indent=2)
        print(f"Metadata saved: {meta_path}")
    else:
        print(f"\n⚠️  No valid credentials found. Video saved at: {output_path}")
        print("   Upload later with:")
        print(f"   python3 scripts/youtube-video-publisher.py upload \\")
        print(f"     --video {output_path} --credentials {credentials} ...")

    return output_path


def cmd_neighborhood_video(args):
    """
    Generate and optionally upload a 30-45s video for a neighborhood guide.
    """
    slug = args.neighborhood_slug
    output_dir = args.output_dir
    publish = args.publish
    credentials = args.credentials

    print(f"Loading neighborhood: {slug}")
    neighborhood = get_neighborhood_by_slug(slug)
    if not neighborhood:
        print(f"ERROR: Neighborhood '{slug}' not found in src/data/neighborhoods.js")
        sys.exit(1)

    name = neighborhood.get("name", slug)
    city = neighborhood.get("citySlug", "")
    print(f"  Name: {name}")
    print(f"  City: {city}")

    # 1. Generate slides
    renderer = SlideRenderer()
    slide_fns = build_neighborhood_slides(neighborhood, renderer)
    slides = [fn() for fn in slide_fns]

    output_filename = f"{slug}.mp4"
    output_path = os.path.join(output_dir, output_filename)

    sd = BRAND["slide_duration"]
    n = len(slides)
    total_duration = sd * n
    music_path = os.path.join(output_dir, f"{slug}_audio.m4a")
    print(f"\nGenerating background audio ({total_duration:.1f}s)...")
    create_background_audio(total_duration, music_path)

    print(f"Assembling video with {n} slides...")
    assemble_video(slides, output_path, music_path=music_path)

    if os.path.exists(music_path):
        os.remove(music_path)

    mins, secs = divmod(int(total_duration), 60)
    print(f"\n✅ Video generated: {output_path} ({mins}:{secs:02d})")

    # 2. Upload
    if credentials and os.path.exists(credentials):
        print(f"\nAuthenticating with YouTube API...")
        youtube = get_authenticated_service(credentials)

        title = f"{name} - {city.replace('-', ' ').title()}, CO | Neighborhood Guide | SAA Homes"
        blog_url = f"https://saahomes.com/northern-colorado-areas/{city}/{slug}/"
        description = (
            f"🔗 {blog_url}\n\n"
            f"📖 Read the full neighborhood guide ↑\n\n"
            f"───\n\n"
            f"Explore {name} in {city.replace('-', ' ').title()}, Colorado. "
            f"Learn about homes, schools, amenities, and what makes this neighborhood special.\n\n"
            f"───\n\n"
            f"Schwartz and Associates | SAA Homes\n"
            f"📞 (970) 999-1407\n"
            f"🏠 https://saahomes.com\n\n"
            f"#NorthernColoradoRealEstate #{name.replace(' ', '')} #{city.replace('-', ' ').title().replace(' ', '')} #SAAHomes"
        )
        tags = [name, f"{name} {city.replace('-', ' ').title()}", "Northern Colorado real estate", "SAA Homes", "neighborhood guide"]
        privacy = "public" if publish else "unlisted"

        print(f"Uploading: {title}")
        video_id = upload_video(
            youtube, output_path, title, description,
            tags=tags, privacy_status=privacy,
        )

        youtube_url = f"https://youtu.be/{video_id}"
        print(f"\n✅ Published: {youtube_url}")
    else:
        print(f"\n⚠️  Video saved at: {output_path}")

    return output_path


def main():
    parser = argparse.ArgumentParser(
        description="SAA Homes — YouTube Video Publisher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(__doc__),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # ── generate ──
    gen = sub.add_parser("generate", help="Generate video from blog data (no upload)")
    gen.add_argument("--title", required=True, help="Video title")
    gen.add_argument("--slug", required=True, help="Slug for filename")
    gen.add_argument("--excerpt", default="", help="Short description")
    gen.add_argument("--points", default="", help="Pipe-separated key points")
    gen.add_argument("--date", default="", help="Publication date (YYYY-MM-DD)")
    gen.add_argument("--output-dir", default="./video-output", help="Output directory")
    gen.add_argument("--market-update", action="store_true", help="Use market update layout")
    gen.set_defaults(func=cmd_generate)

    # ── upload ──
    upl = sub.add_parser("upload", help="Upload existing video to YouTube")
    upl.add_argument("--video", required=True, help="Path to MP4 file")
    upl.add_argument("--title", required=True, help="YouTube video title")
    upl.add_argument("--description", required=True, help="YouTube description")
    upl.add_argument("--credentials", required=True, help="Path to client_secret.json")
    upl.add_argument("--tags", default="", help="Comma-separated tags")
    upl.add_argument("--publish", action="store_true", help="Set to public (default: unlisted)")
    upl.set_defaults(func=cmd_upload)

    # ── publish ──
    pub = sub.add_parser("publish", help="Full pipeline: generate + upload")
    pub.add_argument("--blog-slug", required=True, help="Blog post slug")
    pub.add_argument("--credentials", default="", help="Path to client_secret.json")
    pub.add_argument("--output-dir", default="./video-output", help="Output directory")
    pub.add_argument("--publish", action="store_true", help="Set to public (default: unlisted)")
    pub.set_defaults(func=cmd_publish)

    # ── neighborhood-video ──
    nh = sub.add_parser("neighborhood-video", help="Generate + optionally upload a neighborhood overview video")
    nh.add_argument("--neighborhood-slug", required=True, help="Neighborhood slug from neighborhoods.js")
    nh.add_argument("--credentials", default="", help="Path to client_secret.json")
    nh.add_argument("--output-dir", default="./video-output", help="Output directory")
    nh.add_argument("--publish", action="store_true", help="Set to public (default: unlisted)")
    nh.set_defaults(func=cmd_neighborhood_video)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
