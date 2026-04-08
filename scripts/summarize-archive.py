#!/usr/bin/env python3
"""Prints last 5 archive versions as a markdown table for the GitHub step summary."""
import json
from pathlib import Path
try:
    archive = json.loads(Path(".agent/prompt-archive.json").read_text())
    versions = archive.get("versions", [])[-5:]
    print("| Version | Date | Type | Score |")
    print("|---------|------|------|-------|")
    for v in versions:
        score = v.get("score_after") or v.get("baseline_score") or "N/A"
        print(f"| {v.get('version')} | {v.get('date')} | {v.get('modification_type')} | {score} |")
except Exception as e:
    print(f"Could not read archive: {e}")
