#!/usr/bin/env python3
"""
compress-context.py — SiteSync Context Compression System

Compresses ~37KB of raw organism context files into a focused ~2-3KB
high-signal SESSION_BRIEF.md using entropy-aware filtering inspired by
the SimpleMem three-stage compression pipeline (ICML 2026).

Design principles:
  - Aggressive compression but never lossy on actionable information
  - Deduplicate across sources (same rule in CLAUDE.md + LEARNINGS.md → once)
  - Progressive disclosure: organism starts from compressed brief, expands only if needed
  - Target: organism can execute 80%+ of experiments using ONLY the brief

Usage:
  python3 scripts/compress-context.py [--repo-root PATH]
Output:
  SESSION_BRIEF.md (written to repo root)
"""

import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEMO_DATE = date(2026, 4, 15)
MAX_RULES = 15
TOP_WORST_FILES = 5
TOP_P0_ITEMS = 10
MAX_EXPERIMENTS_SHOWN = 50  # hard cap; all PENDING are shown in practice
RECENT_COMMITS = 20


# ---------------------------------------------------------------------------
# Stage 1 — Gather raw intelligence
# ---------------------------------------------------------------------------

def read_file(path: Path) -> str:
    """Read a file, returning empty string if it doesn't exist."""
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError, OSError):
        return ""


def read_json(path: Path) -> Optional[dict]:
    """Parse a JSON file, returning None on any error."""
    content = read_file(path)
    if not content:
        return None
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None


def gather_raw_intelligence(repo: Path) -> dict:
    """Stage 1: collect raw data from all source files."""
    data = {}

    # Core context files
    data["claude_md"]          = read_file(repo / "CLAUDE.md")
    data["experiments_md"]     = read_file(repo / "EXPERIMENTS.md")
    data["learnings_md"]       = read_file(repo / "LEARNINGS.md")
    data["spec_md"]            = read_file(repo / "SPEC.md")
    data["pause_md"]           = read_file(repo / "PAUSE.md")

    # Structured data files
    data["evolution_ledger"]   = read_json(repo / "EVOLUTION_LEDGER.json")
    data["skill_registry"]     = read_json(repo / "SKILL_REGISTRY.json")
    data["quality_floor"]      = read_json(repo / ".quality-floor.json")

    # Metrics
    data["type_issues"]        = read_json(repo / ".metrics" / "type-issues.json")
    data["quality_issues"]     = read_json(repo / ".metrics" / "quality-issues.json")
    data["untested_files"]     = read_json(repo / ".metrics" / "untested-files.json")
    data["eslint_issues"]      = read_json(repo / ".metrics" / "eslint-issues.json")

    # Git history
    data["git_log"]            = get_git_log(repo, n=RECENT_COMMITS)

    return data


def get_git_log(repo: Path, n: int) -> list[dict]:
    """Fetch last N git commits as structured records."""
    try:
        result = subprocess.run(
            ["git", "log", f"-{n}", "--pretty=format:%H|%s|%an|%ai"],
            capture_output=True, text=True, cwd=repo, timeout=15
        )
        commits = []
        for line in result.stdout.strip().splitlines():
            if not line.strip():
                continue
            parts = line.split("|", 3)
            if len(parts) == 4:
                commits.append({
                    "hash":    parts[0][:8],
                    "subject": parts[1],
                    "author":  parts[2],
                    "date":    parts[3][:10],
                })
        return commits
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Stage 2 — Entropy-aware filtering
# ---------------------------------------------------------------------------

# --- Pause status ---

def extract_pause_status(pause_md: str) -> str:
    """Return RUNNING or PAUSED."""
    if not pause_md:
        return "RUNNING"
    m = re.search(r"Status:\s*(PAUSED|RUNNING)", pause_md, re.IGNORECASE)
    return m.group(1).upper() if m else "RUNNING"


# --- Experiment queue ---

