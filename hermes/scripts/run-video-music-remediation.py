#!/usr/bin/env python3
"""Batch remux + upload all videos listed in video-inventory.json."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def hermes_workspace() -> Path:
    home = Path(os.environ.get("HERMES_HOME", "/opt/data"))
    return home / "workspace" / "saahomes"


def scripts_dir() -> Path:
    return Path("/usr/local/bin")


def run_cmd(cmd: list[str]) -> None:
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)


def build_upload_pack(video: dict, output_file: Path, music_manifest: dict | None = None) -> dict:
    delete_id = None
    if video.get("delete_after_upload", True) and video.get("status") != "taken_down":
        delete_id = video.get("youtube_id")

    description = video.get("description", "")
    if music_manifest:
        slug = video.get("slug")
        for idx, track in enumerate(music_manifest.get("tracks", []), start=1):
            assigned = track.get("assigned_slug") or _default_slug_for_track_index(idx, music_manifest)
            if assigned == slug:
                block = track.get("attribution_block", "").strip()
                if block and block not in description:
                    description = f"{description.rstrip()}\n\n{block}"
                break

    return {
        "slug": video["slug"],
        "file": str(output_file),
        "title": video.get("title", video["slug"]),
        "description": description,
        "tags": video.get("tags", ["SAA Homes", "Northern Colorado", "real estate"]),
        "category_id": video.get("category_id", "22"),
        "privacy_status": video.get("privacy_status", "public"),
        "delete_youtube_id": delete_id,
    }


def _default_slug_for_track_index(index: int, music_manifest: dict) -> str | None:
    inventory_hint = music_manifest.get("assigned_slugs") or []
    if index - 1 < len(inventory_hint):
        return inventory_hint[index - 1]
    return None


def load_music_manifest(workspace: Path) -> dict | None:
    for path in [
        workspace / "assets" / "music" / "manifest.json",
        Path("/seed/assets/music/manifest.json"),
    ]:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Remux and upload all inventory videos")
    parser.add_argument("--inventory", help="Path to video-inventory.json")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--remux-only", action="store_true")
    args = parser.parse_args()

    workspace = hermes_workspace()
    inventory_path = Path(args.inventory) if args.inventory else workspace / "context" / "video-inventory.json"
    if not inventory_path.is_file():
        print(f"Inventory not found: {inventory_path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(inventory_path.read_text(encoding="utf-8"))
    videos = [
        v
        for v in data.get("videos", [])
        if not v.get("skip") and not v.get("delete_only") and not v.get("skip_remux")
    ]
    if not videos:
        print("No videos in inventory.", file=sys.stderr)
        sys.exit(1)

    remux_script = scripts_dir() / "remux-video-music.py"
    upload_script = scripts_dir() / "upload-youtube-video.py"
    pending_dir = workspace / "videos" / "pending-upload"
    output_dir = workspace / "videos" / "output"
    pending_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    music_manifest = load_music_manifest(workspace)
    if music_manifest and not args.dry_run and not args.remux_only:
        missing = [
            v["slug"]
            for v in videos
            if not v.get("audit_required")
            and not (workspace / "assets" / "music" / f"{v['slug']}.mp3").is_file()
            and not (Path("/seed/assets/music") / f"{v['slug']}.mp3").is_file()
        ]
        if missing:
            assign_script = scripts_dir() / "download-audiolibrary-tracks.py"
            if assign_script.is_file():
                run_cmd(
                    [
                        "python3",
                        str(assign_script),
                        "--assign-inventory",
                        str(inventory_path),
                        "--spread",
                        "5",
                    ]
                )
                music_manifest = load_music_manifest(workspace)
                data = json.loads(inventory_path.read_text(encoding="utf-8"))
                videos = [
                    v
                    for v in data.get("videos", [])
                    if not v.get("skip") and not v.get("delete_only") and not v.get("skip_remux")
                ]

    results = []
    for video in videos:
        slug = video["slug"]
        if video.get("audit_required") and not video.get("youtube_id"):
            print(f"SKIP {slug}: audit_required — fill youtube_id first", file=sys.stderr)
            continue

        project_dir = Path(video.get("project_path", workspace / "videos" / "projects" / slug))
        output_file = output_dir / f"{slug}-remuxed.mp4"

        print(f"\n=== {slug} ===")
        if args.dry_run:
            print(f"Would remux: {project_dir} -> {output_file}")
            if not args.remux_only:
                print(f"Would upload; delete old: {video.get('youtube_id')}")
            continue

        if project_dir.is_dir():
            music_file = video.get("music_file")
            music_arg: list[str] = []
            if music_file:
                music_path = workspace / "assets" / "music" / music_file
                if not music_path.is_file():
                    music_path = Path("/seed/assets/music") / music_file
                if music_path.is_file():
                    music_arg = ["--music", str(music_path)]

            run_cmd(
                [
                    "python3",
                    str(remux_script),
                    "--project-dir",
                    str(project_dir),
                    "--slug",
                    slug,
                    "--output",
                    str(output_file),
                    *music_arg,
                ]
            )
        elif video.get("file") and Path(video["file"]).is_file():
            output_file = Path(video["file"])
        else:
            print(f"SKIP {slug}: no project dir or file ({project_dir})", file=sys.stderr)
            continue

        if args.remux_only:
            results.append({"slug": slug, "output": str(output_file)})
            continue

        pack = build_upload_pack(video, output_file, music_manifest)
        pack_path = pending_dir / f"{slug}.json"
        pack_path.write_text(json.dumps(pack, indent=2) + "\n", encoding="utf-8")
        run_cmd(
            [
                "python3",
                str(upload_script),
                str(pack_path),
                "--inventory",
                str(inventory_path),
            ]
        )
        results.append({"slug": slug, "pack": str(pack_path)})

    print(json.dumps({"processed": results}, indent=2))


if __name__ == "__main__":
    main()
