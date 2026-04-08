# Tool Creation Guide

This directory contains helper scripts created by the organism during nightly runs.
Tools are first-class citizens of the system — they compound over time and make
every future night faster.

---

## When to Create a Tool

Create a new tool when **all three conditions** are true:

1. You have encountered the same task pattern **3 or more times** across sessions
2. The task is **not already covered** by an existing tool in this directory
3. The task takes more than ~5 minutes of reasoning each time it appears

**Good candidates:**
- Counting or measuring something in the codebase (e.g., component prop counts, route coverage)
- Validating a structural invariant (e.g., type alignment, schema conformance)
- Extracting a recurring report (e.g., "which pages lack loading states?")
- Transforming data between two formats you encounter repeatedly

**Bad candidates (do NOT create tools for):**
- One-off tasks specific to a single PR
- Tasks that require external API calls with side effects
- Tasks whose logic changes every time

---

## Where to Save

```
.agent/tools/{tool_name}.py
```

Use `snake_case` for tool names. Be descriptive:

| Good                          | Bad             |
|-------------------------------|-----------------|
| `count-component-props.py`    | `tool1.py`      |
| `check-route-coverage.py`     | `helper.py`     |
| `validate-supabase-types.py`  | `utils.py`      |
| `find-missing-loading-states.py` | `check.py`   |

---

## Required Format

Every tool **must** contain:

### 1. Module-level docstring
```python
"""
count_component_props.py

Counts the number of props defined on each React component in src/.
Useful for identifying components that have grown too large.

Usage:
    python .agent/tools/count_component_props.py [--threshold 10]

Output:
    JSON list of {component, file, prop_count} sorted by prop_count desc.
    Exits with code 1 if any component exceeds --threshold.
"""
```

### 2. Type hints on all functions
```python
def count_props_in_file(filepath: str) -> list[dict[str, str | int]]:
    ...
```

### 3. Error handling — every external call must be wrapped
```python
try:
    content = Path(filepath).read_text(encoding="utf-8")
except FileNotFoundError:
    print(f"[count-component-props] File not found: {filepath}", file=sys.stderr)
    return []
except PermissionError as e:
    print(f"[count-component-props] Permission denied: {e}", file=sys.stderr)
    return []
```

### 4. `if __name__ == "__main__"` test block
The test block must run without any external services and must exit 0 on success:
```python
if __name__ == "__main__":
    import sys
    # --- self-test ---
    result = count_props_in_file("src/components/Dashboard.tsx")
    assert isinstance(result, list), "Expected list output"
    assert all("component" in r for r in result), "Each item needs 'component' key"
    print("[count-component-props] Self-test passed.")
    # --- end self-test ---
    # Normal CLI entry point below
    main()
```

---

## Size Constraint

**Maximum 200 lines** (excluding blank lines and comments).

If your tool grows beyond 200 lines, it is doing too much. Split it into two tools
or extract shared logic into a shared utility that both tools import.

---

## Determinism Requirement

Tools **must be deterministic**: given the same codebase state, they must produce
the same output every time. This means:

- No random seeds unless seeded with a fixed value
- No timestamps in output (unless the task explicitly requires them)
- No network calls during normal operation
- Sort all list outputs before returning them

If your tool needs to interact with external state (git, filesystem outside the repo),
document this clearly in the docstring.

---

## Registration

After creating and testing a tool, add it to `.agent/tool-registry.json`:

```json
{
  "name": "count-component-props",
  "file": ".agent/tools/count-component-props.py",
  "description": "Counts props per React component. Flags components exceeding threshold.",
  "trigger_pattern": "component has too many props / component complexity",
  "created_date": "2025-01-15",
  "last_used_date": "2025-01-15",
  "use_count": 1
}
```

Update `last_used_date` and `use_count` each time you use the tool.

---

## Creation Process (Step-by-Step)

```
1. CREATE   → write .agent/tools/{tool_name}.py
2. TEST     → run: python .agent/tools/{tool_name}.py
              Verify exit code 0 and correct output
3. REGISTER → add entry to .agent/tool-registry.json
4. COMMIT   → git add .agent/tools/{tool_name}.py .agent/tool-registry.json
              git commit -m "tool: add {tool_name}"
```

Never skip the test step. A broken tool is worse than no tool.

---

## Deprecation Policy

If a tool has not been used in **5 consecutive nightly runs**, flag it for deprecation:

1. Set `"deprecated": true` in the registry entry
2. Add `"deprecation_reason": "Not used in 5 nights — pattern may no longer apply"`
3. Do **not** delete the file immediately — leave it for one more cycle
4. On the next run, if still unused, delete the file and remove the registry entry

This keeps the toolbox lean and avoids accumulating dead code.

---

## Examples of Good Tools

### `count-component-props.py`
Reads all `.tsx` files in `src/components/`, parses the props interface,
returns JSON with `{component, prop_count, file}`. Useful for refactoring
decisions. Deterministic, ~60 lines.

### `check-route-coverage.py`
Compares routes defined in `src/app/` (Next.js file-based routing) against
routes referenced in the navigation components. Outputs missing routes and
orphaned route files. ~80 lines.

### `validate-supabase-types.py`
Reads `supabase/migrations/` and `src/types/database.ts`, checks that every
table has a corresponding TypeScript type, and that the columns match.
Outputs a diff-style report. ~120 lines.

### `find-missing-loading-states.py`
Scans pages and components that perform async data fetching (uses Suspense,
`useQuery`, `fetch()`). Checks that each has a corresponding loading skeleton
or spinner. ~90 lines.

---

## Philosophy

Tools are the organism's **long-term memory for recurring tasks**. Each tool
you create is a bet that this pattern will appear again. The 3-recurrence rule
prevents premature tooling. The 5-night deprecation rule prevents tool rot.

When in doubt: write the tool. A 60-line script that saves 5 minutes every night
pays for itself within a week.
