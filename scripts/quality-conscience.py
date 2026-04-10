#!/usr/bin/env python3
"""
quality-conscience.py — Pride System for SiteSync PM Autonomous Builder

A fast quality conscience check that the builder runs BEFORE committing each change.
This isn't the full 4-agent verification — it's a rapid gut check. "Would I be proud
of this commit?"

Usage:
    python senses/scripts/quality-conscience.py [--repo-root /path/to/repo]

Reads the staged git diff (or last commit diff) and evaluates:
  1. Completeness — Is this a half-measure?
  2. Craftsmanship — Would you be proud to show this?
  3. User Impact — Does this help the superintendent?
  4. The Pride Test — If this were the only commit tonight, would you be proud?

Outputs .perception/quality-conscience.json with scores and PASS/FAIL verdict.
Exit code: 0 for PASS, 1 for FAIL.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_REPO_ROOT = os.getcwd()
OUTPUT_PATH = ".perception/quality-conscience.json"

# Thresholds
PASS_THRESHOLD = 6.0       # Average score must be >= 6.0 to pass
HARD_FAIL_THRESHOLD = 3.0  # Any dimension below 3.0 is an automatic fail
MIN_DIFF_LINES = 3         # Ignore trivially small diffs


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def run_git(args: list[str], cwd: str) -> str:
    """Run a git command and return stdout."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def save_json(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Diff collection
# ---------------------------------------------------------------------------

def get_staged_diff(repo_root: str) -> str:
    """Get the staged diff (what's about to be committed)."""
    diff = run_git(["diff", "--cached", "--unified=3"], cwd=repo_root)
    if diff:
        return diff
    # Fallback: get the diff of the last commit
    diff = run_git(["diff", "HEAD~1", "--unified=3"], cwd=repo_root)
    return diff


def get_staged_files(repo_root: str) -> list[str]:
    """Get list of staged file paths."""
    output = run_git(["diff", "--cached", "--name-only"], cwd=repo_root)
    if output:
        return output.split("\n")
    # Fallback: last commit files
    output = run_git(["diff", "HEAD~1", "--name-only"], cwd=repo_root)
    return output.split("\n") if output else []


def parse_diff(diff_text: str) -> dict:
    """Parse a unified diff into structured data."""
    files_changed = []
    additions = []
    deletions = []
    current_file = None

    for line in diff_text.split("\n"):
        if line.startswith("diff --git"):
            match = re.search(r"b/(.+)$", line)
            if match:
                current_file = match.group(1)
                files_changed.append(current_file)
        elif line.startswith("+") and not line.startswith("+++"):
            additions.append((current_file, line[1:]))
        elif line.startswith("-") and not line.startswith("---"):
            deletions.append((current_file, line[1:]))

    return {
        "files_changed": files_changed,
        "file_count": len(files_changed),
        "lines_added": len(additions),
        "lines_removed": len(deletions),
        "additions": additions,
        "deletions": deletions,
        "raw": diff_text,
    }


# ---------------------------------------------------------------------------
# Dimension 1: COMPLETENESS — Is this a half-measure?
# ---------------------------------------------------------------------------

