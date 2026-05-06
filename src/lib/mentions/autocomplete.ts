// ── @-mention autocomplete ranker ──────────────────────────────────────────
// Pure deterministic ranking. Given a query string and a list of contacts,
// returns the top N candidates ordered by best-fit. UI is just a thin
// renderer over this — keeps the ranking testable.
//
// Ranking signal:
//   • Exact prefix match on full name           → top
//   • Exact prefix match on last name           → next
//   • Substring match (case-insensitive) on name→ next
//   • Contains query in role / company / trade  → next
//   • Former member (project_id mismatch)       → demoted, suffix added
//
// The query is the text typed AFTER the '@' (caller strips the trigger).

export type MentionContact = {
  id: string;
  name: string;
  email: string | null;
  role?: string | null;
  trade?: string | null;
  company?: string | null;
  /** Optional: when the contact's project_id differs from the active
   *  project, the UI flags them as "(former member)". */
  former_member?: boolean;
};

export interface MentionCandidate {
  contact: MentionContact;
  /** Higher is better. 0 means no match. */
  score: number;
  /** Display label, possibly with "(former member)" suffix. */
  label: string;
  /** Concise role/company line for the dropdown. */
  detail: string;
}

const norm = (s: string) => s.toLowerCase().trim();

function prefixOnFullName(name: string, q: string): boolean {
  return norm(name).startsWith(q);
}
function prefixOnLastName(name: string, q: string): boolean {
  const parts = norm(name).split(/\s+/);
  return parts.some((p) => p.startsWith(q));
}
function substringOnName(name: string, q: string): boolean {
  return norm(name).includes(q);
}
function substringOnAux(c: MentionContact, q: string): boolean {
  return [c.role, c.company, c.trade]
    .filter((v): v is string => !!v)
    .some((v) => norm(v).includes(q));
}

function makeDetail(c: MentionContact): string {
  const parts: string[] = [];
  if (c.role) parts.push(c.role);
  if (c.company) parts.push(c.company);
  if (c.trade && !parts.includes(c.trade)) parts.push(c.trade);
  return parts.join(' · ');
}

export interface RankOptions {
  /** Cap on returned candidates. Default 6 — UI typically shows ≤ 6. */
  limit?: number;
}

/**
 * Rank contacts against a query. Empty query returns the first `limit`
 * contacts (alphabetical by name) so the dropdown shows something
 * useful immediately on '@' before the user types.
 */
export function rankMentions(
  query: string,
  contacts: ReadonlyArray<MentionContact>,
  opts: RankOptions = {},
): MentionCandidate[] {
  const limit = opts.limit ?? 6;
  const q = norm(query);

  const candidates: MentionCandidate[] = contacts.map((contact) => {
    let score = 0;
    if (q.length === 0) {
      // Empty query: rank alphabetically (mod former-member demotion).
      score = 100 - contact.name.charCodeAt(0);
    } else if (prefixOnFullName(contact.name, q)) {
      score = 100;
    } else if (prefixOnLastName(contact.name, q)) {
      score = 80;
    } else if (substringOnName(contact.name, q)) {
      score = 60;
    } else if (substringOnAux(contact, q)) {
      score = 40;
    }
    if (contact.former_member) score -= 25;

    const label = contact.former_member ? `${contact.name} (former member)` : contact.name;

    return { contact, score, label, detail: makeDetail(contact) };
  });

  return candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.contact.name.localeCompare(b.contact.name);
    })
    .slice(0, limit);
}

// ── Trigger detection ────────────────────────────────────────────────
// Given a textarea's value + caret position, decide whether the user is
// currently composing an @-mention. Returns the active query (text from
// the @ to caret) or null.

const MENTION_TRIGGER_RE = /(?:^|\s)@([A-Za-z0-9_.\- ]{0,40})$/;

export function detectMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number; end: number } | null {
  const head = text.slice(0, caret);
  const m = head.match(MENTION_TRIGGER_RE);
  if (!m) return null;
  // Disallow trailing newline-only — we don't want to mention across line breaks.
  const query = m[1];
  if (query.includes('\n')) return null;
  // After the "@": atIdx is the position of the trigger.
  const matchEnd = head.length;
  const atIdx = head.lastIndexOf('@', matchEnd - 1);
  return { query, start: atIdx, end: matchEnd };
}
