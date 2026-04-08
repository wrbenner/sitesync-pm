#!/usr/bin/env python3
"""
initialize-archive.py
─────────────────────
One-time setup script for the SICA self-improvement loop.

Creates .agent/prompt-archive.json with the current organism prompt as v0.
Run this manually once before the first self-improvement session, or let
self-improve.yml call it automatically on first run.

Usage:
    python3 wave2/scripts/initialize-archive.py

    # Dry run (preview only, don't write files)
    python3 wave2/scripts/initialize-archive.py --dry-run

    # Force overwrite (re-seeds even if archive exists)
    python3 wave2/scripts/initialize-archive.py --force
"""

import argparse
import json
import os
import re
import sys
from datetime import date
from pathlib import Path


# ── Configuration ────────────────────────────────────────────────────────────

ARCHIVE_DIR = Path(".agent")
ARCHIVE_FILE = ARCHIVE_DIR / "prompt-archive.json"
NIGHTLY_WORKFLOW = Path(".github/workflows/nightly-build.yml")
PRODUCT_MIND_WORKFLOW = Path(".github/workflows/product-mind.yml")


# ── Prompt Extraction ────────────────────────────────────────────────────────

def extract_organism_prompt(workflow_path: Path) -> dict:
    """
    Extract the organism's Claude prompt from nightly-build.yml.
    Returns dict with 'text', 'char_count', and 'section_hashes'.
    """
    if not workflow_path.exists():
        return {
            "text": f"[Could not read {workflow_path} — file not found]",
            "char_count": 0,
            "sections": {}
        }

    content = workflow_path.read_text(encoding="utf-8")

    # Extract the full claude invocation block
    # Heuristic: everything between the first `claude \` line and `Output <promise>DONE</promise>`
    prompt_match = re.search(
        r'claude \\\s*\n(?:.*\n)*?.*?\"(You are the SiteSync PM Organism.*?Output <promise>DONE</promise>)',
        content,
        re.DOTALL
    )

    if prompt_match:
        prompt_text = prompt_match.group(1)
    else:
        # Fallback: extract everything after the claude invocation starts
        claude_start = content.find("claude \\")
        if claude_start != -1:
            # Get from the first quoted string after claude invocation
            quote_start = content.find('"', claude_start)
            quote_end = content.rfind('"', quote_start + 1, claude_start + 15000)
            if quote_start != -1 and quote_end != -1:
                prompt_text = content[quote_start + 1:quote_end]
            else:
                prompt_text = content[claude_start:]
        else:
            prompt_text = "[Could not locate claude invocation in workflow]"

    # Extract key sections for targeted modification tracking
    sections = {}
    section_patterns = {
        "circuit_breakers": r"=== CIRCUIT BREAKERS.*?(?===|\Z)",
        "quality_gates": r"QUALITY GATES.*?(?=d\) MEASURE|\Z)",
        "rules": r"=== RULES.*?(?===|\Z)",
        "loop": r"=== THE LOOP.*?(?===|\Z)",
        "step_1": r"STEP 1:.*?(?=STEP 2|\Z)",
    }
    for name, pattern in section_patterns.items():
        match = re.search(pattern, prompt_text, re.DOTALL)
        if match:
            sections[name] = {
                "text": match.group(0)[:500],  # first 500 chars of each section
                "char_count": len(match.group(0))
            }

    return {
        "text": prompt_text[:8000],  # cap at 8K to keep archive readable
        "char_count": len(prompt_text),
        "sections": sections,
        "full_workflow_lines": len(content.splitlines())
    }


def extract_product_mind_prompt(workflow_path: Path) -> dict:
    """Extract the Product Mind prompt for baseline recording."""
    if not workflow_path.exists():
        return {"text": f"[Could not read {workflow_path}]", "char_count": 0}

    content = workflow_path.read_text(encoding="utf-8")
    prompt_match = re.search(
        r'"(You are The Product Mind.*?Output <promise>DONE</promise>)',
        content,
        re.DOTALL
    )
    if prompt_match:
        text = prompt_match.group(1)
    else:
        text = content[:4000]

    return {"text": text[:4000], "char_count": len(text)}


# ── Directory Structure ───────────────────────────────────────────────────────

