#!/usr/bin/env python3
"""
Download one unique track per article video from the Happy Music playlist.

Playlist: https://www.youtube.com/playlist?list=PLzCxunOM5WFLOaTRCzeGrODz8TWaLrbhv
Source pages: https://www.audiolibrary.com.co/{artist}/{track}

Each video slug gets its own MP3 ({slug}.mp3) and attribution block in manifest.json.
"""

from __future__ import annotations

import argparse
import html as html_lib
import http.cookiejar
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLzCxunOM5WFLOaTRCzeGrODz8TWaLrbhv"
AUDIOLIBRARY_BASE = "https://www.audiolibrary.com.co"
DEFAULT_MANIFEST = {
    "source": "Audio Library (@audiolibrary_) — Happy Music playlist",
    "playlist_url": PLAYLIST_URL,
    "license": "Creative Commons — include attribution_block in each YouTube description",
    "banned_sources": ["freetouse.com", "limujii"],
    "music_volume": 0.18,
    "tracks": [],
}


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def parse_artist_track(title: str) -> tuple[str, str]:
    tail = title.split("|")[-1].strip()
    if " - " not in tail:
        raise ValueError(f"Cannot parse artist/track from title: {title}")
    artist, track = tail.rsplit(" - ", 1)
    return artist.strip(), track.strip()


def yt_dlp_playlist_item(playlist_url: str, index: int) -> dict:
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--js-runtimes",
        "node",
        "--no-warnings",
        "--flat-playlist",
        "--playlist-items",
        str(index),
        "--print",
        "%(id)s|||%(title)s|||%(playlist_index)s",
        playlist_url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    line = result.stdout.strip().splitlines()[-1]
    vid, title, playlist_index = line.split("|||", 2)
    return {
        "id": vid.strip(),
        "title": title.strip(),
        "playlist_index": int(playlist_index.strip()),
    }


def yt_dlp_description(video_id: str) -> str:
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--js-runtimes",
        "node",
        "--no-warnings",
        "--no-playlist",
        "--print",
        "description",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return result.stdout


def audiolibrary_url_from_description(description: str) -> str | None:
    match = re.search(r"(https://www\.audiolibrary\.com\.co/[a-z0-9\-/]+)", description, re.I)
    if match:
        return match.group(1).rstrip("/")
    return None


def audiolibrary_page_url(title: str) -> str:
    artist, track = parse_artist_track(title)
    return f"{AUDIOLIBRARY_BASE}/{slugify(artist)}/{slugify(track)}"


def resolve_page_url(entry: dict) -> str:
    page_url = audiolibrary_page_url(entry["title"])
    try:
        urllib.request.urlopen(
            urllib.request.Request(page_url, headers={"User-Agent": USER_AGENT}),
            timeout=20,
        )
        return page_url
    except urllib.error.HTTPError:
        pass

    description = yt_dlp_description(entry["id"])
    direct = audiolibrary_url_from_description(description)
    if direct:
        return direct
    raise RuntimeError(f"Cannot resolve audiolibrary page for: {entry['title']}")


def fetch_mp3_from_page(page_url: str) -> tuple[str, bytes, str]:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    headers = {"User-Agent": USER_AGENT}
    html = (
        opener.open(urllib.request.Request(page_url, headers=headers), timeout=60)
        .read()
        .decode("utf-8", errors="replace")
    )

    gate_match = re.search(r'data-download-gate="([^"]+)"', html)
    license_match = re.search(r'data-license="([^"]+)"', html)
    if not gate_match:
        raise RuntimeError(f"No data-download-gate on {page_url}")

    gate = gate_match.group(1)
    license_block = ""
    if license_match:
        license_block = html_lib.unescape(license_match.group(1))
        license_block = re.sub(r"<br\s*/?>", "\n", license_block, flags=re.IGNORECASE).strip()

    download_url = AUDIOLIBRARY_BASE + gate
    req = urllib.request.Request(
        download_url,
        headers={
            **headers,
            "Referer": page_url,
            "Origin": AUDIOLIBRARY_BASE,
            "Accept": "*/*",
        },
    )
    resp = opener.open(req, timeout=120)
    content_disp = resp.headers.get("Content-Disposition", "")
    filename = "track.mp3"
    disp_match = re.search(r'filename="([^"]+)"', content_disp)
    if disp_match:
        filename = disp_match.group(1)
    return filename, resp.read(), license_block


def load_manifest(path: Path) -> dict:
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    return json.loads(json.dumps(DEFAULT_MANIFEST))


