#!/usr/bin/env node
'use strict';

const fs = require('fs');

const TITLE = '🚗 New opening on the Nissan Heritage Tour!';
const LINK = 'https://assisblf.github.io/nissan-heritage-tour-booking';
const TRUNCATED_NOTE = '… (truncated, see the site for all slots)';

// Telegram caps messages at 4096 characters. JS string length counts
// UTF-16 units, which is what Telegram counts too.
const MAX_LENGTH = 4096;

// Builds the full message, dropping whole lines from the end of `message`
// when it's too long, so a Markdown link is never cut in half.
function buildMessage(message) {
  const wrap = (body) => `${TITLE}\n\n${body}\n\n🔗 ${LINK}`;
  let full = wrap(message);
  if (full.length <= MAX_LENGTH) return full;

  const lines = message.split('\n');
  while (lines.length && full.length > MAX_LENGTH) {
    lines.pop();
    full = wrap(`${lines.join('\n').trimEnd()}\n${TRUNCATED_NOTE}`);
  }
  return full;
}

// Sends `message` to Telegram when TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
// are set. Works the same locally (exported shell vars) or in CI (repo
// secrets). Never throws: a failed send is logged and reported in the
// return value, so one bad notification doesn't break the pipeline.
async function notify(message, env = process.env) {
  const fullMessage = buildMessage(message);

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error('⚠️ No notification channel configured — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.');
    console.error('--- message that would have been sent ---');
    console.error(fullMessage);
    return { sent: false, error: null };
  }

  let error = null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: fullMessage,
        parse_mode: 'Markdown',
        disable_web_page_preview: 'true',
      }),
    });
    console.error(`Telegram response: ${res.status}`);
    if (!res.ok) error = `Telegram HTTP ${res.status}: ${await res.text()}`;
  } catch (err) {
    error = `Telegram request failed: ${err.message}`;
  }

  if (error) {
    console.error(`❌ Notification failed: ${error}`);
    // Shows up as a warning annotation on the workflow run.
    if (env.GITHUB_ACTIONS) console.log(`::warning title=Notification failed::${error}`);
    return { sent: false, error };
  }

  return { sent: true, error: null };
}

module.exports = { notify };

if (require.main === module) {
  const [messageFile] = process.argv.slice(2);
  if (!messageFile) {
    console.error('Usage: notify.js <message_file>');
    process.exit(1);
  }
  notify(fs.readFileSync(messageFile, 'utf8'));
}
