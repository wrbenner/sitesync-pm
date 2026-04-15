#!/usr/bin/env python3
"""
update-quality-floor.py — Quality Ratchet Updater

Measures current codebase health and updates .quality-floor.json.
Floors ONLY go down (quality only improves). If a metric has improved
since the last floor was set, the floor ratchets to the new value.

This runs after successful experiments in the heartbeat pipeline.

Usage:
    python3 scripts/update-quality-floor.py
"""

import json
import os
import re
import subprocess
from datetime import datetime, timezone


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def count_pattern(pattern, extensions=("*.ts", "*.tsx"), exclude_tests=True):
    """Count occurrences of a grep pattern in src/."""
    cmd = ["grep", "-rn", pattern, "src/"]
    for ext in extensions:
        cmd.extend(["--include", ext])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
        if exclude_tests:
            lines = [l for l in lines if "/test/" not in l and ".test." not in l and ".spec." not in l]
        return len(lines)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return -1  # Error, don't ratchet


def main():
    floor_path = ".quality-floor.json"
    floor = read_json(floor_path)

    if not floor:
        print("ERROR: .quality-floor.json not found or invalid")
        return

    print("Quality Ratchet Updater")
    print("=" * 40)

    updated = False

    def ratchet_down(key, measured, label):
        """Ratchet a metric DOWN (lower is better)."""
        nonlocal updated
        current_floor = floor.get(key, 999999)
        if measured < 0:
            print(f"  {label}: SKIP (measurement error)")
            return
        if measured < current_floor:
            print(f"  {label}: RATCHET {current_floor} -> {measured}")
            floor[key] = measured
            updated = True
        elif measured == current_floor:
            print(f"  {label}: unchanged at {measured}")
        else:
            print(f"  {label}: {measured} (floor: {current_floor}, no regression allowed)")

    # Measure as_any count
    any_count = count_pattern(r"as any\|@ts-ignore\|@ts-expect-error")
    ratchet_down("anyCount", any_count, "Unsafe casts (as any + ts-ignore)")

    # Measure mock data count
    mock_count = count_pattern(r"mock\|Mock\|MOCK\|fake\|Fake\|placeholder\|Lorem\|dummy")
    # Filter out immune-ok and mock-ok comments
    if mock_count >= 0:
        cmd = ["grep", "-rn", r"mock\|Mock\|MOCK\|fake\|Fake\|placeholder\|Lorem\|dummy",
               "src/", "--include=*.ts", "--include=*.tsx"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
            lines = [l for l in lines
                     if "/test/" not in l and ".test." not in l and ".spec." not in l
                     and "immune-ok" not in l and "mock-ok" not in l]
            mock_count = len(lines)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            mock_count = -1
    ratchet_down("mockCount", mock_count, "Mock data instances")

    # Measure ESLint errors (from metrics if available, otherwise run)
    eslint_metrics = read_json(".metrics/eslint-issues.json")
    if eslint_metrics:
        eslint_errors = eslint_metrics.get("totals", {}).get("errors", -1)
        eslint_warnings = eslint_metrics.get("totals", {}).get("warnings", -1)
    else:
        eslint_errors = -1
        eslint_warnings = -1
    ratchet_down("eslintErrors", eslint_errors, "ESLint errors")
    ratchet_down("eslintWarnings", eslint_warnings, "ESLint warnings")

    # Measure bundle size (only if dist/ exists from a recent build)
    if os.path.isdir("dist"):
        try:
            result = subprocess.run(
                ["du", "-sk"] + [f for f in os.listdir("dist/assets") if f.endswith(".js")],
                capture_output=True, text=True, cwd="dist/assets", timeout=10
            )
            bundle_kb = sum(int(line.split()[0]) for line in result.stdout.strip().split("\n") if line)
            ratchet_down("bundleSizeKB", bundle_kb, "Bundle size (KB)")
        except Exception:
            print("  Bundle size: SKIP (measurement error)")
    else:
        print("  Bundle size: SKIP (no dist/ directory)")

    # Write updated floor
    if updated:
        floor["_updated"] = datetime.now(timezone.utc).isoformat()
        floor["_updatedBy"] = "auto-experiment-ratchet"
        with open(floor_path, "w") as f:
            json.dump(floor, f, indent=2)
            f.write("\n")
        print(f"\n.quality-floor.json updated.")
    else:
        print(f"\nNo floor improvements detected.")


if __name__ == "__main__":
    main()
