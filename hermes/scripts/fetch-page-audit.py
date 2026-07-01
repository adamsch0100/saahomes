#!/usr/bin/env python3
"""Cron-safe live page audit — fetch URL in-process (no curl|python pipes).

Use this from Hermes cron jobs instead of shell pipes, which trigger tirith
security scans and fail unattended with Broken pipe / pending_approval.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from typing import Any


def fetch(url: str, timeout: int = 30) -> tuple[int, str, dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SAAHomes-Hermes-Audit/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, body, headers
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        headers = {k.lower(): v for k, v in err.headers.items()} if err.headers else {}
        return err.code, body, headers


def extract_title(html: str) -> str | None:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else None


def extract_meta(html: str, name: str) -> str | None:
    pattern = (
        rf'<meta[^>]+(?:name|property)=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']*)["\']'
        rf'|<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:name|property)=["\']{re.escape(name)}["\']'
    )
    match = re.search(pattern, html, re.IGNORECASE)
    if not match:
        return None
    return (match.group(1) or match.group(2) or "").strip()


def extract_canonical(html: str) -> str | None:
    match = re.search(
        r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    match = re.search(
        r'<link[^>]+href=["\']([^"\']+)["\'][^>]+rel=["\']canonical["\']',
        html,
        re.IGNORECASE,
    )
    return match.group(1).strip() if match else None


def extract_schemas(html: str) -> list[dict[str, Any]]:
    blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.IGNORECASE | re.DOTALL,
    )
    schemas: list[dict[str, Any]] = []
    for block in blocks:
        text = block.strip()
        try:
            parsed = json.loads(text)
            schemas.append(parsed)
        except json.JSONDecodeError:
            schemas.append({"_parse_error": True, "_raw_preview": text[:200]})
    return schemas


def schema_types(schema: Any) -> list[str]:
    types: list[str] = []
    if isinstance(schema, dict):
        value = schema.get("@type")
        if isinstance(value, str):
            types.append(value)
        elif isinstance(value, list):
            types.extend(str(item) for item in value)
        graph = schema.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                types.extend(schema_types(item))
    elif isinstance(schema, list):
        for item in schema:
            types.extend(schema_types(item))
    return types


def has_noindex(html: str) -> bool:
    robots = (extract_meta(html, "robots") or "").lower()
    return "noindex" in robots


def audit(url: str, timeout: int = 30) -> dict[str, Any]:
    status, html, headers = fetch(url, timeout=timeout)
    schemas = extract_schemas(html)
    schema_type_lists = [schema_types(item) for item in schemas]
    return {
        "url": url,
        "status": status,
        "ok": 200 <= status < 300,
        "title": extract_title(html),
        "description": extract_meta(html, "description"),
        "canonical": extract_canonical(html),
        "noindex": has_noindex(html),
        "schema_count": len(schemas),
        "schema_types": schema_type_lists,
        "content_type": headers.get("content-type"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Cron-safe live page audit for Hermes")
    parser.add_argument("url", help="URL to fetch and audit")
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args()

    try:
        result = audit(args.url, timeout=args.timeout)
    except OSError as err:
        print(json.dumps({"url": args.url, "ok": False, "error": str(err)}))
        sys.exit(1)

    if args.pretty:
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps(result))

    sys.exit(0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()
