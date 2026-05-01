// detect-dead-clicks.ts
//
// AST walk over src/pages/**/*.tsx (configurable via CLI). Flags click
// handlers that don't actually do anything user-observable:
//
//   onClick={() => {}}                 → 'noop_arrow'
//   onClick={() => undefined}          → 'noop_arrow'
//   onClick={undefined}                → 'undefined_handler'
//   onClick={null}                     → 'null_handler'
//   onClick={() => console.log(...)}   → 'console_only'
//   <button>...</button>  (no onClick) → 'button_no_onclick'
//
// Out-of-scope (NOT flagged):
//   onClick on submit buttons inside <form onSubmit={…}>
//   onClick={someIdentifier}  — call site assumed wired
//   disabled={true} on the same element  — handler is intentionally gated
//
// Output: audit/dead-clicks.json keyed by file → array of findings.
//
// Run:
//   tsx scripts/detect-dead-clicks.ts                 # scans src/pages/**
//   tsx scripts/detect-dead-clicks.ts src/components  # custom roots
//
// Exit codes: 0 always (non-blocking; CI uses the JSON output).

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

type Reason =
  | 'noop_arrow'
  | 'undefined_handler'
  | 'null_handler'
  | 'console_only'
  | 'button_no_onclick'

interface Finding {
  file: string
  line: number
  column: number
  reason: Reason
  /** A short snippet of the offending JSX, for the human reviewer. */
  snippet: string
  /** Element name (button, div, etc.) when known. */
  element?: string
}

interface Output {
  generated_at: string
  scanned_files: number
  findings: Finding[]
  /** Counts by reason; useful for CI summaries. */
  by_reason: Record<Reason, number>
}

const ROOTS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['src/pages']

function listTsxFiles(root: string): string[] {
  const out: string[] = []
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === '__tests__') continue
        walk(abs)
      } else if (e.isFile() && (abs.endsWith('.tsx') || abs.endsWith('.ts'))) {
        if (abs.endsWith('.test.ts') || abs.endsWith('.test.tsx')) continue
        if (abs.endsWith('.spec.ts') || abs.endsWith('.spec.tsx')) continue
        out.push(abs)
      }
    }
  }
  walk(path.join(REPO_ROOT, root))
  return out
}

function isNoopExpression(expr: ts.Expression): boolean {
  // () => {}      — arrow with empty block body
  // () => undefined
  // () => void 0
  if (ts.isArrowFunction(expr)) {
    const body = expr.body
    if (ts.isBlock(body)) {
      if (body.statements.length === 0) return true
      // single bare `undefined;` statement
      if (
        body.statements.length === 1 &&
        ts.isExpressionStatement(body.statements[0]) &&
        body.statements[0].expression.kind === ts.SyntaxKind.UndefinedKeyword
      ) return true
    } else {
      // Concise body: () => undefined / () => void 0
      if (body.kind === ts.SyntaxKind.UndefinedKeyword) return true
      if (
        ts.isVoidExpression(body) &&
        ts.isNumericLiteral(body.expression) &&
        body.expression.text === '0'
      ) return true
      // () => undefined is parsed as Identifier("undefined")
      if (ts.isIdentifier(body) && body.text === 'undefined') return true
    }
  }
  return false
}

function isConsoleOnly(expr: ts.Expression): boolean {
  // () => console.log(...) or () => { console.log(...) }  — only console
  if (!ts.isArrowFunction(expr)) return false
  const body = expr.body
  const stmts: ts.Statement[] = ts.isBlock(body)
    ? Array.from(body.statements)
    : [ts.factory.createExpressionStatement(body as ts.Expression)]
  if (stmts.length === 0) return false
  for (const s of stmts) {
    if (!ts.isExpressionStatement(s)) return false
    const e = s.expression
    if (!ts.isCallExpression(e)) return false
    const callee = e.expression
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'console'
    ) continue
    return false
  }
  return true
}

function snippetAt(text: string, start: number, end: number): string {
  const max = Math.min(end - start, 100)
  return text.slice(start, start + max).replace(/\s+/g, ' ').trim()
}

function isDisabled(jsxElement: ts.JsxOpeningElement | ts.JsxSelfClosingElement): boolean {
  for (const attr of jsxElement.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue
    const name = attr.name.getText()
    if (name === 'disabled') {
      // disabled (with no value) === true. disabled={true} or disabled={…}
      // both treated as wired (intentionally gated).
      return true
    }
  }
  return false
}

