# nissan-heritage-tour-booking

This is a project that polls and snapshots data from Nissan Heritage tour booking and presents it in the following page:
https://assisblf.github.io/nissan-heritage-tour-booking

It works as an automated data collector for the **Nissan Heritage Tour** booking events, powered by a GitHub Actions workflow that polls the [Coubic](https://coubic.com) API every 30 minutes and snapshots the responses as JSON, grouped by month. Includes a static HTML viewer to browse vacancy history on a calendar.

---

## How it works

A scheduled workflow (`.github/workflows/fetch-nissan-events.yml`) runs every 30 minutes and:

1. **Fetches** the booking events from the Coubic API for the Nissan Heritage Tour (window: next calendar month, JST)
2. **Merges** the response into `nissan-heritage-collection/<YYYY-MM>.json`, keyed by the Unix epoch of the request — `<YYYY-MM>` is the same target month used in the query window
3. **Commits and pushes** the updated file to `main` automatically

If the API returns an error, that snapshot's value is saved in this format instead of the raw payload:

```json
{
  "errorCode": 404,
  "payload": "..."
}
```

---

## Data format

Each monthly file is a JSON object keyed by Unix epoch (request time), with the raw Coubic response (or error object) as the value:

```json
{
  "1749254400": [
    {
      "title": "８月見学会【Heritage Collection Tour in Aug.】",
      "vacancy": 0,
      "capacity": 40,
      "full": true,
      "start": "2026-08-04 10:00",
      "end": "2026-08-04 11:30",
      "...": "..."
    }
  ],
  "1749256200": {
    "errorCode": 500,
    "payload": "..."
  }
}
```

An empty array (`[]`) means the tour dates for that month hadn't been disclosed yet at that snapshot.

---

## Repository structure

```
nissan-heritage-tour-booking/
├── .github/
│   └── workflows/
│       └── fetch-nissan-events.yml   # Scheduled workflow
├── nissan-heritage-collection/
│   ├── 2026-08.json         # All snapshots targeting Aug 2026
│   ├── 2026-09.json
│   └── ...
├── 1_merge_files_by_month.py  # One-off migration script (old per-timestamp files → grouped format)
├── heritage-watch.html        # Static viewer: month picker + timestamp slider + calendar
└── README.md
```

---

## Data source

| Field    | Value |
|----------|-------|
| Provider | [Coubic](https://coubic.com) |
| Merchant | `nissan-heritage-tour` |
| Endpoint | `/api/v2/merchants/nissan-heritage-tour/booking_events` |
| Renderer | `fullcalendar` |
| Window   | First → last day of **next calendar month** (JST, dynamic) |

The date window is computed dynamically at runtime in JST (UTC+9):

- **`start`** — `YYYY-MM-01T00:00:00+09:00` (first day of next month)
- **`end`** — `YYYY-MM-<last>T23:59:59+09:00` (last day of next month, accounting for month length)

So on any given run the URL looks like:

```
https://coubic.com/api/v2/merchants/nissan-heritage-tour/booking_events
  ?renderer=fullcalendar
  &start=YYYY-MM-01T00:00:00%2B09:00
  &end=YYYY-MM-<last>T23:59:59%2B09:00
```

The computed window (`JST now`, `Window start`, `Window end`) is printed at the top of each run's log. The same `YYYY-MM` derived for the window is used as the output filename, and each entry inside that file is keyed by the Unix epoch of the request — so entries stay sortable and unambiguous regardless of timezone.

---

## Viewing the data

Open `heritage-watch.html` (served over http/https, e.g. via GitHub Pages — `fetch` won't work from a local `file://` path) to:

1. Pick a month
2. Load `nissan-heritage-collection/<month>.json`
3. Slide across the snapshots taken for that month
4. See a calendar with per-day vacancy/capacity for the selected snapshot

Snapshots with no data (`[]`) are skipped by the slider; error snapshots are kept and shown as an error state.

---

## Migrating old per-timestamp files

`1_merge_files_by_month.py` is a one-off script that converts the legacy `nissan-heritage-collection/<epoch>.json` files (one file per request) into the grouped `<YYYY-MM>.json` format. Run it once from the repo root:

```bash
python3 1_merge_files_by_month.py
```

It groups each file by the target month it fetched (derived from the same next-month logic as the workflow), merges into any existing `<YYYY-MM>.json`, and deletes the original per-timestamp files. Only needed once, for repos with data from before the format change.

---

## Setup

### 1. Enable workflow write permissions

Go to **Settings → Actions → General → Workflow permissions** and select **Read and write permissions**, then save.

This allows the `github-actions[bot]` to commit and push new snapshots automatically.

### 2. That's it

Once the permission is set, the workflow will run on its own schedule. You can also trigger it manually anytime from the **Actions** tab using the **Run workflow** button.

---

## Logs & troubleshooting

Each workflow run is visible under the **Actions** tab. If a push conflict occurs and cannot be resolved automatically, the workflow will print the contents of the conflicting files to the log using `cat` so you can inspect them directly.

---

## License

This repository is for data archival purposes. All booking data belongs to their respective owners.
