// src/lib/help/markdown.ts — BRT subsystem 6 §4.2
//
// Tiny markdown → React renderer. Returns React elements directly so we
// never need dangerouslySetInnerHTML. Supports the subset Founder-authored
// help docs use: H1-H4, paragraphs, ordered/unordered lists, inline code,
// fenced code blocks, links (rel/target hardened), bold + italic, blockquotes.
//
// Why custom (not react-markdown): a 15 KB dep for ~20 short articles is
// expensive on the cold-open critical path. This file is < 200 LoC.

import { Fragment, type ReactNode } from 'react'

type Inline = string | { tag: 'a' | 'code' | 'strong' | 'em'; href?: string; text: string }

function parseInline(text: string): Inline[] {
  // Process in order: links, code, bold, italic. Each is non-overlapping.
  const out: Inline[] = []
  let rest = text

  while (rest.length > 0) {
    // Link [text](url)
    const link = rest.match(/^([^\\[`*]*)\[([^\]]+)\]\(([^)]+)\)/)
    if (link) {
      if (link[1]) out.push(link[1])
      out.push({ tag: 'a', href: link[3], text: link[2] })
      rest = rest.slice(link[0].length)
      continue
    }
    // Inline code `…`
    const code = rest.match(/^([^\\[`*]*)`([^`]+)`/)
    if (code) {
      if (code[1]) out.push(code[1])
      out.push({ tag: 'code', text: code[2] })
      rest = rest.slice(code[0].length)
      continue
    }
    // Bold **…**
    const bold = rest.match(/^([^\\[`*]*)\*\*([^*]+)\*\*/)
    if (bold) {
      if (bold[1]) out.push(bold[1])
      out.push({ tag: 'strong', text: bold[2] })
      rest = rest.slice(bold[0].length)
      continue
    }
    // Italic *…*
    const ital = rest.match(/^([^\\[`*]*)\*([^*\n]+)\*/)
    if (ital) {
      if (ital[1]) out.push(ital[1])
      out.push({ tag: 'em', text: ital[2] })
      rest = rest.slice(ital[0].length)
      continue
    }
    // Plain text up to next special character
    const plain = rest.match(/^([^\\[`*]+|.)/)
    if (plain) {
      out.push(plain[1])
      rest = rest.slice(plain[1].length)
      continue
    }
    break
  }
  return out
}

function renderInlines(inlines: Inline[], keyPrefix: string): ReactNode[] {
  return inlines.map((node, i) => {
    const k = `${keyPrefix}-${i}`
    if (typeof node === 'string') return <Fragment key={k}>{node}</Fragment>
    switch (node.tag) {
      case 'a':
        // Force safe link behavior: open in new tab, no opener access.
        return (
          <a key={k} href={node.href} rel="noopener noreferrer" target="_blank">
            {node.text}
          </a>
        )
      case 'code':  return <code key={k}>{node.text}</code>
      case 'strong': return <strong key={k}>{node.text}</strong>
      case 'em':    return <em key={k}>{node.text}</em>
    }
  })
}

export function renderMarkdown(md: string): ReactNode[] {
  const lines = md.split('\n')
  const out: ReactNode[] = []
  let key = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (/^```/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      out.push(<pre key={key++}><code>{buf.join('\n')}</code></pre>)
      i++ // skip closing fence
      continue
    }

    // Headings
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const k = key++
      const inlines = parseInline(h[2])
      const children = renderInlines(inlines, `h-${k}`)
      if (level === 1) out.push(<h1 key={k}>{children}</h1>)
      else if (level === 2) out.push(<h2 key={k}>{children}</h2>)
      else if (level === 3) out.push(<h3 key={k}>{children}</h3>)
      else out.push(<h4 key={k}>{children}</h4>)
      i++
      continue
    }

    // Blockquote
    if (/^>\s/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s/, ''))
        i++
      }
      const k = key++
      out.push(<blockquote key={k}>{renderInlines(parseInline(buf.join(' ')), `bq-${k}`)}</blockquote>)
      continue
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const items: ReactNode[] = []
      let li = 0
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const text = lines[i].replace(/^[-*]\s/, '')
        items.push(<li key={li}>{renderInlines(parseInline(text), `li-${key}-${li}`)}</li>)
        li++
        i++
      }
      out.push(<ul key={key++}>{items}</ul>)
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = []
      let li = 0
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s/, '')
        items.push(<li key={li}>{renderInlines(parseInline(text), `oli-${key}-${li}`)}</li>)
        li++
        i++
      }
      out.push(<ol key={key++}>{items}</ol>)
      continue
    }

    // Paragraph
    if (line.trim().length > 0) {
      const buf: string[] = []
      while (
        i < lines.length &&
        lines[i].trim().length > 0 &&
        !/^(#{1,4}\s|[-*]\s|\d+\.\s|>\s|```)/.test(lines[i])
      ) {
        buf.push(lines[i])
        i++
      }
      const k = key++
      out.push(<p key={k}>{renderInlines(parseInline(buf.join(' ')), `p-${k}`)}</p>)
      continue
    }

    i++
  }
  return out
}
