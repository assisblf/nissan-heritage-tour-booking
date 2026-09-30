# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Scrapes the Coubic booking API for the Nissan Heritage Tour, archives every response as JSON under `state/`, detects newly opened slots, and sends a Telegram notification. A static viewer (`index.html`, served by GitHub Pages at https://assisblf.github.io/nissan-heritage-tour-booking) browses the snapshot history.

Plain Node (v24 in CI, uses built-in `fetch`), CommonJS, **no dependencies, no `package.json`, no build, no linter, no tests**.

## Commands

```sh
node scripts/run-local.js            # full pipeline locally: fetch → merge → detect → notify (no commit)
node scripts/run-local.js --commit   # also commit + push state/ (to the current branch)
node scripts/commit-and-push.js <epoch> --no-push   # commit state/ without pushing
node scripts/detect-new-vacancies.js <events.json> [state_dir]   # run detection on a saved response
node scripts/notify.js <message_file>   # send (or, without Telegram env vars, just print) a message
```

Notifications need `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`; without them `notify` prints the message instead of sending it. Note that running the pipeline locally **mutates `state/`** (snapshots and `available-slots`), which affects what the next CI run considers "new".

To try the viewer, serve the repo over HTTP (e.g. `python3 -m http.server`); `fetch` doesn't work from `file://`.

## Architecture

Each script exports a function and also has a `require.main === module` CLI mode. `fetch-and-detect.js` composes `fetch-events` → `merge-snapshot` → `detect-new-vacancies`; `run-local.js` and the GitHub workflow both drive that same composition.

- **Trigger:** `.github/workflows/fetch-nissan-events.yml` is `workflow_dispatch` only, dispatched externally by cron-job.org (GitHub `schedule` was unreliable). Runs are serialized via `concurrency`.
- **CI step protocol:** in CLI mode, scripts write `key=value` lines to **stdout** (appended to `$GITHUB_OUTPUT`: `timestamp`, `has_new`, `new_count`, `message_file`) and all logs go to **stderr**. Keep that split when adding output. The notification text crosses step boundaries via a temp file.
- **Ordering matters:** commit/push happens *before* notify, so a failed push means the next run re-detects the same slots instead of the user getting a notification whose state was never persisted. Notify failures never fail the run.
- **Fetch windows:** `MONTH_OFFSETS = [0, 1]` (current + next JST month), one request per month because the API returns HTTP 400 for windows longer than ~7 weeks. JST math is done with UTC `Date` as a calendar calculator (JST has no DST). The API never returns past slots, so current-month snapshots shrink to `[]` near month end.
- **`state/snapshots/YYYY-MM.json`** — keyed by the *query window's* month; an object of `{ "<epoch>": <raw events array | { errorCode, payload }> }`. All months in one run share the same epoch. `errorCode: 0` means network error. `[]` means dates not yet published. The viewer skips `[]` snapshots but shows error ones.
- **`state/available-slots/YYYY-MM.json`** — keyed by each *event's start month*; the last known set of open (`vacancy > 0`) slots. Slots are identified by `url` (contains the unique `selected_slot` id). A slot is "new" if it wasn't open before or its vacancy increased. Only months present in the current response are overwritten, so a slot that closes and reopens re-notifies.
- **Commits:** `commit-and-push.js` stages only `state/`, commits as `chore: fetch nissan events [epoch: <ts>]`, and retries a failed push once via fetch + rebase. These bot commits dominate `git log`.
- **Telegram message:** `parse_mode=Markdown` with slot times as links to Coubic; `notify.js` truncates by whole lines to stay under the 4096-char limit so links aren't cut.
- **Viewer:** `index.html` is a single self-contained file (inline CSS/JS, no libraries) that loads `./state/snapshots/<month>.json` and renders a timestamp slider + calendar.