def extract_pending_experiments(experiments_md: str) -> list[dict]:
    """
    Extract only PENDING experiments from EXPERIMENTS.md.
    Skips PASS/FAIL history entirely (high entropy, low signal).
    Returns list of {id, title, file, verify, priority}.
    """
    experiments = []
    if not experiments_md:
        return experiments

    # Split on experiment headers: ### EXP-NNN
    blocks = re.split(r'\n(?=### EXP-)', experiments_md)

    for block in blocks:
        # Only process PENDING experiments
        if "PENDING" not in block:
            continue

        exp = {}

        # ID + title: ### EXP-042: Some Title
        id_match = re.match(r'### (EXP-\d+):\s*(.+)', block.strip())
        if id_match:
            exp["id"]    = id_match.group(1)
            exp["title"] = id_match.group(2).strip()
        else:
            continue  # malformed

        # File / target
        file_match = re.search(r'\*\*File[s]?\*\*:\s*`?([^\n`]+)`?', block)
        exp["file"] = file_match.group(1).strip() if file_match else ""

        # Verify command
        verify_match = re.search(
            r'\*\*Verify\*\*:\s*`([^`]+)`'
            r'|Verify command:\s*`([^`]+)`'
            r'|\*\*Metric\*\*:\s*`([^`]+)`',
            block
        )
        if verify_match:
            exp["verify"] = (verify_match.group(1) or verify_match.group(2) or verify_match.group(3) or "").strip()
        else:
            exp["verify"] = ""

        # Priority (P0 / P1 / P2)
        prio_match = re.search(r'\b(P[0-2])\b', block)
        exp["priority"] = prio_match.group(1) if prio_match else "P1"

        experiments.append(exp)

    return experiments


def count_experiment_outcomes(experiments_md: str) -> tuple[int, int, int]:
    """Return (pending, passed, failed) counts."""
    pending = experiments_md.count("PENDING")
    passed  = experiments_md.count("✅")
    failed  = experiments_md.count("❌")
    return pending, passed, failed


# --- Rules deduplication ---

# Patterns that signal an actionable rule (not narrative)
_RULE_PATTERNS = [
    re.compile(r'(?i)^[-*]\s*(NEVER|ALWAYS|MUST|DO NOT|NEVER USE)\b'),
    re.compile(r'(?i)^[-*]\s*\*{0,2}(NEVER|ALWAYS|MUST|DO NOT)\b'),
    re.compile(r'^\d+\.\s+\*{0,2}(NEVER|ALWAYS|MUST|DO NOT|Never|Always)\b'),
]

_SKIP_HEADERS = re.compile(
    r'(?i)^#+\s*(background|context|why|rationale|example|detail|note|history|overview|intro)'
)


def extract_rules_from_text(text: str) -> list[str]:
    """
    Extract lines that look like actionable rules.
    Skips narrative/explanation text.
    """
    rules = []
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 10:
            continue
        if _SKIP_HEADERS.match(line):
            continue
        for pat in _RULE_PATTERNS:
            if pat.match(line):
                # Clean up markdown formatting
                clean = re.sub(r'\*{1,2}([^*]+)\*{1,2}', r'\1', line)
                clean = re.sub(r'^[-*\d.]+\s+', '', clean).strip()
                rules.append(clean)
                break
    return rules


def _rule_fingerprint(rule: str) -> str:
    """Normalised lowercase fingerprint for dedup."""
    return re.sub(r'\W+', ' ', rule.lower()).strip()


def deduplicate_rules(rule_lists: list[list[str]], max_rules: int = MAX_RULES) -> list[str]:
    """
    Merge multiple rule lists, deduplicate semantically, cap at max_rules.
    Prioritises shorter/more direct formulations.
    """
    seen_fingerprints: set[str] = set()
    merged: list[str] = []

    for rules in rule_lists:
        for rule in rules:
            fp = _rule_fingerprint(rule)
            # Fuzzy dedup: check if any 5-word token overlap with existing
            rule_tokens = set(fp.split())
            duplicate = False
            for seen_fp in seen_fingerprints:
                seen_tokens = set(seen_fp.split())
                overlap = len(rule_tokens & seen_tokens)
                if overlap >= 5 and overlap / max(len(rule_tokens), len(seen_tokens)) > 0.6:
                    duplicate = True
                    break
            if not duplicate:
                seen_fingerprints.add(fp)
                merged.append(rule)

    return merged[:max_rules]


