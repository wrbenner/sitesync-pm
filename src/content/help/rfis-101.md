# RFIs 101

A **Request for Information** (RFI) is a formal question from a contractor to the design team — usually the architect or engineer — asking for clarification on the drawings, specs, or scope. RFIs are the spine of construction risk management. Every ambiguity in the contract documents that goes unanswered turns into a change order, a delay claim, or a lawsuit. The RFI is how you make that ambiguity *somebody else's problem* with a paper trail.

SiteSync treats RFIs as first-class entities with auto-numbering, SLA tracking, ball-in-court routing, drawing references, and a hash-chained audit log.

## When to create one

Create an RFI whenever:

- The drawings and specs contradict each other.
- A detail is missing or ambiguous.
- A material called out is unavailable and needs an equivalent approved.
- An inspector flags something that conflicts with the approved plans.
- A subcontractor asks a question you can't answer from the contract documents alone.

If the answer changes scope, cost, or schedule, the RFI response becomes the evidence trail for the change order that follows. Never resolve a scope-changing question over text or in a hallway conversation.

## Creating an RFI

1. **The Risk → RFIs → + New RFI** (or **The Drawings → pin a location → Create RFI**).
2. Fill in:
   - **Subject** — One sentence summary.
   - **Question** — Full description. Be specific. Reference drawing sheets, spec sections, and detail callouts.
   - **Priority** — Low, Medium, or High. Drives SLA (see below).
   - **Assigned to** — Usually the architect or engineer of record.
   - **Drawing references** — Pin to specific sheets (auto-attached if you started from The Drawings).
   - **Cost/schedule impact** — Estimated dollars and days, if known.
3. Save. An RFI number is auto-assigned (`RFI-001`, `RFI-002`, etc., per-project).
4. SiteSync emails the assignee with a magic link to respond directly without needing a SiteSync account.

## The SLA system

Every RFI carries an SLA based on priority:

| Priority | SLA | Use when |
| --- | --- | --- |
| **High** | 3 business days | Blocks active work. Pour scheduled this week. Critical-path impact. |
| **Medium** | 7 business days | Affects upcoming work but not today's. Standard default. |
| **Low** | 14 business days | Long-lead clarification. Future phase. Nice-to-know. |

SLAs are business-day-aware (project timezone, excludes weekends and configured holidays). They pause automatically when ball-in-court is on the contractor (e.g., you've requested clarification of the response).

The SLA Escalation Ladder fires Slack/email pings at 50%, 75%, 90%, and 100% of SLA elapsed. Configurable per project in **Settings → Project SLAs**. See `docs/SLA_ESCALATION.md` for engineering detail.

## Ball-in-court routing

"Ball-in-court" is the construction term for *whose turn it is*. SiteSync tracks it explicitly:

- **Created** — Ball with assignee (the architect).
- **Responded** — Ball with contractor (you) to accept or push back.
- **Clarification requested** — Ball with assignee again, SLA timer resets.
- **Closed** — Ball nowhere. Locked.

The current ball-in-court is shown prominently on the RFI card, and the SLA clock only counts down when the ball is on the *responsible* party.

## Drawing references

Pinning RFIs to drawings is the difference between "we asked the architect about something" and "we asked the architect about *this specific detail on Sheet A-203 callout 5*." Always pin.

- From the RFI form: click **+ Add drawing reference**, search sheet number, click the location on the sheet.
- From **The Drawings**: open a sheet, click the pin tool, drop a pin, click **Create RFI from pin**.
- Pins persist across drawing revisions. When a new revision is uploaded, SiteSync surfaces any RFI pins that may have been affected.

## Responding and closing out

When the architect responds:

1. SiteSync logs the response, ball-in-court flips to contractor, SLA clock stops.
2. You review on **The Risk → RFIs → [RFI-NNN]**.
3. Three actions: **Accept** (closes the RFI), **Request clarification** (ball back, SLA resumes), **Escalate to change order** (auto-drafts a CO using the RFI as evidence).

Closed RFIs are immutable. Any subsequent comments append to the thread but cannot alter the original question or response.

## Audit trail

Every RFI event — created, responded, clarified, closed, drawing reference added, SLA escalation fired, ball-in-court flipped — is written to the hash-chained audit log. Each entry includes:

- Actor (user ID + role)
- Timestamp (UTC + project timezone)
- Event type
- Before/after state
- Cryptographic hash linking to the prior entry

The audit trail is exportable as a deposition-grade PDF from **The Audit → Export Entity Audit** with a cover sheet, hash-verification appendix, and notarized digital signature option. Use this when an RFI becomes evidence in a dispute.
