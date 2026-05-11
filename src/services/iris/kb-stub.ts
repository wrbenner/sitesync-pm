// ────────────────────────────────────────────────────────────────────────────
// kb-stub — keyword + lightweight vector retrieval over the building-code corpus
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md (Code §)
// ADR: ADR-017 sets the eventual embedding model (text-embedding-3-large)
//
// Phase 2d ships a deterministic stub that operates on a JSON-loaded corpus
// (`tests/fixtures/code-kb/clauses.json`). The retrieval ranking combines:
//   1. Keyword recall — Jaccard similarity over normalized word tokens
//   2. Section-id boost — exact code-section matches bubble to the top
//   3. Cite-or-reject — every retrieved clause carries an audit_ref the
//      caller MUST emit alongside any LLM output (per spec §"Code §")
//
// Real vector retrieval lands Phase 3 with pgvector. The stub is intentionally
// not LLM-aware — the Code specialist runs this synchronously before any
// LLM call (deterministic check) and only invokes the model with the
// retrieved-clause set bound to the prompt.

export interface CodeClause {
  id: string // 'IBC-2024-1006.2' etc.
  jurisdiction: string // 'IBC' | 'NEC' | 'ASHRAE' | project-specific
  code: string // 'IBC 2024' | 'NEC 2023' | 'ASHRAE 90.1-2019'
  section: string // '1006.2' etc.
  title: string
  body: string
  tags: readonly string[] // 'egress' | 'fire-rating' | 'mechanical' | ...
}

export interface RetrievalResult {
  clause: CodeClause
  score: number // 0..1
  matched_tokens: readonly string[]
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'shall', 'should', 'that', 'the',
  'this', 'to', 'was', 'were', 'will', 'with',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

// Pull section-id candidates (e.g. "1006.2" or "IBC 1006.2") from a query.
// We strip any leading jurisdiction prefix so the comparison against
// `clause.section` (which is the bare digit form) succeeds.
function extractSectionIds(query: string): string[] {
  const matches = query.match(/\b(?:[A-Z]+\s+)?\d{2,4}(?:\.\d+){0,3}\b/g) ?? []
  const out: string[] = []
  for (const m of matches) {
    const stripped = m.replace(/^[A-Z]+\s+/, '').trim().toLowerCase()
    out.push(stripped)
  }
  return out
}

export interface RetrieveOptions {
  k?: number // default 5
  min_score?: number // default 0.1 (anything lower is treated as a cite-or-reject failure)
}

export function retrieveClauses(
  query: string,
  corpus: readonly CodeClause[],
  opts: RetrieveOptions = {},
): RetrievalResult[] {
  const k = opts.k ?? 5
  const minScore = opts.min_score ?? 0.1
  const queryTokens = new Set(tokenize(query))
  if (queryTokens.size === 0) return []
  const sectionIds = new Set(extractSectionIds(query))

  const scored: RetrievalResult[] = corpus.map((clause) => {
    const docTokens = new Set(tokenize(`${clause.title} ${clause.body} ${clause.tags.join(' ')}`))
    let intersect = 0
    const matched: string[] = []
    for (const t of queryTokens) {
      if (docTokens.has(t)) {
        intersect += 1
        matched.push(t)
      }
    }
    const union = queryTokens.size + docTokens.size - intersect
    const jaccard = union === 0 ? 0 : intersect / union

    // Section-id boost — an exact section-id match doubles the score.
    const sectionMatch = sectionIds.has(clause.section.toLowerCase())
    const score = sectionMatch ? Math.min(1, jaccard + 0.5) : jaccard

    return { clause, score, matched_tokens: matched }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.filter((r) => r.score >= minScore).slice(0, k)
}

// Cite-or-reject — per spec §"Code §", the Code specialist must EITHER emit
// a citation (via cite_spec_reference) OR refuse to answer. This helper
// formalizes the rejection path. Returns null when no retrieval clears the
// threshold; the specialist routes to the rejection narrative.
export interface CiteOrRejectResult {
  decision: 'cite' | 'reject'
  clauses: readonly RetrievalResult[]
  reason?: string
}

export function citeOrReject(
  query: string,
  corpus: readonly CodeClause[],
  opts: RetrieveOptions = {},
): CiteOrRejectResult {
  const results = retrieveClauses(query, corpus, opts)
  if (results.length === 0) {
    return {
      decision: 'reject',
      clauses: [],
      reason: 'No code clause matched the query above the retrieval threshold.',
    }
  }
  return { decision: 'cite', clauses: results }
}
