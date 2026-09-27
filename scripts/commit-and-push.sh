#!/usr/bin/env bash
# Commits the updated snapshot + state files and pushes, retrying once via
# rebase on conflict (same behavior as the original inline script).
# Usage: commit-and-push.sh <timestamp>
set -euo pipefail

TIMESTAMP="$1"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

git add nissan-heritage-collection/ state/

if git diff --cached --quiet; then
  echo "ℹ️ No changes to commit."
  exit 0
fi

git commit -m "chore: fetch nissan events [epoch: ${TIMESTAMP}]"

# Try to push; on conflict, pull --rebase and retry once
if ! git push origin main; then
  echo "⚠️ Push failed — attempting rebase pull..."
  git fetch origin main
  if git rebase origin/main; then
    if ! git push origin main; then
      echo "❌ Push failed again after rebase. Showing conflicting file contents:"
      git diff HEAD origin/main -- nissan-heritage-collection/ state/ | cat
      for f in nissan-heritage-collection/*.json state/*.json; do
        [ -f "$f" ] && echo "--- $f ---" && cat "$f"
      done
      exit 1
    fi
  else
    echo "❌ Rebase failed. Showing conflicting file contents:"
    for f in $(git diff --name-only --diff-filter=U); do
      echo "--- $f ---"
      cat "$f"
    done
    git rebase --abort
    exit 1
  fi
fi

echo "✅ Pushed successfully."