def evaluate_completeness(diff: dict) -> dict:
    """Check if the change is complete or half-finished."""
    score = 10.0
    issues = []
    additions_text = "\n".join(text for _, text in diff["additions"])
    files = diff["files_changed"]

    # Check: useQuery/useMutation added but no loading/error handling
    has_query_hook = bool(re.search(r"use(?:Query|Mutation|Infinite)", additions_text))
    has_loading_state = bool(re.search(r"(?:isLoading|isPending|Loading|Spinner|Skeleton)", additions_text))
    has_error_state = bool(re.search(r"(?:isError|error\s*[?&]|Error(?:Boundary|Message|Display)|\bcatch\b)", additions_text))
    has_empty_state = bool(re.search(r"(?:empty|no\s+(?:data|results|items)|length\s*===?\s*0)", additions_text, re.IGNORECASE))

    if has_query_hook:
        if not has_loading_state:
            score -= 2.5
            issues.append("Adds a data hook but no loading state — users will see a blank flash")
        if not has_error_state:
            score -= 2.0
            issues.append("Adds a data hook but no error handling — failures will be silent")
        if not has_empty_state:
            score -= 1.5
            issues.append("Adds a data hook but no empty state — what does the user see with no data?")

    # Check: Component added but not exported from barrel file
    new_components = re.findall(r"export\s+(?:default\s+)?(?:function|const)\s+(\w+)", additions_text)
    tsx_files_added = [f for f in files if f.endswith(".tsx") and not f.endswith("index.tsx")]
    index_files_modified = [f for f in files if f.endswith("index.ts") or f.endswith("index.tsx")]
    if tsx_files_added and not index_files_modified and new_components:
        score -= 1.5
        issues.append(f"New component(s) {new_components[:3]} but no barrel file (index.ts) updated")

    # Check: Page wired to Supabase but no UI to display data
    has_supabase_query = bool(re.search(r"(?:supabase|from\s*\(|\.select\(|\.insert\(|\.update\()", additions_text))
    has_ui_rendering = bool(re.search(r"(?:return\s*\(|<(?:div|section|table|ul|Card|List))", additions_text))
    if has_supabase_query and not has_ui_rendering:
        score -= 2.0
        issues.append("Wired to Supabase but no UI to display the data — invisible change")

    # Check: Test file added but no assertions
    test_files = [f for f in files if re.search(r"\.(?:test|spec)\.", f)]
    if test_files:
        has_assertions = bool(re.search(r"(?:expect\(|assert|toBe|toEqual|toHaveBeenCalled|toContain)", additions_text))
        if not has_assertions:
            score -= 2.0
            issues.append("Test file changed but no assertions found — test is just scaffolding")

    # Check: Route added but not registered in router
    has_new_route_component = bool(re.search(r"(?:Page|View|Screen)\s*[=(]", additions_text)) and tsx_files_added
    has_route_registration = bool(re.search(r"(?:Route|path:|route\(|createRoute)", additions_text))
    if has_new_route_component and not has_route_registration and diff["file_count"] == 1:
        score -= 1.0
        issues.append("New page component but router not updated — page is unreachable")

    score = max(0.0, min(10.0, score))
    return {
        "score": round(score, 1),
        "issues": issues,
        "checks_run": 5,
    }


# ---------------------------------------------------------------------------
# Dimension 2: CRAFTSMANSHIP — Would you be proud to show this?
# ---------------------------------------------------------------------------

def evaluate_craftsmanship(diff: dict) -> dict:
    """Check code quality, naming, and attention to detail."""
    score = 10.0
    issues = []
    additions_text = "\n".join(text for _, text in diff["additions"])

    # Check: console.log left in (not in test files)
    non_test_additions = "\n".join(
        text for fname, text in diff["additions"]
        if fname and not re.search(r"\.(?:test|spec)\.", fname)
    )
    console_logs = re.findall(r"console\.(?:log|warn|error|debug)\(", non_test_additions)
    if console_logs:
        penalty = min(3.0, len(console_logs) * 0.5)
        score -= penalty
        issues.append(f"{len(console_logs)} console.log(s) left in production code")

    # Check: Magic numbers
    magic_numbers = re.findall(r"(?<!\w)(?:setTimeout|setInterval|padding|margin|width|height|top|left|right|bottom|z-index|opacity)\s*[:(]\s*(\d{2,})", additions_text)
    if magic_numbers:
        penalty = min(2.0, len(magic_numbers) * 0.5)
        score -= penalty
        issues.append(f"{len(magic_numbers)} magic number(s) — use named constants")

    # Check: Lazy variable names
    lazy_names = re.findall(r"(?:const|let|var)\s+(data|result|temp|tmp|val|res|ret|item|obj|arr|stuff|thing)\s*[=:]", additions_text)
    if lazy_names:
        penalty = min(2.0, len(lazy_names) * 0.5)
        score -= penalty
        issues.append(f"Generic variable name(s): {', '.join(list(set(lazy_names))[:5])} — be descriptive")

    # Check: Generic error messages
    generic_errors = re.findall(
        r"""(?:["'`])(?:Something went wrong|An error occurred|Error|Failed|Oops|Unknown error)(?:["'`])""",
        additions_text,
        re.IGNORECASE,
    )
    if generic_errors:
        score -= min(2.0, len(generic_errors))
        issues.append(f"{len(generic_errors)} generic error message(s) — tell the user what happened and what to do")

    # Check: `as any` type assertions (TypeScript anti-pattern)
    as_any = re.findall(r"\bas\s+any\b", additions_text)
    if as_any:
        penalty = min(2.0, len(as_any) * 0.5)
        score -= penalty
        issues.append(f"{len(as_any)} 'as any' assertion(s) — fix the type instead of escaping")

    # Check: TODO/FIXME/HACK comments (acceptable but note them)
    todos = re.findall(r"(?:TODO|FIXME|HACK|XXX|TEMP)[\s:]+(.+?)$", additions_text, re.MULTILINE)
    if todos:
        score -= min(1.0, len(todos) * 0.25)
        issues.append(f"{len(todos)} TODO/FIXME comment(s) — technical debt being created")

    # Check: Unused imports (lines that add import but the imported name isn't used elsewhere)
    import_lines = re.findall(r"import\s+{([^}]+)}\s+from", additions_text)
    for import_group in import_lines:
        names = [n.strip().split(" as ")[-1].strip() for n in import_group.split(",")]
        for name in names:
            if name and len(name) > 1:
                # Very rough check: does the name appear in additions beyond the import line?
                non_import_text = re.sub(r"import\s+.+?\n", "", additions_text)
                if name not in non_import_text:
                    score -= 0.5
                    issues.append(f"Possibly unused import: {name}")
                    break  # Only report once per import line

    # Check: Commented-out code (not comments, but code that's been commented)
    commented_code = re.findall(r"^\s*//\s*(?:const|let|var|function|return|import|export|if|for|while)\s", additions_text, re.MULTILINE)
    if len(commented_code) > 2:
        score -= 1.0
        issues.append(f"{len(commented_code)} lines of commented-out code — remove or restore, don't leave ghosts")

    score = max(0.0, min(10.0, score))
    return {
        "score": round(score, 1),
        "issues": issues,
        "checks_run": 8,
    }


