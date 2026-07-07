#!/usr/bin/env python3
"""Scan Hermes volume for video projects and print inventory hints."""

from __future__ import annotations

import json
import os
from pathlib import Path


def hermes_workspace() -> Path:
    home = Path(os.environ.get("HERMES_HOME", "/opt/data"))
    return home / "workspace" / "saahomes"


def scan_projects(root: Path) -> list[dict]:
    findings = []
    if not root.is_dir():
        return findings

    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue
        files = list(entry.rglob("*"))
        media = [f for f in files if f.suffix.lower() in {".mp4", ".mp3", ".wav", ".m4a"}]
        if not media:
            continue
        findings.append(
            {
                "slug": entry.name,
                "project_path": str(entry),
                "media_files": [str(f.relative_to(entry)) for f in media[:20]],
            }
        )
    return findings


def main() -> None:
    workspace = hermes_workspace()
    search_roots = [
        workspace / "videos" / "projects",
        workspace / "videos",
        workspace,
    ]

    all_findings: list[dict] = []
    for root in search_roots:
        all_findings.extend(scan_projects(root))

    deduped: dict[str, dict] = {}
    for item in all_findings:
        deduped[item["slug"]] = item

    print(json.dumps({"projects": list(deduped.values())}, indent=2))


if __name__ == "__main__":
    main()