def create_agent_directories(dry_run: bool = False):
    """Create the .agent/ directory structure."""
    directories = [
        ARCHIVE_DIR,
        ARCHIVE_DIR / "insights_db",
        ARCHIVE_DIR / "tools",
    ]
    for d in directories:
        if not dry_run:
            d.mkdir(parents=True, exist_ok=True)
            print(f"  Created: {d}/")
        else:
            print(f"  [DRY RUN] Would create: {d}/")


# ── Archive Initialization ───────────────────────────────────────────────────

def initialize_archive(dry_run: bool = False, force: bool = False) -> dict:
    """
    Create the initial prompt archive with the current prompt as v0.
    Returns the archive dict.
    """
    today = date.today().isoformat()

    # Extract prompts
    print("\nExtracting organism prompt from nightly-build.yml...")
    organism_prompt = extract_organism_prompt(NIGHTLY_WORKFLOW)
    print(f"  Extracted {organism_prompt['char_count']} chars")
    print(f"  Sections found: {list(organism_prompt['sections'].keys())}")

    print("\nExtracting Product Mind prompt from product-mind.yml...")
    pm_prompt = extract_product_mind_prompt(PRODUCT_MIND_WORKFLOW)
    print(f"  Extracted {pm_prompt['char_count']} chars")

    archive = {
        "_comment": (
            "SICA-style prompt version archive. "
            "NEVER delete entries — stepping stones matter even when scores are low. "
            "See: Darwin Gödel Machine (Sakana AI 2025) and SICA (Bristol 2025)."
        ),
        "_schema": "1.0",
        "_created": today,
        "_initialized_by": "initialize-archive.py",
        "freeze_until": None,
        "freeze_reason": None,
        "versions": [
            {
                "version": "v0",
                "date": today,
                "modification_type": "SEED",
                "target": str(NIGHTLY_WORKFLOW),
                "before": None,
                "after": None,
                "rationale": (
                    "Initial seed — baseline prompt before SICA self-improvement loop began. "
                    "This is the stepping-stone root of the evolution tree."
                ),
                "baseline_score": None,     # Populated after first organism run
                "score_after": None,        # Will be populated by next self-improve run
                "deployed": True,
                "is_seed": True,
                "prompt_snapshot": {
                    "organism": organism_prompt,
                    "product_mind": pm_prompt,
                },
                "metrics_at_seed": _collect_current_metrics()
            }
        ]
    }

    return archive


def _collect_current_metrics() -> dict:
    """Collect whatever baseline metrics we can read right now."""
    metrics = {}

    # Try reading .metrics/ files
    metrics_dir = Path(".metrics")
    if metrics_dir.exists():
        for metrics_file in metrics_dir.glob("*.json"):
            try:
                data = json.loads(metrics_file.read_text())
                metrics[metrics_file.stem] = data
            except Exception:
                pass

    # Try counting TS errors from tsconfig if available
    # (we don't run tsc here to keep this script fast)

    # Try reading EXPERIMENTS.md for current state
    if Path("EXPERIMENTS.md").exists():
        content = Path("EXPERIMENTS.md").read_text(encoding="utf-8", errors="replace")
        metrics["experiments_at_seed"] = {
            "total": len(re.findall(r"EXP-\d+", content)),
            "passed": content.count("✅"),
            "failed": content.count("❌"),
            "pending": content.count("PENDING")
        }

    return metrics


# ── Runbook Creation ─────────────────────────────────────────────────────────

def create_runbook(dry_run: bool = False):
    """
    Create .agent/runbook.json with standard failure patterns.
    Based on Meta REA's failure runbook pattern (Area 10, research-breakthrough.md).
    """
    runbook = {
        "_comment": "Failure runbook for the self-improvement loop. Based on Meta REA patterns.",
        "runbook": {
            "yaml_parse_error": {
                "action": "reject_modification_and_skip",
                "description": "Modified workflow file failed YAML parse — never deploy",
                "max_retries": 0
            },
            "circuit_breaker_removed": {
                "action": "reject_modification_and_alert",
                "description": "Safety violation — circuit breakers must never be removed",
                "max_retries": 0
            },
            "no_proposal_generated": {
                "action": "skip_and_alert",
                "description": "Meta-agent produced no proposal.json output",
                "max_retries": 0
            },
            "modification_too_large": {
                "action": "reject_modification",
                "description": "Modification exceeds 200-character limit — reject",
                "max_retries": 0
            },
            "score_regression": {
                "action": "revert_last_modification",
                "description": "Success rate dropped >10% after last modification",
                "threshold": 0.10,
                "max_retries": 0
            },
            "three_consecutive_no_improvement": {
                "action": "freeze_for_2_nights",
                "description": "Three nights without improvement — stability phase",
                "freeze_days": 2,
                "max_retries": 0
            },
            "target_file_not_found": {
                "action": "reject_modification",
                "description": "Meta-agent proposed modifying a file that doesn't exist",
                "max_retries": 0
            },
            "before_text_not_found": {
                "action": "reject_modification",
                "description": "The 'before' text was not found in target file — stale or hallucinated",
                "max_retries": 0
            }
        }
    }

    path = ARCHIVE_DIR / "runbook.json"
    if not dry_run:
        path.write_text(json.dumps(runbook, indent=2))
        print(f"  Created: {path}")
    else:
        print(f"  [DRY RUN] Would create: {path}")

    return runbook


