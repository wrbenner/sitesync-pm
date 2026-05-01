// check-handler-bindings.ts
//
// AST walk over src/components/**/*.tsx + src/pages/**/*.tsx that finds
// callback props which are destructured but never invoked inside the
// component body. The pattern catches the common bug:
//
//   interface FooProps { onSelect: (id: string) => void }
//   export const Foo: React.FC<FooProps> = ({ onSelect }) => {
//     return <div>...</div>     // ← onSelect is destructured, never called
//   }
//
// Output: appends to audit/dead-clicks.json under reason='destructured_unused'.
// (Same file as the dead-click detector for one-stop CI consumption.)
//
// Heuristics:
//   • Only inspect props named onX (onClick, onSelect, onOpen, …)
//   • A prop is "wired" when it appears as an identifier expression anywhere
//     inside the component body — call site, return value, JSX expression,
//     anything that references the binding.
//   • Allow `_unused` style by skipping props prefixed with `_`.
//
// Run:
//   tsx scripts/check-handler-bindings.ts
//   tsx scripts/check-handler-bindings.ts src/components

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..')

interface Finding {
  file: string
  line: number
  column: number
  reason: 'destructured_unused'
  snippet: string
  prop: string
  /** Component name (when detectable). */
  component?: string
}

interface DeadClicksFile {
  generated_at: string
  scanned_files: number
  findings: Array<Finding | { reason: string; [k: string]: unknown }>
  by_reason: Record<string, number>
}

const ROOTS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : ['src/pages', 'src/components']

function listTsxFiles(root: string): string[] {
  const out: string[] = []
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '__tests__', '__demo__'].includes(e.name)) continue
        walk(abs)
      } else if (e.isFile() && abs.endsWith('.tsx')) {
        if (abs.endsWith('.test.tsx') || abs.endsWith('.spec.tsx')) continue
        out.push(abs)
      }
    }
  }
  walk(path.join(REPO_ROOT, root))
  return out
}

function findingsForFile(file: string): Finding[] {
  const text = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const findings: Finding[] = []
  const rel = path.relative(REPO_ROOT, file)

  function inspectComponent(componentName: string | undefined, params: ts.NodeArray<ts.ParameterDeclaration>, body: ts.Node) {
    // Find the (sole) destructured object pattern in the parameters.
    if (params.length === 0) return
    const first = params[0]
    if (!ts.isObjectBindingPattern(first.name)) return

    // Collect (propName, alias) pairs whose name starts with "on" + uppercase.
    const onProps: Array<{ name: string; alias: string }> = []
    for (const el of first.name.elements) {
      if (!ts.isIdentifier(el.name)) continue
      const alias = el.name.text
      const propName = el.propertyName && ts.isIdentifier(el.propertyName)
        ? el.propertyName.text
        : alias
      if (alias.startsWith('_')) continue           // explicit unused
      if (!/^on[A-Z]/.test(propName)) continue       // only callbacks
      onProps.push({ name: propName, alias })
    }
    if (onProps.length === 0) return

    // Walk body, collect every Identifier text that's referenced.
    const referenced = new Set<string>()
    function walk(n: ts.Node) {
      if (ts.isIdentifier(n)) referenced.add(n.text)
      ts.forEachChild(n, walk)
    }
    walk(body)

    for (const p of onProps) {
      // The body might use `props.onSelect` (we'd see "onSelect" as the
      // accessed identifier even when not destructured), but in this
      // pattern we destructure, so the binding name is `p.alias`. Verify
      // that alias appears as an identifier in the body.
      if (!referenced.has(p.alias)) {
        const pos = sf.getLineAndCharacterOfPosition(first.getStart(sf))
        const snippet = `{ ${p.alias} }`
        findings.push({
          file: rel,
          line: pos.line + 1,
          column: pos.character + 1,
          reason: 'destructured_unused',
          snippet,
          prop: p.alias,
          component: componentName,
        })
      }
    }
  }

  function visit(node: ts.Node) {
    // const Foo: React.FC<…> = ({ onX }) => { … }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!decl.initializer) continue
        const componentName = ts.isIdentifier(decl.name) ? decl.name.text : undefined
        if (ts.isArrowFunction(decl.initializer)) {
          inspectComponent(componentName, decl.initializer.parameters, decl.initializer.body)
        } else if (ts.isFunctionExpression(decl.initializer)) {
          inspectComponent(componentName, decl.initializer.parameters, decl.initializer.body)
        }
      }
    }
    // function Foo({ onX }: Props) { … }
    if (ts.isFunctionDeclaration(node) && node.body) {
      inspectComponent(node.name?.text, node.parameters, node.body)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return findings
}

function main(): void {
  const all: Finding[] = []
  let scanned = 0
  for (const root of ROOTS) {
    for (const file of listTsxFiles(root)) {
      scanned += 1
      try {
        all.push(...findingsForFile(file))
      } catch (err) {
        console.warn(`[check-handler-bindings] parse failed for ${file}:`, (err as Error).message)
      }
    }
  }
  const sorted = all.sort((a, b) =>
    a.file.localeCompare(b.file) || a.line - b.line,
  )

  // Append into the existing audit/dead-clicks.json so CI reads one file.
  const outDir = path.join(REPO_ROOT, 'audit')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'dead-clicks.json')

  let existing: DeadClicksFile | null = null
  if (fs.existsSync(outPath)) {
    try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')) as DeadClicksFile } catch { /* ignore */ }
  }

  const merged: DeadClicksFile = existing ?? {
    generated_at: new Date().toISOString(),
    scanned_files: 0,
    findings: [],
    by_reason: {},
  }
  merged.scanned_files = (merged.scanned_files ?? 0) + scanned
  // De-dupe by (file, line, prop) to make this safe to re-run.
  const seen = new Set(
    merged.findings.map((f) => `${(f as Finding).file}:${(f as Finding).line}:${(f as Finding).prop ?? ''}`),
  )
  for (const f of sorted) {
    const k = `${f.file}:${f.line}:${f.prop}`
    if (seen.has(k)) continue
    seen.add(k)
    merged.findings.push(f)
  }
  merged.by_reason.destructured_unused =
    (merged.by_reason.destructured_unused ?? 0) + sorted.length
  merged.generated_at = new Date().toISOString()

  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2))

  console.log(`[check-handler-bindings] scanned ${scanned} file(s); ${sorted.length} unused-callback prop(s)`)
  console.log(`  → ${path.relative(REPO_ROOT, outPath)}`)
}

main()