# ---------------------------------------------------------------------------
# Dimension 3: USER IMPACT — Does this help the superintendent?
# ---------------------------------------------------------------------------

def evaluate_user_impact(diff: dict) -> dict:
    """Check whether this change affects something the user sees."""
    score = 5.0  # Start at neutral; user-visible changes earn points
    issues = []
    files = diff["files_changed"]
    additions_text = "\n".join(text for _, text in diff["additions"])

    # Categorize files
    config_files = [f for f in files if re.search(
        r"(?:config|\.eslint|tsconfig|vite\.config|tailwind\.config|package\.json|\.env|\.yml|\.yaml)", f
    )]
    test_files = [f for f in files if re.search(r"\.(?:test|spec)\.", f)]
    type_files = [f for f in files if re.search(r"\.d\.ts$|types?\.ts$", f)]
    ui_files = [f for f in files if f.endswith(".tsx") and f not in test_files]
    backend_files = [f for f in files if re.search(r"(?:edge-function|supabase/functions|api/|seed)", f)]
    style_files = [f for f in files if re.search(r"\.css$|\.scss$", f)]

    total_files = len(files)
    if total_files == 0:
        return {"score": 5.0, "issues": ["No files changed"], "checks_run": 5}

    # UI changes are directly visible
    if ui_files:
        score += min(3.0, len(ui_files) * 1.0)
        if not issues:
            issues.append(f"Changes {len(ui_files)} UI file(s) — directly visible to users")

    # Backend/seed changes wire up functionality
    if backend_files:
        score += min(2.0, len(backend_files) * 1.0)
        issues.append(f"Changes {len(backend_files)} backend file(s) — wires up real functionality")

    # Style changes improve visual experience
    if style_files:
        score += 1.0
        issues.append(f"Changes {len(style_files)} style file(s) — visual improvement")

    # Config-only changes are invisible housekeeping
    if config_files and not ui_files and not backend_files:
        score -= 2.0
        issues.append("Config-only change — invisible to users, could wait")

    # Type-only changes are invisible
    if type_files and not ui_files and not backend_files:
        score -= 1.0
        issues.append("Type-only change — improves DX but invisible to users")

    # Test-only changes don't move demo readiness
    if test_files and not ui_files and not backend_files:
        score -= 1.0
        issues.append("Test-only change — good for stability but doesn't move the demo needle")

    # Check for demo-relevant keywords
    demo_keywords = [
        "dashboard", "rfi", "submittal", "schedule", "daily log",
        "copilot", "project", "portfolio", "punch list", "inspection",
    ]
    text_lower = additions_text.lower()
    demo_hits = [kw for kw in demo_keywords if kw in text_lower]
    if demo_hits:
        score += min(2.0, len(demo_hits) * 0.5)
        issues.append(f"Touches demo-relevant area(s): {', '.join(demo_hits[:5])}")

    # Check if it adds user-facing text (labels, headings, messages)
    user_text = re.findall(r">[^<]{10,}<", additions_text)  # Text between JSX tags
    if user_text:
        score += 1.0

    score = max(0.0, min(10.0, score))
    return {
        "score": round(score, 1),
        "issues": issues,
        "checks_run": 5,
    }


