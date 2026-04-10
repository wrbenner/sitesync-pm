#!/usr/bin/env python3
"""
update-world-model.py — Persistent World Model for SiteSync PM Autonomous Builder

Maintains .agent/world-model.json — a structured knowledge graph that accumulates
understanding across nightly builds. This is the MEMORY system: it enables the
strategic intelligence to ask questions like "which pages have been stuck for 3+ nights?"
or "what's our demo readiness trend this week?"

Usage:
    python senses/scripts/update-world-model.py [--repo-root /path/to/repo]

Called by reflect-and-evolve.yml after the nightly reflection step.
"""

import json
import os
import re
import subprocess
import sys
import glob as glob_module
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_REPO_ROOT = os.getcwd()
WORLD_MODEL_PATH = ".agent/world-model.json"
PERCEPTION_DIR = ".perception"
REFLECTION_PATH = "REFLECTION.md"
TONIGHT_PATH = "TONIGHT.md"
EVOLUTION_LEDGER_PATH = "EVOLUTION_LEDGER.json"
PROMPT_ARCHIVE_PATH = ".agent/prompt-archive.json"
STATE_PATH = ".agent/state.json"
CURIOSITY_FINDINGS_PATH = ".agent/curiosity-findings.json"

VERSION = "1.0"
MAX_HISTORY_ENTRIES = 60  # Keep ~2 months of nightly history
MAX_PAGE_HISTORY = 14     # Keep 2 weeks of per-page history


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def load_json(path: str) -> Optional[dict]:
    """Load a JSON file, returning None if it doesn't exist or is malformed."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, PermissionError):
        return None


def save_json(path: str, data: dict) -> None:
    """Save data as formatted JSON, creating parent directories if needed."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def read_text(path: str) -> Optional[str]:
    """Read a text file, returning None if it doesn't exist."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def run_git(args: list[str], cwd: str) -> str:
    """Run a git command and return stdout. Returns empty string on failure."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def today_iso() -> str:
    """Return today's date in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def now_iso() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Data collection functions
# ---------------------------------------------------------------------------

def collect_perception_data(repo_root: str) -> dict:
    """Read all perception JSON files from .perception/ directory."""
    perception = {}
    perception_dir = os.path.join(repo_root, PERCEPTION_DIR)
    if not os.path.isdir(perception_dir):
        return perception

    for fpath in sorted(glob_module.glob(os.path.join(perception_dir, "*.json"))):
        key = Path(fpath).stem
        data = load_json(fpath)
        if data is not None:
            perception[key] = data
    return perception


def collect_reflection(repo_root: str) -> Optional[str]:
    """Read REFLECTION.md content."""
    return read_text(os.path.join(repo_root, REFLECTION_PATH))


def collect_tonight(repo_root: str) -> Optional[str]:
    """Read TONIGHT.md content."""
    return read_text(os.path.join(repo_root, TONIGHT_PATH))


def collect_evolution_ledger(repo_root: str) -> Optional[dict]:
    """Read the evolution ledger."""
    return load_json(os.path.join(repo_root, EVOLUTION_LEDGER_PATH))


def collect_nightly_score(perception: dict) -> Optional[float]:
    """Extract the nightly score from perception data."""
    # Try multiple known locations for the score
    for key in ["demo-readiness", "demo_readiness", "nightly-score", "score"]:
        if key in perception:
            data = perception[key]
            if isinstance(data, dict):
                for score_key in ["overall_score", "score", "total", "overall"]:
                    if score_key in data:
                        try:
                            return float(data[score_key])
                        except (ValueError, TypeError):
                            continue
            elif isinstance(data, (int, float)):
                return float(data)
    return None


def collect_git_log_tonight(repo_root: str) -> list[dict]:
    """Get tonight's commits from git log (last 24 hours)."""
    log_output = run_git(
        ["log", "--since=24 hours ago", "--format=%H|%s|%an|%aI", "--no-merges"],
        cwd=repo_root,
    )
    commits = []
    if not log_output:
        return commits

    for line in log_output.split("\n"):
        parts = line.split("|", 3)
        if len(parts) >= 2:
            commits.append({
                "hash": parts[0][:8],
                "message": parts[1],
                "author": parts[2] if len(parts) > 2 else "unknown",
                "date": parts[3] if len(parts) > 3 else today_iso(),
            })
    return commits


