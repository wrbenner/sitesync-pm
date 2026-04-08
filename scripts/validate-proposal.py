#!/usr/bin/env python3
"""
validate-proposal.py
────────────────────
Validates the meta-agent's modification proposal before deployment.

Checks:
  1. Proposal file exists and is valid JSON
  2. modification_type is a recognized value
  3. 'before' text exists in target file (if provided)
  4. 'after' text is <= 200 characters
  5. Modified file passes YAML validation
  6. Circuit breakers section still present after modification
  7. For TOOL_CREATION: new-tool.py passes Python syntax check

Outputs:
  - Prints action to stdout (apply / skip / revert / create_tool)
  - Sets exit code: 0 = valid, 1 = invalid
"""

import json
import sys
import yaml
from pathlib import Path

PROPOSAL_FILE = Path("/tmp/self-improve/proposal.json")
MODIFIED_COPY = Path("/tmp/self-improve/modified-target.yml")
NEW_TOOL_FILE = Path("/tmp/self-improve/new-tool.py")

VALID_MOD_TYPES = {
    "PROMPT_MODIFICATION", "STRATEGY_MODIFICATION",
    "TOOL_CREATION", "REVERT", "SKIP"
}


def fail(reason: str, action: str = "skip") -> None:
    print(f"INVALID: {reason}", file=sys.stderr)
    print(action)
    sys.exit(1)


def succeed(action: str) -> None:
    print(action)
    sys.exit(0)


# ── Load proposal ────────────────────────────────────────────────────────────

if not PROPOSAL_FILE.exists():
    fail("proposal.json not found -- meta-agent produced no output")

try:
    proposal = json.loads(PROPOSAL_FILE.read_text())
except json.JSONDecodeError as e:
    fail(f"proposal.json is invalid JSON: {e}")

mod_type = proposal.get("modification_type", "SKIP")
target = proposal.get("target_file", "") or ""
before = proposal.get("before", "") or ""
after = proposal.get("after", "") or ""

# ── SKIP ─────────────────────────────────────────────────────────────────────

if mod_type == "SKIP":
    print("Meta-agent decided SKIP -- no modification needed", file=sys.stderr)
    succeed("skip")

# ── REVERT ───────────────────────────────────────────────────────────────────

if mod_type == "REVERT":
    print("Revert requested", file=sys.stderr)
    succeed("revert")

# ── Validate modification types ───────────────────────────────────────────────

if mod_type not in VALID_MOD_TYPES:
    fail(f"Unknown modification_type: {mod_type}")

# ── Character count safety ────────────────────────────────────────────────────

if len(after) > 200:
    fail(
        f"Modification exceeds 200-character limit ({len(after)} chars in 'after'). "
        "Rejecting to prevent sweeping changes."
    )

# ── TOOL_CREATION ─────────────────────────────────────────────────────────────

if mod_type == "TOOL_CREATION":
    if not NEW_TOOL_FILE.exists():
        fail("TOOL_CREATION proposed but /tmp/self-improve/new-tool.py not found")
    try:
        source = NEW_TOOL_FILE.read_text()
        compile(source, str(NEW_TOOL_FILE), "exec")
        print("Tool syntax check passed", file=sys.stderr)
        succeed("create_tool")
    except SyntaxError as e:
        fail(f"Tool syntax check failed: {e}")

# ── PROMPT_MODIFICATION or STRATEGY_MODIFICATION ─────────────────────────────

if not target:
    fail("target_file is empty -- cannot apply modification")

target_path = Path(target)
if not target_path.exists():
    fail(f"Target file not found: {target}")

# Verify 'before' text exists in target
content = target_path.read_text(encoding="utf-8")
if before and before not in content:
    fail(
        f"The 'before' text was not found in {target}. "
        "The modification may be stale or the meta-agent hallucinated the text."
    )

# Apply modification to a copy
if before and before in content:
    modified = content.replace(before, after, 1)
elif not before:
    modified = content + "\n" + after
else:
    fail(f"Cannot apply modification: 'before' text not found in {target}")

MODIFIED_COPY.write_text(modified)
print(f"Applied modification to copy ({len(before)} -> {len(after)} chars)", file=sys.stderr)

# YAML validation
try:
    yaml.safe_load(modified)
    print("YAML validation passed", file=sys.stderr)
except yaml.YAMLError as e:
    fail(f"Modified file failed YAML validation: {e}")

# Circuit breaker safety check
if "CIRCUIT BREAKERS" not in modified:
    fail(
        "SAFETY VIOLATION: Circuit breakers section missing from modified file. "
        "This modification would remove a critical safety constraint."
    )

print("Circuit breakers intact -- safety check passed", file=sys.stderr)
succeed("apply")
