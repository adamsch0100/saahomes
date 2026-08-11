#!/bin/sh
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
SEED_DIR="/seed"

mkdir -p "$DATA_DIR"

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

ENV_FILE="$DATA_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ENV_FILE"
  set +a
  import_s6_container_env
fi

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

WORKSPACE_DIR="$DATA_DIR/workspace/listlogic"
mkdir -p "$WORKSPACE_DIR/context"
mkdir -p "$WORKSPACE_DIR/outreach/pending"
mkdir -p "$WORKSPACE_DIR/outreach/sent"
mkdir -p "$WORKSPACE_DIR/outreach/skipped"
mkdir -p "$WORKSPACE_DIR/prospects"
mkdir -p "$DATA_DIR/browser-sessions/intel"

# Hermes gateway runs as user `hermes` — workspace must be writable or CRM/outreach writes fail.
if id hermes >/dev/null 2>&1; then
  chown -R hermes:hermes "$WORKSPACE_DIR" "$DATA_DIR/browser-sessions" 2>/dev/null || true
  chmod -R u+rwX "$WORKSPACE_DIR" 2>/dev/null || true
fi

if [ -f "$DATA_DIR/AGENTS.md" ] && [ ! -f "$WORKSPACE_DIR/AGENTS.md" ]; then
  cp "$DATA_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi

if [ -d "$SEED_DIR/workspace/listlogic/context" ]; then
  cp -R "$SEED_DIR/workspace/listlogic/context/." "$WORKSPACE_DIR/context/"
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
if [ -d "$SEED_DIR/skills" ]; then
  mkdir -p "$DATA_DIR/skills"
  cp -R "$SEED_DIR/skills/." "$DATA_DIR/skills/"
fi

if [ ! -f "$DATA_DIR/.listlogic-bootstrapped" ]; then
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DATA_DIR/.listlogic-bootstrapped"
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

upsert_env "OPENCODE_GO_API_KEY" "${OPENCODE_GO_API_KEY:-}"
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
# Must be the ListLogic WEBSITE service ID — never this Hermes service.
upsert_env "RAILWAY_SERVICE_ID" "${RAILWAY_SERVICE_ID:-}"
append_env "GA4_PROPERTY_ID" "${GA4_PROPERTY_ID:-}"
append_env "GA4_MEASUREMENT_ID" "${GA4_MEASUREMENT_ID:-}"
append_env "OUTREACH_APPROVAL_REQUIRED" "${OUTREACH_APPROVAL_REQUIRED:-true}"
append_env "AUTO_MERGE_SEO_PRS" "${AUTO_MERGE_SEO_PRS:-true}"
upsert_env "BROWSERBASE_API_KEY" "${BROWSERBASE_API_KEY:-}"
upsert_env "BROWSERBASE_PROJECT_ID" "${BROWSERBASE_PROJECT_ID:-}"
append_env "BROWSER_INACTIVITY_TIMEOUT" "${BROWSER_INACTIVITY_TIMEOUT:-300}"
upsert_env "OUTREACH_SMTP_HOST" "${OUTREACH_SMTP_HOST:-}"
upsert_env "OUTREACH_SMTP_USER" "${OUTREACH_SMTP_USER:-}"
upsert_env "OUTREACH_SMTP_PASSWORD" "${OUTREACH_SMTP_PASSWORD:-}"
append_env "OUTREACH_EMAIL_TO" "${OUTREACH_EMAIL_TO:-adam@saahomes.com}"
append_env "LISTLOGIC_SITE_URL" "${LISTLOGIC_SITE_URL:-https://listlogic.homes}"

if id hermes >/dev/null 2>&1; then
  chown hermes:hermes "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$ENV_FILE" 2>/dev/null || true
fi

if browserbase_ready; then
  echo "Browserbase: credentials present — market/competitor intel only (NOT outreach send)"
else
  echo "Browserbase: not configured — optional for browse.sh intel"
fi

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

