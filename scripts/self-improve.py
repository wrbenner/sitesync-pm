#!/usr/bin/env python3
"""
self-improve.py — SICA Self-Improvement Agent

The meta-agent that makes the heartbeat improve itself. Reads experiment
history, identifies patterns, and proposes ONE targeted modification per
night. Implements the decision framework from .agent/IDENTITY.md.

Principles (from IDENTITY.md):
1. Small changes compound (1 mod/night, max 200 chars)
2. Stability > cleverness (skip if >80% success rate)
3. Evidence over intuition (only modify based on measured failures)
4. Safety first (never remove circuit breakers or quality gates)
5. Reversibility always (archive all versions in prompt-archive.json)

Usage:
    python3 scripts/self-improve.py
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


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


ALLOWED_TARGETS = [
    "scripts/generate-experiments.py",
    "scripts/run-experiments.sh",
]

FORBIDDEN_PATTERNS = [
    "circuit breaker",
    "CIRCUIT BREAKER",
    "MAX_CONSECUTIVE_FAILURES",
    "npx tsc --noEmit",
    "npx vite build",
    "npx vitest run",
    "quality gate",
    "QUALITY GATE",
    "git checkout --",
    "git clean -fd",
]


def load_state():
    return read_json(".agent/state.json") or {
        "phase": "initialized",
        "last_run": None,
        "last_modification_type": None,
        "last_modification_target": None,
        "consecutive_skips": 0,
        "total_runs": 0,
        "total_modifications_deployed": 0,
        "best_success_rate_ever": None,
        "best_success_rate_date": None,
        "current_freeze": False,
        "freeze_until": None,
    }


def load_archive():
    data = read_json(".agent/prompt-archive.json")
    return data.get("versions", []) if data else []


def check_last_modification_regressed(archive, current_rate):
    """Check if the last modification caused a regression."""
    if len(archive) < 2:
        return False

    last = archive[-1]
    if last.get("is_seed"):
        return False

    baseline = last.get("baseline_score")
    if baseline is not None and current_rate < baseline - 0.1:
        return True

    return False


def identify_worst_category(category_rates):
    """Find the category with the lowest success rate (min 3 experiments attempted)."""
    worst_cat = None
    worst_rate = 1.0

    for cat, stats in category_rates.items():
        if stats.get("total", 0) >= 3 and stats.get("rate", 1.0) < worst_rate:
            worst_rate = stats["rate"]
            worst_cat = cat

    return worst_cat, worst_rate


def propose_category_weight_adjustment(worst_cat, worst_rate, category_rates):
    """Propose reducing the cap for a failing category."""
    # Read current generator to see the cap
    try:
        with open("scripts/generate-experiments.py") as f:
            generator_code = f.read()
    except FileNotFoundError:
        return None

    # Find the slice limit for this category's experiments
    # The generator uses patterns like `[:3]` or `[:5]` to cap experiments
    if worst_cat == "TESTING":
        before = "targets[:3]"
        after = "targets[:1]"
        rationale = f"TESTING category success rate is {worst_rate:.0%} over 3+ experiments. Reducing scope to 1 test experiment per night to improve success rate."
    elif worst_cat == "HARDCODED_COLORS":
        before = "color_files[:3]"
        after = "color_files[:1]"
        rationale = f"HARDCODED_COLORS category success rate is {worst_rate:.0%}. Reducing to 1 experiment to conserve budget."
    elif worst_cat == "ESLINT_MANUAL":
        before = "files[:5]"
        after = "files[:3]"
        rationale = f"ESLINT_MANUAL category success rate is {worst_rate:.0%}. Reducing top files from 5 to 3."
    else:
        return None

    if before not in generator_code:
        return None

    return {
        "decision": "STRATEGY_MODIFICATION",
        "rationale": rationale,
        "target_file": "scripts/generate-experiments.py",
        "modification": {
            "before": before,
            "after": after,
            "char_count": len(after),
        },
        "expected_impact": f"Increase {worst_cat} success rate by focusing on fewer, higher-quality experiments",
        "risk": f"Fewer {worst_cat} experiments generated per night",
    }


def propose_prompt_adjustment(history, category_rates):
    """Propose a prompt tweak to the experiment runner based on failure patterns."""
    # Analyze failure reasons
    all_experiments = []
    for run in history.get("runs", [])[-7:]:  # Last 7 runs
        all_experiments.extend(run.get("experiments", []))

    # Count failure reasons
    no_changes_count = sum(1 for e in all_experiments if e.get("result") == "NO_CHANGES")
    gate_fail_count = sum(1 for e in all_experiments if "gates=false" in e.get("reason", ""))
    not_improved_count = sum(1 for e in all_experiments if "improved=false" in e.get("reason", ""))

    total_failures = no_changes_count + gate_fail_count + not_improved_count
    if total_failures < 3:
        return None

    # Most common failure type
    if no_changes_count > gate_fail_count and no_changes_count > not_improved_count:
        # Claude isn't making changes — needs more explicit instructions
        return {
            "decision": "PROMPT_MODIFICATION",
            "rationale": f"{no_changes_count} experiments produced NO_CHANGES. Claude is not modifying files. Adding explicit 'you MUST edit the file' instruction.",
            "target_file": "scripts/run-experiments.sh",
            "modification": {
                "before": "Read LEARNINGS.md for patterns to follow.",
                "after": "Read LEARNINGS.md for patterns to follow.\nYou MUST edit at least one file. Do not just read and report.",
                "char_count": 67,
            },
            "expected_impact": "Reduce NO_CHANGES failures by making the instruction more explicit",
            "risk": "Claude might make unnecessary changes to satisfy the instruction",
        }
    elif gate_fail_count > not_improved_count:
        # Quality gates failing — Claude is making bad changes
        return {
            "decision": "PROMPT_MODIFICATION",
            "rationale": f"{gate_fail_count} experiments failed quality gates. Adding 'check tsc before finishing' reminder.",
            "target_file": "scripts/run-experiments.sh",
            "modification": {
                "before": "Keep changes minimal and focused. One clear fix, not a refactor.",
                "after": "Keep changes minimal and focused. One clear fix, not a refactor.\nBefore finishing, run: npx tsc --noEmit",
                "char_count": 50,
            },
            "expected_impact": "Reduce gate failures by making Claude self-check before finishing",
            "risk": "Slightly longer experiment runs",
        }

    return None


def main():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"SICA Self-Improvement Agent — {today}")
    print("=" * 50)

    state = load_state()
    archive = load_archive()
    history = read_json(".metrics/experiment-history.json")
    agg = history.get("aggregate", {})

    overall_rate = agg.get("overall_success_rate", 0.0)
    total_experiments = agg.get("total_experiments", 0)
    category_rates = agg.get("category_rates", {})

    print(f"  Overall success rate: {overall_rate:.0%}")
    print(f"  Total experiments tracked: {total_experiments}")
    print(f"  Total runs: {state.get('total_runs', 0)}")

    # Check freeze
    if state.get("current_freeze"):
        freeze_until = state.get("freeze_until", "")
        if freeze_until and today < freeze_until:
            print(f"  FROZEN until {freeze_until}. Skipping.")
            proposal = {"decision": "SKIP", "rationale": f"Frozen until {freeze_until}"}
            write_json(".agent/proposal.json", proposal)
            state["total_runs"] = state.get("total_runs", 0) + 1
            state["consecutive_skips"] = state.get("consecutive_skips", 0) + 1
            state["last_run"] = today
            write_json(".agent/state.json", state)
            return
        else:
            state["current_freeze"] = False
            state["freeze_until"] = None

    # Not enough data yet — skip
    if total_experiments < 5:
        print(f"  Not enough data ({total_experiments} experiments). Need 5+ to analyze. SKIP.")
        proposal = {
            "decision": "SKIP",
            "rationale": f"Only {total_experiments} experiments tracked. Need 5+ for reliable analysis.",
        }
        write_json(".agent/proposal.json", proposal)
        state["total_runs"] = state.get("total_runs", 0) + 1
        state["consecutive_skips"] = state.get("consecutive_skips", 0) + 1
        state["last_run"] = today
        state["phase"] = "collecting_data"
        write_json(".agent/state.json", state)
        print(f"  State updated: total_runs={state['total_runs']}")
        return

    # Decision framework (from IDENTITY.md)
    proposal = None

    # Check if last modification regressed
    if check_last_modification_regressed(archive, overall_rate):
        print("  Last modification REGRESSED performance. Proposing REVERT.")
        last = archive[-1]
        proposal = {
            "decision": "REVERT",
            "rationale": f"Success rate dropped after last modification (v{last.get('version', '?')}). Reverting.",
            "target_file": last.get("target", ""),
            "modification": {
                "before": last.get("after", ""),
                "after": last.get("before", ""),
                "char_count": len(last.get("before", "")),
            },
        }

    # > 80% success rate — stable, don't touch
    elif overall_rate >= 0.8:
        print(f"  Success rate {overall_rate:.0%} >= 80%. System is stable. SKIP.")
        proposal = {
            "decision": "SKIP",
            "rationale": f"Success rate {overall_rate:.0%} is healthy. No modification needed.",
        }

    # 60-80% — look for specific category failures
    elif overall_rate >= 0.6:
        worst_cat, worst_rate = identify_worst_category(category_rates)
        if worst_cat and worst_rate < 0.4:
            print(f"  Category {worst_cat} at {worst_rate:.0%}. Proposing strategy modification.")
            proposal = propose_category_weight_adjustment(worst_cat, worst_rate, category_rates)
        if not proposal:
            proposal = propose_prompt_adjustment(history, category_rates)
        if not proposal:
            print(f"  Success rate {overall_rate:.0%}, no clear pattern. SKIP.")
            proposal = {"decision": "SKIP", "rationale": f"Success rate {overall_rate:.0%}, no actionable pattern found."}

    # < 60% — investigate
    else:
        worst_cat, worst_rate = identify_worst_category(category_rates)
        if worst_cat and worst_rate < 0.3:
            print(f"  Category {worst_cat} at {worst_rate:.0%}. Proposing strategy modification.")
            proposal = propose_category_weight_adjustment(worst_cat, worst_rate, category_rates)
        if not proposal:
            proposal = propose_prompt_adjustment(history, category_rates)
        if not proposal:
            print(f"  Success rate {overall_rate:.0%}, no clear pattern despite low rate. SKIP.")
            proposal = {
                "decision": "SKIP",
                "rationale": f"Success rate {overall_rate:.0%} but no clear failure pattern. Stability > random change.",
            }

    # Track consecutive skips
    if proposal and proposal["decision"] == "SKIP":
        state["consecutive_skips"] = state.get("consecutive_skips", 0) + 1
    else:
        state["consecutive_skips"] = 0

    # Three consecutive skips with low performance = freeze
    if state["consecutive_skips"] >= 3 and overall_rate < 0.5:
        from datetime import timedelta
        freeze_date = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d")
        state["current_freeze"] = True
        state["freeze_until"] = freeze_date
        print(f"  3 consecutive skips with low rate. Freezing until {freeze_date}.")

    # Update best rate
    if overall_rate > (state.get("best_success_rate_ever") or 0):
        state["best_success_rate_ever"] = round(overall_rate, 2)
        state["best_success_rate_date"] = today

    # Write proposal and state
    write_json(".agent/proposal.json", proposal)
    state["total_runs"] = state.get("total_runs", 0) + 1
    state["last_run"] = today
    state["last_modification_type"] = proposal.get("decision")
    state["last_modification_target"] = proposal.get("target_file")
    state["phase"] = "active"
    write_json(".agent/state.json", state)

    print(f"\n  Decision: {proposal['decision']}")
    print(f"  Rationale: {proposal.get('rationale', 'N/A')}")
    print(f"  Proposal written to .agent/proposal.json")
    print(f"  State updated: total_runs={state['total_runs']}")


if __name__ == "__main__":
    main()