def extract_all_rules(claude_md: str, learnings_md: str) -> list[str]:
    """Extract and deduplicate rules from CLAUDE.md and LEARNINGS.md."""
    # CRITICAL / ALWAYS / NEVER sections from LEARNINGS.md are highest signal
    learning_rules = []
    in_critical = False
    for line in learnings_md.splitlines():
        if re.match(r'(?i)^#+.*\b(critical|always|never|non-negotiable|absolute)\b', line):
            in_critical = True
        elif re.match(r'^#+', line):
            in_critical = False
        if in_critical:
            stripped = line.strip()
            if stripped.startswith(('-', '*', '1', '2', '3', '4', '5', '6', '7', '8', '9')):
                # Strip leading bullet/number punctuation to get just the rule text
                cleaned = re.sub(r'^[-*\d.]+\s+', '', stripped).strip()
                if cleaned:
                    learning_rules.append(cleaned)

    claude_rules  = extract_rules_from_text(claude_md)
    generic_rules = extract_rules_from_text(learnings_md)

    # Priority: learning CRITICAL > claude rules > other learning rules
    return deduplicate_rules([learning_rules, claude_rules, generic_rules])


# --- Evolution ledger ---

def extract_ledger_signals(ledger: Optional[dict]) -> tuple[list[dict], list[dict]]:
    """
    Return (patterns, killed_approaches) — just names and one-line descriptions.
    Skips full evolution history.
    """
    if not ledger:
        return [], []

    patterns = []
    for item in ledger.get("patterns", []):
        if isinstance(item, dict):
            patterns.append({
                "name":        item.get("id") or item.get("name", ""),
                "description": item.get("description") or item.get("summary", ""),
            })
        elif isinstance(item, str):
            patterns.append({"name": item, "description": ""})

    killed = []
    for item in ledger.get("killed_approaches", []):
        if isinstance(item, dict):
            killed.append({
                "name":   item.get("name") or item.get("approach", ""),
                "reason": item.get("reason") or item.get("why", ""),
            })
        elif isinstance(item, str):
            killed.append({"name": item, "reason": ""})

    return patterns, killed


# --- Metrics compression ---

def _worst_files(file_list: list, n: int = TOP_WORST_FILES) -> list[str]:
    """Extract top N worst files from a list (may be strings or dicts)."""
    if not file_list:
        return []
    result = []
    for item in file_list[:n]:
        if isinstance(item, str):
            result.append(item)
        elif isinstance(item, dict):
            path = item.get("file") or item.get("path") or ""
            count = item.get("count") or item.get("issues") or ""
            result.append(f"{path} ({count})" if count else path)
    return result


def extract_metrics(
    type_issues: Optional[dict],
    quality_issues: Optional[dict],
    untested_files: Optional[dict],
    eslint_issues: Optional[dict],
    quality_floor: Optional[dict],
) -> list[dict]:
    """
    Build a compact metrics table.
    Returns list of {metric, value, target, worst_files}.
    """
    rows = []

    # Type issues
    if type_issues:
        totals = type_issues.get("totals", {})
        as_any  = totals.get("as_any", "?")
        ts_ign  = totals.get("ts_ignore", "?")
        floor_any = quality_floor.get("anyCount", "0") if quality_floor else "0"
        worst = _worst_files(
            type_issues.get("worst_files") or type_issues.get("files", [])
        )
        rows.append({
            "metric":      "Unsafe casts (as any + ts-ignore)",
            "value":       f"{as_any} as-any, {ts_ign} ts-ignore",
            "target":      f"{floor_any} → 0",
            "worst_files": worst,
        })

    # Quality issues
    if quality_issues:
        totals = quality_issues.get("totals", {})
        colors = totals.get("hardcoded_colors", "?")
        mocks  = totals.get("mock_data", "?")
        floor_mock = quality_floor.get("mockCount", "0") if quality_floor else "0"
        worst = _worst_files(
            quality_issues.get("worst_files") or quality_issues.get("files", [])
        )
        rows.append({
            "metric":      "Quality issues (colors + mock data)",
            "value":       f"{colors} hardcoded colors, {mocks} mock data",
            "target":      f"mock floor {floor_mock} → 0",
            "worst_files": worst,
        })

    # Test coverage
    if untested_files:
        pct     = untested_files.get("coverage_pct", "?")
        tested  = untested_files.get("tested_count", "?")
        untested = untested_files.get("untested_count", "?")
        worst = _worst_files(
            untested_files.get("untested_files") or untested_files.get("files", [])
        )
        rows.append({
            "metric":      "Test coverage",
            "value":       f"{pct}% ({tested} tested, {untested} untested)",
            "target":      "80%+",
            "worst_files": worst,
        })

    # ESLint
    if eslint_issues:
        totals = eslint_issues.get("totals", {})
        errors = totals.get("errors", "?")
        warns  = totals.get("warnings", "?")
        floor_lint = quality_floor.get("eslintErrors", "0") if quality_floor else "0"
        worst = _worst_files(
            eslint_issues.get("worst_files") or eslint_issues.get("files", [])
        )
        rows.append({
            "metric":      "ESLint",
            "value":       f"{errors} errors, {warns} warnings",
            "target":      f"floor {floor_lint} → 0",
            "worst_files": worst,
        })

    return rows


