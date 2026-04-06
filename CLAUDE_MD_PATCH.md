# CLAUDE.md Patch — Add These Sections

## ADD AT THE TOP (after "# SiteSync AI - Construction Operating System")

```
## Essential Context Files
Before starting any task, read these files in this order:
1. **FEEDBACK.md** — Tonight's P0 priorities from the founder (always do these first)
2. **SPEC.md** — The living product spec with all acceptance criteria
3. **AGENTS.md** — Your full operating instructions (commands, workflows, don't-touch zones)
4. **LEARNINGS.md** — What has worked and what hasn't
5. **DECISIONS.md** — Architecture decisions that must not be undone
6. **.quality-floor.json** — Quality floors that must never be breached
```

## ADD AFTER "## Next Steps for Development"

```
## MCP Configuration
If MCP server tools are available in this session, use them:
- `supabase` — Query and manage the database directly
- `github` — Read/create issues, manage PRs
- `filesystem` — Read any file in the repo without shell

## Don't Touch Zones
### 🚫 Never modify these without explicit instruction
- `supabase/migrations/` — Never delete or modify existing migrations. Only add new ones.
- `src/types/database.ts` — Never edit manually. This is auto-generated from Supabase schema.
- `.quality-floor.json` — Only update when a metric IMPROVES. Never lower a floor.
- `package.json` dependencies — Ask before adding or removing packages.
- `SPEC.md` checkboxes — Only check off criteria that are FULLY implemented AND tested.

### ⚠️ Ask before modifying these
- Any state machine in `src/machines/`
- Authentication logic in `src/hooks/useAuth.ts`
- Permission logic in `src/hooks/usePermissions.ts`
- Database migration (create a new one, never edit existing)
- CI/CD workflows in `.github/workflows/`
```

## ADD NEW SECTION: "## Construction Domain Glossary"

```
## Construction Domain Glossary
- **RFI**: Request for Information — formal written question from contractor to architect/engineer. Has a "ball in court" concept showing who must respond next.
- **Submittal**: Material sample, shop drawing, or product data submitted by contractor for A/E approval before installation.
- **Change Order (CO)**: Signed modification to the contract. Requires owner signature.
- **Potential Change Order (PCO)**: Unofficial scope change under evaluation. Becomes a CO when approved.
- **Punch List**: Deficiency list created at substantial completion. Items must be resolved before final payment.
- **Daily Log**: Required daily record of weather, labor, equipment, visitors, and work performed.
- **AIA G702**: Standard Application for Payment form (billing).
- **AIA G703**: Continuation Sheet for G702 showing Schedule of Values breakdown.
- **Schedule of Values (SOV)**: Line-item breakdown of contract value used for progress billing.
- **Lien Waiver**: Legal document where a party releases their right to file a construction lien.
- **Davis-Bacon Act**: Federal law requiring prevailing wages on government-funded construction.
- **Certified Payroll**: Weekly payroll report required on Davis-Bacon projects (WH-347 form).
- **CPM Schedule**: Critical Path Method — standard for construction scheduling with dependencies.
- **Earned Value**: Method to measure project performance: planned vs. actual work vs. cost.
- **Retainage**: % (typically 10%) withheld from progress payments until substantial completion.
- **GC**: General Contractor — main contractor responsible for the entire project.
- **Sub**: Subcontractor — hired by GC for specific trades (electrical, plumbing, etc.).
- **AHJ**: Authority Having Jurisdiction — the building department or inspection authority.
- **NTP**: Notice to Proceed — written authorization to start work.
- **NDA**: Notice of Default/Acceleration — formal notice of contract breach.
```
