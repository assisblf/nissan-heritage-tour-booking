#!/usr/bin/env bash
# Compares the events that currently have vacancy > 0 against a persisted
# state file of previously-known-open slots. Any slot open now that wasn't
# open before is written to /tmp/new_slots.json and /tmp/notify_message.txt,
# and outputs has_new=true/false + new_count.
# The state file is always overwritten to reflect the current open set,
# so a slot that closes and later reopens triggers a fresh notification.
# Usage: detect-new-vacancies.sh <content_file> [state_file]
set -euo pipefail

CONTENT_FILE="$1"
STATE_FILE="${2:-state/available-slots.json}"

mkdir -p "$(dirname "$STATE_FILE")"

if [ -f "$STATE_FILE" ]; then
  PREVIOUS_FILE="$STATE_FILE"
else
  echo '[]' > /tmp/empty_state.json
  PREVIOUS_FILE="/tmp/empty_state.json"
fi

# Events with open vacancy in the current fetch
jq '[.[] | select((.vacancy // 0) > 0)]' "$CONTENT_FILE" > /tmp/current_open.json

# Currently-open slots that weren't in the previous known state (matched by start time)
jq -n --slurpfile current /tmp/current_open.json --slurpfile previous "$PREVIOUS_FILE" '
  ($previous[0] | map(.start)) as $known_starts |
  [$current[0][] | select(.start as $s | ($known_starts | index($s)) == null)]
' > /tmp/new_slots.json

NEW_COUNT=$(jq 'length' /tmp/new_slots.json)
echo "🔎 New open slots since last check: $NEW_COUNT"

# Always refresh the state to the current open set
cp /tmp/current_open.json "$STATE_FILE"

if [ "$NEW_COUNT" -gt 0 ]; then
  jq -r '.[] | "🎉 \(.title)\n🗓️ \(.start) → \(.end)\n🎫 \(.vacancy)/\(.capacity) vagas"' /tmp/new_slots.json \
    > /tmp/notify_message.txt
  {
    echo "has_new=true"
    echo "new_count=$NEW_COUNT"
  } >> "$GITHUB_OUTPUT"
else
  echo "has_new=false" >> "$GITHUB_OUTPUT"
fi
