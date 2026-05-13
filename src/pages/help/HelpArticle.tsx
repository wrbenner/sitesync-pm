// src/pages/help/HelpArticle.tsx — BRT sub-6 §4.7
//
// Renders a single help article by slug. Articles live as Markdown files
// in src/content/help/*.md and are imported as raw strings via Vite's
// `?raw` query suffix. A tiny inline parser handles the subset of
// markdown the articles actually use (headings, paragraphs, ordered +
// unordered lists, inline code, bold, italic, links, and pipe tables).
//
// Why not MDX: pulling @mdx-js/rollup into devDeps trips the npm audit
// gate against pre-existing high-severity vulns elsewhere in the tree.
// Until those are unblocked, the raw-markdown path keeps the dep tree
// stable while still delivering rendered content.

import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'

// Vite glob-import every help .md at build time as a raw string.
const articleModules = import.meta.glob('../../content/help/*.md', {
  query: '?raw',
  import: 'default',
  eager: false,
}) as Record<string, () => Promise<string>>

const SLUG_TO_PATH: Record<string, string> = {
  'getting-started': '../../content/help/getting-started.md',
  'creating-your-first-project': '../../content/help/creating-your-first-project.md',
  'inviting-your-team': '../../content/help/inviting-your-team.md',
  'rfis-101': '../../content/help/rfis-101.md',
  'billing-and-cancellation': '../../content/help/billing-and-cancellation.md',
}

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'table'
  lines?: string[]
  text?: string
  rows?: string[][]
}

function parseInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const RE = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('`')) {
      out.push(<code key={key++} style={{ background: '#F3F4F6', padding: '1px 6px', borderRadius: 3, fontSize: '0.9em' }}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**')) {
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('_')) {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      if (linkMatch) {
        const [, label, href] = linkMatch
        const isRel = href.startsWith('./') || href.startsWith('../')
        out.push(
          isRel
            ? <Link key={key++} to={href.replace(/^\.\//, '/help/').replace(/^\.\.\//, '/help/')} style={{ color: '#E87722' }}>{label}</Link>
            : <a key={key++} href={href} style={{ color: '#E87722' }}>{label}</a>,
        )
      }
    }
    last = m.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/)
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    if (line.startsWith('### ')) { blocks.push({ kind: 'h3', text: line.slice(4) }); i++; continue }
    if (line.startsWith('## '))  { blocks.push({ kind: 'h2', text: line.slice(3) }); i++; continue }
    if (line.startsWith('# '))   { blocks.push({ kind: 'h1', text: line.slice(2) }); i++; continue }
    if (line.startsWith('| ')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('| ')) {
        const row = lines[i].slice(1, -1).split('|').map((c) => c.trim())
        if (!row.every((c) => /^[-:]+$/.test(c))) rows.push(row)
        i++
      }
      blocks.push({ kind: 'table', rows })
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ kind: 'ol', lines: items })
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('- ')) {
        items.push((lines[i] ?? '').slice(2))
        i++
      }
      blocks.push({ kind: 'ul', lines: items })
      continue
    }
    if (line.trim() === '') { i++; continue }
    const para: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i] ?? ''
      if (next.trim() === '') break
      if (/^(#|-|\d+\.\s|\|)/.test(next)) break
      para.push(next)
      i++
    }
    blocks.push({ kind: 'p', text: para.join(' ') })
  }
  return blocks
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.kind) {
    case 'h1': return <h1 key={key} style={{ fontSize: 28, fontWeight: 600, marginTop: 0, marginBottom: 16, color: '#1A1A1A' }}>{parseInline(block.text ?? '')}</h1>
    case 'h2': return <h2 key={key} style={{ fontSize: 22, fontWeight: 600, marginTop: 28, marginBottom: 12, color: '#1A1A1A' }}>{parseInline(block.text ?? '')}</h2>
    case 'h3': return <h3 key={key} style={{ fontSize: 18, fontWeight: 600, marginTop: 20, marginBottom: 8, color: '#1A1A1A' }}>{parseInline(block.text ?? '')}</h3>
    case 'p':  return <p key={key} style={{ margin: '0 0 14px', lineHeight: 1.65 }}>{parseInline(block.text ?? '')}</p>
    case 'ul': return <ul key={key} style={{ marginTop: 0, marginBottom: 14, paddingLeft: 24, lineHeight: 1.65 }}>{block.lines?.map((l, i) => <li key={i}>{parseInline(l)}</li>)}</ul>
    case 'ol': return <ol key={key} style={{ marginTop: 0, marginBottom: 14, paddingLeft: 24, lineHeight: 1.65 }}>{block.lines?.map((l, i) => <li key={i}>{parseInline(l)}</li>)}</ol>
    case 'table': {
      if (!block.rows || block.rows.length === 0) return null
      const [head, ...body] = block.rows
      return (
        <table key={key} style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 16px', fontSize: 14 }}>
          <thead>
            <tr>{head.map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #D6D6D6', fontWeight: 600 }}>{parseInline(c)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>{row.map((c, ci) => <td key={ci} style={{ padding: '8px 10px', borderBottom: '1px solid #F3F4F6', verticalAlign: 'top' }}>{parseInline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
    }
  }
}

export default function HelpArticle() {
  const { slug } = useParams<{ slug: string }>()
  const path = slug ? SLUG_TO_PATH[slug] : undefined
  const loader = path ? articleModules[path] : undefined
  const notFound = !slug || !path || !loader

  const [markdown, setMarkdown] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  useEffect(() => {
    if (!loader) return
    loader()
      .then((raw) => setMarkdown(raw))
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : 'load-failed'))
  }, [loader])

  if (notFound) return <Navigate to="/help" replace />

  const blocks = markdown ? parseMarkdown(markdown) : null

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <Link
        to="/help"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#5C5C5C', textDecoration: 'none', marginBottom: 16, fontSize: 14 }}
      >
        <ArrowLeft size={14} /> All articles
      </Link>

      {loadErr && (
        <p role="alert" style={{ padding: 12, background: '#FEE2E2', color: '#7F1D1D', borderRadius: 6 }}>
          Couldn't load this article: {loadErr}
        </p>
      )}

      {!blocks && !loadErr && (
        <div style={{ padding: 32, textAlign: 'center', color: '#5C5C5C' }}>
          <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />
          <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {blocks && (
        <article style={{ fontSize: 15, color: '#1A1A1A' }}>
          {blocks.map((b, i) => renderBlock(b, i))}
        </article>
      )}
    </div>
  )
}
