#!/usr/bin/env python3
"""Send a social post pack email to Adam via OUTREACH_SMTP_* env vars."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import smtplib
import sys
import urllib.request
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def require_env(name: str) -> str:
    value = env(name)
    if not value:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def platform_block(platform: dict[str, Any]) -> str:
    name = esc(platform.get("name", "Platform"))
    caption = esc(platform.get("caption", ""))
    image_url = platform.get("image_url") or platform.get("image")
    notes = esc(platform.get("notes", ""))
    img_html = ""
    if image_url:
        img_html = (
            f'<p><img src="{esc(image_url)}" alt="Post image" '
            f'style="max-width:100%;height:auto;border-radius:8px;" /></p>'
            f'<p><a href="{esc(image_url)}">Download image</a></p>'
        )
    notes_html = f"<p><em>{notes}</em></p>" if notes else ""
    return f"""
    <section style="margin:24px 0;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
      <h2 style="margin:0 0 12px;font-size:18px;">{name}</h2>
      {img_html}
      <pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:15px;line-height:1.5;">{caption}</pre>
      {notes_html}
    </section>
    """


def build_html(pack: dict[str, Any]) -> str:
    promoting = pack.get("promoting", {})
    title = esc(promoting.get("title", pack.get("title", "SAA Homes content")))
    url = esc(promoting.get("url", pack.get("url", "https://saahomes.com")))
    intro = esc(pack.get("intro", "Copy each section below into the matching platform."))

    platforms_html = "".join(platform_block(p) for p in pack.get("platforms", []))

    extras = []
    youtube = pack.get("youtube")
    if youtube:
        extras.append(
            f"<h2>YouTube (@SAAHomes)</h2>"
            f"<p><strong>Video:</strong> {esc(youtube.get('video_title', ''))}</p>"
            f"<pre style='white-space:pre-wrap;'>{esc(youtube.get('description', ''))}</pre>"
        )
    x_post = pack.get("x")
    if x_post:
        extras.append(
            f"<h2>X (@saahomes)</h2>"
            f"<pre style='white-space:pre-wrap;'>{esc(x_post.get('caption', ''))}</pre>"
        )
    video_note = pack.get("video_note")
    if video_note:
        extras.append(f"<p><strong>Video note:</strong> {esc(video_note)}</p>")

    return f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#111;max-width:720px;margin:0 auto;padding:16px;">
  <h1 style="font-size:22px;">📋 Social post pack — ready to publish</h1>
  <p><strong>Promoting:</strong> <a href="{url}">{title}</a></p>
  <p>{intro}</p>
  <p><strong>Publish in:</strong> Meta Business Suite (FB + IG) · Google Business Profile · optional YouTube/X below</p>
  {platforms_html}
  {''.join(extras)}
  <hr />
  <p style="color:#666;font-size:13px;">Sent by SAA Homes Hermes. Reply on Telegram with <code>posted</code> when live.</p>
</body></html>"""


def collect_attachments(pack: dict[str, Any]) -> list[tuple[str, bytes, str]]:
    attachments: list[tuple[str, bytes, str]] = []
    seen: set[str] = set()

    def add(name: str, data: bytes, mime: str) -> None:
        if name in seen:
            return
        seen.add(name)
        attachments.append((name, data, mime))

    for idx, platform in enumerate(pack.get("platforms", []), start=1):
        local_path = platform.get("image_path") or platform.get("local_image")
        if local_path:
            path = Path(local_path)
            if path.is_file():
                data = path.read_bytes()
                mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
                add(f"{idx}-{path.name}", data, mime)
                continue
        image_url = platform.get("image_url") or platform.get("image")
        if image_url and image_url.startswith("http"):
            try:
                with urllib.request.urlopen(image_url, timeout=30) as resp:
                    data = resp.read()
                    mime = resp.headers.get_content_type() or "image/jpeg"
                ext = mimetypes.guess_extension(mime) or ".jpg"
                add(f"{idx}-post-image{ext}", data, mime)
            except OSError as err:
                print(f"Warning: could not download {image_url}: {err}", file=sys.stderr)

    for path_str in pack.get("attachment_paths", []):
        path = Path(path_str)
        if path.is_file():
            data = path.read_bytes()
            mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            add(path.name, data, mime)

    return attachments


def send_pack(pack: dict[str, Any]) -> None:
    host = require_env("OUTREACH_SMTP_HOST")
    user = require_env("OUTREACH_SMTP_USER")
    password = require_env("OUTREACH_SMTP_PASSWORD")
    to_addr = env("SOCIAL_POST_EMAIL_TO", user)
    from_addr = env("OUTREACH_SMTP_FROM", user)

    subject = pack.get("subject") or f"SAA Homes — Social posts ready: {pack.get('promoting', {}).get('title', 'New content')}"

    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr

    html = build_html(pack)
    alt = MIMEMultipart("alternative")
    alt.attach(MIMEText("Social post pack — open in HTML-capable email client.", "plain", "utf-8"))
    alt.attach(MIMEText(html, "html", "utf-8"))
    msg.attach(alt)

    for filename, data, mime in collect_attachments(pack):
        if mime.startswith("image/"):
            part = MIMEImage(data, _subtype=mime.split("/", 1)[1])
        else:
            part = MIMEApplication(data, Name=filename)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)

    with smtplib.SMTP(host, 587) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.sendmail(from_addr, [to_addr], msg.as_string())

    print(f"Sent social post pack to {to_addr}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Email a social post pack to Adam")
    parser.add_argument("pack_json", help="Path to JSON pack file")
    args = parser.parse_args()

    pack_path = Path(args.pack_json)
    if not pack_path.is_file():
        print(f"Pack file not found: {pack_path}", file=sys.stderr)
        sys.exit(1)

    pack = json.loads(pack_path.read_text(encoding="utf-8"))
    send_pack(pack)


if __name__ == "__main__":
    main()
