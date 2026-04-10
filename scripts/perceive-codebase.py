#!/usr/bin/env python3
"""
perceive-codebase.py — Codebase Perception Agent

Analyzes the src/ directory to understand the current state of the codebase.
Extracts:
  - Which pages have real DB queries (grep useQuery/fromTable/useMutation)
  - Which custom hooks exist and what they do
  - Which Supabase edge functions exist
  - Test count and coverage indicators
  - Git log for last 24 hours (who changed what)
  - Code health metrics (TypeScript errors, unsafe casts, mock data)

Outputs: .perception/codebase-state.json

This gives the Strategic Mind a structural understanding of the codebase,
not just what the product looks like to a user.
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_DIR = ".perception"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "codebase-state.json")
SRC_DIR = "src"


def run_cmd(cmd: list, timeout: int = 30) -> str:
    """Run a shell command and return stdout, empty string on failure."""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, cwd="."
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        return ""


def grep_files(pattern: str, directory: str = SRC_DIR, extensions: tuple = (".ts", ".tsx")) -> list:
    """Find files containing a pattern using simple Python grep."""
    matches = []
    try:
        for root, _dirs, files in os.walk(directory):
            for fname in files:
                if not fname.endswith(extensions):
                    continue
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    if re.search(pattern, content):
                        # Count occurrences
                        count = len(re.findall(pattern, content))
                        matches.append({"file": fpath, "count": count})
                except Exception:
                    pass
    except Exception:
        pass
    return matches


def analyze_pages_with_db_queries() -> dict:
    """Find which page components have real Supabase queries."""
    query_patterns = {
        "useQuery": r"useQuery",
        "fromTable": r"fromTable|\.from\(['\"]",
        "useMutation": r"useMutation",
        "supabase_select": r"supabase\.\w+\.select|\.select\(",
        "supabase_insert": r"\.insert\(|\.upsert\(",
        "supabase_update": r"\.update\(",
        "supabase_rpc": r"\.rpc\(",
    }

    results = {}
    for pattern_name, pattern_regex in query_patterns.items():
        matches = grep_files(pattern_regex)
        results[pattern_name] = {
            "file_count": len(matches),
            "files": [m["file"] for m in matches[:20]],
        }

    return results


def analyze_hooks() -> list:
    """Find all custom hooks in the codebase."""
    hooks = []
    hook_pattern = r"export\s+(?:function|const)\s+(use[A-Z]\w+)"

    for root, _dirs, files in os.walk(SRC_DIR):
        for fname in files:
            if not fname.endswith((".ts", ".tsx")):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for match in re.finditer(hook_pattern, content):
                    hooks.append({
                        "name": match.group(1),
                        "file": fpath,
                    })
            except Exception:
                pass

    return hooks


def analyze_edge_functions() -> list:
    """Find Supabase edge functions."""
    edge_functions = []
    edge_dir = "supabase/functions"

    if not os.path.exists(edge_dir):
        return edge_functions

    for item in os.listdir(edge_dir):
        func_dir = os.path.join(edge_dir, item)
        if os.path.isdir(func_dir):
            index_file = os.path.join(func_dir, "index.ts")
            has_index = os.path.exists(index_file)
            size = os.path.getsize(index_file) if has_index else 0
            edge_functions.append({
                "name": item,
                "has_index": has_index,
                "size_bytes": size,
            })

    return edge_functions


def count_tests() -> dict:
    """Count test files and test cases."""
    test_files = []
    test_case_count = 0

    for root, _dirs, files in os.walk("."):
        for fname in files:
            if re.match(r".*\.(test|spec)\.(ts|tsx|js|jsx)$", fname):
                fpath = os.path.join(root, fname)
                test_files.append(fpath)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    test_case_count += len(re.findall(r"\b(it|test)\s*\(", content))
                except Exception:
                    pass

    return {
        "test_file_count": len(test_files),
        "test_case_count": test_case_count,
        "test_files": test_files[:30],
    }


def get_git_log_24h() -> list:
    """Get git commits from the last 24 hours."""
    log_output = run_cmd([
        "git", "log", "--since=24 hours ago",
        "--pretty=format:%H|%an|%ae|%s|%ai",
        "--stat",
    ])

    commits = []
    if not log_output:
        return commits

    current_commit = None
    for line in log_output.split("\n"):
        parts = line.split("|")
        if len(parts) >= 5:
            current_commit = {
                "hash": parts[0][:8],
                "author": parts[1],
                "email": parts[2],
                "message": parts[3],
                "date": parts[4],
                "files_changed": [],
            }
            commits.append(current_commit)
        elif current_commit and line.strip() and "|" not in line:
            # This is a stat line like " src/file.ts | 5 ++-"
            file_match = re.match(r"\s+(\S+)\s+\|", line)
            if file_match:
                current_commit["files_changed"].append(file_match.group(1))

    return commits[:50]


def analyze_code_health() -> dict:
    """Check code health indicators."""
    # Count unsafe patterns
    unsafe_any = grep_files(r"\bas\s+any\b|@ts-ignore|@ts-nocheck")
    mock_data = grep_files(r"mockData|MOCK_|mock_|placeholder.*data|sampleData")
    console_logs = grep_files(r"console\.(log|warn|error)\(")

    # Count total source files
    source_files = []
    total_lines = 0
    for root, _dirs, files in os.walk(SRC_DIR):
        for fname in files:
            if fname.endswith((".ts", ".tsx", ".js", ".jsx")):
                fpath = os.path.join(root, fname)
                source_files.append(fpath)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        total_lines += sum(1 for _ in f)
                except Exception:
                    pass

    return {
        "source_file_count": len(source_files),
        "total_lines": total_lines,
        "unsafe_any_count": sum(m["count"] for m in unsafe_any),
        "unsafe_any_files": [m["file"] for m in unsafe_any[:10]],
        "mock_data_count": sum(m["count"] for m in mock_data),
        "mock_data_files": [m["file"] for m in mock_data[:10]],
        "console_log_count": sum(m["count"] for m in console_logs),
    }


def main():
    """Run all codebase perception and write results."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    if not os.path.isdir(SRC_DIR):
        print(f"WARNING: {SRC_DIR}/ directory not found. Writing minimal state.")
        with open(OUTPUT_FILE, "w") as f:
            json.dump({"error": f"{SRC_DIR}/ not found", "timestamp": datetime.now(timezone.utc).isoformat()}, f)
        sys.exit(0)

    print("Analyzing codebase...")

    state = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_dir": SRC_DIR,
    }

    print("  - DB query patterns...")
    state["db_queries"] = analyze_pages_with_db_queries()

    print("  - Custom hooks...")
    state["hooks"] = analyze_hooks()
    state["hook_count"] = len(state["hooks"])

    print("  - Edge functions...")
    state["edge_functions"] = analyze_edge_functions()
    state["edge_function_count"] = len(state["edge_functions"])

    print("  - Tests...")
    state["tests"] = count_tests()

    print("  - Git log (24h)...")
    state["git_log_24h"] = get_git_log_24h()
    state["commits_24h"] = len(state["git_log_24h"])

    print("  - Code health...")
    state["code_health"] = analyze_code_health()

    # Summary for quick reading
    state["summary"] = {
        "source_files": state["code_health"]["source_file_count"],
        "total_lines": state["code_health"]["total_lines"],
        "hooks": state["hook_count"],
        "edge_functions": state["edge_function_count"],
        "test_files": state["tests"]["test_file_count"],
        "test_cases": state["tests"]["test_case_count"],
        "commits_24h": state["commits_24h"],
        "unsafe_casts": state["code_health"]["unsafe_any_count"],
        "mock_data_instances": state["code_health"]["mock_data_count"],
        "pages_with_queries": state["db_queries"]["useQuery"]["file_count"],
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(state, f, indent=2)

    print(f"\nCodebase perception complete. Written to {OUTPUT_FILE}")
    print(f"Summary: {json.dumps(state['summary'], indent=2)}")


if __name__ == "__main__":
    main()
