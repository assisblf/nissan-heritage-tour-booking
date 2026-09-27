'use strict';

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

// Months fetched on every run, as offsets from the current JST month:
// 0 = current month, 1 = next month. Each month is its own request, since
// the API rejects windows longer than ~7 weeks (HTTP 400).
const MONTH_OFFSETS = [0, 1];

// Computes the JST query window for the month `offset` months from now,
// using UTC as a pure calendar calculator (no real timezone conversion
// happening — the numbers ARE the JST wall-clock values, just labeled
// with +09:00).
function monthWindow(offset) {
  const { year, month } = currentJSTDate(); // month is 1-based "this month"
  const start = new Date(Date.UTC(year, month - 1 + offset, 1));
  const end = new Date(Date.UTC(year, month + offset, 0)); // day 0 == last day of the target month

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

// Fetches one month's window. Returns:
//   { events, errorPayload, success, outputFile, monthKey }
// `events` is the parsed array on success; `errorPayload` is
// { errorCode, payload } on failure. Exactly one of the two is set.
async function fetchMonth(offset) {
  const { startStamp, endStamp, monthKey } = monthWindow(offset);

  console.error(`🗂️ Month key: ${monthKey}`);
  console.error(`📅 Window start: ${startStamp}`);
  console.error(`📅 Window end: ${endStamp}`);

  const url = buildUrl(startStamp, endStamp);
  console.error(`🌐 URL: ${url}`);

  const outputFile = path.join('state/snapshots', `${monthKey}.json`);

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
      outputFile,
      monthKey,
    };
  }

  let events = null;
  if (response.ok) {
    try {
      events = JSON.parse(bodyText);
    } catch {
      // Leave events null; handled as a failure below.
    }
  }

  if (Array.isArray(events)) {
    console.error(`✅ Fetched OK (HTTP ${response.status})`);
    return { events, errorPayload: null, success: true, outputFile, monthKey };
  }

  console.error(response.ok
    ? `⚠️ Unexpected response body (HTTP ${response.status}) — expected a JSON array`
    : `⚠️ Fetch failed (HTTP ${response.status})`);
  return {
    events: null,
    errorPayload: { errorCode: response.status, payload: bodyText },
    success: false,
    outputFile,
    monthKey,
  };
}

// Fetches every month in MONTH_OFFSETS. Returns { timestamp, months },
// where `months` holds one fetchMonth() result per month. All months share
// the same timestamp, so one run is one snapshot entry per month file.
async function fetchEvents() {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const months = [];
  for (const offset of MONTH_OFFSETS) months.push(await fetchMonth(offset));
  return { timestamp, months };
}

module.exports = { fetchEvents };
