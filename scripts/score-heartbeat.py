#!/usr/bin/env python3
"""
score-heartbeat.py — Heartbeat Run Scorer

Scores tonight's heartbeat run on 5 dimensions (0-100 total).
Unlike score-night.py (which scores the old builder), this scores
what the heartbeat actually measures: experiment success, quality
floor improvement, build integrity, learning growth, and velocity.

Usage:
    python3 scripts/score-heartbeat.py
"""

import json
import os
import subprocess
from datetime import datetime, timezone


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def score_experiment_success():
    """Score based on experiment success rate. (0-40 points)"""
    result = {"max_points": 40, "points": 0, "details": {}}

    results = read_json(".metrics/experiment-results.json")
    experiments = results.get("experiments", [])

    if not experiments:
        result["details"]["note"] = "No experiments found"
        return result

    succeeded = sum(1 for e in experiments if e.get("result") == "SUCCESS")
    attempted = sum(1 for e in experiments if e.get("result") in ("SUCCESS", "REVERTED"))

    if attempted == 0:
        result["details"]["note"] = "No experiments attempted (all skipped)"
        return result

    rate = succeeded / attempted
    result["points"] = round(rate * result["max_points"])

    result["details"] = {
        "succeeded": succeeded,
        "attempted": attempted,
        "skipped": len(experiments) - attempted,
        "success_rate": round(rate, 2),
    }

    return result


def score_quality_improvement():
    """Score based on quality floor improvements. (0-25 points)"""
    result = {"max_points": 25, "points": 0, "details": {}}

    floor = read_json(".quality-floor.json")
    updated_by = floor.get("_updatedBy", "")

    # Check if the floor was updated by the experiment ratchet today
    if "auto-experiment" in updated_by or "heartbeat" in updated_by:
        updated_date = floor.get("_updated", "")
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if today in updated_date:
            result["points"] = 15
            result["details"]["floor_updated_today"] = True

    # Check specific metrics against targets
    targets = floor.get("_targets", {})
    metrics_improved = 0

    checks = [
        ("anyCount", "anyCount", True),
        ("mockCount", "mockCount", True),
        ("eslintErrors", "eslintErrors", True),
        ("eslintWarnings", "eslintWarnings", True),
        ("coveragePercent", "coveragePercent", False),
    ]

    for floor_key, target_key, lower_is_better in checks:
        current = floor.get(floor_key, None)
        target = targets.get(target_key, None)

        if current is not None and target is not None:
            if lower_is_better and current <= target:
                metrics_improved += 1
            elif not lower_is_better and current >= target:
                metrics_improved += 1

    # 2 points per metric at target, cap at 10
    result["points"] += min(10, metrics_improved * 2)
    result["details"]["metrics_at_target"] = metrics_improved

    return result


def score_build_integrity():
    """Score based on build health. (0-15 points)"""
    result = {"max_points": 15, "points": 0, "details": []}

    # Check TypeScript
    try:
        proc = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            capture_output=True, text=True, timeout=120
        )
        if proc.returncode == 0:
            result["points"] += 5
            result["details"].append("TypeScript: PASS")
        else:
            result["details"].append("TypeScript: FAIL")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        result["details"].append("TypeScript: SKIP (not available)")

    # Check build
    try:
        proc = subprocess.run(
            ["npx", "vite", "build"],
            capture_output=True, text=True, timeout=180
        )
        if proc.returncode == 0:
            result["points"] += 5
            result["details"].append("Build: PASS")
        else:
            result["details"].append("Build: FAIL")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        result["details"].append("Build: SKIP (not available)")

    # Check tests
    try:
        proc = subprocess.run(
            ["npx", "vitest", "run", "--passWithNoTests"],
            capture_output=True, text=True, timeout=180
        )
        if proc.returncode == 0:
            result["points"] += 5
            result["details"].append("Tests: PASS")
        else:
            result["details"].append("Tests: FAIL")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        result["details"].append("Tests: SKIP (not available)")

    return result


def score_learning_growth():
    """Score based on intelligence accumulation. (0-10 points)"""
    result = {"max_points": 10, "points": 0, "details": []}

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # New learnings added today
    try:
        with open("LEARNINGS.md") as f:
            content = f.read()
        today_count = content.count(today)
        if today_count > 0:
            result["points"] += 3
            result["details"].append(f"Learnings added today: {today_count}")
    except FileNotFoundError:
        pass

    # Experiment history is growing
    history = read_json(".metrics/experiment-history.json")
    total_runs = history.get("aggregate", {}).get("total_runs", 0)
    if total_runs > 0:
        result["points"] += 3
        result["details"].append(f"Experiment history: {total_runs} runs tracked")

    # Skills exist
    skills_dir = ".claude/skills"
    if os.path.isdir(skills_dir):
        skill_count = sum(1 for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, d)))
        if skill_count > 0:
            result["points"] += min(4, skill_count)
            result["details"].append(f"Skills in library: {skill_count}")

    return result


def score_velocity():
    """Score based on experiment throughput. (0-10 points)"""
    result = {"max_points": 10, "points": 0, "details": {}}

    results = read_json(".metrics/experiment-results.json")
    max_exp = results.get("max_experiments", 5)
    experiments = results.get("experiments", [])
    completed = sum(1 for e in experiments if e.get("result") in ("SUCCESS", "REVERTED"))

    if max_exp > 0 and completed > 0:
        ratio = completed / max_exp
        result["points"] = min(result["max_points"], round(ratio * result["max_points"]))

    result["details"] = {
        "completed": completed,
        "max_allowed": max_exp,
        "utilization": round(completed / max_exp, 2) if max_exp > 0 else 0,
    }

    return result


def grade(score, max_score):
    if max_score == 0:
        return "N/A"
    pct = (score / max_score) * 100
    if pct >= 90:
        return "A"
    if pct >= 80:
        return "B"
    if pct >= 70:
        return "C"
    if pct >= 60:
        return "D"
    return "F"


def main():
    print("Scoring heartbeat run...")

    dimensions = {
        "experiment_success": score_experiment_success(),
        "quality_improvement": score_quality_improvement(),
        "build_integrity": score_build_integrity(),
        "learning_growth": score_learning_growth(),
        "velocity": score_velocity(),
    }

    total = sum(d["points"] for d in dimensions.values())
    max_total = sum(d["max_points"] for d in dimensions.values())

    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "score": total,
        "max_score": max_total,
        "percentage": round((total / max_total) * 100, 1) if max_total > 0 else 0,
        "grade": grade(total, max_total),
        "breakdown": {
            name: {"points": d["points"], "max": d["max_points"]}
            for name, d in dimensions.items()
        },
        "details": dimensions,
    }

    os.makedirs(".metrics", exist_ok=True)
    with open(".metrics/heartbeat-score.json", "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")

    # Also save dated copy
    dated = f".metrics/heartbeat-score-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json"
    with open(dated, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")

    print(f"\nHeartbeat Score: {total} / {max_total} ({result['percentage']}%) — Grade: {result['grade']}")
    for name, d in dimensions.items():
        print(f"  {name}: {d['points']} / {d['max_points']}")
    print(f"\nWritten to .metrics/heartbeat-score.json")


if __name__ == "__main__":
    main()
