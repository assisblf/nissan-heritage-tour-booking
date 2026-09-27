#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit', ...opts });
}

function gitCapture(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// Commits state/ (snapshots + vacancy state) and pushes, retrying once
// via rebase on conflict.
// - Leaves your git identity alone if one is already configured (local
//   runs); only falls back to github-actions[bot] when none is set (a
//   fresh CI checkout).
// - Pushes to whatever branch is currently checked out.
// - Pass { noPush: true } to commit without pushing (useful for testing).
function commitAndPush(timestamp, { noPush = false } = {}) {
  if (!gitCapture(['config', 'user.name'])) {
    git(['config', 'user.name', 'github-actions[bot]'], { quiet: true });
    git(['config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], { quiet: true });
  }

  git(['add', 'state/']);

  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim();
  if (!staged) {
    console.error('ℹ️ No changes to commit.');
    return;
  }

  git(['commit', '-m', `chore: fetch nissan events [epoch: ${timestamp}]`]);

  if (noPush) {
    console.error('ℹ️ noPush set, skipping push.');
    return;
  }

  const branch = gitCapture(['symbolic-ref', '--short', 'HEAD']);
  if (!branch) {
    console.error('❌ Detached HEAD — cannot determine which branch to push.');
    process.exit(1);
  }

  try {
    git(['push', 'origin', branch]);
  } catch {
    console.error('⚠️ Push failed — attempting rebase pull...');
    try {
      git(['fetch', 'origin', branch]);
      git(['rebase', `origin/${branch}`]);
      git(['push', 'origin', branch]);
    } catch {
      console.error('❌ Could not sync with origin. Showing conflicting file contents (if any):');
      const conflicted = gitCapture(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean);
      for (const f of conflicted) {
        console.error(`--- ${f} ---`);
        try { console.error(fs.readFileSync(f, 'utf8')); } catch { /* ignore */ }
      }
      // Abort the rebase if one was started, so the repo is left clean.
      try { git(['rebase', '--abort']); } catch { /* nothing to abort */ }
      process.exit(1);
    }
  }

  console.error('✅ Pushed successfully.');
}

module.exports = { commitAndPush };

if (require.main === module) {
  const [timestamp, flag] = process.argv.slice(2);
  if (!timestamp) {
    console.error('Usage: commit-and-push.js <timestamp> [--no-push]');
    process.exit(1);
  }
  commitAndPush(timestamp, { noPush: flag === '--no-push' });
}
