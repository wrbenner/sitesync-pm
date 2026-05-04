#!/usr/bin/env python3
"""
audit-permission-gate.py — enumerate action buttons across the six
feature areas and emit a JSON snapshot describing each one's gate
state.

Output: scripts/.permission-gate-snapshot.json (committed to the repo).
The companion CI gate (audit-permission-gate.mjs) compares the live
codebase against this snapshot and fails CI if the count of unguarded
action buttons grows without an allowlist update.

Re-run after any structural change to the six page areas:

    python3 scripts/audit-permission-gate.py

Methodology and full per-button classification: see
docs/audits/PERMISSION_GATE_AUDIT_2026-05-01.md

Author: Walker Benner — May 1, 2026
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# --------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent

AREAS: dict[str, list[str]] = {
    "RFI":         ["src/pages/RFIs.tsx", "src/pages/rfi"],
    "Submittal":   ["src/pages/submittals"],
    "ChangeOrder": ["src/pages/ChangeOrders.tsx", "src/pages/change-orders"],
    "PayApp":      ["src/pages/payment-applications"],
    "Punch":       ["src/pages/punch-list"],
    "DailyLog":    ["src/pages/daily-log"],
}

BUTTON_OPEN = re.compile(r"<(button|Button|IconButton|MenuItem)\b")
PG_OPEN     = re.compile(r"<PermissionGate\b")
PG_CLOSE    = re.compile(r"</PermissionGate>")
JSX_TEXT    = re.compile(r"<(?:button|Button|IconButton|MenuItem)[^>]*>([\s\S]{1,400}?)</(?:button|Button|IconButton|MenuItem)>")
ARIA        = re.compile(r"aria-label=[\"']([^\"']+)[\"']")
ON_CLICK    = re.compile(r"onClick=\{[^}]{1,160}\}")

# Heuristic: a button is an "Action" (mutate server state) if its
# onClick references any of these names. Tunable.
ACTION_HANDLER_HINTS = re.compile(
    r"\b(handle\w*Submit|handleSubmit|handleApprove|handleReject|"
    r"handleDelete|handleCreate|handleSave|handleSend|handlePublish|"
    r"handleSign|handleExport|handleImport|handleVerify|handleResolve|"
    r"handlePromote|handleVoid|handleAcknowledge|handleAutoDraft|"
    r"handleDeleteEntry|handleAIDraft|handlePhotoCapture|handleApply|"
    r"\.mutate\(|\.mutateAsync\(|markPaidMutation|submitMutation|"
    r"onAction\(|onSubmit\b|onApprove\b|onReject\b|onSend\b|onCreate\b|"
    r"onMarkReceived|onMarkExecuted|onGenerateAll|onAiSummary|"
    r"handleRetainageStageAdvance|removeRow|addRow|"
    r"addCrewRow|addEquipmentRow|addFieldEntry|addVisitorRow|addDeliveryRow)\b"
)

# Patterns that indicate a button is UI-only (modal toggles, nav,
# filter chips, tab switches, sort, refetch, client-form-row mgmt).
UI_HINTS = re.compile(
    r"\b(setShow\w+|setActiveTab|setDetailTab|setStatusFilter|setView|"
    r"setExpand|setCollapse|navigate\(|setFilter|expandAll|collapseAll|"
    r"clearFilters|setTab|setSelected\w+|setSort|onTabChange|onClose|"
    r"setG702ModalOpen|onHeaderClick|onClick=\{onClose\}|"
    r"shiftDate|setSelectedDate|setShowReject|stopPropagation|"
    r"refetch\(\)|setShowMore|handleZoom|handleFit|handleReset|"
    r"setShowSidebar|setPage\(|setPageSize|"
    # local-state row managers — these filter/set in-memory arrays, not Supabase
    r"setEquipmentRows|setMaterialRows|setVisitorRows|setManpowerRows|"
    r"setCrewRows|setDeliveryRows|setIncidentRows)\b"
    # passthrough prop button (RowDeleteButton component body)
    r"|onClick=\{onClick\}"
)


def files_in(paths: list[str]) -> list[str]:
    out: list[str] = []
    for p in paths:
        full = REPO_ROOT / p
        if not full.exists():
            continue
        if full.is_file():
            out.append(str(full.relative_to(REPO_ROOT)))
            continue
        for root, _, fnames in os.walk(full):
            if "__tests__" in root or "/test" in root:
                continue
            for fn in fnames:
                if fn.endswith((".tsx", ".ts")) and ".test." not in fn:
                    out.append(str((Path(root) / fn).relative_to(REPO_ROOT)))
    return sorted(set(out))


def classify(label: str, click: str) -> str:
    if not click and not label:
        return "U"  # default: assume UI affordance for opaque buttons
    blob = f"{label}\n{click}"
    if ACTION_HANDLER_HINTS.search(blob):
        return "A"
    if UI_HINTS.search(blob):
        return "U"
    # last-resort heuristic: action verb in label
    if label and re.search(r"\b(Submit|Approve|Reject|Delete|Send|Save|Pay|"
                           r"Verify|Promote|Void|Sign|Issue|Resolve|Mark|"
                           r"Add|Remove|Generate|Export|Import|Capture|"
                           r"Convert|Advance|Withdraw)\b", label, re.I):
        return "A"
    return "U"


def scan_file(path: str) -> list[dict]:
    text = (REPO_ROOT / path).read_text(errors="replace")
    lines = text.splitlines(keepends=True)
    out: list[dict] = []
    depth = 0
    i = 0
    while i < len(lines):
        depth += len(PG_OPEN.findall(lines[i]))
        depth -= len(PG_CLOSE.findall(lines[i]))
        if BUTTON_OPEN.search(lines[i]):
            blob = "".join(lines[i:i+12])
            label = ""
            m = JSX_TEXT.search(blob)
            if m:
                inner = m.group(1)
                inner = re.sub(r"<[^>]+/?>", " ", inner)
                inner = re.sub(r"\{[^}]*\}", " ", inner)
                inner = re.sub(r"\s+", " ", inner).strip()
                label = inner[:80]
            else:
                m2 = ARIA.search(blob)
                label = ("[aria] " + m2.group(1)[:60]) if m2 else ""
            click_match = ON_CLICK.search(blob)
            click = click_match.group(0) if click_match else ""
            out.append({
                "line": i + 1,
                "label": label,
                "click": click[:140],
                "gated": depth > 0,
                "kind": classify(label, click),
            })
        i += 1
    return out


def main() -> int:
    snapshot: dict = {"areas": {}, "summary": {}}
    total_action = 0
    total_unguarded_action = 0
    total_buttons = 0
    for area, paths in AREAS.items():
        files = files_in(paths)
        area_data = {}
        action_count = 0
        unguarded_action_count = 0
        button_count = 0
        for f in files:
            buttons = scan_file(f)
            if not buttons:
                continue
            area_data[f] = buttons
            for b in buttons:
                button_count += 1
                if b["kind"] == "A":
                    action_count += 1
                    if not b["gated"]:
                        unguarded_action_count += 1
        snapshot["areas"][area] = {
            "files": area_data,
            "buttons": button_count,
            "actions": action_count,
            "unguarded_actions": unguarded_action_count,
        }
        total_action += action_count
        total_unguarded_action += unguarded_action_count
        total_buttons += button_count

    snapshot["summary"] = {
        "buttons": total_buttons,
        "actions": total_action,
        "unguarded_actions": total_unguarded_action,
        "schema_version": 1,
    }

    out_path = REPO_ROOT / "scripts" / ".permission-gate-snapshot.json"
    out_path.write_text(json.dumps(snapshot, indent=2) + "\n")

    print(f"=== PermissionGate audit ===")
    print(f"  total button-like elements:   {total_buttons}")
    print(f"  classified as Action:         {total_action}")
    print(f"  unguarded Action buttons:     {total_unguarded_action}")
    print()
    for area, data in snapshot["areas"].items():
        print(f"  {area:<14} actions={data['actions']:<3}  unguarded={data['unguarded_actions']}")
    print()
    print(f"snapshot → {out_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
