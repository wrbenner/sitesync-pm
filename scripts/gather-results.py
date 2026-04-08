#!/usr/bin/env python3
"""
gather-results.py
─────────────────
Parses EXPERIMENTS.md to produce category-level success statistics
and a failure-pattern list for the meta-improvement agent.

Outputs: /tmp/self-improve/category-results.json
"""

import json
import re
import sys
from pathlib import Path

EXPERIMENTS_FILE = Path("EXPERIMENTS.md")
OUTPUT_FILE = Path("/tmp/self-improve/category-results.json")
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

if not EXPERIMENTS_FILE.exists():
    print("EXPERIMENTS.md not found")
    json.dump({"categories": {}, "failures": []}, OUTPUT_FILE.open("w"), indent=2)
    sys.exit(0)

content = EXPERIMENTS_FILE.read_text(encoding="utf-8", errors="replace")

CATEGORIES = ["TYPE_SAFETY", "QUALITY", "TESTING", "FEATURE", "PERFORMANCE"]

# Split into per-experiment blocks
blocks = re.split(r"(?=### EXP-)", content)

results = {}
for cat in CATEGORIES:
    cat_pass = cat_fail = cat_pending = 0
    for block in blocks:
        if f"**Category**: {cat}" in block or f"Category**: {cat}" in block:
            if "\u2705" in block:
                cat_pass += 1
            elif "\u274c" in block:
                cat_fail += 1
            elif "PENDING" in block:
                cat_pending += 1
    total = cat_pass + cat_fail + cat_pending
    results[cat] = {
        "passed": cat_pass,
        "failed": cat_fail,
        "pending": cat_pending,
        "total": total,
        "rate": round(cat_pass / (cat_pass + cat_fail), 4) if (cat_pass + cat_fail) > 0 else None,
    }

# Failure pattern extraction
failure_blocks = []
for block in blocks:
    if "\u274c" in block:
        reason_match = re.search(r"FAIL.*?reason: ([^\n]+)", block)
        file_match = re.search(r"\*\*File\(s\)\*\*: ([^\n]+)", block)
        exp_match = re.search(r"### (EXP-\d+)", block)
        failure_blocks.append({
            "experiment": exp_match.group(1) if exp_match else "unknown",
            "reason": reason_match.group(1).strip() if reason_match else "unknown",
            "file": file_match.group(1).strip() if file_match else "unknown",
        })

output = {"categories": results, "failures": failure_blocks}
OUTPUT_FILE.write_text(json.dumps(output, indent=2))
print(json.dumps(results, indent=2))
