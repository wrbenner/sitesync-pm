#!/usr/bin/env python3
"""Worker Cell: Count ESLint errors and warnings per file.
Runs on every push. Writes .metrics/eslint-issues.json.
The Product Mind reads this to generate lint-fix experiment targets."""

import os, json, subprocess

# Run eslint and capture output
try:
    result = subprocess.run(
        ["npx", "eslint", "src/", "--format", "json", "--no-error-on-unmatched-pattern"],
        capture_output=True, text=True, timeout=120
    )
    eslint_output = json.loads(result.stdout) if result.stdout.strip() else []
except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
    eslint_output = []

files = []
totals = {"errors": 0, "warnings": 0, "fixable_errors": 0, "fixable_warnings": 0, "files": 0}

for entry in eslint_output:
    filepath = entry.get("filePath", "")
    # Make path relative
    if "/src/" in filepath:
        filepath = "src/" + filepath.split("/src/", 1)[1]
    
    error_count = entry.get("errorCount", 0)
    warning_count = entry.get("warningCount", 0)
    fixable_error = entry.get("fixableErrorCount", 0)
    fixable_warning = entry.get("fixableWarningCount", 0)
    
    if error_count + warning_count > 0:
        # Get top 3 rule violations for this file
        rule_counts = {}
        for msg in entry.get("messages", []):
            rule = msg.get("ruleId", "unknown")
            if rule:
                rule_counts[rule] = rule_counts.get(rule, 0) + 1
        top_rules = sorted(rule_counts.items(), key=lambda x: -x[1])[:3]
        
        files.append({
            "file": filepath,
            "errors": error_count,
            "warnings": warning_count,
            "fixable_errors": fixable_error,
            "fixable_warnings": fixable_warning,
            "top_rules": [{"rule": r, "count": c} for r, c in top_rules]
        })
        totals["errors"] += error_count
        totals["warnings"] += warning_count
        totals["fixable_errors"] += fixable_error
        totals["fixable_warnings"] += fixable_warning
        totals["files"] += 1

# Sort by total issues descending
files.sort(key=lambda x: x["errors"] + x["warnings"], reverse=True)

os.makedirs(".metrics", exist_ok=True)
with open(".metrics/eslint-issues.json", "w") as f:
    json.dump({
        "totals": totals,
        "files": files[:50]  # Top 50 worst files
    }, f, indent=2)

print(f"ESLint: {totals['errors']} errors, {totals['warnings']} warnings across {totals['files']} files")
print(f"  Auto-fixable: {totals['fixable_errors']} errors, {totals['fixable_warnings']} warnings")
