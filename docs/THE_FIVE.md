# The Five

> *"Simplicity is the ultimate sophistication."* — Da Vinci
>
> *"Focus is about saying no to a hundred good ideas."* — Jobs

This is the navigation thesis for SiteSync PM. It governs the top-level
information architecture and the relationship between the verbs the
field uses ("what am I doing right now?") and the nouns the contract
demands ("RFI #047, dated 4/15").

---

## The frame

**Top-level navigation is verbs. Nouns live underneath, accessible by
filter or deep link.** This means RFIs, Submittals, Change Orders, and
Meetings still have dedicated views, dedicated numbering, and dedicated
URLs — but they are not equal citizens of the home row. The home row is
*what the user is doing*, not *what kind of database row they're touching*.

The five verbs are:

| Verb | Mental model | Primary user |
|---|---|---|
| **The Day** | What do I need to do right now? | Super, foreman, PM checking in at 6am |
| **The Field** | What happened on site? | Super at end-of-day, PM reviewing logs |
| **The Conversation** | What is waiting on a person? | PM, architect's CA, anyone who reviews |
| **The Set** | What does the building look like? | Anyone touching drawings, BIM, specs |
| **The Site** | What is the state of the project? | PM, exec, owner viewing schedule/budget |

Each verb is a *filtered view of the same underlying data*. The data
model does not change. The schema does not change. RFI #047 is still
RFI #047. What changes is which screen surfaces it, when, and how.

---

## The mapping — every legacy noun goes somewhere

Procore-style navigation has 30+ nouns at the top level. Every one of
them maps cleanly into a verb:

| Legacy noun page | Verb home | Surfacing rule |
|---|---|---|
| Dashboard / Home | The Day | The default view of The Day *is* the dashboard |
| Daily Log | The Field | Today's log is the body of The Field; older logs are a list |
| RFIs | The Conversation | Filter `?type=rfi`. Direct URL `/rfis` still works for CAs who bookmark it |
| Submittals | The Conversation | Filter `?type=submittal`. Direct URL `/submittals` still works |
| Change Orders | The Conversation | Filter `?type=change_order` or accessed from Site → Budget |
| Meetings | The Conversation | Filter `?type=meeting`. Direct URL `/meetings` still works |
| Drawings | The Set | The primary view |
| BIM | The Set | Tab within The Set |
| Files | The Set | Tab within The Set |
| Specifications | The Set | Tab within The Set |
| Schedule | The Site | Primary view of The Site |
| Budget | The Site | Tab within The Site |
| Pay Apps | The Site | Tab within The Site → Financials |
| Contracts | The Site | Tab within The Site → Financials |
| Closeout | The Site | Tab within The Site → end-of-project |
| Reports | The Site | Tab within The Site |
| Workforce / Crews | The Field | Tab within The Field — who was on site |
| Time Tracking | The Field | Tab within The Field — payroll roll-up of crew hours |
| Equipment | The Field | Tab within The Field — what equipment was on site |
| Permits | The Site | Tab within The Site → compliance |
| Directory | (cross-cutting) | Lives in topbar Search; reachable from every entity that has a person field |
| Safety | The Field | Tab within The Field — incidents, inspections, JHA |
| Punch List | The Conversation | Filter `?type=punch`. Direct URL `/punch-list` still works |
| Iris (AI) | (everywhere) | Iris is the home, not a tab. See "Iris is the OS" below |

Nothing is deleted. Nothing is hidden. The navigation just stops
demanding the user know which database table they want.

---

## Why RFIs and Submittals stay first-class

These are not features. They are contractual artifacts. A judge in a
construction dispute will read RFI #047 and the architect's response.
The submittal log is what proves the architect approved the steel mill
certs. You cannot fold these into "messages" and you cannot rename
them. The industry has used these terms for 60 years.

What changes:

1. **A super filing a question never has to know it's an RFI.** They
   tap Capture, speak their question, and Iris classifies it as an RFI,
   drafts the body, pre-fills the location pin from GPS, attaches the
   photo, and routes it to the responsible party. The super sees a
   confirmation: "Sent to Cross Architects · 7-day clock starts now."
   They never opened `/rfis`.

2. **An architect's CA can still bookmark `/submittals`.** The route
   exists. The dedicated log view exists. The numbering, spec section
   tagging, and review chain are unchanged. They live there all day,
   exactly like Procore, but on a faster, more legible page.

