#!/usr/bin/env python3
"""Prints the last 5 versions from .agent/prompt-archive.json as JSON."""
import json, sys
from pathlib import Path
try:
    archive = json.loads(Path(".agent/prompt-archive.json").read_text())
    archive["versions"] = archive.get("versions", [])[-5:]
    print(json.dumps(archive, indent=2))
except Exception:
    print('{"versions":[]}')
