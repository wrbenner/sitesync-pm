#!/usr/bin/env python3
"""Worker Cell: Count quality issues per file (mock data, hardcoded colors).
Runs on every push. Writes .metrics/quality-issues.json."""

import os, json, re

results = []
totals = {"mock_data": 0, "hardcoded_colors": 0, "files": 0}

MOCK_PATTERNS = re.compile(r'mockData|MOCK_|faker\.|Math\.random\(\)|getDemoUser|sampleData|dummyData', re.IGNORECASE)
COLOR_PATTERN = re.compile(r'["\']#[0-9a-fA-F]{6}["\']')

for root, dirs, files in os.walk("src"):
    dirs[:] = [d for d in dirs if d not in ("test", "spec", "__test__", "node_modules")]
    for f in files:
        if not f.endswith(('.ts', '.tsx')): continue
        if '.test.' in f or '.spec.' in f: continue
        if f == 'theme.ts': continue  # Theme file is allowed to have colors
        
        path = os.path.join(root, f)
        with open(path) as fh:
            content = fh.read()
        
        mock_hits = len(MOCK_PATTERNS.findall(content))
        color_hits = len(COLOR_PATTERN.findall(content))
        
        if mock_hits + color_hits > 0:
            results.append({"file": path, "mock_data": mock_hits, "hardcoded_colors": color_hits})
            totals["mock_data"] += mock_hits
            totals["hardcoded_colors"] += color_hits
            totals["files"] += 1

results.sort(key=lambda x: x["mock_data"] + x["hardcoded_colors"], reverse=True)

os.makedirs(".metrics", exist_ok=True)
with open(".metrics/quality-issues.json", "w") as f:
    json.dump({"totals": totals, "files": results}, f, indent=2)

print(f"Quality issues: {totals['files']} files, {totals['mock_data']} mock, {totals['hardcoded_colors']} colors")
