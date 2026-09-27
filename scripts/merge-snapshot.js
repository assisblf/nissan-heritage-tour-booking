#!/usr/bin/env node
'use strict';

const fs = require('fs');

// Merges `content` (events array or error payload) into outputFile, keyed
// by epoch timestamp. Creates the file if it doesn't exist yet.
function mergeSnapshot(outputFile, content, timestamp) {
  let data = {};
  if (fs.existsSync(outputFile)) {
    data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  }
  data[timestamp] = content;
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.error(`✅ Saved entry ${timestamp} into ${outputFile}`);
}

module.exports = { mergeSnapshot };

if (require.main === module) {
  const [outputFile, contentFile, timestamp] = process.argv.slice(2);
  if (!outputFile || !contentFile || !timestamp) {
    console.error('Usage: merge-snapshot.js <output_file> <content_file> <timestamp>');
    process.exit(1);
  }
  const content = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
  mergeSnapshot(outputFile, content, timestamp);
}
