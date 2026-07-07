#!/usr/bin/env python3
"""
Audit @SAAHomes / Adam Schwartz YouTube uploads and classify article vs listing videos.

Article explainer videos live on the Adam Schwartz channel (UCCgkJ1fymEPI5hdBH2SNvrg),
not the @SAAHomes listing-tour channel (Schwartz and Associates Homes).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ARTICLE_CHANNEL_ID = "UCCgkJ1fymEPI5hdBH2SNvrg"
LISTING_CHANNEL_HINTS = (
    "presented by",
    "for sale",
    "tour",
    "open house",
)
ADDRESS_PATTERN = re.compile(r"\b\d{3,5}\s+[A-Za-z0-9\s.'-]+,\s*[A-Za-z\s]+,\s*CO\b", re.I)


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def yt_dlp_channel_uploads(channel_url: str) -> list[dict]:
    cmd = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--js-runtimes",
        "node",
        "--flat-playlist",
        "--print",
        "%(id)s|||%(title)s|||%(upload_date)s",
        channel_url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    entries = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line or "|||" not in line:
            continue
        vid, title, upload_date = line.split("|||", 2)
        entries.append(
            {
                "youtube_id": vid.strip(),
                "title": title.strip(),
                "upload_date": upload_date.strip() if upload_date.strip() != "NA" else None,
            }
        )
    return entries


def classify_video(title: str) -> str:
    lower = title.lower()
    if any(hint in lower for hint in LISTING_CHANNEL_HINTS):
        return "listing"
    if ADDRESS_PATTERN.search(title):
        return "listing"
    if any(
        kw in lower
        for kw in (
            "chfa",
            "market update",
            "neighborhood guide",
            "complete guide",
            "realtor",
            "buying a home",
            "buying your",
            "selling your",
            "sell your",
            "first responder",
            "schools to home",
            "champions",
        )
    ):
        return "article"
    if "guide" in lower and "saa homes" in lower:
        return "article"
    return "unknown"


def suggest_slug(title: str, video_type: str) -> str:
    if video_type != "article":
        return slugify(title)[:80]

    mappings = [
        ("chfa schools to home", "chfa-schools-to-home-colorado-teachers"),
        ("chfa down payment assistance in colorado", "chfa-down-payment-assistance-colorado-2026"),
        ("chfa first-time homebuyer", "chfa-first-time-homebuyer-northern-colorado"),
        ("champions home loan", "colorado-champions-home-loan-first-responders"),
        ("market update", "northern-colorado-market-update"),
        ("buying a home in fort collins", "buying-a-home-in-fort-collins"),
        ("buying a home in loveland", "buying-a-home-in-loveland"),
        ("buying a home in timnath", "buying-a-home-in-timnath"),
        ("buying a home in windsor", "buying-a-home-in-windsor-colorado"),
        ("buying a home in wellington", "buying-a-home-in-wellington-colorado"),
        ("selling your home in fort collins", "selling-your-home-in-fort-collins"),
        ("selling your home in windsor", "selling-your-home-in-windsor-colorado"),
        ("selling your home in greeley", "selling-your-home-in-greeley-colorado"),
        ("fort collins realtor", "fort-collins-realtor"),
        ("south fort collins", "neighborhood-south-fort-collins"),
        ("northwest fort collins", "neighborhood-northwest-fort-collins"),
        ("university area", "neighborhood-university-area-fort-collins"),
        ("june 2026", "northern-colorado-market-update-june-2026"),
        ("july 2026", "northern-colorado-market-update-july-2026"),
    ]
    lower = title.lower()
    for needle, slug in mappings:
        if needle in lower:
            return slug
    return slugify(title)[:80]


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit YouTube channel uploads")
    parser.add_argument(
        "--channel",
        default=f"https://www.youtube.com/channel/{ARTICLE_CHANNEL_ID}/videos",
    )
    parser.add_argument("--output", help="Write JSON audit to this path")
    parser.add_argument("--merge-inventory", help="Merge article videos into video-inventory.json")
    args = parser.parse_args()

    uploads = yt_dlp_channel_uploads(args.channel)
    audit = {"channel": args.channel, "uploads": [], "summary": {}}

    for entry in uploads:
        video_type = classify_video(entry["title"])
        slug = suggest_slug(entry["title"], video_type)
        audit["uploads"].append({**entry, "type": video_type, "suggested_slug": slug})

    by_type: dict[str, int] = {}
    for row in audit["uploads"]:
        by_type[row["type"]] = by_type.get(row["type"], 0) + 1
    audit["summary"] = by_type

    if args.merge_inventory:
        inv_path = Path(args.merge_inventory)
        inventory = json.loads(inv_path.read_text(encoding="utf-8")) if inv_path.is_file() else {"videos": []}
        existing_ids = {v.get("youtube_id") for v in inventory.get("videos", [])}
        existing_slugs = {v.get("slug") for v in inventory.get("videos", [])}

        for row in audit["uploads"]:
            if row["type"] != "article":
                continue
            if row["youtube_id"] in existing_ids:
                continue
            slug = row["suggested_slug"]
            if slug in existing_slugs:
                slug = f"{slug}-{row['youtube_id'][:6].lower()}"

            inventory.setdefault("videos", []).append(
                {
                    "slug": slug,
                    "title": row["title"],
                    "youtube_id": row["youtube_id"],
                    "status": "live",
                    "copyright_risk": True,
                    "urgent_unlist": True,
                    "delete_after_upload": True,
                    "audit_required": True,
                    "project_path": f"/opt/data/workspace/saahomes/videos/projects/{slug}",
                }
            )
            existing_ids.add(row["youtube_id"])
            existing_slugs.add(slug)

        inv_path.write_text(json.dumps(inventory, indent=2) + "\n", encoding="utf-8")
        print(f"Merged into {inv_path}")

    if args.output:
        Path(args.output).write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
