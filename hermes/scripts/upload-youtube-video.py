#!/usr/bin/env python3
"""Upload @SAAHomes videos via YouTube Data API."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

from youtube_auth import build_youtube_service


def load_pack(path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Pack file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def upload_video(youtube, pack: dict) -> str:
    video_path = Path(pack["file"])
    if not video_path.is_file():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    body = {
        "snippet": {
            "title": pack["title"],
            "description": pack.get("description", ""),
            "tags": pack.get("tags", []),
            "categoryId": str(pack.get("category_id", "22")),
        },
        "status": {
            "privacyStatus": pack.get("privacy_status", "public"),
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(str(video_path), chunksize=1024 * 1024, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            print(f"Upload progress: {pct}%")

    video_id = response["id"]
    print(f"Uploaded: https://www.youtube.com/watch?v={video_id}")
    return video_id


def delete_video(youtube, video_id: str) -> None:
    try:
        youtube.videos().delete(id=video_id).execute()
        print(f"Deleted old video: {video_id}")
    except HttpError as err:
        if err.resp.status == 404:
            print(f"Old video already gone: {video_id}")
            return
        raise


def update_inventory(slug: str, new_id: str, old_id: str | None, inventory_path: Path) -> None:
    if not inventory_path.is_file():
        return
    data = json.loads(inventory_path.read_text(encoding="utf-8"))
    for video in data.get("videos", []):
        if video.get("slug") != slug:
            continue
        if old_id:
            video["previous_youtube_id"] = old_id
        video["youtube_id"] = new_id
        video["status"] = "live"
        video["watch_url"] = f"https://www.youtube.com/watch?v={new_id}"
        break
    inventory_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Updated inventory: {inventory_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload a video to @SAAHomes via YouTube API")
    parser.add_argument("pack_json", help="JSON pack with file, title, description, tags")
    parser.add_argument("--inventory", help="Optional video-inventory.json path to update")
    parser.add_argument("--dry-run", action="store_true", help="Validate credentials only")
    args = parser.parse_args()

    pack = load_pack(Path(args.pack_json))
    slug = pack.get("slug", "")
    delete_id = pack.get("delete_youtube_id")

    if args.dry_run:
        build_youtube_service()
        print("Credentials OK.")
        print(f"Would upload: {pack['file']}")
        if delete_id:
            print(f"Would delete after upload: {delete_id}")
        return

    youtube = build_youtube_service()
    new_id = upload_video(youtube, pack)

    if delete_id and delete_id != new_id:
        delete_video(youtube, delete_id)

    if args.inventory:
        update_inventory(slug, new_id, delete_id, Path(args.inventory))

    print(json.dumps({
        "slug": slug,
        "youtube_id": new_id,
        "watch_url": f"https://www.youtube.com/watch?v={new_id}",
        "deleted_youtube_id": delete_id,
    }))


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)
