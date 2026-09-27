#!/usr/bin/env bash
# Merges one fetched snapshot into its month's grouped JSON file, keyed by epoch.
# Usage: merge-snapshot.sh <output_file> <content_file> <timestamp>
set -euo pipefail

OUTPUT_FILE="$1"
CONTENT_FILE="$2"
TIMESTAMP="$3"

if [ -f "$OUTPUT_FILE" ]; then
  jq --arg ts "$TIMESTAMP" --slurpfile content "$CONTENT_FILE" \
    '. + {($ts): $content[0]}' "$OUTPUT_FILE" > /tmp/merged.json
else
  jq -n --arg ts "$TIMESTAMP" --slurpfile content "$CONTENT_FILE" \
    '{($ts): $content[0]}' > /tmp/merged.json
fi

mv /tmp/merged.json "$OUTPUT_FILE"
echo "✅ Saved entry $TIMESTAMP into $OUTPUT_FILE"
