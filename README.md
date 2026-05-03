# nissan-heritage-tour-booking

Automated data collector for the **Nissan Heritage Tour** booking events, powered by a GitHub Actions workflow that polls the [Coubic](https://coubic.com) API every 30 minutes and snapshots the responses as JSON files.

---

## How it works

A scheduled workflow (`.github/workflows/fetch-nissan-events.yml`) runs every 30 minutes and:

1. **Fetches** the booking events from the Coubic API for the Nissan Heritage Tour
2. **Saves** the response as a timestamped JSON file inside `nissan-heritage-collection/`
3. **Commits and pushes** the new file to `main` automatically

If the API returns an error, the file is saved in the following format instead of the raw payload:

```json
{
  "errorCode": 404,
  "payload": { ... }
}
```

---

## Repository structure

```
nissan-heritage-tour-booking/
├── .github/
│   └── workflows/
│       └── fetch-nissan-events.yml   # Scheduled workflow
├── nissan-heritage-collection/
│   ├── 2026-06-07T00-00-00Z.json     # Example snapshot
│   ├── 2026-06-07T00-30-00Z.json
│   └── ...
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

The computed window (`JST now`, `Window start`, `Window end`) is printed at the top of each run's log so you can always verify what range was fetched.

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