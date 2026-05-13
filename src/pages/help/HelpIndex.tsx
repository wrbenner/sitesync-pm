// src/pages/help/HelpIndex.tsx — BRT sub-6 §4.7
//
// Help center landing page. Lists the 5 launch articles and exposes
// search-by-title. Articles live in src/content/help/*.mdx and are
// resolved by HelpArticle via the slug.

import { Link } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'

interface ArticleMeta {
  slug: string
  title: string
  blurb: string
}

const ARTICLES: ArticleMeta[] = [
  { slug: 'getting-started', title: 'Getting started with SiteSync', blurb: 'A quick tour of the dashboard and the Nine pages.' },
  { slug: 'creating-your-first-project', title: 'Creating your first project', blurb: 'Step-by-step: address, team, defaults, and what gets auto-generated.' },
  { slug: 'inviting-your-team', title: 'Inviting your team', blurb: 'Roles, permissions, invite links, and bulk invite.' },
  { slug: 'rfis-101', title: 'RFIs 101', blurb: 'Create, route, respond, and close out RFIs with the SLA system.' },
  { slug: 'billing-and-cancellation', title: 'Billing and cancellation', blurb: 'Trial, plans, dunning, and how to cancel.' },
]

export default function HelpIndex() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ARTICLES
    return ARTICLES.filter(
      (a) => a.title.toLowerCase().includes(q) || a.blurb.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 32, marginTop: 0, marginBottom: 8 }}>Help Center</h1>
      <p style={{ color: '#5C5C5C', marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
        Quick answers to the most common questions. Can't find what you need?
        Click the chat bubble in the corner to message support.
      </p>

      <div
        style={{
          position: 'relative',
          marginBottom: 24,
        }}
      >
        <Search
          size={18}
          color="#5C5C5C"
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles"
          aria-label="Search help articles"
          style={{
            width: '100%',
            padding: '12px 14px 12px 42px',
            border: '1px solid #D6D6D6',
            borderRadius: 8,
            fontSize: 15,
            boxSizing: 'border-box',
            background: 'white',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((a) => (
          <Link
            key={a.slug}
            to={`/help/${a.slug}`}
            style={{
              padding: 18,
              background: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#1A1A1A',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#E87722' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB' }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{a.title}</h2>
            <p style={{ margin: '6px 0 0', color: '#5C5C5C', fontSize: 14 }}>{a.blurb}</p>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#5C5C5C' }}>
            No articles match "{query}".
          </div>
        )}
      </div>
    </div>
  )
}
