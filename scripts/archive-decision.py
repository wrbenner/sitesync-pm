#!/usr/bin/env python3
"""
archive-decision.py
───────────────────
Records the meta-agent's decision in .agent/prompt-archive.json and
(if action=apply or action=revert) applies the modification to the target file.

Called by self-improve.yml after validation passes.

Environment variables:
  ACTION        -- apply | skip | revert | create_tool
  SUCCESS_RATE  -- tonight's experiment success rate (float 0-1)
  DRY_RUN       -- "true" to log without applying (default: false)

Exits:
  0 = success
  1 = error (modification not applied)
"""

import json
import os
import sys
from datetime import date
from pathlib import Path

PROPOSAL_FILE = Path("/tmp/self-improve/proposal.json")
ARCHIVE_FILE = Path(".agent/prompt-archive.json")
NEW_TOOL_FILE = Path("/tmp/self-improve/new-tool.py")

ACTION = os.environ.get("ACTION", "skip")
SUCCESS_RATE = float(os.environ.get("SUCCESS_RATE", "0") or "0")
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"


def load_archive() -> dict:
    if ARCHIVE_FILE.exists():
        return json.loads(ARCHIVE_FILE.read_text())
    return {
        "_comment": "SICA prompt archive. Never delete entries.",
        "_schema": "1.0",
        "freeze_until": None,
        "freeze_reason": None,
        "versions": [],
    }


def save_archive(archive: dict) -> None:
    ARCHIVE_FILE.parent.mkdir(parents=True, exist_ok=True)
    ARCHIVE_FILE.write_text(json.dumps(archive, indent=2))


def next_version(archive: dict) -> str:
    return f"v{len(archive.get('versions', []))}"


# ── Load proposal ─────────────────────────────────────────────────────────────

if not PROPOSAL_FILE.exists():
    print("ERROR: proposal.json not found", file=sys.stderr)
    sys.exit(1)

proposal = json.loads(PROPOSAL_FILE.read_text())
archive = load_archive()
versions = archive.setdefault("versions", [])


# ── SKIP ─────────────────────────────────────────────────────────────────────

if ACTION == "skip":
    entry = {
        "version": next_version(archive),
        "date": date.today().isoformat(),
        "modification_type": "SKIP",
        "target": None,
        "before": None,
        "after": None,
        "rationale": proposal.get("analysis", "Skip -- no systematic issues detected"),
        "baseline_score": SUCCESS_RATE,
        "score_after": None,
        "deployed": False,
    }
    versions.append(entry)
    save_archive(archive)
    print(f"Logged SKIP as {entry['version']}")
    sys.exit(0)


# ── REVERT ────────────────────────────────────────────────────────────────────

if ACTION == "revert":
    # Find last deployed non-SKIP, non-SEED version
    target_v = None
    for i in range(len(versions) - 2, -1, -1):
        if versions[i].get("deployed") and versions[i].get("modification_type") not in ("SKIP", "SEED"):
            target_v = versions[i]
            break

    if target_v is None:
        print("No previous deployed version found -- cannot revert", file=sys.stderr)
        sys.exit(0)

    target_file = target_v.get("target")
    before_text = target_v.get("after")   # what was applied
    restore_text = target_v.get("before") # what to restore to

    if not target_file or before_text is None:
        print("Incomplete revert data -- skipping", file=sys.stderr)
        sys.exit(0)

    if DRY_RUN:
        print(f"DRY RUN: Would revert {target_file} to pre-{target_v['version']} state")
        sys.exit(0)

    target_path = Path(target_file)
    if not target_path.exists():
        print(f"Target file not found: {target_file}", file=sys.stderr)
        sys.exit(1)

    content = target_path.read_text(encoding="utf-8")
    if before_text and before_text in content:
        content = content.replace(before_text, restore_text or "", 1)
        target_path.write_text(content)
        print(f"Reverted {target_file} to pre-{target_v['version']} state")

        entry = {
            "version": next_version(archive),
            "date": date.today().isoformat(),
            "modification_type": "REVERT",
            "target": target_file,
            "before": before_text,
            "after": restore_text,
            "rationale": f"Reverted {target_v['version']} due to score regression",
            "baseline_score": SUCCESS_RATE,
            "score_after": None,
            "deployed": True,
            "reverts": target_v["version"],
        }
        versions.append(entry)
        save_archive(archive)
        print(f"Revert archived as {entry['version']}")
    else:
        print("WARNING: Revert target text not found in file -- nothing changed", file=sys.stderr)
    sys.exit(0)


# ── APPLY (PROMPT_MODIFICATION or STRATEGY_MODIFICATION) ─────────────────────

if ACTION == "apply":
    before = proposal.get("before", "") or ""
    after = proposal.get("after", "") or ""
    target = proposal.get("target_file", "")

    if not target or after is None:
        print("ERROR: Missing target or after -- cannot apply", file=sys.stderr)
        sys.exit(1)

    if DRY_RUN:
        print("DRY RUN: Would apply modification:")
        print(f"  Target: {target}")
        print(f"  Before: {before[:100]!r}...")
        print(f"  After:  {after[:100]!r}...")
        print(json.dumps(proposal, indent=2))
        sys.exit(0)

    target_path = Path(target)
    if not target_path.exists():
        print(f"ERROR: Target file not found: {target}", file=sys.stderr)
        sys.exit(1)

    content = target_path.read_text(encoding="utf-8")
    if before and before in content:
        content = content.replace(before, after, 1)
    elif not before:
        content = content + "\n" + after
    else:
        print(f"ERROR: 'before' text not found in {target}", file=sys.stderr)
        sys.exit(1)

    target_path.write_text(content)
    print(f"Applied modification to {target}")

    entry = {
        "version": next_version(archive),
        "date": date.today().isoformat(),
        "modification_type": proposal.get("modification_type"),
        "target": target,
        "before": before or None,
        "after": after,
        "rationale": proposal.get("rationale"),
        "expected_impact": proposal.get("expected_impact"),
        "risk": proposal.get("risk"),
        "baseline_score": SUCCESS_RATE,
        "score_after": None,
        "deployed": True,
    }
    versions.append(entry)
    save_archive(archive)
    print(f"Archived as {entry['version']}")
    sys.exit(0)


# ── CREATE_TOOL ───────────────────────────────────────────────────────────────

if ACTION == "create_tool":
    target = proposal.get("target_file", "scripts/new-tool.py")
    tool_name = Path(target).name

    if not NEW_TOOL_FILE.exists():
        print("ERROR: new-tool.py not found", file=sys.stderr)
        sys.exit(1)

    if DRY_RUN:
        print(f"DRY RUN: Would deploy scripts/{tool_name}")
        sys.exit(0)

    dest = Path("scripts") / tool_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(NEW_TOOL_FILE.read_text())
    print(f"Deployed new tool: {dest}")

    entry = {
        "version": next_version(archive),
        "date": date.today().isoformat(),
        "modification_type": "TOOL_CREATION",
        "target": str(dest),
        "before": None,
        "after": f"new tool created: {tool_name}",
        "rationale": proposal.get("rationale"),
        "expected_impact": proposal.get("expected_impact"),
        "risk": proposal.get("risk"),
        "baseline_score": SUCCESS_RATE,
        "score_after": None,
        "deployed": True,
    }
    versions.append(entry)
    save_archive(archive)
    print(f"Tool creation archived as {entry['version']}")
    sys.exit(0)


print(f"Unknown action: {ACTION}", file=sys.stderr)
sys.exit(1)
