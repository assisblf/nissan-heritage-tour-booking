#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// JST calendar date ("YYYY-MM-DD") of an epoch timestamp, in seconds.
// JST has no DST, so shifting by +9h and reading UTC fields is exact.
function jstDay(timestamp) {
  return new Date((Number(timestamp) + 9 * 3600) * 1000).toISOString().slice(0, 10);
}

// Merges `content` (events array or error payload) into
// monthDir/<JST day of timestamp>.json, keyed by epoch timestamp. Files are
// split per day (and written without indentation) to stay under GitHub's
// 100 MB file limit. monthDir/index.json lists the day files so the viewer
// can find them. Creates files as needed.
function mergeSnapshot(monthDir, content, timestamp) {
  fs.mkdirSync(monthDir, { recursive: true });
  const dayFile = `${jstDay(timestamp)}.json`;
  const outputFile = path.join(monthDir, dayFile);

  let data = {};
  if (fs.existsSync(outputFile)) {
    data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  }
  data[timestamp] = content;
  fs.writeFileSync(outputFile, JSON.stringify(data));

  const indexFile = path.join(monthDir, 'index.json');
  const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
  if (!index.includes(dayFile)) {
    index.push(dayFile);
    index.sort();
    fs.writeFileSync(indexFile, JSON.stringify(index));
  }

  console.error(`✅ Saved entry ${timestamp} into ${outputFile}`);
}

module.exports = { mergeSnapshot };

if (require.main === module) {
  const [monthDir, contentFile, timestamp] = process.argv.slice(2);
  if (!monthDir || !contentFile || !timestamp) {
    console.error('Usage: merge-snapshot.js <month_dir> <content_file> <timestamp>');
    process.exit(1);
  }
  const content = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  mergeSnapshot(monthDir, content, timestamp);
}
