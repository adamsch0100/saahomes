#!/usr/bin/env python3
"""
Upload a pre-remuxed video to YouTube with the required description format.
Usage: python3 scripts/upload_remuxed.py SLUG VIDEO_PATH TITLE [--delete OLD_ID]

Music attribution is read from /seed/assets/music/manifest.json automatically.
"""
import sys
import os
import json

# Ensure we can import from scripts/
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)
# Also ensure repo root is in path
repo_root = os.path.dirname(script_dir)
sys.path.insert(0, repo_root)

import importlib.util
spec = importlib.util.spec_from_file_location("youtube_video_publisher", os.path.join(script_dir, "youtube-video-publisher.py"))
yt_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(yt_mod)
get_authenticated_service = yt_mod.get_authenticated_service
upload_video = yt_mod.upload_video
build_tags = yt_mod.build_tags

SLUG = sys.argv[1]
VIDEO_PATH = sys.argv[2]
TITLE = sys.argv[3]
DELETE_ID = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '--no-delete' else None

# Read music attribution from manifest
def get_music_attribution(slug):
    """Read attribution block from /seed/assets/music/manifest.json for given slug."""
    manifest_path = "/seed/assets/music/manifest.json"
    if not os.path.exists(manifest_path):
        return None
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
        for track in manifest.get("tracks", []):
            if track.get("assigned_slug") == slug:
                return track.get("attribution_block")
    except Exception as e:
        print(f"Warning: Could not read manifest: {e}", file=sys.stderr)
    return None

description = (
    f"https://saahomes.com/blog/{SLUG}/\n\n"
    f"📖 Read the full article ↑\n\n"
    f"───\n\n"
    f"{TITLE}\n\n"
    f"Schwartz and Associates | SAA Homes\n"
    f"Northern Colorado Real Estate\n\n"
    f"📞 (970) 999-1407\n"
    f"🏠 https://saahomes.com\n\n"
)

attribution = get_music_attribution(SLUG)
if attribution:
    description += f"───\n\n{attribution}\n"

tags = build_tags({"slug": SLUG, "title": TITLE, "category": ""})

print(f"Uploading: {TITLE}")
print(f"Slug: {SLUG}")
print(f"Video: {VIDEO_PATH}")
print(f"Old ID to delete: {DELETE_ID}")

# Authenticate
youtube = get_authenticated_service("client_secret.json", "youtube_token.pickle")

# Upload as PUBLIC
video_id = upload_video(
    youtube, VIDEO_PATH, TITLE, description,
    tags=tags, privacy_status="public",
)

print(f"NEW_YOUTUBE_ID={video_id}")
if DELETE_ID:
    print(f"DELETE_OLD_ID={DELETE_ID}")
