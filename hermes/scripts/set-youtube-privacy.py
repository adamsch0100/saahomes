#!/usr/bin/env python3
"""Batch set privacy on @SAAHomes / article videos (private = immediate takedown from public)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from googleapiclient.errors import HttpError

from youtube_auth import build_youtube_service


def set_privacy(youtube, video_id: str, privacy: str) -> None:
    current = youtube.videos().list(part="status,snippet", id=video_id).execute()
    items = current.get("items", [])
    if not items:
        raise RuntimeError(f"Video not found or not owned by channel: {video_id}")

    item = items[0]
    item["status"]["privacyStatus"] = privacy
    youtube.videos().update(part="status", body=item).execute()
    title = item.get("snippet", {}).get("title", video_id)
    print(f"{privacy}: {video_id} — {title}")


def delete_video(youtube, video_id: str) -> None:
    try:
        youtube.videos().delete(id=video_id).execute()
        print(f"deleted: {video_id}")
    except HttpError as err:
        if err.resp.status == 404:
            print(f"already gone: {video_id}")
            return
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Set YouTube video privacy or delete")
    parser.add_argument("--inventory", help="video-inventory.json path")
    parser.add_argument("--privacy", choices=["private", "unlisted", "public"], default="private")
    parser.add_argument("--urgent-only", action="store_true", help="Only videos with urgent_unlist=true")
    parser.add_argument("--delete-duplicates", action="store_true", help="Delete entries with delete_only=true")
    parser.add_argument("--video-id", action="append", help="Single video ID (repeatable)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    video_ids: list[tuple[str, str, dict]] = []

    if args.inventory:
        data = json.loads(Path(args.inventory).read_text(encoding="utf-8"))
        for video in data.get("videos", []):
            if video.get("skip"):
                continue
            vid = video.get("youtube_id")
            if not vid:
                continue
            if args.urgent_only and not video.get("urgent_unlist"):
                continue
            if video.get("status") == "taken_down":
                continue
            video_ids.append((vid, video.get("slug", ""), video))

    for vid in args.video_id or []:
        video_ids.append((vid, "", {}))

    if not video_ids:
        print("No videos matched.", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        for vid, slug, video in video_ids:
            action = "delete" if args.delete_duplicates and video.get("delete_only") else args.privacy
            print(f"Would {action}: {vid} ({slug or 'no-slug'})")
        return

    youtube = build_youtube_service()
    for vid, slug, video in video_ids:
        try:
            if args.delete_duplicates and video.get("delete_only"):
                delete_video(youtube, vid)
            else:
                set_privacy(youtube, vid, args.privacy)
        except Exception as err:
            print(f"FAILED {vid} ({slug}): {err}", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)
