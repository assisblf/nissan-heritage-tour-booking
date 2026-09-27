#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function pad(n) {
  return String(n).padStart(2, '0');
}

function jstStamp(y, m, d, h, mi, s) {
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}+09:00`;
}

// Current date in the Asia/Tokyo calendar (JST has no DST, so this is a
// fixed +09:00 offset — no timezone library needed).
function currentJSTDate() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

// Computes the next-month JST query window using UTC as a pure calendar
// calculator (no real timezone conversion happening — the numbers ARE
// the JST wall-clock values, just labeled with +09:00).
function nextMonthWindow() {
  const { year, month } = currentJSTDate(); // month is 1-based "this month"
  const start = new Date(Date.UTC(year, month, 1)); // month (0-based) == next month
  const end = new Date(Date.UTC(year, month + 1, 0)); // day 0 == last day of next month

  const sy = start.getUTCFullYear();
  const sm = start.getUTCMonth() + 1;
  const sd = start.getUTCDate();
  const ey = end.getUTCFullYear();
  const em = end.getUTCMonth() + 1;
  const ed = end.getUTCDate();

  return {
    startStamp: jstStamp(sy, sm, sd, 0, 0, 0),
    endStamp: jstStamp(ey, em, ed, 23, 59, 59),
    monthKey: `${sy}-${pad(sm)}`,
  };
}

function buildUrl(startStamp, endStamp) {
  // Match the original script's encoding exactly: only "+" is escaped.
  const encStart = startStamp.replace(/\+/g, '%2B');
  const encEnd = endStamp.replace(/\+/g, '%2B');
  return `https://coubic.com/api/v2/merchants/nissan-heritage-tour/booking_events?renderer=fullcalendar&start=${encStart}&end=${encEnd}`;
}

// Fetches the current window. Returns:
//   { events, errorPayload, success, timestamp, outputFile, monthKey }
// `events` is the parsed array on success; `errorPayload` is
// { errorCode, payload } on failure. Exactly one of the two is set.
async function fetchEvents() {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const { startStamp, endStamp, monthKey } = nextMonthWindow();

  console.error(`📅 Window start: ${startStamp}`);
  console.error(`📅 Window end: ${endStamp}`);
  console.error(`🗂️ Month key: ${monthKey}`);

  const url = buildUrl(startStamp, endStamp);
  console.error(`🌐 URL: ${url}`);

  const outputDir = 'nissan-heritage-collection';
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${monthKey}.json`);

  let response;
  let bodyText;
  try {
    response = await fetch(url);
    bodyText = await response.text();
  } catch (err) {
    console.error(`⚠️ Fetch failed (network error): ${err.message}`);
    return {
      events: null,
      errorPayload: { errorCode: 0, payload: err.message },
      success: false,
      timestamp,
      outputFile,
      monthKey,
    };
  }

  if (response.ok) {
    console.error(`✅ Fetched OK (HTTP ${response.status})`);
    return {
      events: JSON.parse(bodyText),
      errorPayload: null,
      success: true,
      timestamp,
      outputFile,
      monthKey,
    };
  }

  console.error(`⚠️ Fetch failed (HTTP ${response.status})`);
  return {
    events: null,
    errorPayload: { errorCode: response.status, payload: bodyText },
    success: false,
    timestamp,
    outputFile,
    monthKey,
  };
}

module.exports = { fetchEvents };

// CLI mode: used by the GitHub Actions workflow. Writes the fetched
// content to a temp file (crossing a process/step boundary needs a
// file path) and prints key=value lines to stdout for $GITHUB_OUTPUT.
// Logs go to stderr. Running locally works the same way — or skip this
// entirely and call fetchEvents() directly, as run-local.js does.
if (require.main === module) {
  fetchEvents().then((result) => {
    const content = result.success ? result.events : result.errorPayload;
    const contentFile = path.join(os.tmpdir(), `nissan-content-${result.timestamp}.json`);
    fs.writeFileSync(contentFile, JSON.stringify(content));

    console.log(`output_file=${result.outputFile}`);
    console.log(`timestamp=${result.timestamp}`);
    console.log(`content_file=${contentFile}`);
    console.log(`success=${result.success}`);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
