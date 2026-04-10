#!/usr/bin/env python3
"""
compute-urgency.py — The System's Urgency Physiology

Computes the system's current urgency level based on proximity to the demo
date and outputs behavioral modifications that the strategic reasoning agent
MUST follow.

This is not a suggestion — it is a physiological constraint. As the demo
approaches, the system's behavior changes involuntarily, the same way a
human's heart rate rises before a presentation.

Inputs:
  - Current date (from system clock)
  - Demo date (env DEMO_DATE or default 2026-04-15)

Output:
  - .perception/urgency.json

Usage:
  python autopoietic/scripts/compute-urgency.py
"""

import json
import os
import sys
from datetime import datetime, timezone, date

DEMO_DATE_STR = os.environ.get("DEMO_DATE", "2026-04-15")
OUTPUT_DIR = ".perception"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "urgency.json")

# Phase boundaries
# The system has 9 "working days" of full capacity. Urgency is calibrated
# so that at 9 days out, urgency ≈ 0.0, and at 0 days it = 1.0.
FULL_HORIZON_DAYS = 9


def compute():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    today = date.today()
    demo_date = date.fromisoformat(DEMO_DATE_STR)
    days_remaining = (demo_date - today).days

    # Clamp to valid range
    if days_remaining < 0:
        days_remaining = 0
    urgency = round(max(0.0, min(1.0, 1.0 - (days_remaining / FULL_HORIZON_DAYS))), 3)

    # --- Determine phase ---
    if urgency < 0.40:
        phase = "balanced"
        experiment_mix = {"feature": 0.45, "ai": 0.20, "quality": 0.20, "testing": 0.15}
        risk_tolerance = "high"
        allow_infra = True
        allow_refactor = True
        demo_weight = 0.2
        phase_rules = (
            f"Balanced phase: mix features, AI, quality, and testing freely. "
            f"Demo is {days_remaining} days away — infrastructure and refactoring are OK. "
            f"Experiment boldly; there is time to recover from mistakes."
        )
    elif urgency < 0.65:
        phase = "feature-sprint"
        experiment_mix = {"feature": 0.70, "ai": 0.15, "quality": 0.10, "testing": 0.05}
        risk_tolerance = "medium"
        allow_infra = False
        allow_refactor = False
        demo_weight = 0.4
        phase_rules = (
            f"Feature-sprint phase: 70% of effort on features visible in the demo. "
            f"Demo is {days_remaining} days away — NO infrastructure, NO refactoring. "
            f"Every commit should make the demo better. AI features get 15% allocation."
        )
    elif urgency < 0.85:
        phase = "demo-polish"
        experiment_mix = {"feature": 0.30, "ai": 0.10, "quality": 0.40, "testing": 0.20}
        risk_tolerance = "low"
        allow_infra = False
        allow_refactor = False
        demo_weight = 0.7
        phase_rules = (
            f"Demo-polish phase: only touch demo-visible pages. "
            f"Demo is {days_remaining} days away — test the demo flow, fix blockers "
            f"from rehearsal, polish UI. No new features unless they fix a rehearsal blocker. "
            f"Quality and testing are paramount. Every change must be low-risk."
        )
    else:
        phase = "freeze"
        experiment_mix = {"feature": 0.00, "ai": 0.00, "quality": 0.60, "testing": 0.40}
        risk_tolerance = "zero"
        allow_infra = False
        allow_refactor = False
        demo_weight = 1.0
        phase_rules = (
            f"FREEZE phase: only fix critical bugs found in demo rehearsal. "
            f"Demo is {days_remaining} day{'s' if days_remaining != 1 else ''} away — "
            f"NO new features, NO new AI, NO infrastructure. "
            f"If it works, do not touch it. Only fix what is broken in the demo flow. "
            f"Risk tolerance is ZERO."
        )

    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "demo_date": DEMO_DATE_STR,
        "today": today.isoformat(),
        "days_remaining": days_remaining,
        "urgency": urgency,
        "phase": phase,
        "behavioral_modifications": {
            "experiment_mix": experiment_mix,
            "risk_tolerance": risk_tolerance,
            "allow_infrastructure": allow_infra,
            "allow_refactoring": allow_refactor,
            "demo_rehearsal_weight": demo_weight,
        },
        "phase_rules": phase_rules,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(result, f, indent=2)

    # Human-readable output
    print(f"Demo Date:       {DEMO_DATE_STR}")
    print(f"Today:           {today.isoformat()}")
    print(f"Days Remaining:  {days_remaining}")
    print(f"Urgency:         {urgency}")
    print(f"Phase:           {phase.upper()}")
    print(f"Risk Tolerance:  {risk_tolerance}")
    print(f"Infra Allowed:   {allow_infra}")
    print(f"Refactor OK:     {allow_refactor}")
    print(f"Demo Weight:     {demo_weight}")
    print(f"\nWritten to {OUTPUT_FILE}")


if __name__ == "__main__":
    compute()
