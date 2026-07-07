#!/bin/sh
# One-shot YouTube copyright remediation on Railway.
# Trigger: set YOUTUBE_REMEDIATION_ON_DEPLOY=1 on Hermes service, redeploy, then unset.
set -eu

DATA_DIR="${HERMES_HOME:-/opt/data}"
WORKSPACE_DIR="$DATA_DIR/workspace/saahomes"
INV="$WORKSPACE_DIR/context/video-inventory.json"
LOG="$WORKSPACE_DIR/context/youtube-remediation.log"

mkdir -p "$WORKSPACE_DIR/context"
exec >>"$LOG" 2>&1
echo "=== YouTube remediation started $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

if [ ! -f "$INV" ]; then
  echo "Missing inventory: $INV"
  exit 1
fi

echo "Step 1: Emergency unlist (private) for urgent_unlist videos..."
python3 /usr/local/bin/set-youtube-privacy.py \
  --inventory "$INV" \
  --urgent-only \
  --privacy private \
  || echo "WARN: unlist step failed (check OAuth)"

echo "Step 2: Audit video project folders on volume..."
python3 /usr/local/bin/audit-video-volume.py > "$WORKSPACE_DIR/context/video-volume-audit.json" \
  || echo "WARN: volume audit failed"

echo "Step 3: Refresh channel inventory from YouTube..."
python3 /usr/local/bin/audit-youtube-channel.py --merge-inventory "$INV" \
  || echo "WARN: channel audit failed"

echo "Step 4: Ensure unique music tracks assigned..."
python3 /usr/local/bin/download-audiolibrary-tracks.py \
  --assign-inventory "$INV" \
  --spread 3 \
  || echo "WARN: music assign failed"

echo "Step 5: Remux + upload all videos with project files..."
python3 /usr/local/bin/run-video-music-remediation.py --inventory "$INV" \
  || echo "WARN: remediation batch had failures"

echo "Step 6: Delete duplicate uploads..."
python3 /usr/local/bin/set-youtube-privacy.py \
  --inventory "$INV" \
  --delete-duplicates \
  || echo "WARN: duplicate delete failed"

echo "=== YouTube remediation finished $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