3. **The Conversation is the inbox.** A PM opens The Conversation in
   the morning and sees: 3 RFIs awaiting their answer, 2 submittals
   they need to review, 1 change order pending sign-off, sorted by
   ball-in-court SLA. One stream, ordered by urgency, filterable by
   type when they want to drill down.

This serves both audiences without diluting either.

---

## Real-world workflow non-negotiables

The Conversation is only as good as the workflow underneath. These are
the things that have to be perfect for SiteSync to be usable on a real
$50M project — not aspirational, not optional:

### 1. Numbering is sacred
Sequential, never reused, project-scoped. Already correct in the
schema. Never expose a row without its number.

### 2. Ball-in-court is the dominant signal
"Who do I need to push?" is the #1 PM question. The ball-in-court
column is the second-biggest pixel on the row, after the title. Color
codes overdue red. **Done as of this commit:** overdue rows now have a
3px red left rail across RFIs and Submittals tables, scannable from
across the table without relying on row background.

### 3. SLA clock is visible and exportable
Construction contracts typically specify a 7- or 14-day RFI response
window. The clock is part of the legal record. Show "5 days overdue"
loudly. Export it in PDF and CSV.

### 4. Spec section tag on submittals
CSI division (03 31 00, 26 05 00…) drives the architect's review
chain. Every submittal row shows the spec section. Every architect
view filters by it.

### 5. External collaborators by email, not login
The sub's electrician will never install the app. The architect's CA
might not. RFIs and Submittals support magic-link email replies:
generate a signed URL, reply lands as a comment, audited and
threaded. This is where Procore's UX dies — they make the architect
log in.

### 6. PDF export with embedded markup
Insurance and legal artifact. Single-button. Always. The PDF is the
deliverable when this goes to a courtroom.

### 7. Linkage chain is the legal narrative
RFI → drawing markup → field photo → resulting change order. The
chain is what proves the GC followed process. `crossFeatureWorkflows.ts`
is the right primitive — extend it to surface the chain in the entity
detail views.

### 8. Email-in for replies
Architect's CA replies to the email; reply gets parsed, threaded, and
the RFI's status updates automatically. Without this, the architect
has to log in. Most won't.

### 9. Approval chains for submittals
Multi-step. Sub → GC → architect → consultant → architect → back.
Configurable per-project. Visible inline as a chain of avatars with
"awaiting" highlighted.

### 10. Offline-first capture
The super in the basement of a 30-story tower has no signal. Capture
queues locally, syncs when connectivity returns, and never loses a
photo. Already implemented; verify it stays that way.

---

## Iris is the OS, not a tab

The five verbs are the *destinations*. Iris is the *path*.

- Open the app at 6am → Iris briefing (morning summary, schedule
  risk, who needs answers, weather alerts).
- Capture in the field → Iris classifies, drafts, routes.
- End of day → Iris drafts the daily log; super reviews and signs.
- Anywhere, anytime → Iris is the universal command line via cmd-K
  or the Capture FAB.

The five tabs exist for the 10% case where Iris was wrong or the
user wants to browse a specific log (CA reviewing submittals, exec
checking budget). The 90% case is three Iris interactions across the
day. The five tabs are the safety net, not the primary surface.

---

## What this means for the next sprint

1. **Don't add a sixth tab.** Hold the line. Anything that wants to be
   a top-level tab gets folded into one of the five.
2. **Build the Conversation inbox.** It's the unification of RFIs,
   Submittals, Change Orders, Meetings into one prioritized list. URL
   filters keep the dedicated logs working.
3. **Wire the ball-in-court treatment into Change Orders, Meetings,
   and Punch List.** The 3px red rail is the new universal "act now"
   visual. Apply consistently.
4. **Iris morning briefing.** Edge function ships today (Tab B in the
   parallel work plan). Briefing UI is a new view inside The Day.
5. **Capture classifier.** Edge function ships today (Tab C). UI swap
   to a single FAB comes after the classifier is at >70% accuracy on
   real input.

---

## What this means for the contract argument

When a customer's IT director asks "do you have an RFI module?" the
answer is yes, and you can show them `/rfis`. The numbering, the log,
the approval chain, the PDF export, the email-in — all there.

When a super asks "where do I file an RFI?" the answer is "you don't.
You tap the orange button and tell me what's wrong; I'll handle the
rest."

Both customers served. Neither watered down. That's the move.
