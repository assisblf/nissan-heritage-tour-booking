#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Compares events with vacancy > 0 against persisted per-month state files
// (<stateDir>/YYYY-MM.json, keyed by each event's start month) of
// previously-known-open slots, matched by `url`, which carries the unique
// selected_slot id. A slot counts as new if it wasn't open before or its
// vacancy increased. Overwrites the state file of every month present in
// `events` with its current open set, so a slot that closes and later
// reopens triggers a fresh notification; other months are left untouched.
// Returns { hasNew, newCount, newSlots, message }.
function detectNewVacancies(events, stateDir) {
  fs.mkdirSync(stateDir, { recursive: true });

  const byMonth = new Map();
  for (const e of events) {
    const month = e.start.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(e);
  }

  const knownVacancy = new Map();
  const newSlots = [];
  for (const [month, monthEvents] of byMonth) {
    const stateFile = path.join(stateDir, `${month}.json`);
    const previous = fs.existsSync(stateFile)
      ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
      : [];
    for (const e of previous) knownVacancy.set(e.url, e.vacancy ?? 0);

    const currentOpen = monthEvents.filter((e) => (e.vacancy ?? 0) > 0);
    newSlots.push(...currentOpen.filter(
      (e) => !knownVacancy.has(e.url) || e.vacancy > knownVacancy.get(e.url),
    ));

    fs.writeFileSync(stateFile, JSON.stringify(currentOpen, null, 2));
  }

  console.error(`🔎 New or increased open slots since last check: ${newSlots.length}`);

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
      const was = knownVacancy.get(e.url) ?? 0;
      return `  • [${time}](https://coubic.com${e.url}) · ${e.vacancy}/${e.capacity} spots (was ${was})`;
    });
    return [`🗓️ ${weekday} ${m}/${d}`, ...lines].join('\n');
  }).join('\n\n');
}

module.exports = { detectNewVacancies };

if (require.main === module) {
  const [contentFile, stateDir = 'state/available-slots'] = process.argv.slice(2);
  if (!contentFile) {
    console.error('Usage: detect-new-vacancies.js <content_file> [state_dir]');
    process.exit(1);
  }
  const events = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  const result = detectNewVacancies(events, stateDir);

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
