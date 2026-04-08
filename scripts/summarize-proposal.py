#!/usr/bin/env python3
"""Prints the proposal fields as markdown for the GitHub step summary."""
import json
from pathlib import Path
try:
    p = json.loads(Path("/tmp/self-improve/proposal.json").read_text())
    print(f"**Analysis:** {p.get('analysis', 'N/A')}")
    print()
    print(f"**Rationale:** {p.get('rationale', 'N/A')}")
    print()
    print(f"**Expected Impact:** {p.get('expected_impact', 'N/A')}")
    print()
    print(f"**Risk:** {p.get('risk', 'N/A')}")
except Exception as e:
    print(f"Could not read proposal: {e}")
