#!/usr/bin/env python3
"""
score-night.py — Nightly Score Computer

Reads TONIGHT.md success criteria, REFLECTION.md, and .reviews/consensus.json
to compute a 0-100 score for the night's build.

Scoring dimensions (inspired by CodeX-Verify multi-perspective evaluation):

  1. SUCCESS CRITERIA MET (0-35 points)
     - Parse TONIGHT.md for success criteria
     - Check REFLECTION.md for evidence of completion

  2. VERIFICATION SCORE (0-25 points)
     - Average score from 4 verification agents
     - Penalty for critical issues

  3. CODE HEALTH DELTA (0-20 points)
     - Did TypeScript errors decrease?
     - Did unsafe casts decrease?
     - Did mock data decrease?

  4. BUILD INTEGRITY (0-10 points)
     - Build passes?
     - No regressions introduced?

  5. INTELLIGENCE GROWTH (0-10 points)
     - New learnings added?
     - Skills created or improved?
     - Closer to vision (intelligence, not just features)?

Outputs: .perception/nightly-score.json
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

OUTPUT_DIR = ".perception"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "nightly-score.json")


def read_file(path: str) -> str:
    """Read a file, return empty string if missing."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return ""


def read_json(path: str) -> dict:
    """Read a JSON file, return empty dict if missing or invalid."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, PermissionError):
        return {}


def score_success_criteria() -> dict:
    """Score how well success criteria from TONIGHT.md were met."""
    tonight = read_file("TONIGHT.md")
    reflection = read_file("REFLECTION.md")

    result = {
        "max_points": 35,
        "points": 0,
        "criteria_found": 0,
        "criteria_met": 0,
        "details": [],
    }

    if not tonight:
        result["details"].append("No TONIGHT.md found — cannot evaluate criteria")
        return result

    # Extract success criteria section
    criteria_section = ""
    in_criteria = False
    for line in tonight.split("\n"):
        if re.search(r"success\s+criteria", line, re.IGNORECASE):
            in_criteria = True
            continue
        if in_criteria:
            if line.startswith("## ") and "success" not in line.lower():
                break
            criteria_section += line + "\n"

    # Parse individual criteria (lines starting with - or numbered)
    criteria = []
    for line in criteria_section.split("\n"):
        stripped = line.strip()
        if stripped and (stripped.startswith("-") or re.match(r"^\d+\.", stripped)):
            criterion = re.sub(r"^[-\d.]+\s*", "", stripped).strip()
            if len(criterion) > 10:
                criteria.append(criterion)

    result["criteria_found"] = len(criteria)

    if not criteria:
        result["details"].append("No parseable success criteria found in TONIGHT.md")
        result["points"] = 10  # Partial credit — criteria section exists
        return result

    # Check reflection for evidence of completion
    reflection_lower = reflection.lower()
    for criterion in criteria:
        # Simple keyword matching — look for key phrases from criterion in reflection
        keywords = [w.lower() for w in criterion.split() if len(w) > 4]
        if not keywords:
            continue

        match_count = sum(1 for kw in keywords if kw in reflection_lower)
        match_ratio = match_count / len(keywords)

        met = match_ratio > 0.4  # At least 40% of significant words appear
        result["criteria_met"] += 1 if met else 0
        result["details"].append({
            "criterion": criterion[:100],
            "met": met,
            "confidence": round(match_ratio, 2),
        })

    if result["criteria_found"] > 0:
        ratio = result["criteria_met"] / result["criteria_found"]
        result["points"] = round(ratio * result["max_points"])

    return result


def score_verification() -> dict:
    """Score based on verification agent consensus."""
    consensus = read_json(".reviews/consensus.json")

    result = {
        "max_points": 25,
        "points": 0,
        "details": [],
    }

    if not consensus:
        result["details"].append("No consensus.json found")
        return result

    agents_reporting = consensus.get("agents_reporting", 0)
    avg_score = consensus.get("average_score", 0)
    critical_count = len(consensus.get("critical_issues", []))
    major_count = len(consensus.get("major_issues", []))

    # Base score from average (0-10 scale -> 0-20 points)
    base_points = round((avg_score / 10) * 20)

    # Bonus for agent coverage (0-5 points)
    coverage_points = min(5, round((agents_reporting / 4) * 5))

    # Penalties
    critical_penalty = min(10, critical_count * 5)
    major_penalty = min(5, major_count * 1)

    result["points"] = max(0, min(result["max_points"], base_points + coverage_points - critical_penalty - major_penalty))
    result["details"] = {
        "agents_reporting": agents_reporting,
        "average_score": avg_score,
        "base_points": base_points,
        "coverage_points": coverage_points,
        "critical_penalty": critical_penalty,
        "major_penalty": major_penalty,
        "critical_issues": critical_count,
        "major_issues": major_count,
    }

    return result


def score_code_health() -> dict:
    """Score based on code health delta (before vs after)."""
    result = {
        "max_points": 20,
        "points": 0,
        "details": [],
    }

    # Read current codebase state
    codebase = read_json(".perception/codebase-state.json")
    if not codebase:
        result["details"].append("No codebase-state.json found")
        return result

    health = codebase.get("code_health", {})
    summary = codebase.get("summary", {})

    # Points for low unsafe cast count
    unsafe_casts = health.get("unsafe_any_count", 999)
    if unsafe_casts == 0:
        cast_points = 7
    elif unsafe_casts < 5:
        cast_points = 5
    elif unsafe_casts < 15:
        cast_points = 3
    elif unsafe_casts < 30:
        cast_points = 1
    else:
        cast_points = 0

    # Points for low mock data count
    mock_count = health.get("mock_data_count", 999)
    if mock_count == 0:
        mock_points = 7
    elif mock_count < 5:
        mock_points = 5
    elif mock_count < 15:
        mock_points = 3
    else:
        mock_points = 0

    # Points for having tests
    test_cases = summary.get("test_cases", 0)
    if test_cases > 50:
        test_points = 6
    elif test_cases > 20:
        test_points = 4
    elif test_cases > 5:
        test_points = 2
    else:
        test_points = 0

    result["points"] = min(result["max_points"], cast_points + mock_points + test_points)
    result["details"] = {
        "unsafe_casts": unsafe_casts,
        "cast_points": cast_points,
        "mock_count": mock_count,
        "mock_points": mock_points,
        "test_cases": test_cases,
        "test_points": test_points,
    }

    return result


def score_build_integrity() -> dict:
    """Score based on build passing and no regressions."""
    result = {
        "max_points": 10,
        "points": 0,
        "details": [],
    }

    reflection = read_file("REFLECTION.md").lower()
    consensus = read_json(".reviews/consensus.json")

    # Check if build passes (from reflection or consensus)
    build_passes = (
        "build pass" in reflection
        or "build: pass" in reflection
        or consensus.get("consensus_deploy", False)
    )

    if build_passes:
        result["points"] += 5
        result["details"].append("Build appears to pass")
    else:
        result["details"].append("Build status unclear or failing")

    # Check for regressions
    critical_issues = consensus.get("critical_issues", [])
    has_regressions = any(
        "regression" in str(issue).lower()
        for issue in critical_issues
    )

    if not has_regressions:
        result["points"] += 5
        result["details"].append("No regressions detected")
    else:
        result["details"].append("Regressions detected in critical issues")

    return result


def score_intelligence_growth() -> dict:
    """Score based on growth toward the intelligence vision."""
    result = {
        "max_points": 10,
        "points": 0,
        "details": [],
    }

    # Check for new learnings
    learnings = read_file("LEARNINGS.md")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_learnings = learnings.count(today)

    if today_learnings > 0:
        result["points"] += 3
        result["details"].append(f"New learnings added today: {today_learnings}")

    # Check for skills
    skills_dir = ".claude/skills"
    if os.path.isdir(skills_dir):
        skill_count = sum(1 for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir, d)))
        if skill_count > 0:
            result["points"] += 2
            result["details"].append(f"Skills in library: {skill_count}")

    # Check for intelligence signals in product
    app_state = read_json(".perception/app-state.json")
    pages_with_intelligence = app_state.get("pages_with_intelligence", 0)
    if pages_with_intelligence > 0:
        intel_points = min(5, pages_with_intelligence * 2)
        result["points"] += intel_points
        result["details"].append(f"Pages with intelligence signals: {pages_with_intelligence}")
    else:
        result["details"].append("No intelligence signals detected in product")

    result["points"] = min(result["max_points"], result["points"])
    return result


def main():
    """Compute the nightly score and write results."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Computing nightly score...")

    dimensions = {
        "success_criteria": score_success_criteria(),
        "verification": score_verification(),
        "code_health": score_code_health(),
        "build_integrity": score_build_integrity(),
        "intelligence_growth": score_intelligence_growth(),
    }

    total_score = sum(d["points"] for d in dimensions.values())
    max_score = sum(d["max_points"] for d in dimensions.values())

    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "score": total_score,
        "max_score": max_score,
        "percentage": round((total_score / max_score) * 100, 1) if max_score > 0 else 0,
        "breakdown": {
            name: {"points": d["points"], "max": d["max_points"]}
            for name, d in dimensions.items()
        },
        "details": dimensions,
        "grade": _grade(total_score, max_score),
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(result, f, indent=2)

    # Also save a dated copy for history
    dated_file = os.path.join(
        OUTPUT_DIR,
        f"nightly-score-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.json",
    )
    with open(dated_file, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nNightly Score: {total_score} / {max_score} ({result['percentage']}%)")
    print(f"Grade: {result['grade']}")
    for name, d in dimensions.items():
        print(f"  {name}: {d['points']} / {d['max_points']}")
    print(f"\nWritten to {OUTPUT_FILE}")


def _grade(score: int, max_score: int) -> str:
    """Convert score to letter grade."""
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


if __name__ == "__main__":
    main()
