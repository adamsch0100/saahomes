#!/bin/sh
# Rebuild Go + OpenRouter credentials on every boot so routing actually works:
#   1. This service's OPENCODE_GO_API_KEY (sticky / fill_first)
#   2. Other Go keys in OPENCODE_GO_API_KEYS
#   3. OpenRouter (config.yaml fallback_providers)
#
# Volume auth.json can keep a stale maxed Go key ahead of Railway env. We drop
# pooled opencode-go entries and re-add in the order above.

set -eu

env_dir="/var/run/s6/container_environment"
if [ -d "$env_dir" ]; then
  for key in OPENCODE_GO_API_KEY OPENCODE_GO_API_KEYS OPENROUTER_API_KEY; do
    if [ -f "$env_dir/$key" ]; then
      val="$(cat "$env_dir/$key")"
      export "${key}=${val}"
    fi
  done
fi

if ! command -v hermes >/dev/null 2>&1; then
  echo "seed-extra-go-keys: hermes CLI not on PATH — skip"
  exit 0
fi

normalize_key() {
  printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

# Drop stale pooled Go keys (max 20). Env-sourced primary is re-added next.
i=0
while [ "$i" -lt 20 ]; do
  if hermes auth remove opencode-go 1 >/dev/null 2>&1; then
    i=$((i + 1))
  else
    break
  fi
done

add_go() {
  key="$1"
  label="$2"
  key="$(normalize_key "$key")"
  [ -z "$key" ] && return 0
  if hermes auth add opencode-go --api-key "$key" --label "$label" >/dev/null 2>&1; then
    echo "seed-extra-go-keys: added opencode-go $label"
    return 0
  fi
  echo "WARNING: hermes auth add opencode-go failed for $label"
  return 0
}

primary="$(normalize_key "${OPENCODE_GO_API_KEY:-}")"
add_go "$primary" "primary"

added_extras=0
OLDIFS=$IFS
IFS=','
for raw in ${OPENCODE_GO_API_KEYS:-}; do
  IFS=$OLDIFS
  key="$(normalize_key "$raw")"
  [ -z "$key" ] && continue
  if [ -n "$primary" ] && [ "$key" = "$primary" ]; then
    IFS=','
    continue
  fi
  add_go "$key" "overflow"
  added_extras=$((added_extras + 1))
  IFS=','
done
IFS=$OLDIFS

or_key="$(normalize_key "${OPENROUTER_API_KEY:-}")"
if [ -n "$or_key" ]; then
  if hermes auth add openrouter --api-key "$or_key" --label "fallback" >/dev/null 2>&1; then
    echo "seed-extra-go-keys: added openrouter fallback"
  else
    echo "WARNING: hermes auth add openrouter failed (env OPENROUTER_API_KEY may still auto-seed)"
  fi
else
  echo "WARNING: OPENROUTER_API_KEY unset — Go quota exhaustion has no paid fallback"
fi

echo "seed-extra-go-keys: Go primary + $added_extras overflow key(s), then OpenRouter"
