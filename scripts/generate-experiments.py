#!/usr/bin/env python3
"""
generate-experiments.py — The Brain

Reads .metrics/*.json and generates a concrete, executable EXPERIMENTS.md
with zero placeholders. Every experiment has real file paths, real verify
commands, and real target values.

This replaces the "Product Mind" that was supposed to generate experiments
but never worked. Pure data transform, no LLM calls needed.

Usage:
    python3 scripts/generate-experiments.py
"""

import json
import os
from datetime import datetime, timezone


def read_json(path):
    """Read a JSON file, return empty dict if missing."""
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def load_killed_files():
    """Load files/patterns that should be skipped from EVOLUTION_LEDGER.json."""
    ledger = read_json("EVOLUTION_LEDGER.json")
    killed = set()
    for entry in ledger.get("killed_approaches", []):
        desc = entry.get("description", "").lower()
        # Extract any file paths mentioned in killed approaches
        if "batch refactor" in desc:
            killed.add("__batch__")  # Flag to avoid multi-file experiments
    return killed


def load_category_caps():
    """Load experiment caps per category from experiment history.

    If a category has a high success rate (>70%), allow more experiments.
    If a category has a low success rate (<40%), reduce to 1 experiment.
    Default cap is 3 per category if no history exists.
    """
    default_caps = {
        "TYPE_SAFETY": 3,
        "ESLINT_FIXABLE": 1,
        "ESLINT_MANUAL": 5,
        "TESTING": 3,
        "HARDCODED_COLORS": 3,
    }

    history = read_json(".metrics/experiment-history.json")
    cat_rates = history.get("aggregate", {}).get("category_rates", {})

    if not cat_rates:
        return default_caps  # No history yet, use defaults

    caps = dict(default_caps)
    for cat, stats in cat_rates.items():
        total = stats.get("total", 0)
        rate = stats.get("rate", 0.5)

        if total < 3:
            continue  # Not enough data to adjust

        if rate >= 0.7:
            # High success category: allow up to 5 experiments
            caps[cat] = min(5, default_caps.get(cat, 3) + 2)
        elif rate < 0.4:
            # Low success category: reduce to 1 experiment
            caps[cat] = 1
        # Otherwise keep default

    return caps


def generate_type_safety_experiments(metrics, experiments, counter):
    """Generate experiments to remove as_any and ts_ignore casts."""
    type_issues = metrics.get("type_issues", metrics.get("type-issues", {}))
    files = type_issues.get("files", [])

    for entry in files[:3]:  # Top 3 worst files
        filepath = entry.get("file", "")
        as_any = entry.get("as_any", 0)
        ts_ignore = entry.get("ts_ignore", 0)
        if not filepath or (as_any + ts_ignore) == 0:
            continue

        counter[0] += 1
        exp_id = f"EXP-{counter[0]:03d}"

        tasks = []
        if as_any > 0:
            tasks.append(f"Replace {as_any} `as any` casts with proper TypeScript types using generics, type guards, or explicit interfaces")
        if ts_ignore > 0:
            tasks.append(f"Fix the underlying type issues for {ts_ignore} @ts-ignore/@ts-expect-error comments instead of suppressing them")

        experiments.append({
            "id": exp_id,
            "title": f"Remove unsafe type casts from `{os.path.basename(filepath)}`",
            "files": filepath,
            "task": ". ".join(tasks) + f". Use the fromTable<T>() helper from src/lib/supabase.ts for Supabase queries (PAT-003).",
            "metric": "Unsafe cast count in file",
            "current": as_any + ts_ignore,
            "target": 0,
            "verify": f'grep -c "as any\\|@ts-ignore\\|@ts-expect-error" {filepath} || echo 0',
            "category": "TYPE_SAFETY",
            "priority": "P0",
        })

    return experiments


def generate_eslint_fixable_experiment(metrics, experiments, counter):
    """Generate a single experiment to run eslint --fix for auto-fixable issues."""
    eslint = metrics.get("eslint_issues", metrics.get("eslint-issues", {}))
    totals = eslint.get("totals", {})
    fixable = totals.get("fixable_errors", 0) + totals.get("fixable_warnings", 0)

    if fixable > 0:
        counter[0] += 1
        exp_id = f"EXP-{counter[0]:03d}"
        experiments.append({
            "id": exp_id,
            "title": f"Auto-fix {fixable} fixable ESLint issues",
            "files": "src/",
            "task": f"Run `npx eslint src/ --fix` to resolve {fixable} auto-fixable ESLint issues. Then verify with `npx tsc --noEmit` that no type errors were introduced.",
            "metric": "Fixable ESLint issue count",
            "current": fixable,
            "target": 0,
            "verify": 'npx eslint src/ --format json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(e.get(\'fixableErrorCount\',0)+e.get(\'fixableWarningCount\',0) for e in d))" || echo 0',
            "category": "ESLINT_FIXABLE",
            "priority": "P0",
        })

    return experiments