def collect_experiment_results(perception: dict) -> dict:
    """Extract experiment pass/fail counts from perception data."""
    results = {"passed": 0, "failed": 0, "total": 0}
    for key in ["experiments", "experiment-results", "homeostasis"]:
        if key in perception and isinstance(perception[key], dict):
            data = perception[key]
            results["passed"] = data.get("passed", data.get("pass", 0))
            results["failed"] = data.get("failed", data.get("fail", 0))
            results["total"] = results["passed"] + results["failed"]
            break
    return results


# ---------------------------------------------------------------------------
# Analysis functions
# ---------------------------------------------------------------------------

def analyze_page_states(perception: dict) -> dict:
    """Analyze the state of each page from perception data."""
    pages = {}

    # Look for page inventory or route analysis in perception
    for key in ["page-inventory", "pages", "routes", "route-analysis"]:
        if key in perception and isinstance(perception[key], (dict, list)):
            data = perception[key]
            if isinstance(data, dict):
                items = data.get("pages", data.get("routes", data))
                if isinstance(items, list):
                    for page in items:
                        if isinstance(page, dict):
                            name = page.get("name", page.get("route", page.get("path", "unknown")))
                            pages[name] = {
                                "wired_to_db": page.get("wired_to_db", page.get("has_db", False)),
                                "last_evaluated": today_iso(),
                                "user_experience": page.get("user_experience", page.get("status", "unknown")),
                                "priority": page.get("priority", "P2"),
                            }
                elif isinstance(items, dict):
                    for name, info in items.items():
                        if isinstance(info, dict):
                            pages[name] = {
                                "wired_to_db": info.get("wired_to_db", info.get("has_db", False)),
                                "last_evaluated": today_iso(),
                                "user_experience": info.get("user_experience", info.get("status", "unknown")),
                                "priority": info.get("priority", "P2"),
                            }
            break

    return pages


def analyze_architecture(perception: dict) -> dict:
    """Extract architecture metrics from perception data."""
    arch = {
        "total_pages": 0,
        "pages_with_db": 0,
        "pages_without_db": 0,
        "edge_functions": 0,
        "edge_functions_wired": 0,
        "test_coverage_pct": 0.0,
    }

    # Pull from various perception sources
    for key in ["architecture", "codebase", "code-analysis", "codebase-stats"]:
        if key in perception and isinstance(perception[key], dict):
            data = perception[key]
            arch["total_pages"] = data.get("total_pages", data.get("page_count", arch["total_pages"]))
            arch["pages_with_db"] = data.get("pages_with_db", data.get("wired_pages", arch["pages_with_db"]))
            arch["edge_functions"] = data.get("edge_functions", data.get("edge_function_count", arch["edge_functions"]))
            arch["edge_functions_wired"] = data.get("edge_functions_wired", data.get("wired_edge_functions", arch["edge_functions_wired"]))
            arch["test_coverage_pct"] = data.get("test_coverage_pct", data.get("coverage", arch["test_coverage_pct"]))
            break

    arch["pages_without_db"] = max(0, arch["total_pages"] - arch["pages_with_db"])
    return arch


def extract_recurring_problems(perception: dict, reflection: Optional[str]) -> list[dict]:
    """Identify recurring problems from perception and reflection."""
    problems = []

    # From perception
    for key in ["problems", "issues", "blockers", "lint-errors"]:
        if key in perception and isinstance(perception[key], (list, dict)):
            data = perception[key]
            if isinstance(data, list):
                for item in data[:10]:
                    if isinstance(item, str):
                        problems.append({"pattern": item, "frequency": 1, "root_cause": "unknown"})
                    elif isinstance(item, dict):
                        problems.append({
                            "pattern": item.get("message", item.get("pattern", str(item))),
                            "frequency": item.get("count", item.get("frequency", 1)),
                            "root_cause": item.get("root_cause", item.get("cause", "unknown")),
                        })

    # From reflection text — look for "struggled with" or "failed" patterns
    if reflection:
        struggle_patterns = re.findall(
            r"(?:struggled? with|failed? to|couldn't|didn't work|broke|issue with)\s+(.+?)(?:\.|$)",
            reflection,
            re.IGNORECASE | re.MULTILINE,
        )
        for pattern in struggle_patterns[:5]:
            problems.append({
                "pattern": pattern.strip(),
                "frequency": 1,
                "root_cause": "from reflection",
            })

    return problems


