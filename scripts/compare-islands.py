#!/usr/bin/env python3
"""
compare-islands.py — MAP-Elites Island Winner Selection

Reads results from each island (.evolution/island-{N}-results.json),
computes composite scores, selects the winner, and appends the run
to .agent/population-archive.json.

Composite score formula:
  score = 0.5 * pass_rate
        + 0.3 * min(lines_changed / 500, 1.0)
        + 0.2 * quality_score

Quality score: fraction of 4 quality gates (tsc, lint, vitest, build) that pass.

Usage:
  python3 compare-islands.py
  python3 compare-islands.py --results-dir /path/to/.evolution --archive .agent/population-archive.json
"""

import json
import os
import sys
import argparse
import datetime
from pathlib import Path


# ── Constants ────────────────────────────────────────────────────────────────

WEIGHTS = {
    "pass_rate":     0.5,
    "lines_changed": 0.3,   # normalized: lines_changed / LINES_NORM, capped at 1.0
    "quality_score": 0.2,
}

LINES_NORM = 500  # 500 lines changed = full score in that dimension
QUALITY_GATES = ["tsc", "lint", "vitest", "build"]

STRATEGY_NAMES = {
    0: "depth",
    1: "breadth",
    2: "hybrid",
}


# ── Scoring ──────────────────────────────────────────────────────────────────

def compute_quality_score(gate_results: dict) -> float:
    """Fraction of quality gates that passed (0.0 – 1.0)."""
    if not gate_results:
        return 0.0
    passes = sum(
        1 for gate in QUALITY_GATES
        if str(gate_results.get(gate, "")).lower() in ("pass", "true", "1")
    )
    return passes / len(QUALITY_GATES)


def compute_composite_score(results: dict) -> float:
    """
    Composite score for one island.

    Fields expected in results:
      pass_rate          float 0–1
      total_lines_changed  int
      quality_gate_results dict with keys tsc/lint/vitest/build → "pass"/"fail"
    """
    pass_rate = float(results.get("pass_rate", 0.0))
    lines     = int(results.get("total_lines_changed", 0))
    gates     = results.get("quality_gate_results", {})

    lines_score   = min(lines / LINES_NORM, 1.0)
    quality_score = compute_quality_score(gates)

    score = (
        WEIGHTS["pass_rate"]     * pass_rate
        + WEIGHTS["lines_changed"] * lines_score
        + WEIGHTS["quality_score"] * quality_score
    )

    return round(score, 4)


# ── File I/O ─────────────────────────────────────────────────────────────────

def load_island_results(results_dir: Path, island_id: int) -> dict | None:
    """Load .evolution/island-{N}-results.json. Returns None if missing."""
    path = results_dir / f"island-{island_id}-results.json"
    if not path.exists():
        print(f"[warn] Missing results file: {path}", file=sys.stderr)
        return None
    with open(path) as f:
        return json.load(f)


def load_archive(archive_path: Path) -> dict:
    """Load or initialize population-archive.json."""
    if archive_path.exists():
        with open(archive_path) as f:
            return json.load(f)
    return {
        "version": "1.0.0",
        "description": "MAP-Elites population search archive — tracks which strategy wins each run.",
        "strategy_wins": {
            "depth":   0,
            "breadth": 0,
            "hybrid":  0,
        },
        "runs": [],
    }


