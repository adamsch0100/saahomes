#!/usr/bin/env python3
"""One-time OAuth setup for @SAAHomes YouTube uploads (if not already configured)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from youtube_auth import credentials_dir, run_oauth_setup


def main() -> None:
    parser = argparse.ArgumentParser(description="Authorize Hermes for @SAAHomes YouTube uploads")
    parser.add_argument(
        "--client-secrets",
        default=str(credentials_dir() / "client_secrets.json"),
        help="Google OAuth client secrets JSON",
    )
    parser.add_argument(
        "--output",
        default=str(credentials_dir() / "youtube-oauth.json"),
        help="Where to save the authorized token JSON",
    )
    args = parser.parse_args()

    try:
        run_oauth_setup(Path(args.client_secrets), Path(args.output))
    except Exception as err:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
