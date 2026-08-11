#!/usr/bin/env python3
"""Harvest agent contact hints from public HTML directory pages.

Public pages only. Does not send email/SMS. Dedupes into a CSV CRM.

Example:
  python harvest_prospects.py --url https://example-brokerage.com/agents -o agents.csv
  python harvest_prospects.py --urls-file sources.txt -o agents.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")
TITLE_HINTS_HIGH = (
    "listing",
    "seller",
    "team lead",
    "team leader",
    "managing broker",
    "broker owner",
    "listing specialist",
)
TITLE_HINTS_SKIP = ("buyer specialist", "buyer's agent", "buyer agent only")

CSV_FIELDS = [
    "name",
    "email",
    "phone",
    "brokerage",
    "city",
    "state",
    "title",
    "source_url",
    "icp_score",
    "consent_sms",
    "dnc",
    "last_touch",
    "notes",
]


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []
        self.texts: list[str] = []
        self._capture = False
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)
            self._capture = True
            self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._capture:
            self.texts.append("".join(self._buf).strip())
            self._capture = False

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buf.append(data)


def fetch(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ListLogic-ProspectHarvest/1.0 (+https://listlogic.homes)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def icp_score(title: str, blob: str) -> str:
    t = f"{title} {blob}".lower()
    if any(s in t for s in TITLE_HINTS_SKIP) and "listing" not in t:
        return "low"
    if any(h in t for h in TITLE_HINTS_HIGH):
        return "high"
    return "medium"


def extract_rows(html: str, source_url: str, brokerage: str) -> list[dict[str, str]]:
    emails = sorted(set(EMAIL_RE.findall(html)))
    # Drop common junk
    emails = [
        e
        for e in emails
        if not e.lower().endswith((".png", ".jpg", ".gif", ".svg"))
        and "example.com" not in e.lower()
        and "sentry" not in e.lower()
    ]
    phones = sorted(set(PHONE_RE.findall(html)))
    parser = LinkCollector()
    try:
        parser.feed(html)
    except Exception:
        pass

    rows: list[dict[str, str]] = []
    if not emails:
        # Still record page as source note for manual follow-up
        rows.append(
            {
                "name": "",
                "email": "",
                "phone": phones[0] if phones else "",
                "brokerage": brokerage,
                "city": "",
                "state": "",
                "title": "",
                "source_url": source_url,
                "icp_score": "medium",
                "consent_sms": "0",
                "dnc": "0",
                "last_touch": "",
                "notes": "no_email_extracted_manual_review",
            }
        )
        return rows

    for i, email in enumerate(emails):
        local = email.split("@", 1)[0]
        guess_name = re.sub(r"[._\-]+", " ", local).strip().title()
        phone = phones[i] if i < len(phones) else (phones[0] if phones else "")
        score = icp_score("", html[:8000])
        rows.append(
            {
                "name": guess_name,
                "email": email.lower(),
                "phone": phone,
                "brokerage": brokerage,
                "city": "",
                "state": "",
                "title": "",
                "source_url": source_url,
                "icp_score": score,
                "consent_sms": "0",
                "dnc": "0",
                "last_touch": "",
                "notes": "harvested_public_html",
            }
        )
    return rows


def load_existing(path: Path) -> dict[str, dict[str, str]]:
    if not path.is_file():
        return {}
    out: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            key = (row.get("email") or "").strip().lower() or f"url:{(row.get('source_url') or '').strip()}"
            if key:
                out[key] = row
    return out


def write_csv(path: Path, rows_by_key: dict[str, dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows_by_key.values():
            writer.writerow({k: row.get(k, "") for k in CSV_FIELDS})


def iter_urls(args: argparse.Namespace) -> Iterable[str]:
    if args.url:
        for u in args.url:
            yield u.strip()
    if args.urls_file:
        text = Path(args.urls_file).read_text(encoding="utf-8")
        for line in text.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                yield line


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--url", action="append", default=[], help="Source URL (repeatable)")
    ap.add_argument("--urls-file", help="Text file with one URL per line")
    ap.add_argument("-o", "--out", default="agents.csv", help="Output CSV path")
    ap.add_argument("--brokerage", default="", help="Default brokerage label")
    args = ap.parse_args()

    urls = list(iter_urls(args))
    if not urls:
        print("Provide --url or --urls-file", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    existing = load_existing(out_path)
    added = 0

    for url in urls:
        brokerage = args.brokerage or (urlparse(url).hostname or "")
        try:
            html = fetch(url)
        except (urllib.error.URLError, TimeoutError, ValueError) as err:
            print(f"FAIL {url}: {err}", file=sys.stderr)
            continue
        for row in extract_rows(html, url, brokerage):
            key = (row.get("email") or "").strip().lower() or f"url:{url}|{row.get('notes')}"
            if key in existing and existing[key].get("email"):
                continue
            if key not in existing:
                added += 1
            existing[key] = row
        print(f"OK {url}")

    write_csv(out_path, existing)
    print(f"Wrote {out_path} ({len(existing)} rows, +{added} new)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
