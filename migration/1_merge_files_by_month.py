#!/usr/bin/env python3
"""
Migrates nissan-heritage-collection/{timestamp}.json files into
nissan-heritage-collection/{YYYY-MM}.json, grouped by the target month
that was being fetched at that execution time (next month).

Deletes original per-timestamp files after grouping.
"""
import json
import os
import re
from datetime import datetime, timedelta, timezone

DIR = "nissan-heritage-collection"
TS_RE = re.compile(r"^(\d+)\.json$")


def target_month_key(ts: int) -> str:
    """Same logic as workflow: next month, relative to execution ts."""
    exec_time = datetime.fromtimestamp(ts)
    year, month = exec_time.year, exec_time.month
    month += 1
    if month > 12:
        month = 1
        year += 1
    return f"{year:04d}-{month:02d}"


def main():
    groups: dict[str, dict[str, object]] = {}
    files_to_remove = []

    for fname in os.listdir(DIR):
        m = TS_RE.match(fname)
        if not m:
            continue
        ts = int(m.group(1))
        path = os.path.join(DIR, fname)
        with open(path, encoding="utf-8") as f:
            content = json.load(f)

        key = target_month_key(ts)
        groups.setdefault(key, {})[str(ts)] = content
        files_to_remove.append(path)

    for key, data in groups.items():
        out_path = os.path.join(DIR, f"{key}.json")
        existing = {}
        if os.path.exists(out_path):
            with open(out_path, encoding="utf-8") as f:
                existing = json.load(f)
        existing.update(data)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2, sort_keys=True)
        print(f"✅ Wrote {out_path} ({len(existing)} entries)")

    for path in files_to_remove:
        os.remove(path)
    print(f"🗑️  Removed {len(files_to_remove)} timestamp files")


if __name__ == "__main__":
    main()
