#!/usr/bin/env python3
"""Prints the latest version string from .agent/prompt-archive.json."""
import json, sys
from pathlib import Path
try:
    archive = json.loads(Path(".agent/prompt-archive.json").read_text())
    versions = archive.get("versions", [])
    print(versions[-1]["version"] if versions else "v0")
except Exception:
    print("v0")