if [ -f "$GSC_KEY_FILE" ] && id hermes >/dev/null 2>&1; then
  chown hermes:hermes "$CREDENTIALS_DIR" "$GSC_KEY_FILE"
  chmod 700 "$CREDENTIALS_DIR"
  chmod 600 "$GSC_KEY_FILE"
fi

if [ -n "${GITHUB_TOKEN:-}" ] && [ ! -d "$WORKSPACE_DIR/.git" ]; then
  REPO="${GITHUB_REPO:-adamsch0100/saahomes}"
  echo "Cloning github.com/${REPO} for autonomous ListLogic work"
  CLONE_TMP="$(mktemp -d)"
  git clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git" "$CLONE_TMP"
  # Prefer listlogic/ subtree as working context if present
  if [ -d "$CLONE_TMP/listlogic" ]; then
    mkdir -p "$CLONE_TMP/listlogic/hermes-workspace-context"
    if [ -d "$WORKSPACE_DIR/context" ]; then
      cp -R "$WORKSPACE_DIR/context/." "$CLONE_TMP/listlogic/hermes-workspace-context/" 2>/dev/null || true
    fi
  fi
  if [ -d "$WORKSPACE_DIR/context" ]; then
    mkdir -p "$CLONE_TMP/context"
    cp -R "$WORKSPACE_DIR/context/." "$CLONE_TMP/context/"
  fi
  rm -rf "$WORKSPACE_DIR"
  mv "$CLONE_TMP" "$WORKSPACE_DIR"
  mkdir -p "$WORKSPACE_DIR/context"
  if [ -d "$SEED_DIR/workspace/listlogic/context" ]; then
    cp -R "$SEED_DIR/workspace/listlogic/context/." "$WORKSPACE_DIR/context/"
  fi
  git -C "$WORKSPACE_DIR" config user.email "hermes@listlogic.homes"
  git -C "$WORKSPACE_DIR" config user.name "ListLogic Hermes"
fi

export HERMES_HOME="$DATA_DIR"
if command -v hermes >/dev/null 2>&1; then
  # Pin OpenCode Go models every boot (volume may retain upstream defaults like claude-opus).
  # Adam lock: flash daily · pro next · kimi-k3 super only.
  hermes config set model.provider opencode-go 2>/dev/null || true
  hermes config set model.default mimo-v2.5 2>/dev/null || true
  # NOTE: After OpenCode China opt-in for DeepSeek, change seed config + this line to deepseek-v4-flash.  hermes config set auxiliary.compression.provider opencode-go 2>/dev/null || true
  hermes config set auxiliary.compression.model deepseek-v4-flash 2>/dev/null || true
  hermes config set auxiliary.web_extract.provider opencode-go 2>/dev/null || true
  hermes config set auxiliary.web_extract.model deepseek-v4-flash 2>/dev/null || true
  hermes config set delegation.provider opencode-go 2>/dev/null || true
  hermes config set delegation.model deepseek-v4-pro 2>/dev/null || true
  # Prefer seed config model block if present (keeps YAML authoritative).
  if [ -f "$SEED_DIR/config.yaml" ]; then
    cp "$SEED_DIR/config.yaml" "$DATA_DIR/config.yaml"
  fi
  if telegram_allowed="$(resolve_telegram_allowed_users)"; then
    upsert_env "TELEGRAM_ALLOWED_USERS" "$telegram_allowed"
    export TELEGRAM_ALLOWED_USERS="$telegram_allowed"
    if [ -x /usr/local/bin/sync-telegram-auth.sh ]; then
      /usr/local/bin/sync-telegram-auth.sh || echo "WARNING: sync-telegram-auth.sh failed"
    else
      echo "WARNING: sync-telegram-auth.sh not found — Telegram may block DMs"
    fi
  else
    echo "WARNING: Telegram enabled but TELEGRAM_ALLOWED_USERS is unset — DMs blocked until set"
  fi
  hermes config set browser.cloud_provider browserbase 2>/dev/null || true
  hermes config set browser.inactivity_timeout 300 2>/dev/null || true
  hermes config set 'tools.toolsets' '["web","terminal","files","browser"]' 2>/dev/null || true
fi