def extract_successful_patterns(perception: dict, reflection: Optional[str]) -> list[dict]:
    """Identify successful patterns from perception and reflection."""
    patterns = []

    for key in ["successful-patterns", "patterns", "wins"]:
        if key in perception and isinstance(perception[key], list):
            for item in perception[key][:10]:
                if isinstance(item, str):
                    patterns.append({"pattern": item, "times_used": 1, "success_rate": 1.0})
                elif isinstance(item, dict):
                    patterns.append({
                        "pattern": item.get("pattern", item.get("name", str(item))),
                        "times_used": item.get("times_used", item.get("count", 1)),
                        "success_rate": item.get("success_rate", 1.0),
                    })

    # From reflection — look for "worked well" or "succeeded" patterns
    if reflection:
        success_patterns = re.findall(
            r"(?:worked? well|succeeded?|success|improved?|fixed|resolved|shipped)\s+(.+?)(?:\.|$)",
            reflection,
            re.IGNORECASE | re.MULTILINE,
        )
        for pattern in success_patterns[:5]:
            patterns.append({
                "pattern": pattern.strip(),
                "times_used": 1,
                "success_rate": 1.0,
            })

    return patterns


def extract_strategic_insights(
    reflection: Optional[str],
    tonight: Optional[str],
    ledger: Optional[dict],
) -> dict:
    """Build strategic understanding from reflection, tonight's direction, and evolution ledger."""
    strategic = {
        "what_works": [],
        "what_fails": [],
        "competitive_position": {
            "ahead_of_procore": [],
            "behind_procore": [],
            "unique_advantages": [],
        },
        "demo_strategy": {
            "must_show": [],
            "skip_in_demo": [],
            "wow_moment": "",
        },
    }

    # From evolution ledger
    if ledger:
        for evolution in ledger.get("evolutions", []):
            if isinstance(evolution, dict):
                if evolution.get("success", evolution.get("status")) in (True, "success", "passed"):
                    strategic["what_works"].append(
                        evolution.get("summary", evolution.get("description", "unknown evolution"))
                    )
                elif evolution.get("status") in ("killed", "failed", "reverted"):
                    strategic["what_fails"].append(
                        evolution.get("summary", evolution.get("description", "unknown evolution"))
                    )

        for killed in ledger.get("killed_approaches", []):
            if isinstance(killed, dict):
                strategic["what_fails"].append(
                    killed.get("approach", killed.get("description", str(killed)))
                )
            elif isinstance(killed, str):
                strategic["what_fails"].append(killed)

        for pattern in ledger.get("patterns", []):
            if isinstance(pattern, dict):
                strategic["what_works"].append(
                    pattern.get("pattern", pattern.get("description", str(pattern)))
                )
            elif isinstance(pattern, str):
                strategic["what_works"].append(pattern)

    return strategic


def compute_demo_readiness(
    perception: dict,
    pages: dict,
    arch: dict,
) -> dict:
    """Compute demo readiness scores."""
    readiness = {
        "overall_score": 0,
        "scene_scores": {},
        "critical_blockers": [],
        "trend": "stable",
    }

    # Try to get score from perception
    score = collect_nightly_score(perception)
    if score is not None:
        readiness["overall_score"] = score

    # Extract scene scores if available
    for key in ["demo-readiness", "demo_readiness", "demo-rehearsal"]:
        if key in perception and isinstance(perception[key], dict):
            data = perception[key]
            if "scene_scores" in data:
                readiness["scene_scores"] = data["scene_scores"]
            elif "scenes" in data:
                readiness["scene_scores"] = data["scenes"]

            if "blockers" in data:
                blockers = data["blockers"]
                if isinstance(blockers, list):
                    readiness["critical_blockers"] = [
                        b if isinstance(b, str) else b.get("description", str(b))
                        for b in blockers[:10]
                    ]
            break

    return readiness