def save_archive(archive: dict, archive_path: Path) -> None:
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with open(archive_path, "w") as f:
        json.dump(archive, f, indent=2)
    print(f"[info] Archive saved: {archive_path}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Compare MAP-Elites island results and select winner.")
    parser.add_argument(
        "--results-dir",
        default=".evolution",
        help="Directory containing island-{N}-results.json files (default: .evolution)",
    )
    parser.add_argument(
        "--archive",
        default=".agent/population-archive.json",
        help="Path to population-archive.json (default: .agent/population-archive.json)",
    )
    parser.add_argument(
        "--num-islands",
        type=int,
        default=3,
        help="Number of islands to compare (default: 3)",
    )
    parser.add_argument(
        "--run-id",
        default=None,
        help="Unique run identifier (default: ISO timestamp)",
    )
    args = parser.parse_args()

    results_dir  = Path(args.results_dir)
    archive_path = Path(args.archive)
    run_id       = args.run_id or datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    print(f"\n=== MAP-Elites Island Comparison — {run_id} ===\n")

    # ── Load results ────────────────────────────────────────────────────────
    island_data = {}
    for i in range(args.num_islands):
        results = load_island_results(results_dir, i)
        if results is not None:
            island_data[i] = results

    if not island_data:
        print("[error] No island result files found. Exiting without selecting winner.", file=sys.stderr)
        # Write a sentinel so the workflow knows selection failed
        sentinel = {"winner": None, "reason": "no_results_found", "run_id": run_id}
        print(json.dumps(sentinel))
        sys.exit(1)

    # ── Score each island ────────────────────────────────────────────────────
    scored = {}
    print(f"{'Island':<10} {'Strategy':<10} {'PassRate':<12} {'Lines':<10} {'Quality':<12} {'Score':<8}")
    print("-" * 62)

    for island_id, results in island_data.items():
        score         = compute_composite_score(results)
        pass_rate     = float(results.get("pass_rate", 0.0))
        lines         = int(results.get("total_lines_changed", 0))
        gates         = results.get("quality_gate_results", {})
        quality_score = compute_quality_score(gates)
        strategy      = results.get("strategy", STRATEGY_NAMES.get(island_id, "unknown"))

        scored[island_id] = {
            "island":         island_id,
            "strategy":       strategy,
            "pass_rate":      pass_rate,
            "lines_changed":  lines,
            "quality_score":  quality_score,
            "composite_score": score,
            "raw":            results,
        }

        print(f"{island_id:<10} {strategy:<10} {pass_rate:<12.2%} {lines:<10} {quality_score:<12.2%} {score:<8.4f}")

    print()

    # ── Select winner ────────────────────────────────────────────────────────
    winner_id = max(scored, key=lambda k: scored[k]["composite_score"])
    winner    = scored[winner_id]

    print(f"Winner: Island {winner_id} ({winner['strategy'].upper()})")
    print(f"  Composite score: {winner['composite_score']:.4f}")
    print(f"  Pass rate:       {winner['pass_rate']:.1%}")
    print(f"  Lines changed:   {winner['lines_changed']}")
    print(f"  Quality score:   {winner['quality_score']:.1%}")

    # ── Detect ties ──────────────────────────────────────────────────────────
    top_score = winner["composite_score"]
    tied = [
        k for k, v in scored.items()
        if abs(v["composite_score"] - top_score) < 0.0001 and k != winner_id
    ]
    if tied:
        print(f"  [note] Tied with island(s) {tied} — winner chosen by lowest island ID (stability)")

    # ── Write machine-readable output ─────────────────────────────────────────
    # The workflow reads this JSON from stdout to get the winning branch name.
    output = {
        "winner_island":   winner_id,
        "winner_strategy": winner["strategy"],
        "winner_score":    winner["composite_score"],
        "all_scores":      {str(k): v["composite_score"] for k, v in scored.items()},
        "run_id":          run_id,
    }

    # ── Update archive ────────────────────────────────────────────────────────
    archive = load_archive(archive_path)

    # Increment win counter for the winning strategy
    strategy_key = winner["strategy"]
    if strategy_key not in archive["strategy_wins"]:
        archive["strategy_wins"][strategy_key] = 0
    archive["strategy_wins"][strategy_key] += 1

    # Append run record
    run_record = {
        "run_id":          run_id,
        "winner_island":   winner_id,
        "winner_strategy": winner["strategy"],
        "winner_score":    winner["composite_score"],
        "islands": {
            str(k): {
                "strategy":        v["strategy"],
                "composite_score": v["composite_score"],
                "pass_rate":       v["pass_rate"],
                "lines_changed":   v["lines_changed"],
                "quality_score":   v["quality_score"],
                "experiments_attempted": v["raw"].get("experiments_attempted", 0),
                "experiments_passed":   v["raw"].get("experiments_passed", 0),
            }
            for k, v in scored.items()
        },
    }
    archive["runs"].append(run_record)

    # Trim to last 50 runs to keep the file manageable
    if len(archive["runs"]) > 50:
        archive["runs"] = archive["runs"][-50:]

    save_archive(archive, archive_path)

    # ── Print strategy summary ────────────────────────────────────────────────
    total_wins = sum(archive["strategy_wins"].values())
    if total_wins > 0:
        print(f"\n=== Cumulative Strategy Performance ({total_wins} total runs) ===")
        for strat, wins in sorted(archive["strategy_wins"].items(), key=lambda x: -x[1]):
            pct = wins / total_wins * 100
            bar = "█" * int(pct / 5)
            print(f"  {strat:<10} {wins:>3} wins ({pct:5.1f}%)  {bar}")

    # ── Emit final JSON to stdout for workflow consumption ────────────────────
    print(f"\n__WINNER_JSON__")
    print(json.dumps(output))


if __name__ == "__main__":
    main()
