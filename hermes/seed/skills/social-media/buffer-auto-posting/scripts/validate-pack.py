#!/usr/bin/env python3
"""
Validate an SAA Homes social pack JSON before posting to Buffer.

Catches the three most common Buffer rejections / silent failures:
  1. X caption > 280 chars (Buffer rejects with "cannot exceed 280 characters")
  2. GBP caption contains phone number (Buffer rejects: "Google Business posts
     cannot contain phone numbers") or a URL in caption text
  3. Pack structure mistakes: platforms missing from the `platforms` array
     (e.g. X only in a top-level `x` object — buffer-post.py --file only
     posts entries in `platforms`)

Usage:
  python3 validate-pack.py outreach/pending/social-YYYY-MM-DD-weekly.json

Exit code 0 = all checks pass, 1 = problems found (with messages).
Stdlib only — runs on system python3, no deps.
"""
import json
import re
import sys
import urllib.request

PHONE_RE = re.compile(r"\d{3}[-.)]\d{3}[-.]\d{4}")
URL_RE = re.compile(r"https?://")

GBP_CTA_ENDINGS = (
    "Learn more at the link below.",
    "Click the button to learn more.",
)

BLACK_PLACEHOLDER = "blog-default-black"


def check_image(url: str):
    """Return an error string if the image is missing/black/broken, else None.

    Empty URL = allowed (legitimate text-only posts). Black placeholder or an
    unreachable/non-image URL = hard fail (Adam: no black images on social, Aug 2026).
    """
    if not url:
        return None
    if BLACK_PLACEHOLDER in url:
        return (
            "uses the black placeholder image (blog-default-black.jpg) — "
            "create a real branded image (content-image-creation skill) before posting"
        )
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            ct = resp.headers.get_content_type() or ""
            if not ct.startswith("image/"):
                return f"URL does not serve an image (content-type: {ct}) — the post would render with a broken/blank image"
    except Exception as e:
        return f"image URL not reachable ({e}) — the post would render with a broken/black image"
    return None


def main():
    if len(sys.argv) != 2:
        print("usage: validate-pack.py <pack.json>")
        return 1

    path = sys.argv[1]
    with open(path) as f:
        pack = json.load(f)

    problems = []
    platforms = pack.get("platforms", [])

    if not platforms:
        problems.append("pack has no 'platforms' array — nothing will post")
    else:
        names = [p.get("name", "").lower() for p in platforms]
        if not any("google" in n or "gbp" in n or "business" in n for n in names):
            problems.append("no Google Business Profile entry in platforms[]")
        if not any("facebook" in n or "fb" in n for n in names):
            problems.append("no Facebook entry in platforms[]")
        if not any(n in ("x", "twitter", "x/twitter") or n.startswith("x ") for n in names):
            problems.append(
                "no X entry in platforms[] — a top-level 'x' object is IGNORED "
                "by buffer-post.py --file and will not post"
            )

    for plat in platforms:
        name = plat.get("name", "?")
        cap = plat.get("caption", "")
        low = name.lower()
        img = plat.get("image_url") or plat.get("image") or ""
        img_err = check_image(img)
        if img_err:
            problems.append(f"{name}: {img_err}")

        if "google" in low or "gbp" in low or "business" in low:
            if PHONE_RE.search(cap):
                problems.append(f"GBP caption contains a phone number — Buffer will reject: {PHONE_RE.search(cap).group(0)}")
            if URL_RE.search(cap):
                problems.append("GBP caption contains a URL — link goes in CTA button metadata only")
            if not cap.rstrip().endswith(GBP_CTA_ENDINGS):
                problems.append(f"GBP caption should end with a CTA phrase like: {GBP_CTA_ENDINGS[0]}")
        elif low in ("x", "twitter", "x/twitter"):
            # X counts the FULL URL in the caption toward the 280 limit
            length = len(cap)
            print(f"X caption length: {length} chars (limit 280)")
            if length > 280:
                problems.append(f"X caption is {length} chars — exceeds 280 limit, Buffer will reject")

    if problems:
        print("❌ Validation FAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1

    print("✅ Pack valid — all platforms accounted for, GBP clean, X within limit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
