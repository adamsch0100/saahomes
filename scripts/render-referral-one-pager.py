#!/usr/bin/env python3
"""Render public/referral-one-pager.html to a one-page US Letter PDF.

Usage (from repo root):
    .venv/bin/python scripts/render-referral-one-pager.py

Requires Playwright Chromium (PLAYWRIGHT_BROWSERS_PATH or a local install).
"""

from __future__ import annotations

import os
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HTML = PUBLIC / "referral-one-pager.html"
PDF = PUBLIC / "referral-one-pager.pdf"
LOCAL_CHROME = Path(
    "/opt/hermes/.playwright/chromium_headless_shell-1228/"
    "chrome-headless-shell-linux64/chrome-headless-shell"
)


def _serve(directory: Path) -> tuple[ThreadingHTTPServer, str]:
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address
    return httpd, f"http://{host}:{port}/referral-one-pager.html"


def _ensure_qr() -> None:
    """Write a local QR for https://saahomes.com if segno is available."""
    dest = PUBLIC / "images" / "referral-qr.svg"
    if dest.exists() and dest.stat().st_size > 200:
        return
    try:
        import segno
    except ImportError:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    qr = segno.make("https://saahomes.com", error="m")
    qr.save(dest, kind="svg", scale=6, border=1, dark="#1a1a1a", light="#ffffff")


def render() -> None:
    if not HTML.exists():
        sys.exit(f"missing {HTML}")

    _ensure_qr()

    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/hermes/.playwright")

    from playwright.sync_api import sync_playwright

    httpd, url = _serve(PUBLIC)
    try:
        with sync_playwright() as p:
            launch_kwargs = {"headless": True}
            if LOCAL_CHROME.exists():
                launch_kwargs["executable_path"] = str(LOCAL_CHROME)
            browser = p.chromium.launch(**launch_kwargs)
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=60_000)
            page.emulate_media(media="print")
            page.wait_for_timeout(400)
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = Path(tmp.name)
            page.pdf(
                path=str(tmp_path),
                format="Letter",
                print_background=True,
                prefer_css_page_size=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
            browser.close()
    finally:
        httpd.shutdown()

    # Confirm a single page before replacing the public artifact.
    page_count = _pdf_page_count(tmp_path)
    if page_count != 1:
        tmp_path.unlink(missing_ok=True)
        sys.exit(f"expected 1 page, got {page_count} — tighten copy/CSS before shipping")

    PDF.write_bytes(tmp_path.read_bytes())
    tmp_path.unlink(missing_ok=True)
    print(f"wrote {PDF} ({PDF.stat().st_size} bytes, {page_count} page)")


def _pdf_page_count(path: Path) -> int:
    try:
        from pypdf import PdfReader

        return len(PdfReader(str(path)).pages)
    except Exception:
        data = path.read_bytes()
        return data.count(b"/Type /Page") - data.count(b"/Type /Pages")


if __name__ == "__main__":
    render()