def generate_eslint_manual_experiments(metrics, experiments, counter):
    """Generate experiments for top files with ESLint errors, grouped by dominant rule."""
    eslint = metrics.get("eslint_issues", metrics.get("eslint-issues", {}))
    files = eslint.get("files", [])

    for entry in files[:5]:  # Top 5 worst files
        filepath = entry.get("file", "")
        errors = entry.get("errors", 0)
        if not filepath or errors < 5:
            continue

        top_rules = entry.get("top_rules", [])
        if not top_rules:
            continue

        # Focus on the dominant rule for this file
        dominant_rule = top_rules[0]
        rule_name = dominant_rule.get("rule", "unknown")
        rule_count = dominant_rule.get("count", 0)

        if rule_count < 3:
            continue

        # Skip react-hooks/rules-of-hooks — these require structural refactoring,
        # not quick fixes. They indicate hooks called conditionally or in loops.
        if rule_name == "react-hooks/rules-of-hooks":
            continue

        counter[0] += 1
        exp_id = f"EXP-{counter[0]:03d}"

        # Generate appropriate task description based on rule
        if "no-unused-vars" in rule_name or "no-unused" in rule_name:
            task = f"Remove {rule_count} unused variables/imports flagged by `{rule_name}`. Delete unused imports, remove unused function parameters (prefix with _ if required by interface), and delete unused local variables."
        elif "no-explicit-any" in rule_name:
            task = f"Replace {rule_count} explicit `any` types flagged by `{rule_name}` with proper TypeScript types."
        elif "jsx-a11y" in rule_name:
            task = f"Fix {rule_count} accessibility violations flagged by `{rule_name}`. Add missing aria-labels, alt text, roles, or other accessibility attributes."
        else:
            task = f"Fix {rule_count} ESLint violations for rule `{rule_name}`. Read the ESLint docs for this rule to understand the correct fix pattern."

        experiments.append({
            "id": exp_id,
            "title": f"Fix `{rule_name}` in `{os.path.basename(filepath)}` ({rule_count} violations)",
            "files": filepath,
            "task": task,
            "metric": f"`{rule_name}` violations in file",
            "current": rule_count,
            "target": 0,
            "verify": f'npx eslint {filepath} --format json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(sum(1 for e in d for m in e.get(\'messages\',[]) if m.get(\'ruleId\')==\'{rule_name}\'))" || echo 0',
            "category": "ESLINT_MANUAL",
            "priority": "P1",
        })

    return experiments


def generate_testing_experiments(metrics, experiments, counter):
    """Generate experiments to write tests for untested pages and components."""
    untested = metrics.get("untested_files", metrics.get("untested-files", {}))
    files = untested.get("untested", [])

    # Filter to pages first (highest leverage), then components
    pages = [f for f in files if "/pages/" in f][:3]
    components = [f for f in files if "/components/" in f][:2]
    targets = pages + components

    for filepath in targets[:3]:  # Cap at 3 test experiments
        basename = os.path.basename(filepath)
        name_no_ext = os.path.splitext(basename)[0]

        # Determine test file path
        if "/pages/" in filepath:
            test_path = f"src/test/pages/{name_no_ext}.test.tsx"
        elif "/components/" in filepath:
            test_path = filepath.replace(".tsx", ".test.tsx").replace(".ts", ".test.ts")
        else:
            test_path = filepath.replace(".tsx", ".test.tsx").replace(".ts", ".test.ts")

        counter[0] += 1
        exp_id = f"EXP-{counter[0]:03d}"
        experiments.append({
            "id": exp_id,
            "title": f"Write tests for `{basename}`",
            "files": filepath,
            "task": f"Write a test file at `{test_path}` for `{filepath}`. Include: 1) A basic render test (component mounts without crashing), 2) A test for the primary user interaction, 3) An empty state test if the component displays data. Use the testing patterns from LEARNINGS.md (data-testid attributes, factory pattern from src/test/factories.ts).",
            "metric": "Test file exists and passes",
            "current": 0,
            "target": 1,
            "verify": f'test -f {test_path} && npx vitest run {test_path} --reporter=verbose 2>&1 | grep -c "pass\\|✓" || echo 0',
            "category": "TESTING",
            "priority": "P1",
        })

    return experiments