def compute_trend(history: list[dict], key: str = "score") -> str:
    """Compute trend from nightly history. Returns 'improving', 'stable', or 'declining'."""
    if len(history) < 2:
        return "stable"

    # Look at last 5 entries
    recent = history[-5:]
    scores = [
        h.get(key) for h in recent
        if h.get(key) is not None
    ]

    if len(scores) < 2:
        return "stable"

    # Compare first half to second half
    mid = len(scores) // 2
    first_half_avg = sum(scores[:mid]) / max(mid, 1)
    second_half_avg = sum(scores[mid:]) / max(len(scores) - mid, 1)

    diff = second_half_avg - first_half_avg
    if diff > 2:
        return "improving"
    elif diff < -2:
        return "declining"
    return "stable"


# ---------------------------------------------------------------------------
# Merge functions — the heart of accumulation
# ---------------------------------------------------------------------------

def merge_pages(existing_pages: dict, new_pages: dict) -> dict:
    """Merge new page data into existing, preserving history."""
    merged = dict(existing_pages)

    for name, new_data in new_pages.items():
        if name in merged:
            existing = merged[name]
            # Preserve and extend history
            history = existing.get("history", [])

            # Check if state changed
            old_state = existing.get("user_experience", "unknown")
            new_state = new_data.get("user_experience", "unknown")
            old_wired = existing.get("wired_to_db", False)
            new_wired = new_data.get("wired_to_db", False)

            if old_state != new_state or old_wired != new_wired:
                history.append({
                    "date": today_iso(),
                    "state": new_state,
                    "wired_to_db": new_wired,
                    "action_taken": "changed" if old_state != new_state else "db wiring changed",
                })

            # Trim history to max
            history = history[-MAX_PAGE_HISTORY:]

            merged[name] = {
                **existing,
                **new_data,
                "history": history,
                "nights_tracked": existing.get("nights_tracked", 0) + 1,
                "nights_stuck": (
                    existing.get("nights_stuck", 0) + 1
                    if old_state == new_state and not new_wired
                    else 0
                ),
            }
        else:
            # New page discovered
            merged[name] = {
                **new_data,
                "history": [{
                    "date": today_iso(),
                    "state": new_data.get("user_experience", "unknown"),
                    "wired_to_db": new_data.get("wired_to_db", False),
                    "action_taken": "first observation",
                }],
                "nights_tracked": 1,
                "nights_stuck": 0,
            }

    return merged


def merge_problems(existing: list[dict], new: list[dict]) -> list[dict]:
    """Merge recurring problems, incrementing frequency for known patterns."""
    # Build a map of existing patterns
    pattern_map: dict[str, dict] = {}
    for p in existing:
        key = p.get("pattern", "").lower().strip()
        if key:
            pattern_map[key] = p

    for p in new:
        key = p.get("pattern", "").lower().strip()
        if not key:
            continue
        if key in pattern_map:
            pattern_map[key]["frequency"] = pattern_map[key].get("frequency", 0) + p.get("frequency", 1)
            if p.get("root_cause", "unknown") != "unknown":
                pattern_map[key]["root_cause"] = p["root_cause"]
        else:
            pattern_map[key] = p

    # Sort by frequency descending, keep top 20
    sorted_problems = sorted(pattern_map.values(), key=lambda x: x.get("frequency", 0), reverse=True)
    return sorted_problems[:20]


def merge_successful_patterns(existing: list[dict], new: list[dict]) -> list[dict]:
    """Merge successful patterns, incrementing usage counts."""
    pattern_map: dict[str, dict] = {}
    for p in existing:
        key = p.get("pattern", "").lower().strip()
        if key:
            pattern_map[key] = p

    for p in new:
        key = p.get("pattern", "").lower().strip()
        if not key:
            continue
        if key in pattern_map:
            pattern_map[key]["times_used"] = pattern_map[key].get("times_used", 0) + p.get("times_used", 1)
            # Update success rate as running average
            old_rate = pattern_map[key].get("success_rate", 1.0)
            new_rate = p.get("success_rate", 1.0)
            pattern_map[key]["success_rate"] = round((old_rate + new_rate) / 2, 2)
        else:
            pattern_map[key] = p

    sorted_patterns = sorted(pattern_map.values(), key=lambda x: x.get("times_used", 0), reverse=True)
    return sorted_patterns[:20]