# --- Quality floor ---

def extract_quality_floor(quality_floor: Optional[dict]) -> dict:
    """Return just current values and targets."""
    if not quality_floor:
        return {}
    return {
        "mockCount":    quality_floor.get("mockCount", "?"),
        "anyCount":     quality_floor.get("anyCount", "?"),
        "eslintErrors": quality_floor.get("eslintErrors", "?"),
    }


# --- Available skills ---

def extract_skills(skill_registry: Optional[dict]) -> list[dict]:
    """Return skill name + when_to_use summaries."""
    if not skill_registry:
        return []
    skills = []
    items = skill_registry.get("skills") or skill_registry.get("registry") or []
    if isinstance(skill_registry, dict) and not items:
        # Top-level keys may be skill IDs
        for key, val in skill_registry.items():
            if isinstance(val, dict):
                items.append({"name": key, **val})

    for item in items:
        if isinstance(item, dict):
            skills.append({
                "name":        item.get("name") or item.get("id", ""),
                "when_to_use": item.get("when_to_use") or item.get("description") or item.get("use_when", ""),
            })
    return skills


# --- SPEC P0 unchecked items ---

def extract_p0_unchecked(spec_md: str, n: int = TOP_P0_ITEMS) -> list[str]:
    """Return top N unchecked P0 criteria from SPEC.md."""
    items = []
    # An unchecked item looks like: - [ ] some text
    # P0 context: look for P0 label in the item OR in a preceding section header
    in_p0_section = False
    for line in spec_md.splitlines():
        # Track section headers that mention P0
        if re.match(r'^#+', line):
            in_p0_section = bool(re.search(r'\bP0\b', line))
        # Unchecked checkbox
        if re.match(r'^\s*-\s*\[\s*\]\s*', line):
            item_text = re.sub(r'^\s*-\s*\[\s*\]\s*', '', line).strip()
            if in_p0_section or re.search(r'\bP0\b', line):
                items.append(item_text)
                if len(items) >= n:
                    break

    # If we found fewer than n with explicit P0, fill from any unchecked items
    if len(items) < n:
        for line in spec_md.splitlines():
            if re.match(r'^\s*-\s*\[\s*\]\s*', line):
                item_text = re.sub(r'^\s*-\s*\[\s*\]\s*', '', line).strip()
                if item_text not in items:
                    items.append(item_text)
                    if len(items) >= n:
                        break

    return items[:n]


# --- Git trend ---

def compute_quality_trend(git_log: list[dict]) -> str:
    """Infer quality trend from recent commit subjects."""
    if not git_log:
        return "unknown"
    subjects = [c["subject"].lower() for c in git_log[:10]]
    passes = sum(1 for s in subjects if "pass" in s or "fix" in s or "feat" in s)
    fails  = sum(1 for s in subjects if "fail" in s or "revert" in s or "broken" in s)
    if passes > fails * 2:
        return "improving"
    elif fails > passes:
        return "declining"
    return "stable"


def summarise_last_night(git_log: list[dict]) -> str:
    """One-line summary of last night's organism results."""
    recent = [c for c in git_log if "organism" in c.get("author", "").lower()
              or "[auto]" in c.get("subject", "").lower()
              or "[organism]" in c.get("subject", "").lower()]
    if not recent:
        return "No organism commits found in recent history"
    passed = sum(1 for c in recent if "pass" in c["subject"].lower() or "feat" in c["subject"].lower())
    failed = sum(1 for c in recent if "fail" in c["subject"].lower() or "revert" in c["subject"].lower())
    total  = len(recent)
    return f"{passed} experiments passed, {failed} failed ({total} total organism commits)"


# ---------------------------------------------------------------------------
# Stage 3 — Output compressed briefing
# ---------------------------------------------------------------------------

