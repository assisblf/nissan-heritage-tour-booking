#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchEvents } = require('./fetch-events');
const { mergeSnapshot } = require('./merge-snapshot');
const { detectNewVacancies } = require('./detect-new-vacancies');

// Fetches every tracked month, merges each response into its snapshot file,
// then runs vacancy detection once over the events of all months that were
// fetched successfully (so one run sends at most one notification).
// Returns { timestamp, detection }; `detection` is null when no month was
// fetched successfully.
async function fetchAndDetect(stateDir = 'state/available-slots') {
  const { timestamp, months } = await fetchEvents();

  for (const m of months) {
    mergeSnapshot(m.outputFile, m.success ? m.events : m.errorPayload, timestamp);
  }

  const ok = months.filter((m) => m.success);
  const detection = ok.length
    ? detectNewVacancies(ok.flatMap((m) => m.events), stateDir)
    : null;

  return { timestamp, detection };
}

module.exports = { fetchAndDetect };

// CLI mode: used by the GitHub Actions workflow. Writes the notification
// message to a temp file (crossing a step boundary needs a file path) and
// prints key=value lines to stdout for $GITHUB_OUTPUT. Logs go to stderr.
if (require.main === module) {
  fetchAndDetect().then(({ timestamp, detection }) => {
    console.log(`timestamp=${timestamp}`);
    if (detection?.hasNew) {
      const messageFile = path.join(os.tmpdir(), `nissan-message-${timestamp}.txt`);
      fs.writeFileSync(messageFile, detection.message);
      console.log('has_new=true');
      console.log(`new_count=${detection.newCount}`);
      console.log(`message_file=${messageFile}`);
    } else {
      console.log('has_new=false');
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