def generate_hardcoded_color_experiments(metrics, experiments, counter):
    """Generate experiments to replace hardcoded hex colors with theme tokens."""
    quality = metrics.get("quality_issues", metrics.get("quality-issues", {}))
    files = quality.get("files", [])

    # Filter to files with hardcoded colors (not mock data)
    color_files = [f for f in files if f.get("hardcoded_colors", 0) > 10]
    color_files.sort(key=lambda x: x["hardcoded_colors"], reverse=True)

    for entry in color_files[:3]:  # Top 3 worst files
        filepath = entry.get("file", "")
        count = entry.get("hardcoded_colors", 0)
        if not filepath:
            continue

        counter[0] += 1
        exp_id = f"EXP-{counter[0]:03d}"
        experiments.append({
            "id": exp_id,
            "title": f"Replace {count} hardcoded colors in `{os.path.basename(filepath)}`",
            "files": filepath,
            "task": f"Replace {count} hardcoded hex color values (e.g., '#F47820') with theme token references from `src/styles/theme.ts`. Import the theme and use `theme.colors.primary`, `theme.colors.success`, etc. Never use raw hex values in component code.",
            "metric": "Hardcoded color count in file",
            "current": count,
            "target": 0,
            "verify": f"grep -c \"'#[0-9a-fA-F]{{6}}'\" {filepath} || echo 0",
            "category": "HARDCODED_COLORS",
            "priority": "P2",
        })

    return experiments


def format_experiments_md(experiments):
    """Format experiments list as EXPERIMENTS.md markdown."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = [
        "# EXPERIMENTS.md",
        f"Generated by scripts/generate-experiments.py — {now}",
        "Strategy: Data-driven experiment queue from .metrics/ analysis",
        "",
        "## Queue",
        "",
    ]

    for exp in experiments:
        lines.extend([
            f"### {exp['id']}: {exp['title']}",
            f"- **File(s)**: {exp['files']}",
            f"- **Task**: {exp['task']}",
            f"- **Metric**: {exp['metric']}",
            f"- **Current**: {exp['current']}",
            f"- **Target**: {exp['target']}",
            f"- **Verify**: `{exp['verify']}`",
            f"- **Category**: {exp['category']}",
            f"- **Priority**: {exp['priority']}",
            f"- **Status**: PENDING",
            "",
        ])

    lines.extend([
        "---",
        f"*Generated from .metrics/ data. {len(experiments)} experiments queued.*",
        f"*All file paths verified against codebase at generation time.*",
        "",
    ])

    return "\n".join(lines)


def main():
    print("Generating experiments from metrics...")

    # Load metrics — support both dash and underscore key names
    summary = read_json(".metrics/summary.json")
    if not summary:
        # Fall back to loading individual files
        summary = {}
        for name in ["type-issues", "quality-issues", "untested-files", "eslint-issues"]:
            data = read_json(f".metrics/{name}.json")
            if data:
                summary[name.replace("-", "_")] = data

    if not summary:
        print("ERROR: No metrics found. Run scripts/cells/collect-all-metrics.sh first.")
        return

    killed = load_killed_files()
    caps = load_category_caps()
    experiments = []
    counter = [0]  # Mutable counter for experiment IDs

    print(f"  Category caps (from experiment history): {caps}")

    # Generate experiments in priority order, respecting learned caps
    generate_type_safety_experiments(summary, experiments, counter)
    generate_eslint_fixable_experiment(summary, experiments, counter)
    generate_eslint_manual_experiments(summary, experiments, counter)
    generate_testing_experiments(summary, experiments, counter)
    generate_hardcoded_color_experiments(summary, experiments, counter)

    # Apply category caps from experiment history
    capped = []
    category_counts = {}
    for exp in experiments:
        cat = exp["category"]
        count = category_counts.get(cat, 0)
        cap = caps.get(cat, 3)
        if count < cap:
            capped.append(exp)
            category_counts[cat] = count + 1
        else:
            print(f"  CAP: Skipping {exp['id']} ({cat} already at cap of {cap})")
    experiments = capped

    # Cap at 15 experiments
    experiments = experiments[:15]

    # Verify file paths exist (skip experiments for missing files)
    verified = []
    for exp in experiments:
        filepath = exp["files"]
        if filepath == "src/" or os.path.exists(filepath):
            verified.append(exp)
        else:
            print(f"  SKIP {exp['id']}: file not found: {filepath}")
    experiments = verified

    # Write EXPERIMENTS.md
    md = format_experiments_md(experiments)
    with open("EXPERIMENTS.md", "w") as f:
        f.write(md)

    print(f"\nGenerated {len(experiments)} experiments -> EXPERIMENTS.md")
    for exp in experiments:
        print(f"  [{exp['priority']}] {exp['id']}: {exp['title']} ({exp['category']})")


if __name__ == "__main__":
    main()
