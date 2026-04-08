#!/usr/bin/env python3
"""
aggregate-reviews.py
────────────────────
SiteSync PM — Multi-Agent Verification Consensus Aggregator

Reads all .reviews/<agent-name>.json files produced by the parallel
CodeX-Verify agents, computes a weighted aggregate score, identifies
consensus issues (flagged by 2+ agents), and writes .reviews/consensus.json.

Weights (from research — CodeX-Verify pattern):
  correctness  0.40
  security     0.30
  performance  0.20
  style        0.10

Usage:
  python wave1/scripts/aggregate-reviews.py [--reviews-dir .reviews]

Exit codes:
  0 — aggregate score >= 6.0 and no urgent dimensions
  1 — aggregate score < 6.0  (quality flag)
  2 — any dimension < 4.0   (urgent — superset of exit code 1)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

CANONICAL_WEIGHTS: dict[str, float] = {
    "correctness": 0.40,
    "security":    0.30,
    "performance": 0.20,
    "style":       0.10,
}

AGGREGATE_THRESHOLD   = 6.0   # Below this → quality-flag issue
URGENT_THRESHOLD      = 4.0   # Below this (any dimension) → urgent issue
CONSENSUS_MIN_AGENTS  = 2     # Issue must be flagged by this many agents to be "consensus"


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def load_reviews(reviews_dir: Path) -> list[dict[str, Any]]:
    """Load every *.json file in reviews_dir except consensus.json."""
    reviews = []
    for path in sorted(reviews_dir.glob("*.json")):
        if path.stem == "consensus":
            continue
        try:
            with path.open() as f:
                data = json.load(f)
            reviews.append(data)
            print(f"  Loaded: {path.name}")
        except (json.JSONDecodeError, OSError) as exc:
            print(f"  WARNING: Could not load {path.name}: {exc}", file=sys.stderr)
    return reviews


def get_score(review: dict[str, Any]) -> float | None:
    """Return the numeric score from a review, or None if unavailable/skipped."""
    if review.get("skipped") or review.get("parse_error"):
        return None
    score = review.get("score")
    if score is None:
        return None
    try:
        return float(score)
    except (TypeError, ValueError):
        return None


def compute_weighted_aggregate(reviews: list[dict[str, Any]]) -> float | None:
    """
    Weighted average using CANONICAL_WEIGHTS.
    Only dimensions with valid scores contribute.
    Weights are re-normalised if some dimensions are missing.
    """
    total_weight = 0.0
    weighted_sum = 0.0

    for review in reviews:
        dimension = review.get("dimension", "")
        score = get_score(review)
        if score is None:
            continue
        weight = CANONICAL_WEIGHTS.get(dimension, 0.0)
        weighted_sum  += score * weight
        total_weight  += weight

    if total_weight == 0:
        return None

    return round(weighted_sum / total_weight, 3)


def find_consensus_issues(
    reviews: list[dict[str, Any]],
    min_agents: int = CONSENSUS_MIN_AGENTS,
) -> list[dict[str, Any]]:
    """
    Identify issues that appear in 2+ agent reviews.

    Matching heuristic: two issues are considered the "same" if they share
    the same (file, line) pair OR if their description strings share >= 6
    significant tokens (to handle paraphrasing).
    """
    # Collect all issues with their source agent
    all_issues: list[dict[str, Any]] = []
    for review in reviews:
        agent = review.get("agent", "unknown")
        for issue in review.get("critical_issues", []):
            issue = dict(issue)
            issue["_source_agent"] = agent
            all_issues.append(issue)

    if not all_issues:
        return []

    def issue_tokens(issue: dict) -> set[str]:
        desc = (issue.get("description") or "").lower()
        return set(desc.split())

    def issues_match(a: dict, b: dict) -> bool:
        # Same file + line
        file_a, file_b = a.get("file"), b.get("file")
        line_a, line_b = a.get("line"), b.get("line")
        if file_a and file_a == file_b and line_a is not None and line_a == line_b:
            return True
        # Significant token overlap (>= 6 words in common)
        shared = issue_tokens(a) & issue_tokens(b)
        stopwords = {"the", "a", "an", "is", "in", "of", "to", "and", "or", "not",
                     "this", "that", "it", "for", "on", "with", "are", "was", "be"}
        meaningful_shared = shared - stopwords
        return len(meaningful_shared) >= 6

    # Cluster issues
    clusters: list[list[dict]] = []
    assigned = [False] * len(all_issues)

    for i, issue in enumerate(all_issues):
        if assigned[i]:
            continue
        cluster = [issue]
        assigned[i] = True
        for j, other in enumerate(all_issues):
            if assigned[j] or i == j:
                continue
            if issues_match(issue, other):
                cluster.append(other)
                assigned[j] = True
        clusters.append(cluster)

    # Keep clusters flagged by >= min_agents distinct agents
    consensus_issues = []
    for cluster in clusters:
        agents_flagging = set(item["_source_agent"] for item in cluster)
        if len(agents_flagging) >= min_agents:
            # Use the highest-severity version as the representative
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            representative = min(
                cluster,
                key=lambda x: severity_order.get(x.get("severity", "low"), 3),
            )
            consensus_issues.append({
                "severity":    representative.get("severity", "unknown"),
                "file":        representative.get("file"),
                "line":        representative.get("line"),
                "description": representative.get("description"),
                "suggested_fix": representative.get("suggested_fix"),
                "flagged_by":  sorted(agents_flagging),
                "agent_count": len(agents_flagging),
            })

    # Sort by severity then agent count
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "unknown": 4}
    consensus_issues.sort(
        key=lambda x: (severity_order.get(x["severity"], 4), -x["agent_count"])
    )
    return consensus_issues


def deploy_recommendation(
    aggregate: float | None,
    urgent_dimensions: list[dict],
) -> str:
    if urgent_dimensions:
        return "no"
    if aggregate is None:
        return "conditional"
    if aggregate >= 7.5:
        return "yes"
    if aggregate >= 6.0:
        return "conditional"
    return "no"


def print_summary(consensus: dict[str, Any]) -> None:
    """Print a human-readable summary to stdout for the workflow log."""
    divider = "─" * 60
    print()
    print(divider)
    print("  SiteSync Multi-Agent Verification — Consensus Report")
    print(divider)

    agg = consensus.get("aggregate_score")
    agg_str = f"{agg:.2f}" if agg is not None else "N/A"
    print(f"  Aggregate score (weighted):  {agg_str} / 10")
    print(f"  Deploy recommendation:       {consensus.get('deploy_recommendation', 'unknown').upper()}")
    print()

    print("  Dimension scores:")
    for ds in consensus.get("dimension_scores", []):
        score = ds.get("score")
        score_str = f"{score:>4}/10" if score is not None else "  N/A"
        weight = ds.get("weight", 0)
        skipped = "  (skipped)" if ds.get("skipped") else ""
        print(f"    {ds['dimension']:<14} {score_str}   weight={weight:.2f}{skipped}")

    print()
    urgent = consensus.get("urgent_dimensions", [])
    if urgent:
        print(f"  !! URGENT — {len(urgent)} dimension(s) below {URGENT_THRESHOLD}:")
        for u in urgent:
            print(f"     {u['dimension']}: {u['score']}/10")
    else:
        print("  No urgent dimensions.")

    print()
    ci = consensus.get("consensus_issues", [])
    if ci:
        print(f"  Consensus issues ({len(ci)} flagged by 2+ agents):")
        for issue in ci:
            agents = ", ".join(issue.get("flagged_by", []))
            loc = f"{issue.get('file', '?')}:{issue.get('line', '?')}"
            print(f"    [{issue.get('severity','?').upper()}] {loc}")
            print(f"      {issue.get('description','')}")
            print(f"      (flagged by: {agents})")
    else:
        print("  No cross-agent consensus issues found.")

    print(divider)
    print()


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Aggregate multi-agent review JSONs into consensus.json"
    )
    parser.add_argument(
        "--reviews-dir",
        default=".reviews",
        help="Directory containing agent review JSON files (default: .reviews)",
    )
    args = parser.parse_args()

    reviews_dir = Path(args.reviews_dir)
    if not reviews_dir.exists():
        print(f"ERROR: Reviews directory '{reviews_dir}' does not exist.", file=sys.stderr)
        sys.exit(2)

    print(f"\nReading reviews from: {reviews_dir.resolve()}")
    reviews = load_reviews(reviews_dir)

    if not reviews:
        print("WARNING: No review files found — writing empty consensus.", file=sys.stderr)
        consensus: dict[str, Any] = {
            "aggregate_score":      None,
            "deploy_recommendation": "conditional",
            "urgent_dimensions":    [],
            "consensus_issues":     [],
            "dimension_scores":     [],
            "agent_summaries":      [],
            "error":               "No review files found",
        }
        output_path = reviews_dir / "consensus.json"
        with output_path.open("w") as f:
            json.dump(consensus, f, indent=2)
        print(f"Wrote: {output_path}")
        return 1

    # ── Build dimension score table ──────────────────────────────────────────
    dimension_scores = []
    for review in reviews:
        dimension = review.get("dimension", "unknown")
        score     = get_score(review)
        dimension_scores.append({
            "dimension": dimension,
            "agent":     review.get("agent", "unknown"),
            "score":     score,
            "weight":    CANONICAL_WEIGHTS.get(dimension, 0.0),
            "skipped":   review.get("skipped", False),
            "deploy_recommendation": review.get("deploy_recommendation"),
        })

    # ── Weighted aggregate ───────────────────────────────────────────────────
    aggregate_score = compute_weighted_aggregate(reviews)

    # ── Urgent dimensions (score < 4.0) ──────────────────────────────────────
    urgent_dimensions = [
        {
            "dimension": ds["dimension"],
            "agent":     ds["agent"],
            "score":     ds["score"],
        }
        for ds in dimension_scores
        if ds["score"] is not None and ds["score"] < URGENT_THRESHOLD
    ]

    # ── Consensus issues ─────────────────────────────────────────────────────
    consensus_issues = find_consensus_issues(reviews)

    # ── Per-agent summaries ──────────────────────────────────────────────────
    agent_summaries = [
        {
            "agent":   review.get("agent"),
            "score":   get_score(review),
            "summary": review.get("summary"),
        }
        for review in reviews
    ]

    # ── Deploy recommendation ─────────────────────────────────────────────────
    rec = deploy_recommendation(aggregate_score, urgent_dimensions)

    # ── Build consensus document ─────────────────────────────────────────────
    consensus = {
        "aggregate_score":       aggregate_score,
        "aggregate_threshold":   AGGREGATE_THRESHOLD,
        "urgent_threshold":      URGENT_THRESHOLD,
        "deploy_recommendation": rec,
        "quality_flag":          aggregate_score is not None and aggregate_score < AGGREGATE_THRESHOLD,
        "has_urgent":            len(urgent_dimensions) > 0,
        "urgent_dimensions":     urgent_dimensions,
        "consensus_issues":      consensus_issues,
        "dimension_scores":      dimension_scores,
        "agent_summaries":       agent_summaries,
        "weights_used":          CANONICAL_WEIGHTS,
        "agents_scored":         sum(1 for ds in dimension_scores if ds["score"] is not None),
        "agents_skipped":        sum(1 for ds in dimension_scores if ds.get("skipped")),
    }

    # ── Write output ──────────────────────────────────────────────────────────
    output_path = reviews_dir / "consensus.json"
    with output_path.open("w") as f:
        json.dump(consensus, f, indent=2)

    print(f"Wrote consensus: {output_path}")

    # ── Print summary ─────────────────────────────────────────────────────────
    print_summary(consensus)

    # ── Exit code ─────────────────────────────────────────────────────────────
    if urgent_dimensions:
        print("Exit code 2: urgent dimension(s) detected.", file=sys.stderr)
        return 2
    if aggregate_score is not None and aggregate_score < AGGREGATE_THRESHOLD:
        print(f"Exit code 1: aggregate score {aggregate_score} < {AGGREGATE_THRESHOLD}.", file=sys.stderr)
        return 1

    print("Exit code 0: quality within acceptable thresholds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
