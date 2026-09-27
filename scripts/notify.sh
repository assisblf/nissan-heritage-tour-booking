#!/usr/bin/env bash
# Sends a notification for newly-opened slots to Discord and/or Telegram,
# whichever secrets are configured in the environment. Silently skips a
# channel whose secrets aren't set.
# Usage: notify.sh <message_file>
# Env:   DISCORD_WEBHOOK_URL
#        TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
set -euo pipefail

MESSAGE_FILE="$1"
TITLE="🚗 Nova vaga no Nissan Heritage Tour!"
LINK="https://assisblf.github.io/nissan-heritage-tour-booking"

BODY=$(cat "$MESSAGE_FILE")
FULL_MESSAGE="${TITLE}

${BODY}

🔗 ${LINK}"

SENT_ANY="false"

if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
  jq -n --arg content "$FULL_MESSAGE" '{content: $content}' \
    | curl -s -o /dev/null -w "Discord response: %{http_code}\n" \
        -X POST -H "Content-Type: application/json" -d @- "$DISCORD_WEBHOOK_URL"
  SENT_ANY="true"
fi

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  curl -s -o /dev/null -w "Telegram response: %{http_code}\n" \
    -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${FULL_MESSAGE}"
  SENT_ANY="true"
fi

if [ "$SENT_ANY" = "false" ]; then
  echo "⚠️ No notification channel configured — set DISCORD_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID as repo secrets."
  echo "--- message that would have been sent ---"
  echo "$FULL_MESSAGE"
fi