def save_manifest(path: Path, manifest: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def used_playlist_indices(manifest: dict) -> set[int]:
    return {
        int(track["playlist_index"])
        for track in manifest.get("tracks", [])
        if track.get("playlist_index") is not None
    }


def next_free_playlist_index(manifest: dict, start: int = 1) -> int:
    used = used_playlist_indices(manifest)
    index = start
    while index in used:
        index += 1
    return index


def track_for_slug(manifest: dict, slug: str) -> dict | None:
    for track in manifest.get("tracks", []):
        if track.get("assigned_slug") == slug:
            return track
    return None


def download_for_slug(
    video_slug: str,
    output_dir: Path,
    manifest: dict,
    playlist_url: str,
    playlist_index: int | None = None,
) -> dict:
    existing = track_for_slug(manifest, video_slug)
    if existing and (output_dir / existing["filename"]).is_file():
        print(f"Already have music for {video_slug}: {existing['filename']}")
        return existing

    if playlist_index is None:
        playlist_index = next_free_playlist_index(manifest)

    entry = yt_dlp_playlist_item(playlist_url, playlist_index)
    page_url = resolve_page_url(entry)
    print(f"{video_slug} <- playlist #{playlist_index}: {entry['title']}")
    print(f"  page: {page_url}")

    _, data, license_block = fetch_mp3_from_page(page_url)
    artist, track_name = parse_artist_track(entry["title"])
    filename = f"{video_slug}.mp3"
    dest = output_dir / filename
    dest.write_bytes(data)
    print(f"  saved: {dest} ({len(data)} bytes)")

    record = {
        "assigned_slug": video_slug,
        "filename": filename,
        "artist": artist,
        "track": track_name,
        "playlist_index": playlist_index,
        "playlist_preview_id": entry["id"],
        "playlist_preview_title": entry["title"],
        "audiolibrary_page": page_url,
        "source": "audiolibrary.com.co",
        "attribution_required": True,
        "attribution_block": license_block,
    }

    manifest["tracks"] = [t for t in manifest.get("tracks", []) if t.get("assigned_slug") != video_slug]
    manifest["tracks"].append(record)
    return record


def assign_inventory(
    inventory_path: Path,
    output_dir: Path,
    manifest_path: Path,
    playlist_url: str,
    spread: int = 1,
) -> dict:
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    manifest = load_manifest(manifest_path)
    manifest["playlist_url"] = playlist_url

    videos = [v for v in inventory.get("videos", []) if not v.get("skip") and not v.get("delete_only")]
    next_index = 1
    for video in videos:
        slug = video["slug"]
        if track_for_slug(manifest, slug) and (output_dir / f"{slug}.mp3").is_file():
            print(f"skip existing: {slug}")
            next_index = max(next_index, track_for_slug(manifest, slug)["playlist_index"] + spread)
            continue
        while next_index in used_playlist_indices(manifest):
            next_index += 1
        try:
            download_for_slug(slug, output_dir, manifest, playlist_url, playlist_index=next_index)
            video["music_file"] = f"{slug}.mp3"
            video["music_assigned"] = True
            next_index += spread
        except Exception as err:
            print(f"FAILED {slug} at playlist #{next_index}: {err}", file=sys.stderr)
            next_index += 1
            continue

    save_manifest(manifest_path, manifest)
    inventory_path.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="One unique playlist track per video slug")
    parser.add_argument("--slug", help="Download music for a single article/video slug")
    parser.add_argument(
        "--assign-inventory",
        help="Assign + download one track per entry in video-inventory.json",
    )
    parser.add_argument("--playlist-index", type=int, help="Force a specific playlist index")
    parser.add_argument("--spread", type=int, default=1, help="Gap between playlist picks (default 1)")
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parent.parent / "assets" / "music"),
    )
    parser.add_argument("--playlist", default=PLAYLIST_URL)
    parser.add_argument("--list", type=int, metavar="N", help="List first N playlist titles (no download)")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.json"

    if args.list:
        for i in range(1, args.list + 1):
            entry = yt_dlp_playlist_item(args.playlist, i)
            artist, track = parse_artist_track(entry["title"])
            print(f"{i:3d}. {artist} - {track}")
        return

    if args.assign_inventory:
        manifest = assign_inventory(
            Path(args.assign_inventory),
            output_dir,
            manifest_path,
            args.playlist,
            spread=args.spread,
        )
        print(json.dumps({"tracks": len(manifest["tracks"])}, indent=2))
        return

    if not args.slug:
        parser.error("Provide --slug, --assign-inventory, or --list N")
        return

    manifest = load_manifest(manifest_path)
    download_for_slug(
        args.slug,
        output_dir,
        manifest,
        args.playlist,
        playlist_index=args.playlist_index,
    )
    save_manifest(manifest_path, manifest)
    print(f"Wrote {manifest_path}")


if __name__ == "__main__":
    main()
