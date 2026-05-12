// src/pages/help/HelpIndex.tsx — BRT sub-6 §4.2
// In-app help center index. Lists 20 articles grouped by section with
// client-side search. Server-side search not needed at Beta scale.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ARTICLES, SECTIONS } from '../../lib/help/articles'

export default function HelpIndex() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return ARTICLES
    const q = query.toLowerCase()
    return ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    )
  }, [query])

  const grouped = useMemo(() => {
    return SECTIONS.map((section) => ({
      ...section,
      articles: filtered.filter((a) => a.section === section.id),
    })).filter((g) => g.articles.length > 0)
  }, [filtered])

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Help center</h1>
      <p style={{ color: '#5C5C5C', marginBottom: 24 }}>
        20 articles covering everything from your first project to keeping your
        data secure. Use the search below or browse by topic.
      </p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help articles…"
        aria-label="Search help articles"
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: 16,
          border: '1px solid #D6D6D6',
          borderRadius: 8,
          marginBottom: 32,
        }}
      />

      {grouped.length === 0 && (
        <p style={{ color: '#5C5C5C' }}>
          No articles match &ldquo;{query}&rdquo;. Try a different search, or
          email <a href="mailto:walker@sitesyncai.com">walker@sitesyncai.com</a>.
        </p>
      )}

      {grouped.map((section) => (
        <section key={section.id} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, color: '#1A1A1A', marginBottom: 12 }}>
            {section.label}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {section.articles.map((a) => (
              <li key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #EFEFEF' }}>
                <Link
                  to={`/help/${a.id}`}
                  style={{ color: '#0066FF', textDecoration: 'none', fontSize: 15 }}
                >
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