# ── State File ───────────────────────────────────────────────────────────────

def create_state_file(dry_run: bool = False):
    """
    Create .agent/state.json — the hibernate-wake state file.
    Based on Meta REA's state persistence architecture (Area 10).
    """
    state = {
        "_comment": "Current self-improvement state. Read at start of each session (REA hibernate-wake pattern).",
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
        "freeze_until": None
    }

    path = ARCHIVE_DIR / "state.json"
    if not dry_run:
        path.write_text(json.dumps(state, indent=2))
        print(f"  Created: {path}")
    else:
        print(f"  [DRY RUN] Would create: {path}")

    return state


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Initialize the SICA self-improvement prompt archive",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview what would be created without writing any files")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing archive (re-seed from current prompt)")
    args = parser.parse_args()

    print("═" * 60)
    print("SiteSync PM — SICA Self-Improvement Archive Initializer")
    print("═" * 60)

    if args.dry_run:
        print("  [DRY RUN MODE — no files will be written]\n")

    # Check if archive already exists
    if ARCHIVE_FILE.exists() and not args.force:
        print(f"\nArchive already exists at {ARCHIVE_FILE}")
        archive = json.loads(ARCHIVE_FILE.read_text())
        version_count = len(archive.get("versions", []))
        print(f"  Contains {version_count} version(s)")
        print(f"  Last version: {archive['versions'][-1]['version'] if archive['versions'] else 'none'}")
        print("\nUse --force to re-seed from current prompt.")
        sys.exit(0)

    # Create directory structure
    print("\n[1/4] Creating .agent/ directory structure...")
    create_agent_directories(dry_run=args.dry_run)

    # Initialize archive
    print("\n[2/4] Initializing prompt archive (v0 seed)...")
    archive = initialize_archive(dry_run=args.dry_run, force=args.force)

    if not args.dry_run:
        ARCHIVE_FILE.write_text(json.dumps(archive, indent=2))
        print(f"  Created: {ARCHIVE_FILE}")
        print(f"  Archive seed contains {archive['versions'][0]['prompt_snapshot']['organism']['char_count']} char organism prompt")
    else:
        print(f"  [DRY RUN] Would create: {ARCHIVE_FILE}")
        print(f"  [DRY RUN] Organism prompt: {archive['versions'][0]['prompt_snapshot']['organism']['char_count']} chars")
        print(f"  [DRY RUN] Sections extracted: {list(archive['versions'][0]['prompt_snapshot']['organism']['sections'].keys())}")

    # Create runbook
    print("\n[3/4] Creating failure runbook...")
    create_runbook(dry_run=args.dry_run)

    # Create state file
    print("\n[4/4] Creating state file...")
    create_state_file(dry_run=args.dry_run)

    print("\n" + "═" * 60)
    if not args.dry_run:
        print("✓ Initialization complete")
        print(f"\n  Archive location: {ARCHIVE_FILE}")
        print(f"  Versions: 1 (v0 seed)")
        print(f"\nNext steps:")
        print("  1. Commit .agent/ to the repository:")
        print("       git add .agent/")
        print("       git commit -m 'chore: initialize SICA self-improvement archive [skip ci]'")
        print("  2. The self-improve.yml workflow will run automatically after")
        print("     the next nightly organism run completes.")
        print("  3. To disable: create FREEZE_SELF_IMPROVE.md in the repo root.")
    else:
        print("[DRY RUN] Complete — no files written")
    print("═" * 60)


if __name__ == "__main__":
    main()