function findingsForFile(file: string): Finding[] {
  const text = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const findings: Finding[] = []
  const rel = path.relative(REPO_ROOT, file)

  function recordOpening(jsx: ts.JsxOpeningElement | ts.JsxSelfClosingElement) {
    const tagName = jsx.tagName.getText()
    const isButton = tagName === 'button'
    let onClickAttr: ts.JsxAttribute | undefined
    for (const attr of jsx.attributes.properties) {
      if (!ts.isJsxAttribute(attr)) continue
      const name = attr.name.getText()
      if (name === 'onClick') {
        onClickAttr = attr
        break
      }
    }

    if (!onClickAttr) {
      // Plain <button>...</button> with no onClick: only flag if also no
      // `type="submit"` (form-submit buttons rely on parent <form>) and
      // not `disabled` (a disabled button is wired-by-design).
      if (isButton && !isDisabled(jsx)) {
        const hasSubmitType = jsx.attributes.properties.some((a) => {
          if (!ts.isJsxAttribute(a)) return false
          if (a.name.getText() !== 'type') return false
          if (!a.initializer) return false
          if (ts.isStringLiteral(a.initializer)) return a.initializer.text === 'submit'
          if (ts.isJsxExpression(a.initializer) && a.initializer.expression && ts.isStringLiteral(a.initializer.expression)) {
            return a.initializer.expression.text === 'submit'
          }
          return false
        })
        if (!hasSubmitType) {
          const pos = sf.getLineAndCharacterOfPosition(jsx.getStart(sf))
          findings.push({
            file: rel,
            line: pos.line + 1,
            column: pos.character + 1,
            reason: 'button_no_onclick',
            snippet: snippetAt(text, jsx.getStart(sf), jsx.getEnd()),
            element: tagName,
          })
        }
      }
      return
    }

    // We have an onClick. Inspect its initializer.
    const init = onClickAttr.initializer
    if (!init) return  // boolean-only attribute; very unusual. Skip.

    // Permit if disabled at the same site.
    if (isDisabled(jsx)) return

    if (ts.isJsxExpression(init)) {
      const inner = init.expression
      if (!inner) {
        // <... onClick={} /> — invalid JSX; treat as undefined handler.
        const pos = sf.getLineAndCharacterOfPosition(jsx.getStart(sf))
        findings.push({
          file: rel,
          line: pos.line + 1,
          column: pos.character + 1,
          reason: 'undefined_handler',
          snippet: snippetAt(text, jsx.getStart(sf), jsx.getEnd()),
          element: tagName,
        })
        return
      }
      if (inner.kind === ts.SyntaxKind.UndefinedKeyword || (ts.isIdentifier(inner) && inner.text === 'undefined')) {
        const pos = sf.getLineAndCharacterOfPosition(jsx.getStart(sf))
        findings.push({
          file: rel,
          line: pos.line + 1,
          column: pos.character + 1,
          reason: 'undefined_handler',
          snippet: snippetAt(text, jsx.getStart(sf), jsx.getEnd()),
          element: tagName,
        })
        return
      }
      if (inner.kind === ts.SyntaxKind.NullKeyword) {
        const pos = sf.getLineAndCharacterOfPosition(jsx.getStart(sf))
        findings.push({
          file: rel,
          line: pos.line + 1,
          column: pos.character + 1,
          reason: 'null_handler',
          snippet: snippetAt(text, jsx.getStart(sf), jsx.getEnd()),
          element: tagName,
        })
        return
      }
      if (isNoopExpression(inner)) {
        const pos = sf.getLineAndCharacterOfPosition(jsx.getStart(sf))
        findings.push({
          file: rel,
          line: pos.line + 1,
          column: pos.character + 1,
          reason: 'noop_arrow',
          snippet: snippetAt(text, jsx.getStart(sf), jsx.getEnd()),
          element: tagName,
        })
        return
      }
      if (isConsoleOnly(inner)) {
        const pos = sf.getLineAndCharacterOfPosition(jsx.getStart(sf))
        findings.push({
          file: rel,
          line: pos.line + 1,
          column: pos.character + 1,
          reason: 'console_only',
          snippet: snippetAt(text, jsx.getStart(sf), jsx.getEnd()),
          element: tagName,
        })
        return
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      recordOpening(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return findings
}

function main(): void {
  const allFindings: Finding[] = []
  let scanned = 0
  for (const root of ROOTS) {
    for (const file of listTsxFiles(root)) {
      scanned += 1
      try {
        const fs2 = findingsForFile(file)
        allFindings.push(...fs2)
      } catch (err) {
        // Don't let a single parse error abort the whole scan.
        console.warn(`[detect-dead-clicks] parse failed for ${file}:`, (err as Error).message)
      }
    }
  }

  const byReason: Record<Reason, number> = {
    noop_arrow: 0, undefined_handler: 0, null_handler: 0,
    console_only: 0, button_no_onclick: 0,
  }
  for (const f of allFindings) byReason[f.reason] += 1

  const output: Output = {
    generated_at: new Date().toISOString(),
    scanned_files: scanned,
    findings: allFindings.sort((a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line,
    ),
    by_reason: byReason,
  }

  const outDir = path.join(REPO_ROOT, 'audit')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'dead-clicks.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

  console.log(`[detect-dead-clicks] scanned ${scanned} file(s); ${allFindings.length} finding(s)`)
  for (const r of Object.keys(byReason) as Reason[]) {
    console.log(`  ${r.padEnd(20)} ${byReason[r]}`)
  }
  console.log(`  → ${path.relative(REPO_ROOT, outPath)}`)
}

main()
