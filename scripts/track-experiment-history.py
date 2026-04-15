#!/usr/bin/env python3
"""
track-experiment-history.py — Persistent Experiment History

Reads .metrics/experiment-results.json (tonight's results) and appends
to .metrics/experiment-history.json (all-time record). Computes aggregate
success rates by category so the meta-agent knows what works.

Usage:
    python3 scripts/track-experiment-history.py
"""

import json
import os
from datetime import datetime, timezone


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def main():
    results_path = ".metrics/experiment-results.json"
    history_path = ".metrics/experiment-history.json"

    # Read tonight's results
    results = read_json(results_path)
    experiments = results.get("experiments", [])

    if not experiments:
        print("No experiment results to track.")
        return

    # Read existing history
    history = read_json(history_path)
    if "runs" not in history:
        history = {"runs": [], "aggregate": {}}

    # Compute tonight's stats
    succeeded = [e for e in experiments if e.get("result") == "SUCCESS"]
    reverted = [e for e in experiments if e.get("result") == "REVERTED"]
    skipped = [e for e in experiments if e.get("result") in ("SKIPPED", "NO_CHANGES", "ERROR")]
    total_attempted = len(succeeded) + len(reverted)  # Exclude skips from rate calc

    success_rate = len(succeeded) / total_attempted if total_attempted > 0 else 0.0

    # Category breakdown
    by_category = {}
    for exp in experiments:
        cat = exp.get("category", "UNKNOWN")
        if cat not in by_category:
            by_category[cat] = {"total": 0, "succeeded": 0, "reverted": 0, "skipped": 0}

        result = exp.get("result", "UNKNOWN")
        if result == "SUCCESS":
            by_category[cat]["succeeded"] += 1
            by_category[cat]["total"] += 1
        elif result == "REVERTED":
            by_category[cat]["reverted"] += 1
            by_category[cat]["total"] += 1
        else:
            by_category[cat]["skipped"] += 1

    # Compute category rates
    for cat, stats in by_category.items():
        attempted = stats["succeeded"] + stats["reverted"]
        stats["rate"] = round(stats["succeeded"] / attempted, 2) if attempted > 0 else 0.0

    # Build tonight's entry
    tonight = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": len(experiments),
        "attempted": total_attempted,
        "succeeded": len(succeeded),
        "reverted": len(reverted),
        "skipped": len(skipped),
        "success_rate": round(success_rate, 2),
        "by_category": by_category,
        "experiments": [
            {
                "id": e.get("id", ""),
                "category": e.get("category", "UNKNOWN"),
                "result": e.get("result", "UNKNOWN"),
                "before": e.get("before", ""),
                "after": e.get("after", ""),
                "reason": e.get("reason", ""),
            }
            for e in experiments
        ],
    }

    # Append to history
    history["runs"].append(tonight)

    # Keep last 90 days of history (trim older entries)
    if len(history["runs"]) > 90:
        history["runs"] = history["runs"][-90:]

    # Recompute aggregate stats across all runs
    all_experiments = []
    for run in history["runs"]:
        all_experiments.extend(run.get("experiments", []))

    total_all = len([e for e in all_experiments if e["result"] in ("SUCCESS", "REVERTED")])
    succeeded_all = len([e for e in all_experiments if e["result"] == "SUCCESS"])

    # Aggregate category rates
    cat_agg = {}
    for exp in all_experiments:
        cat = exp.get("category", "UNKNOWN")
        if cat not in cat_agg:
            cat_agg[cat] = {"total": 0, "succeeded": 0}
        if exp["result"] == "SUCCESS":
            cat_agg[cat]["succeeded"] += 1
            cat_agg[cat]["total"] += 1
        elif exp["result"] == "REVERTED":
            cat_agg[cat]["total"] += 1

    for cat, stats in cat_agg.items():
        stats["rate"] = round(stats["succeeded"] / stats["total"], 2) if stats["total"] > 0 else 0.0

    # Streak tracking
    recent_results = [e["result"] for e in all_experiments if e["result"] in ("SUCCESS", "REVERTED")]
    current_streak = 0
    for r in reversed(recent_results):
        if r == "SUCCESS":
            current_streak += 1
        else:
            break

    best_streak = 0
    streak = 0
    for r in recent_results:
        if r == "SUCCESS":
            streak += 1
            best_streak = max(best_streak, streak)
        else:
            streak = 0

    history["aggregate"] = {
        "total_runs": len(history["runs"]),
        "total_experiments": total_all,
        "total_succeeded": succeeded_all,
        "overall_success_rate": round(succeeded_all / total_all, 2) if total_all > 0 else 0.0,
        "category_rates": cat_agg,
        "streak": {
            "current_successes": current_streak,
            "best_successes": best_streak,
        },
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }

    # Write history
    os.makedirs(".metrics", exist_ok=True)
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
        f.write("\n")

    # Print summary
    print(f"Experiment History Updated")
    print(f"  Tonight: {len(succeeded)}/{total_attempted} succeeded ({success_rate:.0%})")
    print(f"  All-time: {succeeded_all}/{total_all} succeeded ({history['aggregate']['overall_success_rate']:.0%})")
    print(f"  Streak: {current_streak} consecutive successes (best: {best_streak})")
    print(f"  Category rates:")
    for cat, stats in sorted(cat_agg.items()):
        print(f"    {cat}: {stats['succeeded']}/{stats['total']} ({stats['rate']:.0%})")


if __name__ == "__main__":
    main()
