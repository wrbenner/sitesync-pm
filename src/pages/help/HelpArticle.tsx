// src/pages/help/HelpArticle.tsx — BRT sub-6 §4.7
//
// Renders a single help article by slug. Articles live as MDX files in
// src/content/help/*.mdx; we lazy-import the matching module per slug.
// If the slug doesn't exist, route to /help.

import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'

// Vite glob-import every help MDX at build time. Keyed by relative path.
const articleModules = import.meta.glob<{ default: React.ComponentType }>(
  '../../content/help/*.mdx',
)

const SLUG_TO_PATH: Record<string, string> = {
  'getting-started': '../../content/help/getting-started.mdx',
  'creating-your-first-project': '../../content/help/creating-your-first-project.mdx',
  'inviting-your-team': '../../content/help/inviting-your-team.mdx',
  'rfis-101': '../../content/help/rfis-101.mdx',
  'billing-and-cancellation': '../../content/help/billing-and-cancellation.mdx',
}

export default function HelpArticle() {
  const { slug } = useParams<{ slug: string }>()
  const path = slug ? SLUG_TO_PATH[slug] : undefined
  const loader = path ? articleModules[path] : undefined
  const notFound = !slug || !path || !loader

  const [Mod, setMod] = useState<React.ComponentType | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    if (!loader) return
    loader()
      .then((m) => setMod(() => m.default))
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : 'load-failed'))
  }, [loader])

  if (notFound) return <Navigate to="/help" replace />
  const err = loadErr

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <Link
        to="/help"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5C5C5C', textDecoration: 'none', marginBottom: 16, fontSize: 14 }}
      >
        <ArrowLeft size={14} /> All articles
      </Link>

      {err && err !== 'not-found' && (
        <p role="alert" style={{ padding: 12, background: '#FEE2E2', color: '#7F1D1D', borderRadius: 6 }}>
          Couldn't load this article: {err}
        </p>
      )}

      {!Mod && !err && (
        <div style={{ padding: 32, textAlign: 'center', color: '#5C5C5C' }}>
          <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />
          <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {Mod && (
        <article
          style={{
            lineHeight: 1.6,
            fontSize: 15,
            color: '#1A1A1A',
          }}
        >
          <Mod />
        </article>
      )}
    </div>
  )
}