def merge_strategic(existing: dict, new: dict) -> dict:
    """Merge strategic understanding, deduplicating lists."""
    merged = {}
    for key in ["what_works", "what_fails"]:
        existing_items = existing.get(key, [])
        new_items = new.get(key, [])
        # Deduplicate by lowercase comparison
        seen = set()
        combined = []
        for item in existing_items + new_items:
            normalized = item.lower().strip()
            if normalized not in seen:
                seen.add(normalized)
                combined.append(item)
        merged[key] = combined[-20:]  # Keep most recent 20

    # Merge competitive position
    existing_cp = existing.get("competitive_position", {})
    new_cp = new.get("competitive_position", {})
    merged["competitive_position"] = {}
    for subkey in ["ahead_of_procore", "behind_procore", "unique_advantages"]:
        existing_items = existing_cp.get(subkey, [])
        new_items = new_cp.get(subkey, [])
        if new_items:
            merged["competitive_position"][subkey] = new_items  # New replaces old for competitive
        else:
            merged["competitive_position"][subkey] = existing_items

    # Merge demo strategy
    existing_ds = existing.get("demo_strategy", {})
    new_ds = new.get("demo_strategy", {})
    merged["demo_strategy"] = {}
    for subkey in ["must_show", "skip_in_demo"]:
        existing_items = existing_ds.get(subkey, [])
        new_items = new_ds.get(subkey, [])
        if new_items:
            merged["demo_strategy"][subkey] = new_items
        else:
            merged["demo_strategy"][subkey] = existing_items
    merged["demo_strategy"]["wow_moment"] = (
        new_ds.get("wow_moment") or existing_ds.get("wow_moment", "")
    )

    return merged


def append_nightly_entry(
    existing_history: list[dict],
    commits: list[dict],
    experiments: dict,
    score: Optional[float],
    reflection: Optional[str],
    tonight: Optional[str],
) -> list[dict]:
    """Add tonight's entry to the nightly history."""
    # Determine the night number
    night_number = len(existing_history) + 1

    # Extract direction from TONIGHT.md
    direction = "unknown"
    if tonight:
        first_line = tonight.strip().split("\n")[0]
        direction = first_line.replace("#", "").strip()[:100]

    # Extract key learning from reflection
    key_learning = ""
    if reflection:
        # Look for key takeaways
        learning_match = re.search(
            r"(?:key (?:learning|takeaway|insight)|learned|realized|discovered)[\s:]+(.+?)(?:\n|$)",
            reflection,
            re.IGNORECASE,
        )
        if learning_match:
            key_learning = learning_match.group(1).strip()[:200]
        else:
            # Take the first substantive line
            for line in reflection.split("\n"):
                line = line.strip()
                if line and not line.startswith("#") and len(line) > 20:
                    key_learning = line[:200]
                    break

    entry = {
        "night": night_number,
        "date": today_iso(),
        "direction": direction,
        "commits": len(commits),
        "experiments_passed": experiments.get("passed", 0),
        "experiments_failed": experiments.get("failed", 0),
        "score": score,
        "key_learning": key_learning,
    }

    # Avoid duplicate entries for the same date
    existing_history = [h for h in existing_history if h.get("date") != today_iso()]
    existing_history.append(entry)

    # Trim to max
    return existing_history[-MAX_HISTORY_ENTRIES:]


# ---------------------------------------------------------------------------
# Feature tracking
# ---------------------------------------------------------------------------

