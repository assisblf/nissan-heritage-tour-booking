#!/usr/bin/env node
'use strict';

// Runs the full pipeline locally: fetch → merge → detect → [commit] → notify.
// Does NOT commit/push by default — pass --commit to also do that.
//
// Usage: node scripts/run-local.js [--commit]

const { fetchEvents } = require('./fetch-events');
const { mergeSnapshot } = require('./merge-snapshot');
const { detectNewVacancies } = require('./detect-new-vacancies');
const { notify } = require('./notify');
const { commitAndPush } = require('./commit-and-push');

(async () => {
  const { events, errorPayload, success, timestamp, outputFile } = await fetchEvents();
  console.log(`→ fetched: success=${success}`);

  mergeSnapshot(outputFile, success ? events : errorPayload, timestamp);

  const detection = success ? detectNewVacancies(events, 'state/available-slots') : null;

  // Commit before notifying so a failed push doesn't leave a sent
  // notification without persisted state (which would cause a duplicate).
  if (process.argv.includes('--commit')) {
    commitAndPush(timestamp);
  } else {
    console.log('ℹ️ Skipping commit/push (pass --commit to also commit).');
  }

  if (detection) {
    const { hasNew, newCount, message } = detection;
    if (hasNew) {
      console.log(`🎉 ${newCount} new slot(s) — sending notification`);
      await notify(message);
    } else {
      console.log('ℹ️ No new slots since last run.');
    }
  }
})();
