#!/usr/bin/env node
'use strict';

// Runs the full pipeline locally: fetch → merge → detect → [commit] → notify.
// Does NOT commit/push by default — pass --commit to also do that.
//
// Usage: node scripts/run-local.js [--commit]

const { fetchAndDetect } = require('./fetch-and-detect');
const { notify } = require('./notify');
const { commitAndPush } = require('./commit-and-push');

(async () => {
  const { timestamp, detection } = await fetchAndDetect();

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