def analyze_features(perception: dict) -> dict:
    """Analyze feature status from perception data."""
    features = {}

    for key in ["features", "feature-status", "feature-inventory"]:
        if key in perception and isinstance(perception[key], (dict, list)):
            data = perception[key]
            if isinstance(data, dict):
                for feature_name, feature_data in data.items():
                    if isinstance(feature_data, dict):
                        features[feature_name] = {
                            "status": feature_data.get("status", "unknown"),
                            "blocker": feature_data.get("blocker", ""),
                            "last_updated": today_iso(),
                        }
                    elif isinstance(feature_data, str):
                        features[feature_name] = {
                            "status": feature_data,
                            "blocker": "",
                            "last_updated": today_iso(),
                        }
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and "name" in item:
                        features[item["name"]] = {
                            "status": item.get("status", "unknown"),
                            "blocker": item.get("blocker", ""),
                            "last_updated": today_iso(),
                        }
            break

    return features


def merge_features(existing: dict, new: dict) -> dict:
    """Merge feature data, preserving history of status changes."""
    merged = dict(existing)
    for name, new_data in new.items():
        if name in merged:
            old_status = merged[name].get("status", "unknown")
            new_status = new_data.get("status", "unknown")
            history = merged[name].get("status_history", [])
            if old_status != new_status:
                history.append({
                    "date": today_iso(),
                    "from": old_status,
                    "to": new_status,
                })
                history = history[-10:]  # Keep last 10 transitions
            merged[name] = {
                **merged[name],
                **new_data,
                "status_history": history,
            }
        else:
            merged[name] = {
                **new_data,
                "status_history": [],
            }
    return merged


# ---------------------------------------------------------------------------
# Days-until-demo calculation
# ---------------------------------------------------------------------------

