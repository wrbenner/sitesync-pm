# PAUSE.md — Organism Control

## Status: RUNNING

The organism checks this file at the start of every session.
- If Status is **RUNNING**: proceed normally
- If Status is **PAUSED**: stop immediately, create an issue, do nothing else
- If Status is **EMERGENCY_STOP**: revert last 3 commits, create incident issue, stop

To pause the organism from your phone:
Edit this file on GitHub → change RUNNING to PAUSED → commit

To resume: change PAUSED back to RUNNING

## Current Session Notes
(The organism appends observations here each session)
