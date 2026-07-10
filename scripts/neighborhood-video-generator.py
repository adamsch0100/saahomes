#!/usr/bin/env python3
"""
SAA Homes — Neighborhood Video Generator
=========================================
Generates branded neighborhood overview videos and uploads them to YouTube.

This is a dedicated wrapper around youtube-video-publisher.py's
'neighborhood-video' command. It generates a 30-45 second video for a
given neighborhood slug, uploads it as unlisted, and reports the video ID.

Usage:
  # Generate + upload one neighborhood video
  python3 scripts/neighborhood-video-generator.py \\
    --slug old-town \\
    --credentials client_secret.json

  # Generate only (no upload)
  python3 scripts/neighborhood-video-generator.py \\
    --slug old-town --no-upload

  # Upload existing video
  python3 scripts/neighborhood-video-generator.py \\
    --slug old-town --upload-only \\
    --title "Old Town - Fort Collins, CO | Neighborhood Guide | SAA Homes" \\
    --description "..."
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLISHER = os.path.join(REPO_ROOT, "scripts", "youtube-video-publisher.py")
VENV_PYTHON = os.path.join(REPO_ROOT, ".venv", "bin", "python3")
OUTPUT_DIR = os.path.join(REPO_ROOT, "video-output")
NEIGHBORHOODS_JS = os.path.join(REPO_ROOT, "src", "data", "neighborhoods.js")
PENDING_FILE = os.path.join(REPO_ROOT, "scripts", "video-assets", ".pending_videos")
TRACKING_FILE = os.path.join(REPO_ROOT, "scripts", "video-assets", ".uploaded_today")


def get_yesterday_date():
    """Get yesterday's date string (YYYY-MM-DD) for the tracking file."""
    from datetime import datetime, timedelta
    return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")


def get_today_date():
    """Get today's date string (YYYY-MM-DD)."""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d")


