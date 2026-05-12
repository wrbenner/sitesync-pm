# Postmortem — `<one-line incident summary>`

**Incident date:** YYYY-MM-DD
**Severity:** P0 / P1 / P2 / P3
**Detection time:** UTC HH:MM
**Resolution time:** UTC HH:MM
**Total customer-facing duration:** N hours / minutes
**Postmortem owner:** _name_
**Postmortem due:** _within 24h for P0; within 5 business days otherwise_

---

## TL;DR

_(One paragraph. What broke, who noticed, what we did, who was affected. Save
the deep technical detail for §4. Read this paragraph aloud — if a Board member
couldn't follow it, rewrite it.)_

---

## 1. Timeline

UTC, ordered. Include all material events, even ones that turned out to be red
herrings — they explain why decisions took as long as they did.

| Time | Actor | Event |
|---|---|---|
| HH:MM | system | _Event that started the chain_ |
| HH:MM | _person_ | _What they noticed / did_ |
| ... | ... | ... |
| HH:MM | system | Resolution: _what specifically restored service_ |

Detection latency = _time of trigger_ − _time of root cause_.
Response latency = _time of response_ − _time of detection_.
Resolution latency = _time of resolution_ − _time of response_.

---

## 2. Customer-facing impact

- **Number of users affected:** _count_
- **Number of orgs affected:** _count_
- **Number of projects affected:** _count_
- **What they experienced:** _e.g., "could not load /dashboard for 47 minutes"_
- **Data integrity:** _intact / corrupted-and-restored / corrupted-and-lost_
- **Money impact:** _e.g., "no billing events lost; 3 charge attempts queued and processed"_

---

## 3. Root cause

_(One paragraph naming the specific commit, migration, or external event that
caused the incident. If multiple contributors, name them all. Avoid blame on
people; name systems and decisions.)_

---

## 4. Why we didn't catch it sooner

_(What test, monitor, or process would have detected this before customers did?
This section is what makes the postmortem useful — it produces concrete action
items.)_

---

## 5. Action items

Each item has an owner and a due date. They go to the engineering backlog and
are tracked to completion. P0 action items are non-negotiable; P1+ may be
deprioritized with explicit Founder approval.

| # | Item | Owner | Due | Status |
|---|---|---|---|---|
| 1 | _e.g., "Add adversarial RLS test for the X policy"_ | _name_ | YYYY-MM-DD | open |
| 2 | _e.g., "Move check_rate_limit retry off the critical path"_ | _name_ | YYYY-MM-DD | open |

---

## 6. What went well

_(2–4 bullets. The on-call team needs to see what to keep doing. Examples:
fast paging, useful Sentry stack trace, decisive rollback.)_

---

## 7. What we tried that didn't work

_(2–4 bullets. The on-call team needs to see the dead ends so they don't try
them again next time.)_

---

## 8. Glossary / unfamiliar terms

_(Optional. If a Board member or junior engineer reading this would hit a
term they don't know, define it here.)_

---

## 9. Sign-off

- **Author:** _name_, _date_
- **Reviewer (Founder or designate):** _name_, _date_
- **Distribution:** Engineering all-hands. Board summary if customer-money was
  involved. Public summary on `status.sitesyncai.com` if customer-facing
  outage > 1 hour.