def render_brief(
    *,
    run_date: str,
    days_to_demo: int,
    pause_status: str,
    last_night: str,
    quality_trend: str,
    pending_experiments: list[dict],
    pending_count: int,
    passed_count: int,
    failed_count: int,
    rules: list[str],
    metrics: list[dict],
    quality_floor: dict,
    patterns: list[dict],
    killed: list[dict],
    skills: list[dict],
    p0_unchecked: list[str],
) -> str:
    lines = []

    # ── Header ─────────────────────────────────────────────────────────────
    lines.append(f"# SESSION BRIEF — {run_date}")
    lines.append(f"{days_to_demo} days until April 15 demo")
    lines.append("")

    # ── Status ─────────────────────────────────────────────────────────────
    lines.append("## STATUS")
    lines.append(f"Pause: {pause_status}")
    lines.append(f"Last night: {last_night}")
    lines.append(f"Quality trend: {quality_trend}")
    lines.append("")

    # ── Tonight's experiments ───────────────────────────────────────────────
    lines.append("## TONIGHT'S EXPERIMENTS (pending only)")
    lines.append(f"Total in queue: {pending_count} pending | {passed_count} passed | {failed_count} failed")
    lines.append("")
    if pending_experiments:
        for exp in pending_experiments:
            pri   = f"[{exp['priority']}] " if exp.get("priority") else ""
            title = f"{pri}{exp['id']}: {exp['title']}"
            lines.append(f"### {title}")
            if exp.get("file"):
                lines.append(f"  File: `{exp['file']}`")
            if exp.get("verify"):
                lines.append(f"  Verify: `{exp['verify']}`")
    else:
        lines.append("  No PENDING experiments found — check EXPERIMENTS.md")
    lines.append("")

    # ── Rules ──────────────────────────────────────────────────────────────
    lines.append("## RULES (non-negotiable)")
    if rules:
        for i, rule in enumerate(rules, 1):
            lines.append(f"{i}. {rule}")
    else:
        lines.append("  (No rules extracted — read CLAUDE.md directly)")
    lines.append("")

    # ── Metrics ────────────────────────────────────────────────────────────
    lines.append("## METRICS (current state)")
    if metrics:
        lines.append("| Metric | Value | Target | Worst files |")
        lines.append("|--------|-------|--------|-------------|")
        for row in metrics:
            worst_str = ", ".join(row["worst_files"]) if row["worst_files"] else "—"
            lines.append(f"| {row['metric']} | {row['value']} | {row['target']} | {worst_str} |")
    else:
        lines.append("  No metrics files found — run worker cells first.")
    lines.append("")

    # ── Quality floor ──────────────────────────────────────────────────────
    if quality_floor:
        lines.append("## QUALITY FLOOR (never regress below)")
        lines.append("| Metric | Current floor | Target |")
        lines.append("|--------|--------------|--------|")
        lines.append(f"| Mock data        | {quality_floor.get('mockCount', '?')} | 0 |")
        lines.append(f"| Unsafe casts     | {quality_floor.get('anyCount', '?')} | 0 |")
        lines.append(f"| ESLint errors    | {quality_floor.get('eslintErrors', '?')} | 0 |")
        lines.append("")

    # ── Patterns ───────────────────────────────────────────────────────────
    lines.append("## PATTERNS (use these)")
    if patterns:
        for p in patterns:
            desc = f": {p['description']}" if p.get("description") else ""
            lines.append(f"- {p['name']}{desc}")
    else:
        lines.append("  (No patterns in EVOLUTION_LEDGER — read file directly)")
    lines.append("")

    # ── Killed approaches ──────────────────────────────────────────────────
    lines.append("## KILLED APPROACHES (avoid these)")
    if killed:
        for k in killed:
            reason = f" — {k['reason']}" if k.get("reason") else ""
            lines.append(f"- {k['name']}{reason}")
    else:
        lines.append("  (No killed approaches recorded)")
    lines.append("")

    # ── Available skills ───────────────────────────────────────────────────
    lines.append("## AVAILABLE SKILLS")
    if skills:
        for s in skills:
            when = f": {s['when_to_use']}" if s.get("when_to_use") else ""
            lines.append(f"- {s['name']}{when}")
    else:
        lines.append("  (SKILL_REGISTRY.json not found — skills not tracked yet)")
    lines.append("")

    # ── SPEC P0 unchecked ──────────────────────────────────────────────────
    lines.append("## SPEC P0 UNCHECKED (demo-critical)")
    if p0_unchecked:
        for item in p0_unchecked:
            lines.append(f"- [ ] {item}")
    else:
        lines.append("  (No unchecked P0 items found — all P0 criteria complete, or SPEC.md missing)")
    lines.append("")

    # ── Progressive disclosure note ────────────────────────────────────────
    lines.append("---")
    lines.append("*Compressed brief — for details on any section, read the full source file.*")
    lines.append("*Read CLAUDE.md | EXPERIMENTS.md | LEARNINGS.md | EVOLUTION_LEDGER.json as needed.*")

    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Compress organism context to SESSION_BRIEF.md")
    parser.add_argument("--repo-root", default=".", help="Path to repo root (default: cwd)")
    parser.add_argument("--output", default="SESSION_BRIEF.md", help="Output file path")
    parser.add_argument("--verbose", action="store_true", help="Print compression stats")
    args = parser.parse_args()

    repo = Path(args.repo_root).resolve()
    output_path = repo / args.output

    if args.verbose:
        print(f"[compress-context] Repo root: {repo}", file=sys.stderr)

    # ── Stage 1: Gather ────────────────────────────────────────────────────
    if args.verbose:
        print("[compress-context] Stage 1: Gathering raw intelligence...", file=sys.stderr)

    raw = gather_raw_intelligence(repo)

    # Measure raw size
    raw_bytes = sum(
        len(v.encode()) if isinstance(v, str) else len(json.dumps(v).encode())
        for v in raw.values()
        if v is not None
    )

    # ── Stage 2: Filter ────────────────────────────────────────────────────
    if args.verbose:
        print("[compress-context] Stage 2: Entropy-aware filtering...", file=sys.stderr)

    # Pause
    pause_status = extract_pause_status(raw["pause_md"])

    # Experiments
    pending_exps = extract_pending_experiments(raw["experiments_md"])
    pending_count, passed_count, failed_count = count_experiment_outcomes(raw["experiments_md"])

    # Rules (deduplicated across CLAUDE.md + LEARNINGS.md)
    rules = extract_all_rules(raw["claude_md"], raw["learnings_md"])

    # Metrics
    metrics = extract_metrics(
        raw["type_issues"],
        raw["quality_issues"],
        raw["untested_files"],
        raw["eslint_issues"],
        raw["quality_floor"],
    )
    quality_floor_vals = extract_quality_floor(raw["quality_floor"])

    # Evolution ledger
    patterns, killed = extract_ledger_signals(raw["evolution_ledger"])

    # Skills
    skills = extract_skills(raw["skill_registry"])

    # SPEC P0
    p0_unchecked = extract_p0_unchecked(raw["spec_md"])

    # Git signals
    quality_trend = compute_quality_trend(raw["git_log"])
    last_night    = summarise_last_night(raw["git_log"])

    # Dates
    today        = date.today()
    run_date     = today.strftime("%Y-%m-%d")
    days_to_demo = (DEMO_DATE - today).days

    # ── Stage 3: Render ────────────────────────────────────────────────────
    if args.verbose:
        print("[compress-context] Stage 3: Rendering compressed brief...", file=sys.stderr)

    brief = render_brief(
        run_date=run_date,
        days_to_demo=days_to_demo,
        pause_status=pause_status,
        last_night=last_night,
        quality_trend=quality_trend,
        pending_experiments=pending_exps,
        pending_count=pending_count,
        passed_count=passed_count,
        failed_count=failed_count,
        rules=rules,
        metrics=metrics,
        quality_floor=quality_floor_vals,
        patterns=patterns,
        killed=killed,
        skills=skills,
        p0_unchecked=p0_unchecked,
    )

    output_path.write_text(brief, encoding="utf-8")

    compressed_bytes = len(brief.encode())
    ratio = raw_bytes / compressed_bytes if compressed_bytes else 0

    print(
        f"SESSION_BRIEF.md written ({compressed_bytes:,} bytes compressed "
        f"from ~{raw_bytes:,} bytes raw — {ratio:.1f}x reduction, "
        f"{pending_count} pending experiments, {days_to_demo} days to demo)"
    )

    if args.verbose:
        print(f"  Experiments shown: {len(pending_exps)}", file=sys.stderr)
        print(f"  Rules extracted:   {len(rules)}", file=sys.stderr)
        print(f"  Metrics rows:      {len(metrics)}", file=sys.stderr)
        print(f"  Patterns:          {len(patterns)}", file=sys.stderr)
        print(f"  Killed:            {len(killed)}", file=sys.stderr)
        print(f"  Skills:            {len(skills)}", file=sys.stderr)
        print(f"  P0 unchecked:      {len(p0_unchecked)}", file=sys.stderr)


if __name__ == "__main__":
    main()