# ---------------------------------------------------------------------------
# Dimension 4: THE PRIDE TEST
# ---------------------------------------------------------------------------

def evaluate_pride(diff: dict, completeness: dict, craftsmanship: dict, user_impact: dict) -> dict:
    """The final gut check: 'If this were my only commit tonight, would I be proud?'"""
    # Pride is a weighted synthesis of the other dimensions, plus holistic checks
    avg_score = (completeness["score"] + craftsmanship["score"] + user_impact["score"]) / 3

    score = avg_score
    issues = []

    # Holistic checks

    # Is the diff substantial enough to matter?
    if diff["lines_added"] < 5 and diff["lines_removed"] < 5:
        score -= 1.0
        issues.append("Very small change — is this meaningful enough to commit separately?")

    # Is the diff touching too many files (shotgun change)?
    if diff["file_count"] > 15:
        score -= 2.0
        issues.append(f"Touching {diff['file_count']} files — large blast radius, higher risk of breakage")
    elif diff["file_count"] > 8:
        score -= 1.0
        issues.append(f"Touching {diff['file_count']} files — consider splitting into focused commits")

    # Is the commit message area clear? (check if files tell a coherent story)
    file_dirs = set(os.path.dirname(f) for f in diff["files_changed"] if f)
    if len(file_dirs) > 5:
        score -= 1.0
        issues.append(f"Changes span {len(file_dirs)} directories — this might be doing too many things at once")

    # Positive: Does this commit tell a complete story?
    if diff["file_count"] <= 5 and completeness["score"] >= 8 and craftsmanship["score"] >= 8:
        score += 1.0
        issues.append("Clean, focused commit with high completeness and craftsmanship")

    # Positive: Does this commit wire something end-to-end?
    additions_text = "\n".join(text for _, text in diff["additions"])
    has_frontend = any(f.endswith(".tsx") for f in diff["files_changed"])
    has_backend = any("supabase" in f or "edge" in f or "api" in f for f in diff["files_changed"])
    if has_frontend and has_backend:
        score += 1.5
        issues.append("End-to-end change (frontend + backend) — this moves the needle")

    score = max(0.0, min(10.0, score))
    return {
        "score": round(score, 1),
        "issues": issues,
        "checks_run": 4,
    }


# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------

