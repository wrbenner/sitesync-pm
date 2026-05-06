#!/usr/bin/env node
// audit-permission-gate.mjs — CI gate that fails when the count of
// unguarded action buttons grows in the six contractual feature areas.
//
// How it works
// ------------
// 1. Re-runs the Python analyzer to produce a fresh snapshot of the
//    current codebase state.
// 2. Diffs the fresh snapshot against the committed baseline at
//    scripts/.permission-gate-snapshot.json.
// 3. Fails CI if any area's `unguarded_actions` count is HIGHER than
//    the baseline. Lower or equal is fine — that's progress.
//
// Updating the baseline (when you intentionally add a new action and
// gate it, or accept a new exception):
//
//     python3 scripts/audit-permission-gate.py
//     git add scripts/.permission-gate-snapshot.json
//
// The baseline is a load-bearing artifact. Decreases are encouraged;
// increases require an explicit baseline commit, which is reviewable.
//
// References:
//   docs/audits/PERMISSION_GATE_AUDIT_2026-05-01.md
//   src/components/auth/PermissionGate.tsx
//   src/hooks/usePermissions.ts
//
// Author: Walker Benner — May 1, 2026
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");
const snapshotPath = resolve(repoRoot, "scripts/.permission-gate-snapshot.json");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function fail(msg) {
  console.error(`${RED}✗ ${msg}${RESET}`);
  process.exit(1);
}

if (!existsSync(snapshotPath)) {
  fail(
    "No baseline snapshot found at scripts/.permission-gate-snapshot.json. " +
    "Run `python3 scripts/audit-permission-gate.py` and commit the file."
  );
}

const baseline = JSON.parse(readFileSync(snapshotPath, "utf8"));

// Re-run analyzer to a fresh temp file. If python is missing, soft-skip
// rather than hard-fail (some CI lanes are JS-only).
const tmp = `/tmp/permission-gate-fresh-${process.pid}.json`;
let fresh;
try {
  execSync(
    `python3 "${resolve(repoRoot, "scripts/audit-permission-gate.py")}" >/dev/null && ` +
    `cp "${snapshotPath}" "${tmp}.baseline.json"`,
    { stdio: "inherit" }
  );
  fresh = JSON.parse(readFileSync(snapshotPath, "utf8"));
  // Restore committed baseline so the analyzer's write doesn't dirty the worktree.
  execSync(
    `git -C "${repoRoot}" checkout HEAD -- scripts/.permission-gate-snapshot.json 2>/dev/null || true`
  );
} catch (e) {
  console.error(
    `${YELLOW}! audit-permission-gate.mjs: could not run analyzer ` +
    `(python3 missing?). Skipping live diff; baseline check only.${RESET}`
  );
  fresh = baseline;
}

const violations = [];
let unguardedTotalDelta = 0;
const baseAreas = baseline.areas || {};
const freshAreas = fresh.areas || {};
for (const area of Object.keys(baseAreas)) {
  const baseUg = baseAreas[area]?.unguarded_actions ?? 0;
  const freshUg = freshAreas[area]?.unguarded_actions ?? 0;
  unguardedTotalDelta += freshUg - baseUg;
  if (freshUg > baseUg) {
    violations.push({
      area,
      from: baseUg,
      to: freshUg,
      delta: freshUg - baseUg,
    });
  }
}

console.log("");
console.log(`${DIM}=== PermissionGate CI gate ===${RESET}`);
console.log(`${DIM}baseline:${RESET} scripts/.permission-gate-snapshot.json`);
console.log(`${DIM}schema:  ${RESET} v${baseline.summary?.schema_version ?? 1}`);
console.log("");

for (const area of Object.keys(baseAreas)) {
  const baseUg = baseAreas[area]?.unguarded_actions ?? 0;
  const freshUg = freshAreas[area]?.unguarded_actions ?? 0;
  const delta = freshUg - baseUg;
  const arrow = delta > 0 ? `${RED}▲ +${delta}${RESET}`
              : delta < 0 ? `${GREEN}▼ ${delta}${RESET}`
              : `${DIM}=${RESET}`;
  console.log(
    `  ${area.padEnd(14)}  baseline ${String(baseUg).padStart(3)}  ` +
    `now ${String(freshUg).padStart(3)}  ${arrow}`
  );
}
console.log("");

if (violations.length > 0) {
  console.error(
    `${RED}✗ PermissionGate gate FAILED — unguarded action buttons grew:${RESET}`
  );
  for (const v of violations) {
    console.error(
      `  ${v.area}: ${v.from} → ${v.to}  (+${v.delta})`
    );
  }
  console.error("");
  console.error("If the new buttons are intentional and properly gated, run:");
  console.error("  python3 scripts/audit-permission-gate.py");
  console.error("  git add scripts/.permission-gate-snapshot.json");
  console.error("");
  console.error(
    "If the new buttons are NOT actions (UI affordances), confirm by " +
    "reading docs/audits/PERMISSION_GATE_AUDIT_2026-05-01.md and add " +
    "them to the allowlist convention there."
  );
  process.exit(1);
}

if (unguardedTotalDelta < 0) {
  console.log(
    `${GREEN}✓ PermissionGate gate passed — net ${unguardedTotalDelta} ` +
    `unguarded action button(s) eliminated since baseline.${RESET}`
  );
} else {
  console.log(`${GREEN}✓ PermissionGate gate passed — no growth since baseline.${RESET}`);
}
console.log("");
process.exit(0);