def load_today_uploads():
    """Load slugs uploaded today from tracking file."""
    today = get_today_date()
    uploaded = []
    if os.path.exists(TRACKING_FILE):
        with open(TRACKING_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("|")
                    if len(parts) >= 2 and parts[0] == today:
                        uploaded.append(parts[1])
    return uploaded


def record_upload(slug):
    """Record a successful upload in the tracking file."""
    today = get_today_date()
    with open(TRACKING_FILE, "a") as f:
        f.write(f"{today}|{slug}\n")


def get_neighborhoods_without_youtube_id():
    """Read neighborhoods.js and return slugs that don't have a youtubeId."""
    with open(NEIGHBORHOODS_JS, "r") as f:
        content = f.read()

    # Find all slug declarations with their positions
    slug_positions = [(m.group(1), m.start()) for m in re.finditer(r"slug:\s*'([^']+)'", content)]

    slugs = []
    for i, (slug, pos) in enumerate(slug_positions):
        # Get the end of this entry - either the next slug's position or end of file
        if i + 1 < len(slug_positions):
            next_pos = slug_positions[i + 1][1]
        else:
            next_pos = len(content)
        
        segment = content[pos:next_pos]
        if "youtubeId" not in segment:
            slugs.append(slug)
    return slugs


def add_youtube_id_to_neighborhood(slug, video_id):
    """Add youtubeId to the neighborhood entry in neighborhoods.js.
    
    Inserts youtubeId between the 'keywords' line and 'neighborhoodHighlights' array
    at the top level of the neighborhood object.
    """
    with open(NEIGHBORHOODS_JS, "r") as f:
        content = f.read()

    # Find the slug line
    slug_pattern = rf"(slug:\s*'{re.escape(slug)}')"
    slug_match = re.search(slug_pattern, content)
    if not slug_match:
        print(f"  WARNING: Could not find slug '{slug}' in neighborhoods.js")
        return False

    slug_start = slug_match.start()
    
    # Find the opening brace of this neighborhood object
    # Walk backwards from the slug to find the matching '{'
    # The neighborhood object starts with "  {" or "{\n" before the slug
    brace_pos = content.rfind("{\n", 0, slug_start)
    if brace_pos == -1:
        brace_pos = content.rfind("{", 0, slug_start)
    # Use the content from the opening brace onwards
    entry_start = brace_pos
    
    # Now within this entry, find the keywords line
    # We look for 'keywords:' between the entry start and next slug (or end)
    after_slug = content[slug_match.end():]
    # Find where this neighborhood entry ends - look for the next slug or end of file
    next_slug_pos = content.find("\n  {\n    slug:", slug_match.end())
    if next_slug_pos == -1:
        next_slug_pos = content.find("\n{\n    slug:", slug_match.end())
    if next_slug_pos == -1:
        next_slug_pos = len(content)
    
    entry_content = content[entry_start:next_slug_pos]
    
    # Check if youtubeId already exists in this entry
    if "youtubeId" in entry_content:
        print(f"  ⏭️  '{slug}' already has youtubeId, skipping")
        return True
    
    # Find the keywords: line in the entry and the neighborhoodHighlights: line
    kw_match = re.search(r"keywords:\s*\n\s+'[^']*'", entry_content)
    nh_match = re.search(r"neighborhoodHighlights:\s*\[", entry_content)
    
    if not kw_match:
        # Try single-line keywords
        kw_match = re.search(r"keywords:\s*'[^']*'", entry_content)
    
    if not kw_match or not nh_match:
        print(f"  WARNING: Could not find keywords or neighborhoodHighlights for '{slug}'")
        return False
    
    # Ensure we insert before neighborhoodHighlights
    insert_before_nh = nh_match.start() < kw_match.end()
    if insert_before_nh:
        # keywords comes after neighborhoodHighlights (unusual), insert before nh
        insert_pos = entry_start + nh_match.start()
    else:
        # Normal case: keywords before neighborhoodHighlights
        # Insert after keywords line, AFTER any trailing comma
        kw_end = entry_start + kw_match.end()
        # Skip past any trailing comma/whitespace so we don't orphan a comma
        after_text = content[kw_end:entry_start + kw_match.end() + 10]
        if after_text.startswith(','):
            kw_end += 1
        insert_pos = kw_end
    
    # Check again: make sure youtubeId doesn't already exist in the insertion region
    if "youtubeId" in entry_content[:insert_pos - entry_start + 50]:
        print(f"  ⏭️  '{slug}' already has youtubeId, skipping")
        return True
    
    # Insert youtubeId
    content = content[:insert_pos] + f"\n    youtubeId: '{video_id}'," + content[insert_pos:]
    print(f"  ✅ Added youtubeId '{video_id}' to neighborhood '{slug}'")
    
    with open(NEIGHBORHOODS_JS, "w") as f:
        f.write(content)
    return True


def generate_and_upload(slug, credentials, output_dir, no_upload=False, upload_only=False, publish=True):
    """Generate and/or upload a neighborhood video."""
    cmd = [VENV_PYTHON, PUBLISHER, "neighborhood-video",
           "--neighborhood-slug", slug,
           "--output-dir", output_dir]

    if credentials:
        cmd.extend(["--credentials", credentials])

    if publish and not no_upload:
        cmd.append("--publish")

    if no_upload:
        # Can't use --publish with no-upload, just generate
        pass
    elif not upload_only:
        # Upload with publish flag if set
        pass

    if upload_only:
        print(f"Upload-only mode not supported for neighborhood-video subcommand.")
        print(f"Use 'upload' subcommand of publisher manually.")
        return None

    print(f"\n{'=' * 60}")
    print(f"  Processing neighborhood: {slug}")
    print(f"{'=' * 60}")

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    # Print output
    print(result.stdout)
    if result.stderr:
        print(f"  STDERR: {result.stderr[-500:]}")

    if result.returncode != 0:
        error_msg = (result.stderr + result.stdout).lower()
        if "uploadlimitexceeded" in error_msg or "quota" in error_msg:
            print(f"\n{'!' * 60}")
            print(f"  UPLOAD LIMIT REACHED — stopping for today")
            print(f"{'!' * 60}")
            return "QUOTA_EXCEEDED"
        print(f"  ❌ Failed for '{slug}' (exit {result.returncode})")
        return None

    # Extract video ID from output
    video_id = None
    for line in result.stdout.split("\n"):
        m = re.search(r"https://youtu\.be/([a-zA-Z0-9_-]+)", line)
        if m:
            video_id = m.group(1)
            break

    return video_id


def save_pending_list(slugs):
    """Save list of pending neighborhood slugs to tracking file."""
    pending = list(slugs)
    with open(PENDING_FILE, "w") as f:
        f.write(f"# Pending neighborhood video slugs — generated on {get_today_date()}\n")
        f.write("# Format: one slug per line\n")
        for slug in pending:
            f.write(f"{slug}\n")
    print(f"📝 Saved {len(pending)} pending slugs to {PENDING_FILE}")


def load_pending_list():
    """Load pending slugs from tracking file."""
    if not os.path.exists(PENDING_FILE):
        return None
    slugs = []
    with open(PENDING_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                slugs.append(line)
    return slugs if slugs else None


def main():
    parser = argparse.ArgumentParser(
        description="Generate and upload neighborhood videos to YouTube",
    )
    parser.add_argument("--slug", default="", help="Single neighborhood slug to process")
    parser.add_argument("--credentials", default="client_secret.json",
                        help="Path to YouTube API client_secret.json")
    parser.add_argument("--output-dir", default=OUTPUT_DIR,
                        help="Output directory for generated videos")
    parser.add_argument("--no-upload", action="store_true",
                        help="Generate video only, do not upload")
    parser.add_argument("--max", type=int, default=3,
                        help="Maximum videos to generate this run (default: 3)")
    parser.add_argument("--no-git", action="store_true",
                        help="Skip git commit and push")

    args = parser.parse_args()

    # Determine which slugs to process
    if args.slug:
        slugs_to_process = [args.slug]
    else:
        # Check for pending videos from previous run
        pending = load_pending_list()
        if pending:
            print(f"📋 Found {len(pending)} pending videos from previous run")
            slugs_to_process = pending
        else:
            # Find all neighborhoods without youtubeId
            slugs_to_process = get_neighborhoods_without_youtube_id()
            print(f"🔍 Found {len(slugs_to_process)} neighborhoods without videos")

    if not slugs_to_process:
        print("✅ All neighborhoods already have videos! Nothing to do.")
        return

    # Limit to max per run
    batch = slugs_to_process[:args.max]
    remaining = slugs_to_process[args.max:]

    print(f"🎬 Processing up to {len(batch)} videos (buffer: {len(remaining)} pending)")

    uploaded_count = 0
    quota_hit = False

    for slug in batch:
        video_id = generate_and_upload(
            slug, args.credentials, args.output_dir, args.no_upload
        )

        if video_id == "QUOTA_EXCEEDED":
            quota_hit = True
            break

        if video_id:
            # Add youtubeId to neighborhoods.js
            add_youtube_id_to_neighborhood(slug, video_id)
            # Record upload
            record_upload(slug)
            uploaded_count += 1
            print(f"  ✅ Successfully uploaded '{slug}' — https://youtu.be/{video_id}")

    # Build final pending list
    if quota_hit:
        # The slug that hit quota needs to go back to pending
        # If uploaded_count < len(batch), those not yet uploaded are pending
        final_pending = batch[uploaded_count:] + remaining
    else:
        final_pending = remaining

    # Save pending list
    if final_pending:
        save_pending_list(final_pending)
    else:
        # All processed — remove pending file
        if os.path.exists(PENDING_FILE):
            os.remove(PENDING_FILE)
            print("✅ All neighborhoods processed — pending file removed")

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Attempted: {len(batch)}")
    print(f"  Uploaded:  {uploaded_count}")
    print(f"  Pending:   {len(final_pending)}")
    if quota_hit:
        print(f"  ⚠️  Quota/exceeded limit hit — stopped early")
    print(f"{'=' * 60}")

    # Git commit if there are changes
    if uploaded_count > 0 and not args.no_git:
        print(f"\n📦 Committing changes...")
        subprocess.run(["git", "add", NEIGHBORHOODS_JS, PENDING_FILE, TRACKING_FILE,
                        os.path.join(args.output_dir, f"{slug}.mp4")],
                       cwd=REPO_ROOT, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", f"Add youtubeId for {uploaded_count} neighborhood video(s) [cron]"],
            cwd=REPO_ROOT, capture_output=True, text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print(f"  Git: {result.stderr}")
        else:
            subprocess.run(["git", "push"], cwd=REPO_ROOT, capture_output=True)
            print(f"  ✅ Changes pushed to remote")


if __name__ == "__main__":
    main()
