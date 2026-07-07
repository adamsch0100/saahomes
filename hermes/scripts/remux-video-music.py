#!/usr/bin/env python3
"""Swap background music in article videos using ffmpeg."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str]) -> None:
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)


def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def find_first(project_dir: Path, names: list[str]) -> Path | None:
    for name in names:
        path = project_dir / name
        if path.is_file():
            return path
    return None


def music_manifest_candidates() -> list[Path]:
    return [
        Path("/seed/assets/music/manifest.json"),
        Path("/opt/data/workspace/saahomes/assets/music/manifest.json"),
        Path(__file__).resolve().parent.parent / "assets" / "music" / "manifest.json",
    ]


def resolve_music_track(music_arg: str | None, slug: str) -> Path:
    if music_arg:
        path = Path(music_arg)
        if path.is_file():
            return path
        raise FileNotFoundError(f"Music file not found: {path}")

    manifest_path = None
    for candidate in music_manifest_candidates():
        if candidate.is_file():
            manifest_path = candidate
            break
    if not manifest_path:
        raise FileNotFoundError(
            "Music manifest not found. Pass --music or add tracks under hermes/assets/music/."
        )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    tracks = manifest.get("tracks", [])
    if not tracks:
        raise RuntimeError("Music manifest has no tracks.")

    music_dir = manifest_path.parent

    # Per-slug file: {slug}.mp3 (preferred)
    slug_file = music_dir / f"{slug}.mp3"
    if slug_file.is_file():
        return slug_file

    for track in tracks:
        if track.get("assigned_slug") == slug:
            candidate = music_dir / track["filename"]
            if candidate.is_file():
                return candidate

    for track in tracks:
        candidate = music_dir / track["filename"]
        if candidate.is_file():
            return candidate

    exts = (".mp3", ".webm", ".m4a", ".opus", ".wav")
    for track in tracks:
        stem = Path(track["filename"]).stem
        for ext in exts:
            candidate = music_dir / f"{stem}{ext}"
            if candidate.is_file():
                return candidate

    raise FileNotFoundError(
        "No music MP3 files found. Download tracks from YouTube Studio → Audio Library "
        "(no attribution required) into hermes/assets/music/."
    )


def remux_with_stems(
    video_path: Path,
    narration_path: Path,
    music_path: Path,
    output_path: Path,
    music_volume: float,
) -> None:
    duration = probe_duration(video_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(narration_path),
            "-stream_loop",
            "-1",
            "-i",
            str(music_path),
            "-filter_complex",
            (
                f"[2:a]volume={music_volume},atrim=0:{duration},asetpts=PTS-STARTPTS[music];"
                f"[1:a]asetpts=PTS-STARTPTS[voice];"
                f"[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
            ),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(output_path),
        ]
    )


def remux_video_only(
    video_path: Path,
    music_path: Path,
    output_path: Path,
    music_volume: float,
) -> None:
    duration = probe_duration(video_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-stream_loop",
            "-1",
            "-i",
            str(music_path),
            "-filter_complex",
            (
                f"[1:a]volume={music_volume},atrim=0:{duration},asetpts=PTS-STARTPTS[music];"
                f"[0:a]asetpts=PTS-STARTPTS[voice];"
                f"[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
            ),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(output_path),
        ]
    )


def remux_project(
    project_dir: Path,
    output_path: Path,
    music_path: Path,
    music_volume: float,
) -> Path:
    video_path = find_first(
        project_dir,
        ["video.mp4", "output.mp4", "final.mp4", "render.mp4", f"{project_dir.name}.mp4"],
    )
    if not video_path:
        raise FileNotFoundError(f"No video file found in {project_dir}")

    narration_path = find_first(
        project_dir,
        [
            "narration.wav",
            "narration.mp3",
            "voiceover.wav",
            "voiceover.mp3",
            "voice.wav",
            "voice.mp3",
            "tts.mp3",
        ],
    )

    if narration_path:
        remux_with_stems(video_path, narration_path, music_path, output_path, music_volume)
    else:
        print(
            "No narration stem found — remixing existing audio with new background music.",
            file=sys.stderr,
        )
        remux_video_only(video_path, music_path, output_path, music_volume)

    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Remux article video with approved background music")
    parser.add_argument("--project-dir", required=True, help="Video project directory")
    parser.add_argument("--slug", required=True, help="Blog/article slug")
    parser.add_argument("--output", help="Output MP4 path")
    parser.add_argument("--music", help="Path to approved music MP3")
    parser.add_argument("--music-volume", type=float, default=0.18, help="Background music level")
    args = parser.parse_args()

    project_dir = Path(args.project_dir)
    if not project_dir.is_dir():
        print(f"Project dir not found: {project_dir}", file=sys.stderr)
        sys.exit(1)

    music_path = resolve_music_track(args.music, args.slug)
    output_path = (
        Path(args.output)
        if args.output
        else project_dir.parent.parent / "output" / f"{args.slug}-remuxed.mp4"
    )

    result_path = remux_project(project_dir, output_path, music_path, args.music_volume)
    print(json.dumps({"slug": args.slug, "output": str(result_path), "music": str(music_path)}))


if __name__ == "__main__":
    main()
