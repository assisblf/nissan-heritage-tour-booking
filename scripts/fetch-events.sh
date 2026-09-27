#!/usr/bin/env bash
# Fetches the current month-window booking events from the Coubic API.
# Writes outputs consumed by the other scripts: output_file, timestamp,
# content_file (raw response or error payload) and success (true/false).
set -euo pipefail

# ── Timestamps ────────────────────────────────────────────────────────
# Current time as Unix epoch (used as the entry key)
TIMESTAMP=$(date -u +"%s")

# Current time in JST (UTC+9) — used only for the query window below
JST_NOW=$(TZ="Asia/Tokyo" date +"%Y-%m-%dT%H:%M:%S+09:00")

# First day of next month in JST
NEXT_MONTH_START=$(TZ="Asia/Tokyo" date -d "$(date -d 'today' +%Y-%m-01) +1 month" +"%Y-%m-01T00:00:00+09:00")

# Last moment of the last day of next month in JST
NEXT_MONTH_END=$(TZ="Asia/Tokyo" date -d "$(date -d 'today' +%Y-%m-01) +2 months -1 day" +"%Y-%m-%dT23:59:59+09:00")

echo "🕐 JST now: $JST_NOW"
echo "📅 Window start: $NEXT_MONTH_START"
echo "📅 Window end: $NEXT_MONTH_END"

# ── Month key for grouping (same month as the query window) ─────────────
MONTH_KEY=$(echo "$NEXT_MONTH_START" | cut -c1-7)
echo "🗂️ Month key: $MONTH_KEY"

# ── Build URL ─────────────────────────────────────────────────────────
ENCODED_START=$(echo "$NEXT_MONTH_START" | sed 's/+/%2B/g')
ENCODED_END=$(echo "$NEXT_MONTH_END" | sed 's/+/%2B/g')
URL="https://coubic.com/api/v2/merchants/nissan-heritage-tour/booking_events?renderer=fullcalendar&start=${ENCODED_START}&end=${ENCODED_END}"
echo "🌐 URL: $URL"

# ── Fetch ─────────────────────────────────────────────────────────────
OUTPUT_DIR="nissan-heritage-collection"
OUTPUT_FILE="${OUTPUT_DIR}/${MONTH_KEY}.json"
mkdir -p "$OUTPUT_DIR"

HTTP_CODE=$(curl -s -o /tmp/response_body.txt -w "%{http_code}" "$URL")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  CONTENT_FILE="/tmp/response_body.txt"
  SUCCESS="true"
  echo "✅ Fetched OK (HTTP $HTTP_CODE)"
else
  jq -n --argjson code "$HTTP_CODE" --arg payload "$(cat /tmp/response_body.txt)" \
    '{errorCode: $code, payload: $payload}' > /tmp/error_body.json
  CONTENT_FILE="/tmp/error_body.json"
  SUCCESS="false"
  echo "⚠️ Fetch failed (HTTP $HTTP_CODE)"
fi

{
  echo "output_file=$OUTPUT_FILE"
  echo "timestamp=$TIMESTAMP"
  echo "content_file=$CONTENT_FILE"
  echo "success=$SUCCESS"
} >> "$GITHUB_OUTPUT"
