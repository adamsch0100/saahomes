#!/usr/bin/env python3
"""Load YouTube OAuth credentials from Railway env or Hermes volume."""

from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]


def hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", "/opt/data"))


def credentials_dir() -> Path:
    return hermes_home() / "credentials"


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def candidate_credential_paths() -> list[Path]:
    paths: list[Path] = []
    explicit = env("YOUTUBE_OAUTH_CREDENTIALS")
    if explicit:
        paths.append(Path(explicit))
    cred_dir = credentials_dir()
    paths.extend(
        [
            cred_dir / "youtube-oauth.json",
            cred_dir / "youtube-token.json",
            cred_dir / "token.json",
            cred_dir / "client_token.json",
            hermes_home() / "youtube-oauth.json",
            hermes_home() / "youtube-token.json",
            hermes_home() / "token.json",
            hermes_home() / "browser-sessions" / "youtube" / "token.json",
            hermes_home() / "browser-sessions" / "youtube" / "youtube-oauth.json",
            hermes_home() / "browser-sessions" / "youtube" / "oauth.json",
        ]
    )
    seen: set[str] = set()
    unique: list[Path] = []
    for path in paths:
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def credentials_from_dict(data: dict[str, Any]) -> Credentials | None:
    if "refresh_token" in data and ("client_id" in data or "installed" in data or "web" in data):
        if "installed" in data or "web" in data:
            client = data.get("installed") or data.get("web") or {}
            client_id = client.get("client_id") or data.get("client_id")
            client_secret = client.get("client_secret") or data.get("client_secret")
            refresh_token = data.get("refresh_token")
            if client_id and client_secret and refresh_token:
                return Credentials(
                    token=None,
                    refresh_token=refresh_token,
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=client_id,
                    client_secret=client_secret,
                    scopes=YOUTUBE_SCOPES,
                )
        return Credentials.from_authorized_user_info(data, scopes=YOUTUBE_SCOPES)

    if "refresh_token" in data:
        client_id = data.get("client_id") or env("YOUTUBE_CLIENT_ID")
        client_secret = data.get("client_secret") or env("YOUTUBE_CLIENT_SECRET")
        if client_id and client_secret:
            return Credentials(
                token=data.get("token"),
                refresh_token=data["refresh_token"],
                token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=client_id,
                client_secret=client_secret,
                scopes=data.get("scopes") or YOUTUBE_SCOPES,
            )
    return None


def credentials_from_env() -> Credentials | None:
    client_id = env("YOUTUBE_CLIENT_ID")
    client_secret = env("YOUTUBE_CLIENT_SECRET")
    refresh_token = env("YOUTUBE_REFRESH_TOKEN")
    if client_id and client_secret and refresh_token:
        return Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=YOUTUBE_SCOPES,
        )
    return None


def load_credentials() -> Credentials:
    for path in candidate_credential_paths():
        data = load_json(path)
        if not data:
            continue
        creds = credentials_from_dict(data)
        if creds:
            return refresh_if_needed(creds)

    creds = credentials_from_env()
    if creds:
        return refresh_if_needed(creds)

    searched = ", ".join(str(p) for p in candidate_credential_paths())
    raise RuntimeError(
        "YouTube OAuth credentials not found. Set YOUTUBE_CLIENT_ID, "
        "YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN or place youtube-oauth.json "
        f"on the Hermes volume. Searched: {searched}"
    )


def refresh_if_needed(creds: Credentials) -> Credentials:
    if creds.valid:
        return creds
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds.valid:
        raise RuntimeError("YouTube OAuth token is invalid and could not be refreshed.")
    return creds


def build_youtube_service():
    creds = load_credentials()
    return build("youtube", "v3", credentials=creds)


def run_oauth_setup(client_secrets_path: Path, token_output: Path) -> Credentials:
    if not client_secrets_path.is_file():
        print(f"Client secrets file not found: {client_secrets_path}", file=sys.stderr)
        sys.exit(1)
    flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets_path), YOUTUBE_SCOPES)
    creds = flow.run_local_server(port=0)
    token_output.parent.mkdir(parents=True, exist_ok=True)
    token_output.write_text(creds.to_json(), encoding="utf-8")
    print(f"Saved token to {token_output}")
    return creds


def write_credentials_from_b64() -> None:
    raw_b64 = env("YOUTUBE_OAUTH_JSON_B64")
    if not raw_b64:
        return
    out = credentials_dir() / "youtube-oauth.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(raw_b64))
    os.chmod(out, 0o600)
