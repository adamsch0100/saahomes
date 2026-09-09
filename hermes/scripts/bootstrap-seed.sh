#!/bin/sh
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
SEED_DIR="/seed"

mkdir -p "$DATA_DIR"

# s6 cont-init scripts may not inherit Railway env directly. Import from s6's
# container_environment store (same vars the main process receives).
import_s6_container_env() {
  env_dir="/var/run/s6/container_environment"
  [ -d "$env_dir" ] || return 0
  for key_path in "$env_dir"/*; do
    [ -f "$key_path" ] || continue
    key="$(basename "$key_path")"
    val="$(cat "$key_path")"
    export "${key}=${val}"
  done
}

import_s6_container_env

# Parse KEY=VALUE lines. Never `.` source .env — unquoted values with spaces
# (e.g. Gmail app passwords) make dash execute words as commands and abort
# cont-init (exit 127), which skips the routing pin and leaves a bad model live.
load_env_file() {
  env_file="$1"
  [ -f "$env_file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      ''|*[!A-Za-z0-9_]*) continue ;;
    esac
    val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    export "${key}=${val}"
  done < "$env_file"
}

ENV_FILE="$DATA_DIR/.env"
load_env_file "$ENV_FILE"
import_s6_container_env

env_key_set() {
  key="$1"
  eval "val=\${${key}:-}"
  [ -n "$val" ]
}

env_file_key_set() {
  key="$1"
  [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE" 2>/dev/null || return 1
  val="$(grep "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2-)"
  [ -n "$val" ]
}

env_file_get() {
  key="$1"
  env_file_key_set "$key" || return 1
  grep "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2-
}

normalize_env_value() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

resolve_telegram_allowed_users() {
  if env_key_set TELEGRAM_ALLOWED_USERS; then
    normalize_env_value "${TELEGRAM_ALLOWED_USERS}"
    return 0
  fi
  if env_file_key_set TELEGRAM_ALLOWED_USERS; then
    normalize_env_value "$(env_file_get TELEGRAM_ALLOWED_USERS)"
    return 0
  fi
  return 1
}

browserbase_ready() {
  if env_key_set BROWSERBASE_API_KEY && env_key_set BROWSERBASE_PROJECT_ID; then
    return 0
  fi
  env_file_key_set BROWSERBASE_API_KEY && env_file_key_set BROWSERBASE_PROJECT_ID
}

if [ ! -f "$DATA_DIR/config.yaml" ] && [ -f "$SEED_DIR/config.yaml" ]; then
  echo "Seeding Hermes data directory at $DATA_DIR"
  cp -R "$SEED_DIR/." "$DATA_DIR/"
fi

WORKSPACE_DIR="$DATA_DIR/workspace/saahomes"
mkdir -p "$WORKSPACE_DIR/context"
mkdir -p "$WORKSPACE_DIR/outreach/pending"
mkdir -p "$WORKSPACE_DIR/outreach/sent"
mkdir -p "$WORKSPACE_DIR/outreach/skipped"
mkdir -p "$WORKSPACE_DIR/videos/projects"
mkdir -p "$WORKSPACE_DIR/videos/output"
mkdir -p "$WORKSPACE_DIR/videos/pending-upload"
mkdir -p "$WORKSPACE_DIR/assets/music"
if [ -d "$SEED_DIR/assets/music" ]; then
  cp -R "$SEED_DIR/assets/music/." "$WORKSPACE_DIR/assets/music/" 2>/dev/null || true
fi
mkdir -p "$DATA_DIR/browser-sessions/gbp"
mkdir -p "$DATA_DIR/browser-sessions/meta"
mkdir -p "$DATA_DIR/browser-sessions/youtube"
mkdir -p "$DATA_DIR/browser-sessions/x"
if id hermes >/dev/null 2>&1; then
  chown -R hermes:hermes "$DATA_DIR/browser-sessions" 2>/dev/null || true
fi

if [ -f "$DATA_DIR/AGENTS.md" ] && [ ! -f "$WORKSPACE_DIR/AGENTS.md" ]; then
  cp "$DATA_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi

if [ -f "$SEED_DIR/workspace/saahomes/context/automation-registry.md" ] && [ ! -f "$WORKSPACE_DIR/context/automation-registry.md" ]; then
  cp -R "$SEED_DIR/workspace/saahomes/." "$WORKSPACE_DIR/"
fi

# Keep repo-shipped context docs current on every deploy (does not touch MEMORY.md).
if [ -d "$SEED_DIR/workspace/saahomes/context" ]; then
  cp -R "$SEED_DIR/workspace/saahomes/context/." "$WORKSPACE_DIR/context/"
fi
if [ -f "$SEED_DIR/USER.md" ]; then
  cp "$SEED_DIR/USER.md" "$DATA_DIR/USER.md"
fi
if [ -f "$SEED_DIR/AGENTS.md" ]; then
  cp "$SEED_DIR/AGENTS.md" "$DATA_DIR/AGENTS.md"
  cp "$SEED_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi
if [ -f "$SEED_DIR/SOUL.md" ]; then
  cp "$SEED_DIR/SOUL.md" "$DATA_DIR/SOUL.md"
fi
# Append canonical integration status if volume MEMORY predates email-only social policy.
if [ -f "$DATA_DIR/MEMORY.md" ]; then
  if ! grep -q "Never Browserbase for social" "$DATA_DIR/MEMORY.md" 2>/dev/null; then
    printf '\n## Integration status (canonical — updated %s)\n' "$(date -u +%Y-%m-%d)" >> "$DATA_DIR/MEMORY.md"
    printf '%s\n' "- **Social posting:** SMTP email packs via social-post-pack → adam@saahomes.com. **Never Browserbase for social.**" >> "$DATA_DIR/MEMORY.md"
    printf '%s\n' "- **Browserbase:** Optional. browse.sh market intel only." >> "$DATA_DIR/MEMORY.md"
  fi
fi

if [ ! -f "$DATA_DIR/.saahomes-bootstrapped" ]; then
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DATA_DIR/.saahomes-bootstrapped"
  echo "First boot: run AGENTS.md first-boot checklist and install cron jobs from automation-registry.md"
fi

touch "$ENV_FILE"

append_env() {
  key="$1"
  value="$2"
  if [ -z "$value" ]; then
    return 0
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    return 0
  fi
  printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
}

upsert_env() {
  key="$1"
  value="$2"
  value="$(normalize_env_value "$value")"
  if [ -z "$value" ]; then
    return 0
  fi
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# Volume .env can pin a stale Go key; Railway/s6 must win before upsert + auth seed.
import_s6_container_env
upsert_env "OPENCODE_GO_API_KEY" "${OPENCODE_GO_API_KEY:-}"
upsert_env "OPENCODE_GO_API_KEYS" "${OPENCODE_GO_API_KEYS:-}"
upsert_env "OPENROUTER_API_KEY" "${OPENROUTER_API_KEY:-}"
if [ -n "${XAI_API_KEY:-}" ]; then
  echo "WARNING: XAI_API_KEY is set — Hermes will bill xAI API tokens and skip SuperGrok OAuth. Unset it to use grok CLI-style subscription limits (hermes auth add xai-oauth --no-browser)."
  upsert_env "XAI_API_KEY" "${XAI_API_KEY}"
fi
upsert_env "TELEGRAM_BOT_TOKEN" "${TELEGRAM_BOT_TOKEN:-}"
upsert_env "TELEGRAM_ALLOWED_USERS" "${TELEGRAM_ALLOWED_USERS:-}"
append_env "API_SERVER_KEY" "${API_SERVER_KEY:-}"
append_env "API_SERVER_ENABLED" "${API_SERVER_ENABLED:-true}"
append_env "API_SERVER_HOST" "${API_SERVER_HOST:-0.0.0.0}"
append_env "API_SERVER_CORS_ORIGINS" "${API_SERVER_CORS_ORIGINS:-*}"

append_env "HERMES_DASHBOARD" "${HERMES_DASHBOARD:-1}"
append_env "HERMES_DASHBOARD_HOST" "${HERMES_DASHBOARD_HOST:-0.0.0.0}"
append_env "HERMES_DASHBOARD_PORT" "${HERMES_DASHBOARD_PORT:-9119}"
append_env "HERMES_DASHBOARD_BASIC_AUTH_USERNAME" "${HERMES_DASHBOARD_BASIC_AUTH_USERNAME:-}"
append_env "HERMES_DASHBOARD_BASIC_AUTH_PASSWORD" "${HERMES_DASHBOARD_BASIC_AUTH_PASSWORD:-}"
append_env "HERMES_DASHBOARD_BASIC_AUTH_SECRET" "${HERMES_DASHBOARD_BASIC_AUTH_SECRET:-}"
append_env "SERPAPI_API_KEY" "${SERPAPI_API_KEY:-}"
upsert_env "GITHUB_TOKEN" "${GITHUB_TOKEN:-}"
upsert_env "GITHUB_REPO" "${GITHUB_REPO:-adamsch0100/saahomes}"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  upsert_env "GH_TOKEN" "${GITHUB_TOKEN}"
fi
upsert_env "RAILWAY_TOKEN" "${RAILWAY_TOKEN:-}"
upsert_env "RAILWAY_SERVICE_ID" "${RAILWAY_SERVICE_ID:-}"
append_env "GA4_PROPERTY_ID" "${GA4_PROPERTY_ID:-G-CB5GL0P3EZ}"
append_env "OUTREACH_APPROVAL_REQUIRED" "${OUTREACH_APPROVAL_REQUIRED:-true}"
append_env "AUTO_MERGE_SEO_PRS" "${AUTO_MERGE_SEO_PRS:-true}"
upsert_env "BROWSERBASE_API_KEY" "${BROWSERBASE_API_KEY:-}"
upsert_env "BROWSERBASE_PROJECT_ID" "${BROWSERBASE_PROJECT_ID:-}"
append_env "BROWSER_INACTIVITY_TIMEOUT" "${BROWSER_INACTIVITY_TIMEOUT:-300}"
upsert_env "OUTREACH_SMTP_HOST" "${OUTREACH_SMTP_HOST:-}"
upsert_env "OUTREACH_SMTP_USER" "${OUTREACH_SMTP_USER:-}"
upsert_env "OUTREACH_SMTP_PASSWORD" "${OUTREACH_SMTP_PASSWORD:-}"
append_env "SOCIAL_POST_EMAIL_TO" "${SOCIAL_POST_EMAIL_TO:-adam@saahomes.com}"
upsert_env "YOUTUBE_CLIENT_ID" "${YOUTUBE_CLIENT_ID:-}"
upsert_env "YOUTUBE_CLIENT_SECRET" "${YOUTUBE_CLIENT_SECRET:-}"
upsert_env "YOUTUBE_REFRESH_TOKEN" "${YOUTUBE_REFRESH_TOKEN:-}"
append_env "YOUTUBE_OAUTH_CREDENTIALS" "${YOUTUBE_OAUTH_CREDENTIALS:-}"
append_env "YOUTUBE_REMEDIATION_ON_DEPLOY" "${YOUTUBE_REMEDIATION_ON_DEPLOY:-}"

if id hermes >/dev/null 2>&1; then
  chown hermes:hermes "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$ENV_FILE" 2>/dev/null || true
fi

if browserbase_ready; then
  echo "Browserbase: credentials present — market intel / browse.sh only (NOT social posting)"
else
  echo "Browserbase: not configured — optional for browse.sh market intel; social uses SMTP email packs"
fi

echo "Social policy: SMTP email post packs ONLY (social-post-pack). No Browserbase for GBP/Meta/X."

CREDENTIALS_DIR="$DATA_DIR/credentials"
mkdir -p "$CREDENTIALS_DIR"
chmod 700 "$CREDENTIALS_DIR"
GSC_KEY_FILE="$CREDENTIALS_DIR/gsc-service-account.json"

if [ -n "${GSC_SERVICE_ACCOUNT_JSON_B64:-}" ]; then
  echo "Writing GSC service account key from GSC_SERVICE_ACCOUNT_JSON_B64"
  printf '%s' "$GSC_SERVICE_ACCOUNT_JSON_B64" | base64 -d > "$GSC_KEY_FILE"
  chmod 600 "$GSC_KEY_FILE"
elif [ -n "${GSC_SERVICE_ACCOUNT_JSON:-}" ]; then
  echo "Writing GSC service account key from GSC_SERVICE_ACCOUNT_JSON"
  printf '%s' "$GSC_SERVICE_ACCOUNT_JSON" > "$GSC_KEY_FILE"
  chmod 600 "$GSC_KEY_FILE"
fi

YOUTUBE_OAUTH_FILE="$CREDENTIALS_DIR/youtube-oauth.json"
if [ -n "${YOUTUBE_OAUTH_JSON_B64:-}" ]; then
  echo "Writing YouTube OAuth token from YOUTUBE_OAUTH_JSON_B64"
  printf '%s' "$YOUTUBE_OAUTH_JSON_B64" | base64 -d > "$YOUTUBE_OAUTH_FILE"
  chmod 600 "$YOUTUBE_OAUTH_FILE"
fi

# Bootstrap and Console uploads run as root; gateway runs as hermes.
if id hermes >/dev/null 2>&1; then
  chown -R hermes:hermes "$CREDENTIALS_DIR"
  chmod 700 "$CREDENTIALS_DIR"
  if ls "$CREDENTIALS_DIR"/*.json >/dev/null 2>&1; then
    chmod 600 "$CREDENTIALS_DIR"/*.json
  fi
  echo "credentials ownership: hermes:hermes dir=700 json=600"
  ls -la "$CREDENTIALS_DIR"
fi

# Hermes agent reads git credentials from /opt/data/.env — sync from Railway on every boot.
if [ -n "${GITHUB_TOKEN:-}" ] && [ ! -d "$WORKSPACE_DIR/.git" ]; then
  REPO="${GITHUB_REPO:-adamsch0100/saahomes}"
  echo "Cloning github.com/${REPO} for autonomous SEO work"
  CLONE_TMP="$(mktemp -d)"
  git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$CLONE_TMP"
  if [ -d "$WORKSPACE_DIR/context" ]; then
    mkdir -p "$CLONE_TMP/context"
    cp -R "$WORKSPACE_DIR/context/." "$CLONE_TMP/context/"
  fi
  rm -rf "$WORKSPACE_DIR"
  mv "$CLONE_TMP" "$WORKSPACE_DIR"
  mkdir -p "$WORKSPACE_DIR/context"
  if [ -d "$SEED_DIR/workspace/saahomes/context" ]; then
    cp -R "$SEED_DIR/workspace/saahomes/context/." "$WORKSPACE_DIR/context/"
  fi
  git -C "$WORKSPACE_DIR" config user.email "hermes@saahomes.com"
  git -C "$WORKSPACE_DIR" config user.name "SAA Homes Hermes"
fi

# Ox Alpha (x-preview-f-free) 401s. Drop the volume lock and rewrite cron pins
# onto OpenCode Go so scheduled jobs can run after this boot.
retire_dead_ox_alpha() {
  if [ -f "$DATA_DIR/ox-alpha-promo.lock" ]; then
    echo "retiring ox-alpha-promo.lock — x-preview-f-free 401s; keeping OpenCode Go"
    rm -f "$DATA_DIR/ox-alpha-promo.lock"
  fi
  jobs_file="$DATA_DIR/cron/jobs.json"
  [ -f "$jobs_file" ] || return 0
  python3 - "$jobs_file" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    blob = json.load(fh)
jobs = blob.get("jobs") if isinstance(blob, dict) else blob
changed = 0
for row in jobs or []:
    if not isinstance(row, dict):
        continue
    model = str(row.get("model") or "")
    provider = str(row.get("provider") or "")
    if model in {"x-preview-f-free", "ox-alpha"} or provider == "opencode-zen":
        row["model"] = "deepseek-v4-flash"
        row["provider"] = "opencode-go"
        changed += 1
print(f"rewrote {changed} cron jobs onto opencode-go/deepseek-v4-flash")
if changed:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(blob, fh, indent=2)
        fh.write("\n")
PY
}

# Volume seeded on first boot may predate gateway.platforms.telegram in config.yaml.
export HERMES_HOME="$DATA_DIR"
if command -v hermes >/dev/null 2>&1; then
  # Seed config is source of truth for hybrid routing (Go flash → OpenRouter flash).
  if [ -f "$SEED_DIR/config.yaml" ]; then
    cp "$SEED_DIR/config.yaml" "$DATA_DIR/config.yaml"
  fi
  hermes config set model.provider opencode-go 2>/dev/null || true
  hermes config set model.default deepseek-v4-flash 2>/dev/null || true
  hermes config set auxiliary.compression.provider opencode-go 2>/dev/null || true
  hermes config set auxiliary.compression.model deepseek-v4-flash 2>/dev/null || true
  hermes config set auxiliary.web_extract.provider opencode-go 2>/dev/null || true
  hermes config set auxiliary.web_extract.model deepseek-v4-flash 2>/dev/null || true
  hermes config set delegation.provider opencode-go 2>/dev/null || true
  hermes config set delegation.model deepseek-v4-pro 2>/dev/null || true
  if [ -f "$SEED_DIR/config.yaml" ]; then
    cp "$SEED_DIR/config.yaml" "$DATA_DIR/config.yaml"
  fi
  retire_dead_ox_alpha
  if [ ! -f "$DATA_DIR/ox-alpha-promo.lock" ] && [ -x /usr/local/bin/model-routing-pulse.py ]; then
    python3 /usr/local/bin/model-routing-pulse.py --apply-lock-only || echo "WARNING: model-routing lock re-apply failed"
  fi
  if [ -x /usr/local/bin/seed-extra-go-keys.sh ]; then
    /usr/local/bin/seed-extra-go-keys.sh || echo "WARNING: seed-extra-go-keys.sh failed"
  fi
  if telegram_allowed="$(resolve_telegram_allowed_users)"; then
    upsert_env "TELEGRAM_ALLOWED_USERS" "$telegram_allowed"
    export TELEGRAM_ALLOWED_USERS="$telegram_allowed"
    if [ -x /usr/local/bin/sync-telegram-auth.sh ]; then
      /usr/local/bin/sync-telegram-auth.sh || echo "WARNING: sync-telegram-auth.sh failed"
    elif [ -f /seed/scripts/sync-telegram-auth.sh ]; then
      sh /seed/scripts/sync-telegram-auth.sh || echo "WARNING: sync-telegram-auth.sh failed"
    else
      echo "WARNING: sync-telegram-auth.sh not found — Telegram may block DMs"
    fi
  else
    echo "WARNING: Telegram enabled but TELEGRAM_ALLOWED_USERS is unset — DMs will be blocked until you set it in Railway or run repair-telegram.sh"
  fi
  hermes config set browser.cloud_provider browserbase 2>/dev/null || true
  hermes config set browser.inactivity_timeout 300 2>/dev/null || true
  hermes config set 'tools.toolsets' '["web","terminal","files","browser"]' 2>/dev/null || true
fi

if [ "${YOUTUBE_REMEDIATION_ON_DEPLOY:-}" = "1" ]; then
  echo "YOUTUBE_REMEDIATION_ON_DEPLOY=1 — starting live YouTube remediation in background"
  if [ -x /usr/local/bin/run-live-youtube-remediation.sh ]; then
    /usr/local/bin/run-live-youtube-remediation.sh &
  fi
fi
