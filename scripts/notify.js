#!/usr/bin/env node
'use strict';

const fs = require('fs');

const TITLE = '🚗 New opening on the Nissan Heritage Tour!';
const LINK = 'https://assisblf.github.io/nissan-heritage-tour-booking';

// Discord caps messages at 2000 chars (Telegram at 4096), so long slot
// lists are split on the blank lines between slots.
const MAX_LENGTH = 1900;

function splitMessage(text) {
  const chunks = [];
  let current = '';
  for (const block of text.split('\n\n')) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > MAX_LENGTH && current) {
      chunks.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Sends `message` to whichever channel has its env vars set. Works the
// same locally (exported shell vars) or in CI (repo secrets) — the
// function itself doesn't know or care which.
// Throws if any configured channel rejects the message, so the workflow
// stops before committing the updated state and the next run retries.
async function notify(message, env = process.env) {
  const fullMessage = `${TITLE}\n\n${message}\n\n🔗 ${LINK}`;
  let sentAny = false;
  const failures = [];

  const chunks = splitMessage(fullMessage);

  if (env.DISCORD_WEBHOOK_URL) {
    for (const chunk of chunks) {
      const res = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chunk }),
      });
      console.error(`Discord response: ${res.status}`);
      if (!res.ok) failures.push(`Discord HTTP ${res.status}: ${await res.text()}`);
    }
    sentAny = true;
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    for (const chunk of chunks) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ chat_id: env.TELEGRAM_CHAT_ID, text: chunk }),
      });
      console.error(`Telegram response: ${res.status}`);
      if (!res.ok) failures.push(`Telegram HTTP ${res.status}: ${await res.text()}`);
    }
    sentAny = true;
  }

  if (!sentAny) {
    console.error('⚠️ No notification channel configured — set DISCORD_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.');
    console.error('--- message that would have been sent ---');
    console.error(fullMessage);
  }

  if (failures.length) {
    throw new Error(`Notification failed:\n${failures.join('\n')}`);
  }

  return { sentAny };
}

module.exports = { notify };

if (require.main === module) {
  const [messageFile] = process.argv.slice(2);
  if (!messageFile) {
    console.error('Usage: notify.js <message_file>');
    process.exit(1);
  }
  const message = fs.readFileSync(messageFile, 'utf8');
  notify(message).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
