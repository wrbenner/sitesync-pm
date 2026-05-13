# Inviting your team

SiteSync uses role-based permissions to gate *actions*, not pages. Every invited user can navigate to every page; what they can create, edit, or approve depends on their role.

## Roles at a glance

| Role | What they can do |
| --- | --- |
| **Owner** | Everything. Billing, org settings, role assignment, project deletion, audit export, SSO config. Exactly one per org. |
| **Admin** | Everything except billing and org deletion. Can create projects, manage users, configure SLAs, export audit packs. |
| **Project Manager** | Create/edit RFIs, submittals, change orders, schedule, budget, daily logs. Approve RFIs and submittals within their assigned projects. Cannot manage org-level users or billing. |
| **Superintendent** | Create/edit daily logs, photos, check-ins, punch list items, safety observations. Can create RFIs but not approve them. Read-only on budget and change orders. |
| **Subcontractor** | Read-only on drawings, schedule, and assigned punch list items. Can respond to RFIs/submittals assigned to them. Cannot see budget, change orders, or other subs' data. |
| **Viewer** | Read-only everywhere they're assigned. Useful for owners, architects, lenders, inspectors. No create or edit. |

Permissions are enforced at the database row level via RLS, not just in the UI — a deleted or downgraded user cannot smuggle data via the API.

## Sending invites

1. Navigate to **The Crew → Invite** (or **Settings → Users → Invite User**).
2. Enter the invitee's email and select a role.
3. Optional: scope the invite to specific projects (otherwise they get org-wide visibility per their role).
4. Click **Send invite**.

The invitee receives a magic-link email from `invites@sitesync.app`. The link expires after **7 days**. If they miss the window, resend from **The Crew → Pending Invites**.

## Bulk invite via CSV

For teams of ten or more, bulk invite is faster:

1. **The Crew → Invite → Bulk CSV**.
2. Download the template. Columns: `email`, `role`, `project_ids` (semicolon-separated, optional).
3. Fill in up to 500 rows.
4. Upload. SiteSync validates emails, deduplicates against existing users, and shows a preview.
5. Confirm to send. All invites go out in a single batch.

> **Note:** Bulk CSV invite ships in Wave 2 of the BRT track. Until then, invite users one at a time from **The Crew → Invite**.

## What happens when an invitee accepts

1. They click the magic link within 7 days.
2. They land on a brief account-setup screen — name, password (or OAuth via Google/Microsoft/Apple), phone (optional, used for 2FA).
3. On submit, SiteSync provisions their user record, joins them to your org with the assigned role, and logs the event to the hash-chained audit trail (`audit_org_member_added`).
4. They're redirected to **The Day** scoped to their role and assigned projects.

You'll see them appear in **The Crew → Active** within seconds.

## Changing or revoking access

- **Change role** — **The Crew → [User] → Edit Role**. Effective immediately. Audit-logged.
- **Remove from project** — Unchecks them from the project assignment list. They keep their org account but lose visibility into that project.
- **Deactivate** — Soft-delete. They can't log in but their historical activity (RFIs created, daily logs filed) remains attributed for the audit trail.
- **Hard delete** — Available only to Owner. Permanently scrubs PII per GDPR right-to-be-forgotten. Audit trail keeps anonymized event records.

Any change to a user's role or project access is logged to the audit trail with the old value, new value, actor, and timestamp.

## Common questions

**Can I have multiple owners?** No. Exactly one owner per org. Promote another user to owner via **Settings → Org → Transfer Ownership**.

**Do invites count against my seat limit?** No — only accepted invites consume seats. SiteSync is currently flat-priced ($400/mo or $4,080/yr) with unlimited users, but the seat count is tracked for capacity planning.

**Can subcontractors see each other?** No. Each subcontractor sees only their own assigned items. RLS enforces this at the database level.
