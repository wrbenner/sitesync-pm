#!/usr/bin/env python3
"""Worker Cell: Count type safety issues per file.
Runs on every push. Writes .metrics/type-issues.json.
The experiment generator reads this to create targeted experiments."""

import os, json, re
from datetime import datetime, timezone

results = []
totals = {"as_any": 0, "ts_ignore": 0, "files": 0}

for root, dirs, files in os.walk("src"):
    dirs[:] = [d for d in dirs if d not in ("test", "spec", "__test__", "__tests__", "node_modules")]
    for f in files:
        if not f.endswith(('.ts', '.tsx')): continue
        if '.test.' in f or '.spec.' in f: continue

        path = os.path.join(root, f)
        try:
            with open(path) as fh:
                content = fh.read()
        except (IOError, UnicodeDecodeError):
            continue

        as_any = len(re.findall(r'\bas\s+any\b', content))
        ts_ignore = len(re.findall(r'@ts-ignore|@ts-expect-error', content))

        if as_any + ts_ignore > 0:
            results.append({"file": path, "as_any": as_any, "ts_ignore": ts_ignore})
            totals["as_any"] += as_any
            totals["ts_ignore"] += ts_ignore
            totals["files"] += 1

results.sort(key=lambda x: x["as_any"] + x["ts_ignore"], reverse=True)

os.makedirs(".metrics", exist_ok=True)
with open(".metrics/type-issues.json", "w") as f:
    json.dump({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "totals": totals,
        "files": results
    }, f, indent=2)

print(f"Type issues: {totals['files']} files, {totals['as_any']} as-any, {totals['ts_ignore']} ts-ignore")
