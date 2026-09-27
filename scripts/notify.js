#!/usr/bin/env node
'use strict';

const fs = require('fs');

const TITLE = '🚗 New opening on the Nissan Heritage Tour!';
const LINK = 'https://assisblf.github.io/nissan-heritage-tour-booking';

// Sends `message` to whichever channel has its env vars set. Works the
// same locally (exported shell vars) or in CI (repo secrets) — the
// function itself doesn't know or care which.
async function notify(message, env = process.env) {
  const fullMessage = `${TITLE}\n\n${message}\n\n🔗 ${LINK}`;
  let sentAny = false;

  if (env.DISCORD_WEBHOOK_URL) {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: fullMessage }),
    });
    console.error(`Discord response: ${res.status}`);
    sentAny = true;
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ chat_id: env.TELEGRAM_CHAT_ID, text: fullMessage }),
    });
    console.error(`Telegram response: ${res.status}`);
    sentAny = true;
  }

  if (!sentAny) {
    console.error('⚠️ No notification channel configured — set DISCORD_WEBHOOK_URL or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.');
    console.error('--- message that would have been sent ---');
    console.error(fullMessage);
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
