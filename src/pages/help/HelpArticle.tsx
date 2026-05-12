// src/pages/help/HelpArticle.tsx — BRT sub-6 §4.2
// Renders a single help article from its markdown body via the React-element
// renderer (no dangerouslySetInnerHTML).

import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { articleById } from '../../lib/help/articles'
import { renderMarkdown } from '../../lib/help/markdown'
import analytics from '../../lib/analytics'

export default function HelpArticle() {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const article = articleId ? articleById(articleId) : undefined

  useEffect(() => {
    if (article) {
      analytics.capture('help_article_viewed', { article_id: article.id })
    }
  }, [article])

  if (!article) {
    return (
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
        <p>
          Article not found.{' '}
          <button
            onClick={() => navigate('/help')}
            style={{ background: 'none', border: 'none', color: '#0066FF', cursor: 'pointer', padding: 0 }}
          >
            Back to help center
          </button>
        </p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
      <Link
        to="/help"
        style={{ display: 'inline-block', marginBottom: 16, color: '#5C5C5C', fontSize: 14, textDecoration: 'none' }}
      >
        ← All articles
      </Link>
      <article className="help-article">{renderMarkdown(article.body)}</article>
      <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #EFEFEF' }} />
      <p style={{ color: '#5C5C5C', fontSize: 13 }}>
        Need a human? Email <a href="mailto:walker@sitesyncai.com">walker@sitesyncai.com</a>{' '}
        or use the chat widget in the corner.
      </p>
    </main>
  )
}
