#!/usr/bin/env python3
"""Write Telegram allowlist into config.yaml as real YAML lists (not JSON strings).

Hermes plugin adapter treats adapter-level allow_from as highest-priority auth.
`hermes config set ... allow_from '["123"]'` stores a quoted STRING, which does
NOT match user IDs — TELEGRAM_ALLOWED_USERS is then ignored. This script fixes both
platforms.telegram.extra and gateway.platforms.telegram.extra paths.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def load_yaml(path: Path):
    try:
        import yaml  # type: ignore
    except ImportError:
        return None, None

    if not path.is_file():
        return yaml, {}

    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return yaml, data if isinstance(data, dict) else {}


def parse_allowed_users(raw: str) -> list[str]:
    ids: list[str] = []
    for part in raw.split(","):
        cleaned = part.strip().strip('"').strip("'")
        if cleaned:
            ids.append(cleaned)
    return ids


def resolve_allowed_users(data_dir: Path) -> list[str]:
    raw = os.environ.get("TELEGRAM_ALLOWED_USERS", "").strip()
    if not raw:
        env_file = data_dir / ".env"
        if env_file.is_file():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("TELEGRAM_ALLOWED_USERS="):
                    raw = line.split("=", 1)[1].strip()
                    break
    return parse_allowed_users(raw)


def set_nested(cfg: dict, keys: list[str], value) -> None:
    node = cfg
    for key in keys[:-1]:
        child = node.get(key)
        if not isinstance(child, dict):
            child = {}
            node[key] = child
        node = child
    node[keys[-1]] = value


def main() -> int:
    data_dir = Path(os.environ.get("HERMES_HOME", "/opt/data"))
    config_path = data_dir / "config.yaml"
    allowed_ids = resolve_allowed_users(data_dir)

    if not allowed_ids:
        print("sync-telegram-auth: TELEGRAM_ALLOWED_USERS unset — skipping config patch")
        return 0

    yaml_mod, cfg = load_yaml(config_path)
    if yaml_mod is None:
        print("sync-telegram-auth: PyYAML unavailable — rely on TELEGRAM_ALLOWED_USERS env only")
        return 0

    set_nested(cfg, ["platforms", "telegram", "extra", "allow_from"], allowed_ids)
    set_nested(cfg, ["gateway", "platforms", "telegram", "extra", "allow_from"], allowed_ids)
    set_nested(cfg, ["gateway", "platforms", "telegram", "enabled"], True)

    config_path.parent.mkdir(parents=True, exist_ok=True)
    with config_path.open("w", encoding="utf-8") as handle:
        yaml_mod.dump(cfg, handle, default_flow_style=False, sort_keys=False)

    print(f"sync-telegram-auth: allow_from={allowed_ids} at platforms.telegram.extra")
    return 0


if __name__ == "__main__":
    sys.exit(main())
