#!/usr/bin/env python3
"""
Batch backfill: generate + publish YouTube videos for blog posts without one.
Also adds youtubeId to blogPosts.js after each successful publish.
"""
import subprocess
import re
import json
import sys
import os
from pathlib import Path

REPO = "/opt/data/workspace/saahomes-repo"
BLOG_POSTS_JS = os.path.join(REPO, "src", "data", "blogPosts.js")
CREDS = os.path.join(REPO, "client_secret.json")
VENV_PYTHON = os.path.join(REPO, ".venv", "bin", "python3")
PUBLISHER = os.path.join(REPO, "scripts", "youtube-video-publisher.py")
OUTPUT_DIR = os.path.join(REPO, "video-output")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Posts to backfill (Tier 1 — highest SEO value)
POSTS = [
    "chfa-down-payment-assistance-colorado-2026",
    "chfa-first-time-homebuyer-northern-colorado",
    "chfa-schools-to-home-colorado-teachers",
    "colorado-champions-home-loan-first-responders",
    "northern-colorado-market-update-june-2026",
]

def add_youtube_id_to_post(slug, video_id):
    """Add youtubeId to the blog post entry in blogPosts.js."""
    with open(BLOG_POSTS_JS, "r") as f:
        content = f.read()
    
    # Find the slug line and add youtubeId after readTime line before it
    # Pattern: find the slug, then find the nearest readTime before it
    slug_pattern = rf"(slug:\s*'{re.escape(slug)}')"
    slug_match = re.search(slug_pattern, content)
    if not slug_match:
        print(f"  WARNING: Could not find slug '{slug}' in blogPosts.js")
        return False
    
    # Find the readTime line before this slug
    before_slug = content[:slug_match.start()]
    readtime_match = re.search(r"readTime:\s*'[^']*',?\n?", before_slug)
    if not readtime_match:
        print(f"  WARNING: Could not find readTime before slug '{slug}'")
        return False
    
    # Check if youtubeId already exists
    after_readtime = content[readtime_match.end():slug_match.start()]
    if "youtubeId" in after_readtime:
        print(f"  youtubeId already exists for '{slug}', replacing...")
        # Replace existing youtubeId
        old = re.search(r"youtubeId:\s*'[^']*',?\n?", after_readtime)
        if old:
            start = readtime_match.end() + old.start()
            end = readtime_match.end() + old.end()
            content = content[:start] + f"    youtubeId: '{video_id}',\n" + content[end:]
    else:
        # Insert after readTime line
        insert_pos = readtime_match.end()
        content = content[:insert_pos] + f"\n    youtubeId: '{video_id}'," + content[insert_pos:]
    
    with open(BLOG_POSTS_JS, "w") as f:
        f.write(content)
    
    print(f"  ✅ Added youtubeId '{video_id}' to blog post '{slug}'")
    return True

for slug in POSTS:
    print(f"\n{'=' * 60}")
    print(f"  Processing: {slug}")
    print(f"{'=' * 60}")
    
    # Check if already has youtubeId
    with open(BLOG_POSTS_JS) as f:
        content = f.read()
    if re.search(rf"slug:\s*'{re.escape(slug)}'[\s\S]*?youtubeId:", content):
        print(f"  Already has youtubeId — skipping.")
        continue
    
    # Run publish
    cmd = [
        VENV_PYTHON, PUBLISHER, "publish",
        "--blog-slug", slug,
        "--credentials", CREDS,
        "--publish",
        "--output-dir", OUTPUT_DIR,
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    
    print(result.stdout)
    if result.stderr:
        print(f"  STDERR: {result.stderr[-300:]}")
    
    if result.returncode != 0:
        print(f"  ❌ Failed for '{slug}' (exit {result.returncode})")
        continue
    
    # Extract YouTube URL from output
    yt_match = re.search(r"https://youtu\.be/([\w-]+)", result.stdout)
    if yt_match:
        video_id = yt_match.group(1)
        add_youtube_id_to_post(slug, video_id)
    else:
        print(f"  WARNING: Could not extract YouTube URL from output")

print(f"\n{'=' * 60}")
print(f"  Backfill complete!")
print(f"{'=' * 60}")
