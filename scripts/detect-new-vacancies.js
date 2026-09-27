#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Compares events with vacancy > 0 against a persisted state file of
// previously-known-open slots (matched by `url`, which carries the unique
// selected_slot id). A slot counts as new if it wasn't open before or its
// vacancy increased. Always overwrites the state file with the current open
// set, so a slot that closes and later reopens triggers a fresh notification.
// Returns { hasNew, newCount, newSlots, message }.
function detectNewVacancies(events, stateFile) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });

  const previous = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : [];
  const knownVacancy = new Map(previous.map((e) => [e.url, e.vacancy ?? 0]));

  const currentOpen = events.filter((e) => (e.vacancy ?? 0) > 0);
  const newSlots = currentOpen.filter(
    (e) => !knownVacancy.has(e.url) || e.vacancy > knownVacancy.get(e.url),
  );

  console.error(`🔎 New or increased open slots since last check: ${newSlots.length}`);

  fs.writeFileSync(stateFile, JSON.stringify(currentOpen, null, 2));

  if (newSlots.length === 0) {
    return { hasNew: false, newCount: 0, newSlots: [], message: null };
  }

  const message = formatMessage(newSlots, knownVacancy);

  return { hasNew: true, newCount: newSlots.length, newSlots, message };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Groups slots by day (blank line between days, so notify.js splits long
// messages on day boundaries). Times are Markdown links, which both Discord
// and Telegram (parse_mode=Markdown) render as clickable text.
// `start`/`end` look like "2026-10-03 10:00".
function formatMessage(slots, knownVacancy) {
  const byDay = new Map();
  for (const e of [...slots].sort((a, b) => a.start.localeCompare(b.start))) {
    const day = e.start.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(e);
  }

  return [...byDay].map(([day, daySlots]) => {
    const [y, m, d] = day.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    const lines = daySlots.map((e) => {
      const time = `${e.start.slice(11)}–${e.end.slice(11)}`;
      const status = knownVacancy.has(e.url) ? `(was ${knownVacancy.get(e.url)})` : '🆕';
      return `  • [${time}](https://coubic.com${e.url}) · ${e.vacancy}/${e.capacity} spots ${status}`;
    });
    return [`🗓️ ${weekday} ${m}/${d}`, ...lines].join('\n');
  }).join('\n\n');
}

module.exports = { detectNewVacancies };

if (require.main === module) {
  const [contentFile, stateFile = 'state/available-slots.json'] = process.argv.slice(2);
  if (!contentFile) {
    console.error('Usage: detect-new-vacancies.js <content_file> [state_file]');
    process.exit(1);
  }
  const events = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  const result = detectNewVacancies(events, stateFile);

  if (result.hasNew) {
    const messageFile = path.join(os.tmpdir(), `nissan-message-${Date.now()}.txt`);
    fs.writeFileSync(messageFile, result.message);
    console.log('has_new=true');
    console.log(`new_count=${result.newCount}`);
    console.log(`message_file=${messageFile}`);
  } else {
    console.log('has_new=false');
  }
}
