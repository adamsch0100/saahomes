#!/bin/sh
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
SEED_DIR="/seed"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/config.yaml" ] && [ -f "$SEED_DIR/config.yaml" ]; then
  echo "Seeding Hermes data directory at $DATA_DIR"
  cp -R "$SEED_DIR/." "$DATA_DIR/"
fi

WORKSPACE_DIR="$DATA_DIR/workspace/saahomes"
mkdir -p "$WORKSPACE_DIR/context"
mkdir -p "$WORKSPACE_DIR/outreach/pending"
mkdir -p "$WORKSPACE_DIR/outreach/sent"
mkdir -p "$WORKSPACE_DIR/outreach/skipped"

if [ -f "$DATA_DIR/AGENTS.md" ] && [ ! -f "$WORKSPACE_DIR/AGENTS.md" ]; then
  cp "$DATA_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi

if [ -f "$SEED_DIR/workspace/saahomes/context/automation-registry.md" ] && [ ! -f "$WORKSPACE_DIR/context/automation-registry.md" ]; then
  cp -R "$SEED_DIR/workspace/saahomes/." "$WORKSPACE_DIR/"
fi

if [ ! -f "$DATA_DIR/.saahomes-bootstrapped" ]; then
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$DATA_DIR/.saahomes-bootstrapped"
  echo "First boot: run AGENTS.md first-boot checklist and install cron jobs from automation-registry.md"
fi

ENV_FILE="$DATA_DIR/.env"
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
append_env "GITHUB_TOKEN" "${GITHUB_TOKEN:-}"
append_env "GITHUB_REPO" "${GITHUB_REPO:-adamsch0100/saahomes}"
append_env "GA4_PROPERTY_ID" "${GA4_PROPERTY_ID:-G-CB5GL0P3EZ}"
append_env "OUTREACH_APPROVAL_REQUIRED" "${OUTREACH_APPROVAL_REQUIRED:-true}"
append_env "AUTO_MERGE_SEO_PRS" "${AUTO_MERGE_SEO_PRS:-true}"

# Volume seeded on first boot may predate platforms.telegram in config.yaml.
export HERMES_HOME="$DATA_DIR"
if command -v hermes >/dev/null 2>&1; then
  hermes config set platforms.telegram.enabled true 2>/dev/null || true
fi
