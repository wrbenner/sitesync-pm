# Working with the schedule

The schedule module shows project phases as a Gantt with critical-path highlighting. Slip on any task ripples downstream automatically.

## Importing

We support import from Microsoft Project (XML) and Primavera P6 (XER). Drop the file in **Schedule** → **Import**.

## Recalc

When a task slips, the recalc engine propagates the slip downstream and surfaces a follow-up draft RFI for any newly-impacted submittals or buyouts. You stay in control — the draft is for review, not auto-send.

## Weather integration

Outdoor tasks get a weather flag if forecast conditions threaten the work window. Surfaces in the daily-log assembler.
