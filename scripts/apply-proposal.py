#!/usr/bin/env python3
"""
apply-proposal.py — Proposal Validator and Deployer

Reads .agent/proposal.json, validates it against safety constraints
(from .agent/runbook.json), applies it if valid, records the result
in .agent/prompt-archive.json.

Safety constraints:
- Modification must be <= 200 characters
- "before" text must exist in target file
- Target file must be in the allowed list
- Cannot remove circuit breaker or quality gate text
- Modified file must still parse (syntax check)

Usage:
    python3 scripts/apply-proposal.py
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


def write_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


ALLOWED_TARGETS = {
    "scripts/generate-experiments.py",
    "scripts/run-experiments.sh",
}

FORBIDDEN_REMOVALS = [
    "CIRCUIT BREAKER",
    "circuit breaker",
    "MAX_CONSECUTIVE_FAILURES",
    "npx tsc --noEmit",
    "npx vite build",
    "npx vitest run",
    "quality gate",
    "git checkout --",
    "git clean -fd",
    "--dangerously-skip-permissions",
]


def validate_proposal(proposal):
    """Validate proposal against safety constraints. Returns (valid, reason)."""
    decision = proposal.get("decision", "SKIP")

    if decision == "SKIP":
        return True, "SKIP decisions are always valid"

    if decision not in ("PROMPT_MODIFICATION", "STRATEGY_MODIFICATION", "REVERT", "TOOL_CREATION"):
        return False, f"Unknown decision type: {decision}"

    mod = proposal.get("modification", {})
    if not mod:
        return False, "No modification specified"

    before = mod.get("before", "")
    after = mod.get("after", "")
    target = proposal.get("target_file", "")

    # Check target is allowed
    if target not in ALLOWED_TARGETS:
        return False, f"Target file '{target}' not in allowed list: {ALLOWED_TARGETS}"

    # Check target file exists
    if not os.path.exists(target):
        return False, f"Target file '{target}' does not exist"

    # Check character limit
    char_count = len(after)
    if char_count > 200:
        return False, f"Modification is {char_count} chars, exceeds 200 char limit"

    # Check before text exists in target
    try:
        with open(target) as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return False, f"Cannot read target file '{target}'"

    if before and before not in content:
        return False, f"'before' text not found in {target}. Stale or hallucinated modification."

    # Check no forbidden patterns are being removed
    for pattern in FORBIDDEN_REMOVALS:
        if pattern in before and pattern not in after:
            return False, f"Cannot remove forbidden pattern: '{pattern}'"

    return True, "Validation passed"


def apply_modification(proposal):
    """Apply the modification to the target file. Returns (success, reason)."""
    target = proposal["target_file"]
    mod = proposal["modification"]
    before = mod["before"]
    after = mod["after"]

    try:
        with open(target) as f:
            content = f.read()
    except (IOError, UnicodeDecodeError):
        return False, f"Cannot read {target}"

    if before not in content:
        return False, f"'before' text no longer in {target}"

    # Apply the replacement
    new_content = content.replace(before, after, 1)

    # Syntax check before writing
    if target.endswith(".py"):
        try:
            compile(new_content, target, "exec")
        except SyntaxError as e:
            return False, f"Python syntax error after modification: {e}"
    elif target.endswith(".sh"):
        # Write to temp file and check with bash -n
        tmp = f"/tmp/self-improve-check-{os.getpid()}.sh"
        with open(tmp, "w") as f:
            f.write(new_content)
        try:
            result = subprocess.run(["bash", "-n", tmp], capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                return False, f"Bash syntax error: {result.stderr[:200]}"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass  # Skip check if bash not available
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass

    # Write the modified file
    with open(target, "w") as f:
        f.write(new_content)

    return True, "Modification applied successfully"


def record_in_archive(proposal, applied, reason, success_rate):
    """Record this decision in .agent/prompt-archive.json."""
    archive = read_json(".agent/prompt-archive.json") or {"versions": []}
    versions = archive.get("versions", [])

    # Determine version number
    last_version = 0
    for v in versions:
        ver = v.get("version", "v0")
        try:
            num = int(ver.replace("v", ""))
            last_version = max(last_version, num)
        except ValueError:
            pass

    new_version = f"v{last_version + 1}"
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    mod = proposal.get("modification", {})
    entry = {
        "version": new_version,
        "date": today,
        "modification_type": proposal.get("decision", "SKIP"),
        "target": proposal.get("target_file", ""),
        "before": mod.get("before", ""),
        "after": mod.get("after", ""),
        "rationale": proposal.get("rationale", ""),
        "expected_impact": proposal.get("expected_impact", ""),
        "risk": proposal.get("risk", ""),
        "baseline_score": round(success_rate, 2) if success_rate else None,
        "score_after": None,
        "deployed": applied,
        "validation_result": reason,
    }

    versions.append(entry)
    archive["versions"] = versions
    write_json(".agent/prompt-archive.json", archive)

    return new_version


def main():
    print("Proposal Validator and Deployer")
    print("=" * 40)

    proposal = read_json(".agent/proposal.json")
    if not proposal:
        print("  No proposal found at .agent/proposal.json")
        return

    decision = proposal.get("decision", "SKIP")
    print(f"  Decision: {decision}")
    print(f"  Rationale: {proposal.get('rationale', 'N/A')}")

    # Get current success rate for archive
    history = read_json(".metrics/experiment-history.json")
    success_rate = history.get("aggregate", {}).get("overall_success_rate", 0.0)

    if decision == "SKIP":
        print("  SKIP — no changes to apply.")
        record_in_archive(proposal, False, "SKIP decision", success_rate)
        return

    # Validate
    valid, reason = validate_proposal(proposal)
    print(f"  Validation: {'PASSED' if valid else 'FAILED'} — {reason}")

    if not valid:
        record_in_archive(proposal, False, reason, success_rate)
        print("  Proposal REJECTED. No changes applied.")
        return

    # Apply
    success, apply_reason = apply_modification(proposal)
    print(f"  Application: {'SUCCESS' if success else 'FAILED'} — {apply_reason}")

    if not success:
        record_in_archive(proposal, False, apply_reason, success_rate)
        print("  Modification FAILED. No changes persisted.")
        return

    # Record success
    version = record_in_archive(proposal, True, "Applied successfully", success_rate)
    print(f"  Modification DEPLOYED as {version}.")
    print(f"  Target: {proposal.get('target_file')}")
    print(f"  Archived in .agent/prompt-archive.json")


if __name__ == "__main__":
    main()
