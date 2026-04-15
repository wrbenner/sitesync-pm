#!/usr/bin/env python3
"""
compile-reflection.py — Clean Reflection Compiler

Writes REFLECTION.md from scratch each run. Does NOT read the existing
REFLECTION.md (which caused recursive duplication in the old pipeline).
Reads only structured data: heartbeat-score.json, experiment-results.json,
consensus.json.

Usage:
    python3 scripts/compile-reflection.py
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
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = []

    lines.append(f"# Heartbeat Reflection — {today}")
    lines.append("")

    # Heartbeat score
    score = read_json(".metrics/heartbeat-score.json")
    if score:
        total = score.get("score", "N/A")
        max_s = score.get("max_score", 100)
        grade = score.get("grade", "N/A")
        lines.append(f"## Score: {total} / {max_s} (Grade: {grade})")
        lines.append("")
        for name, vals in score.get("breakdown", {}).items():
            lines.append(f"- **{name}**: {vals['points']} / {vals['max']}")
        lines.append("")
    else:
        lines.append("## Score: Not available")
        lines.append("")

    # Experiment results
    results = read_json(".metrics/experiment-results.json")
    experiments = results.get("experiments", [])
    if experiments:
        succeeded = [e for e in experiments if e.get("result") == "SUCCESS"]
        reverted = [e for e in experiments if e.get("result") == "REVERTED"]
        lines.append(f"## Experiments: {len(succeeded)} succeeded, {len(reverted)} reverted out of {len(experiments)} total")
        lines.append("")
        lines.append("| Experiment | Result | Before | After | Reason |")
        lines.append("|---|---|---|---|---|")
        for exp in experiments:
            reason = exp.get("reason", "")
            lines.append(f"| {exp.get('id', '?')} | {exp.get('result', '?')} | {exp.get('before', '?')} | {exp.get('after', '?')} | {reason} |")
        lines.append("")
    else:
        lines.append("## Experiments: None run")
        lines.append("")

    # Experiment history trends
    history = read_json(".metrics/experiment-history.json")
    agg = history.get("aggregate", {})
    if agg:
        lines.append("## Cumulative Stats")
        lines.append("")
        lines.append(f"- Total runs: {agg.get('total_runs', 0)}")
        lines.append(f"- Total experiments: {agg.get('total_experiments', 0)}")
        lines.append(f"- Overall success rate: {agg.get('overall_success_rate', 0):.0%}")
        lines.append(f"- Current streak: {agg.get('streak', {}).get('current_successes', 0)} consecutive successes")
        lines.append("")

        cat_rates = agg.get("category_rates", {})
        if cat_rates:
            lines.append("### Category Success Rates")
            lines.append("")
            lines.append("| Category | Succeeded | Total | Rate |")
            lines.append("|---|---|---|---|")
            for cat, stats in sorted(cat_rates.items()):
                lines.append(f"| {cat} | {stats['succeeded']} | {stats['total']} | {stats['rate']:.0%} |")
            lines.append("")

    # Verification consensus (if available)
    consensus = read_json(".reviews/consensus.json")
    if consensus and consensus.get("agents_reporting", 0) > 0:
        lines.append("## Verification Consensus")
        lines.append("")
        lines.append(f"- Agents reporting: {consensus['agents_reporting']} / 4")
        lines.append(f"- Average score: {consensus.get('average_score', 'N/A')} / 10")
        lines.append(f"- Deploy consensus: {'YES' if consensus.get('consensus_deploy') else 'NO'}")
        lines.append(f"- Critical issues: {len(consensus.get('critical_issues', []))}")
        lines.append(f"- Major issues: {len(consensus.get('major_issues', []))}")
        lines.append("")

        for issue in consensus.get("critical_issues", [])[:5]:
            lines.append(f"  - **CRITICAL** [{issue.get('file', 'unknown')}]: {issue.get('description', '')}")
        if consensus.get("critical_issues"):
            lines.append("")

    # Quality floor state
    floor = read_json(".quality-floor.json")
    if floor:
        lines.append("## Quality Floor")
        lines.append("")
        lines.append("| Metric | Current | Target |")
        lines.append("|---|---|---|")
        targets = floor.get("_targets", {})
        for key in ["anyCount", "mockCount", "eslintErrors", "eslintWarnings", "coveragePercent", "bundleSizeKB"]:
            current = floor.get(key, "?")
            target = targets.get(key, "?")
            lines.append(f"| {key} | {current} | {target} |")
        lines.append("")

    # Write REFLECTION.md (overwrite, do NOT append)
    reflection = "\n".join(lines)
    with open("REFLECTION.md", "w") as f:
        f.write(reflection)

    print(f"REFLECTION.md written: {len(reflection)} chars, {len(lines)} lines")


if __name__ == "__main__":
    main()
