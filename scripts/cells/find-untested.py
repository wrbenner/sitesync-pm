#!/usr/bin/env python3
"""Worker Cell: Find source files with no corresponding test.
Runs on every push. Writes .metrics/untested-files.json."""

import os, json

source_files = []
test_files = set()

# Collect all test files
for root, dirs, files in os.walk("src"):
    for f in files:
        if '.test.' in f or '.spec.' in f:
            # Map test file back to source: Component.test.tsx -> Component.tsx
            source_name = f.replace('.test.', '.').replace('.spec.', '.')
            test_files.add(source_name)

for root, dirs, files in os.walk("e2e"):
    for f in files:
        if f.endswith('.spec.ts'):
            test_files.add(f)

# Find source files without tests
untested = []
tested = []

for root, dirs, files in os.walk("src"):
    dirs[:] = [d for d in dirs if d not in ("test", "spec", "__test__", "node_modules", "types")]
    for f in files:
        if not f.endswith(('.ts', '.tsx')): continue
        if '.test.' in f or '.spec.' in f: continue
        if f.startswith('index.'): continue  # Barrel exports don't need tests
        if f == 'vite-env.d.ts': continue
        
        path = os.path.join(root, f)
        has_test = f in test_files or f.replace('.tsx', '.test.tsx') in test_files or f.replace('.ts', '.test.ts') in test_files
        
        if has_test:
            tested.append(path)
        else:
            untested.append(path)

# Sort by directory (pages first, then components, then others)
def priority(path):
    if '/pages/' in path: return 0
    if '/components/' in path: return 1
    if '/hooks/' in path: return 2
    return 3

untested.sort(key=priority)

os.makedirs(".metrics", exist_ok=True)
coverage = len(tested) / (len(tested) + len(untested)) * 100 if (tested or untested) else 0

with open(".metrics/untested-files.json", "w") as f:
    json.dump({
        "coverage_pct": round(coverage, 1),
        "tested_count": len(tested),
        "untested_count": len(untested),
        "untested": untested[:50]  # Top 50 most important untested files
    }, f, indent=2)

print(f"Test coverage: {coverage:.1f}% ({len(tested)} tested, {len(untested)} untested)")
