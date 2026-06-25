#!/bin/sh
# Run in Railway Console as root to fix GSC key ownership for the hermes user.
set -eu

KEY="/opt/data/credentials/gsc-service-account.json"
DIR="/opt/data/credentials"

if [ ! -f "$KEY" ]; then
  echo "Missing $KEY"
  exit 1
fi

if ! id hermes >/dev/null 2>&1; then
  echo "hermes user not found"
  exit 1
fi

chown hermes:hermes "$DIR" "$KEY"
chmod 700 "$DIR"
chmod 600 "$KEY"
ls -la "$DIR"

echo "OK — hermes can read $(basename "$KEY")"