def days_until_demo() -> int:
    """Calculate days remaining until the April 15 2026 demo."""
    demo_date = datetime(2026, 4, 15, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    delta = demo_date - now
    return max(0, delta.days)


# ---------------------------------------------------------------------------
# Main world model build/update
# ---------------------------------------------------------------------------

def build_world_model(repo_root: str) -> dict:
    """Build or update the persistent world model."""

    # 1. Load existing world model (crucial for accumulation)
    existing_path = os.path.join(repo_root, WORLD_MODEL_PATH)
    existing = load_json(existing_path) or {}

    print(f"[world-model] {'Updating' if existing else 'Creating'} world model...")

    # 2. Collect tonight's data
    perception = collect_perception_data(repo_root)
    reflection = collect_reflection(repo_root)
    tonight = collect_tonight(repo_root)
    ledger = collect_evolution_ledger(repo_root)
    commits = collect_git_log_tonight(repo_root)
    experiments = collect_experiment_results(perception)
    score = collect_nightly_score(perception)

    print(f"[world-model] Perception files: {len(perception)}")
    print(f"[world-model] Tonight's commits: {len(commits)}")
    print(f"[world-model] Score: {score}")
    print(f"[world-model] Experiments: {experiments['passed']} passed, {experiments['failed']} failed")

    # 3. Analyze tonight's data
    new_pages = analyze_page_states(perception)
    new_arch = analyze_architecture(perception)
    new_problems = extract_recurring_problems(perception, reflection)
    new_patterns = extract_successful_patterns(perception, reflection)
    new_strategic = extract_strategic_insights(reflection, tonight, ledger)
    new_readiness = compute_demo_readiness(perception, new_pages, new_arch)
    new_features = analyze_features(perception)

    # 4. Merge with existing data
    existing_product = existing.get("product_understanding", {})
    existing_technical = existing.get("technical_understanding", {})
    existing_strategic = existing.get("strategic_understanding", {})
    existing_history = existing.get("nightly_history", [])

    # Merge pages
    merged_pages = merge_pages(
        existing_product.get("pages", {}),
        new_pages,
    )

    # Merge features
    merged_features = merge_features(
        existing_product.get("features", {}),
        new_features,
    )

    # Merge architecture (new data replaces old for current-state metrics)
    merged_arch = existing_technical.get("architecture", {})
    for k, v in new_arch.items():
        if v != 0 or k not in merged_arch:  # Don't overwrite with zeros unless first run
            merged_arch[k] = v

    # Track architecture history for trend analysis
    arch_history = existing_technical.get("architecture_history", [])
    arch_snapshot = {**new_arch, "date": today_iso()}
    arch_history = [h for h in arch_history if h.get("date") != today_iso()]
    arch_history.append(arch_snapshot)
    arch_history = arch_history[-MAX_HISTORY_ENTRIES:]

    # Merge problems and patterns
    merged_problems = merge_problems(
        existing_technical.get("recurring_problems", []),
        new_problems,
    )
    merged_patterns = merge_successful_patterns(
        existing_technical.get("successful_patterns", []),
        new_patterns,
    )

    # Merge strategic understanding
    merged_strategic = merge_strategic(
        existing_strategic,
        new_strategic,
    )

    # Build nightly history
    nightly_history = append_nightly_entry(
        existing_history,
        commits,
        experiments,
        score,
        reflection,
        tonight,
    )

    # Compute trends
    demo_trend = compute_trend(nightly_history, "score")
    new_readiness["trend"] = demo_trend

    # If we have a previous score but no new score, preserve the old one
    if new_readiness["overall_score"] == 0:
        old_readiness = existing_product.get("demo_readiness", {})
        if old_readiness.get("overall_score", 0) > 0:
            new_readiness["overall_score"] = old_readiness["overall_score"]

    # 5. Compute derived insights
    stuck_pages = [
        name for name, data in merged_pages.items()
        if data.get("nights_stuck", 0) >= 3
    ]

    unwired_pages = [
        name for name, data in merged_pages.items()
        if not data.get("wired_to_db", False)
    ]

    # 6. Assemble the complete world model
    world_model = {
        "_version": VERSION,
        "_last_updated": now_iso(),
        "_night_count": len(nightly_history),
        "_days_until_demo": days_until_demo(),

        "product_understanding": {
            "pages": merged_pages,
            "features": merged_features,
            "demo_readiness": new_readiness,
        },

        "technical_understanding": {
            "architecture": merged_arch,
            "architecture_history": arch_history,
            "recurring_problems": merged_problems,
            "successful_patterns": merged_patterns,
        },

        "strategic_understanding": merged_strategic,

        "derived_insights": {
            "stuck_pages": stuck_pages,
            "stuck_page_count": len(stuck_pages),
            "unwired_pages": unwired_pages,
            "unwired_page_count": len(unwired_pages),
            "demo_trend": demo_trend,
            "nights_of_improvement": sum(
                1 for h in nightly_history
                if h.get("score") is not None and
                any(
                    prev.get("score") is not None and h["score"] > prev["score"]
                    for prev in nightly_history[:nightly_history.index(h)]
                )
            ),
            "total_commits": sum(h.get("commits", 0) for h in nightly_history),
            "total_experiments_passed": sum(h.get("experiments_passed", 0) for h in nightly_history),
            "total_experiments_failed": sum(h.get("experiments_failed", 0) for h in nightly_history),
        },

        "nightly_history": nightly_history,
    }

    # 7. Save
    output_path = os.path.join(repo_root, WORLD_MODEL_PATH)
    save_json(output_path, world_model)
    print(f"[world-model] Saved to {output_path}")
    print(f"[world-model] Night #{len(nightly_history)} | "
          f"Pages tracked: {len(merged_pages)} | "
          f"Stuck pages: {len(stuck_pages)} | "
          f"Demo trend: {demo_trend} | "
          f"Days until demo: {days_until_demo()}")

    return world_model


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Update the persistent world model for SiteSync PM autonomous builder."
    )
    parser.add_argument(
        "--repo-root",
        default=DEFAULT_REPO_ROOT,
        help="Path to the repository root (default: current directory)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print analysis without writing to disk",
    )
    args = parser.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    if not os.path.isdir(repo_root):
        print(f"Error: Repository root not found: {repo_root}", file=sys.stderr)
        sys.exit(1)

    world_model = build_world_model(repo_root)

    if args.dry_run:
        print("\n--- DRY RUN: World Model Preview ---")
        print(json.dumps(world_model, indent=2, default=str)[:5000])
        print("... (truncated)")
    else:
        print("[world-model] Update complete.")


if __name__ == "__main__":
    main()