def compute_verdict(
    completeness: dict,
    craftsmanship: dict,
    user_impact: dict,
    pride: dict,
) -> dict:
    """Compute the final PASS/FAIL verdict with reasoning."""
    scores = {
        "completeness": completeness["score"],
        "craftsmanship": craftsmanship["score"],
        "user_impact": user_impact["score"],
        "pride": pride["score"],
    }
    avg = sum(scores.values()) / len(scores)

    # Determine verdict
    verdict = "PASS"
    reasons = []

    # Hard fail: any dimension below threshold
    for dim, score in scores.items():
        if score < HARD_FAIL_THRESHOLD:
            verdict = "FAIL"
            reasons.append(f"{dim} scored {score}/10 — below minimum threshold of {HARD_FAIL_THRESHOLD}")

    # Soft fail: average below threshold
    if avg < PASS_THRESHOLD:
        verdict = "FAIL"
        reasons.append(f"Average score {avg:.1f}/10 — below pass threshold of {PASS_THRESHOLD}")

    # Collect all improvement suggestions
    all_issues = []
    all_issues.extend(completeness.get("issues", []))
    all_issues.extend(craftsmanship.get("issues", []))
    all_issues.extend(user_impact.get("issues", []))
    all_issues.extend(pride.get("issues", []))

    # Generate improvement guidance for FAIL
    improvement = ""
    if verdict == "FAIL":
        improvement_lines = ["To make this commit worthy:"]
        # Prioritize the lowest-scoring dimension
        lowest_dim = min(scores, key=scores.get)
        if lowest_dim == "completeness":
            improvement_lines.append("- Complete the change: add missing loading/error/empty states, update barrel files, wire both frontend and backend")
        elif lowest_dim == "craftsmanship":
            improvement_lines.append("- Clean up: remove console.logs, replace magic numbers with constants, use descriptive names, write specific error messages")
        elif lowest_dim == "user_impact":
            improvement_lines.append("- Make it visible: ensure this change affects something the user actually sees, or bundle it with a user-visible improvement")
        elif lowest_dim == "pride":
            improvement_lines.append("- Focus: split into smaller commits, ensure each one tells a complete story")

        for issue in all_issues[:5]:
            improvement_lines.append(f"- {issue}")
        improvement = "\n".join(improvement_lines)

    return {
        "verdict": verdict,
        "average_score": round(avg, 1),
        "scores": scores,
        "reasons": reasons,
        "improvement": improvement,
        "issues_count": len(all_issues),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_quality_conscience(repo_root: str) -> dict:
    """Run the quality conscience check on the current staged diff."""

    print("[conscience] Running quality conscience check...")

    # 1. Get the diff
    diff_text = get_staged_diff(repo_root)
    if not diff_text:
        print("[conscience] No diff found (nothing staged and no previous commit).")
        result = {
            "timestamp": now_iso(),
            "verdict": "SKIP",
            "reason": "No diff to evaluate",
            "scores": {},
        }
        save_json(os.path.join(repo_root, OUTPUT_PATH), result)
        return result

    diff = parse_diff(diff_text)

    if diff["lines_added"] + diff["lines_removed"] < MIN_DIFF_LINES:
        print(f"[conscience] Trivial diff ({diff['lines_added']} added, {diff['lines_removed']} removed). Skipping.")
        result = {
            "timestamp": now_iso(),
            "verdict": "SKIP",
            "reason": f"Trivial diff ({diff['lines_added']} lines added, {diff['lines_removed']} removed)",
            "scores": {},
        }
        save_json(os.path.join(repo_root, OUTPUT_PATH), result)
        return result

    print(f"[conscience] Evaluating: {diff['file_count']} files, +{diff['lines_added']}/-{diff['lines_removed']} lines")

    # 2. Evaluate each dimension
    completeness = evaluate_completeness(diff)
    craftsmanship = evaluate_craftsmanship(diff)
    user_impact = evaluate_user_impact(diff)
    pride = evaluate_pride(diff, completeness, craftsmanship, user_impact)

    # 3. Compute verdict
    verdict = compute_verdict(completeness, craftsmanship, user_impact, pride)

    # 4. Assemble output
    result = {
        "timestamp": now_iso(),
        "diff_summary": {
            "files_changed": diff["file_count"],
            "lines_added": diff["lines_added"],
            "lines_removed": diff["lines_removed"],
            "files": diff["files_changed"][:20],
        },
        "dimensions": {
            "completeness": completeness,
            "craftsmanship": craftsmanship,
            "user_impact": user_impact,
            "pride": pride,
        },
        "verdict": verdict["verdict"],
        "average_score": verdict["average_score"],
        "scores": verdict["scores"],
        "improvement": verdict.get("improvement", ""),
    }

    # 5. Save
    output_path = os.path.join(repo_root, OUTPUT_PATH)
    save_json(output_path, result)

    # 6. Print results
    print(f"\n{'=' * 60}")
    print(f"  QUALITY CONSCIENCE — {verdict['verdict']}")
    print(f"{'=' * 60}")
    print(f"  Completeness:   {completeness['score']:4.1f}/10")
    print(f"  Craftsmanship:  {craftsmanship['score']:4.1f}/10")
    print(f"  User Impact:    {user_impact['score']:4.1f}/10")
    print(f"  Pride:          {pride['score']:4.1f}/10")
    print(f"  ─────────────────────────")
    print(f"  Average:        {verdict['average_score']:4.1f}/10")
    print(f"  Verdict:        {verdict['verdict']}")
    print(f"{'=' * 60}")

    if verdict["verdict"] == "FAIL":
        print(f"\n{verdict.get('improvement', '')}")
        print(f"\n  You have standards. This doesn't meet them yet.")
        print(f"  Improve the change before committing.\n")
    else:
        # Even on PASS, note any issues
        all_issues = []
        for dim in [completeness, craftsmanship, user_impact, pride]:
            all_issues.extend(dim.get("issues", []))
        if all_issues:
            print(f"\n  Notes:")
            for issue in all_issues[:5]:
                print(f"    • {issue}")
        print(f"\n  This work is worthy. Commit with confidence.\n")

    return result


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Quality conscience check for SiteSync PM autonomous builder."
    )
    parser.add_argument(
        "--repo-root",
        default=DEFAULT_REPO_ROOT,
        help="Path to the repository root (default: current directory)",
    )
    args = parser.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    if not os.path.isdir(repo_root):
        print(f"Error: Repository root not found: {repo_root}", file=sys.stderr)
        sys.exit(1)

    result = run_quality_conscience(repo_root)

    # Exit code: 0 for PASS/SKIP, 1 for FAIL
    if result.get("verdict") == "FAIL":
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
