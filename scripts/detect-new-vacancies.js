#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

// Compares events with vacancy > 0 against a persisted state file of
// previously-known-open slots (matched by `start`). Always overwrites the
// state file with the current open set, so a slot that closes and later
// reopens triggers a fresh notification.
// Returns { hasNew, newCount, newSlots, message }.
function detectNewVacancies(events, stateFile) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });

  const previous = fs.existsSync(stateFile)
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : [];
  const knownStarts = new Set(previous.map((e) => e.start));

  const currentOpen = events.filter((e) => (e.vacancy ?? 0) > 0);
  const newSlots = currentOpen.filter((e) => !knownStarts.has(e.start));

  console.error(`🔎 New open slots since last check: ${newSlots.length}`);

  fs.writeFileSync(stateFile, JSON.stringify(currentOpen, null, 2));

  if (newSlots.length === 0) {
    return { hasNew: false, newCount: 0, newSlots: [], message: null };
  }

  const message = newSlots
    .map((e) => `🎉 ${e.title}\n🗓️ ${e.start} → ${e.end}\n🎫 ${e.vacancy}/${e.capacity} spots`)
    .join('\n');

  return { hasNew: true, newCount: newSlots.length, newSlots, message };
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
