// Static audit — no browser, no dev server. Reads source files and compares
// each page's observable signals against its declared PageContract. Runs fine
// in CI or in a sandbox where vite can't start.
//
// Signals detected per page:
//   has_list       — rendering of a table/list (DataTable, VirtualDataTable, role="row", EmptyState)
//   has_create     — import of a Create*Modal or use of a useCreate* mutation hook
//   has_edit       — use of a useUpdate* mutation hook or EditableField
//   has_delete     — use of a useDelete* mutation hook
//   has_detail_view — presence of DetailPanel / useParams / detail drawer
//   has_filters    — Filter / FilterBar / TabBar usage
//   has_search     — input[placeholder*="search"] or <Search> icon + controlled input
//   has_export     — ExportCenter import or exportXlsx helper usage
//   has_import     — file-upload patterns: <input type="file"> + parse*/*.csv/.xlsx
//
// Entity mutations are confirmed by grep against ENTITY_MUTATIONS[kind].module.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PAGE_REGISTRY, ENTITY_MUTATIONS, type PageContract } from '../registry'
import type { ActualFlags, AuditReport, AuditResult, Finding, Severity } from './types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')

function read(relPath: string): string | null {
  const p = path.join(REPO_ROOT, relPath)
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, 'utf8')
}

/** Read the page file plus every sibling .tsx in the same directory so
 *  detector matches can find helpers co-located with the page (e.g.
 *  src/pages/schedule/ScheduleShellParts.tsx imported by index.tsx). */
function readPageWithSiblings(pageRelPath: string): string {
  const direct = read(pageRelPath) ?? ''
  const dir = path.dirname(path.join(REPO_ROOT, pageRelPath))
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return direct
  try {
    const siblings = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
      .filter((name) => path.join(dir, name) !== path.join(REPO_ROOT, pageRelPath))
      .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    return [direct, ...siblings].join('\n/* ── sibling ── */\n')
  } catch {
    return direct
  }
}

// ── Detectors ────────────────────────────────────────────────

function detectList(src: string): boolean {
  return (
    /VirtualDataTable|<DataTable|role=["']row["']|<EmptyState|<KanbanBoard|<Gantt|<table\b|<ul\b|<ol\b|\.map\s*\(\s*\(?\s*\w+[^)]*\)?\s*=>/.test(
      src,
    )
  )
}

function detectCreate(src: string, contract: PageContract): boolean {
  if (contract.createModal && src.includes(contract.createModal)) return true
  if (/useCreate\w+\(/.test(src)) return true
  // Inline supabase insert (Budget.tsx pattern) — still counts as "has create UI"
  if (/\.from\(['"][\w_]+['"]\)\s*\.insert/.test(src)) return true
  // Form/Modal components with onClose handlers (Safety's IncidentForm pattern)
  if (/<\w+(?:Form|Modal|Dialog)\b[^>]*onClose=/.test(src)) return true
  return false
}

function detectEdit(src: string): boolean {
  return /useUpdate\w+\(|<EditableField|EditableDetailField/.test(src)
}

function detectDelete(src: string): boolean {
  return /useDelete\w+\(|\.from\(['"][\w_]+['"]\)\s*\.delete\(|onDelete\s*=|handleDelete\b/.test(src)
}

function detectDetailView(src: string): boolean {
  return /<DetailPanel|useParams\(\)|detailDrawer|selectedId|selectedRow|selected\w+Id|setSelected\w+/.test(
    src,
  )
}

function detectFilters(src: string): boolean {
  // Catch both `filterStatus` and `statusFilter` idioms, plus explicit
  // FilterBar / TabBar / Filter components.
  return /<FilterBar|<TabBar|<Filter\b|[Ff]ilter[A-Z]\w*|\w+Filter\s*[=,)]|setStatusFilter|setPriorityFilter/.test(
    src,
  )
}

function detectSearch(src: string): boolean {
  return /placeholder=["'][^"']*[Ss]earch|<Search\s|searchQuery|setSearchQuery|searchTerm|setSearchTerm/.test(
    src,
  )
}

function detectExport(src: string): boolean {
  return /ExportCenter|exportXlsx|exportToCSV|exportRFILogXlsx|exportSubmittalLogXlsx|exportPunchListXlsx|exportBudgetXlsx|exportDailyLogXlsx/.test(
    src,
  )
}

function detectImport(src: string): boolean {
  return /BudgetUpload|ScheduleUpload|parseCSV|parseXLSX|<input[^>]*type=["']file["']|IntelligentUploadHub/.test(
    src,
  )
}

// ── Mutation presence ────────────────────────────────────────

function hookExports(moduleRelPath: string): Set<string> {
  const src = read(moduleRelPath) ?? ''
  const exports = new Set<string>()
  const re = /^export\s+(?:function|const|async\s+function)\s+(\w+)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    exports.add(m[1])
  }
  // Named re-exports: "export { foo } from './x'"
  const reNamed = /^export\s*\{([^}]+)\}\s*from/gm
  while ((m = reNamed.exec(src)) !== null) {
    for (const name of m[1].split(',')) {
      exports.add(name.trim().split(/\s+as\s+/)[0].trim())
    }
  }
  return exports
}

// ── Main pass ────────────────────────────────────────────────

export function runStaticAudit(): AuditReport {
  const results: AuditResult[] = []
  const globalFindings: Finding[] = []

  // 1. Route-drift check — every route in App.tsx must have a registry entry
  const appTsx = read('src/App.tsx') ?? ''
  const routePaths = new Set<string>()
  const reRoute = /<Route\s+path=["']([^"']+)["']/g
  let rm: RegExpExecArray | null
  while ((rm = reRoute.exec(appTsx)) !== null) routePaths.add(rm[1])

  const registeredRoutes = new Set(PAGE_REGISTRY.map((p) => p.route))

  for (const route of routePaths) {
    if (!registeredRoutes.has(route)) {
      globalFindings.push({
        severity: 'P1',
        code: 'REGISTRY_DRIFT_MISSING_ENTRY',
        message: `Route "${route}" declared in src/App.tsx but missing from audit/registry.ts`,
      })
    }
  }
  for (const r of registeredRoutes) {
    if (!routePaths.has(r) && r !== '*') {
      globalFindings.push({
        severity: 'P1',
        code: 'REGISTRY_DRIFT_STALE_ENTRY',
        message: `Route "${r}" in registry but not in src/App.tsx`,
      })
    }
  }

  // 2. Per-page static scan
  for (const contract of PAGE_REGISTRY) {
    const directSrc = read(contract.pageFile)
    // Scan page file plus sibling files in the same directory — pages under
    // src/pages/<entity>/index.tsx commonly delegate helpers to co-located
    // modules (ScheduleShellParts, SubmittalDetail, etc.).
    const src = directSrc == null ? null : readPageWithSiblings(contract.pageFile)
    const actual: ActualFlags = {}
    const findings: Finding[] = []

    if (src == null) {
      findings.push({
        severity: 'P0',
        code: 'PAGE_FILE_MISSING',
        message: `pageFile "${contract.pageFile}" does not exist`,
      })
    } else {
      if (contract.expected.has_list) actual.has_list = detectList(src)
      if (contract.expected.has_create) actual.has_create = detectCreate(src, contract)
      if (contract.expected.has_edit) actual.has_edit = detectEdit(src)
      if (contract.expected.has_delete) actual.has_delete = detectDelete(src)
      if (contract.expected.has_detail_view) actual.has_detail_view = detectDetailView(src)
      if (contract.expected.has_filters) actual.has_filters = detectFilters(src)
      if (contract.expected.has_search) actual.has_search = detectSearch(src)
      if (contract.expected.has_export) actual.has_export = detectExport(src)
      if (contract.expected.has_import) actual.has_import = detectImport(src)

      // Compare actual vs expected
      for (const [flag, expected] of Object.entries(contract.expected)) {
        if (!expected) continue
        const got = actual[flag as keyof ActualFlags]
        if (!got) {
          const severity: Severity =
            flag === 'has_list' || flag === 'has_create' ? 'P1' : flag === 'has_export' || flag === 'has_import' ? 'P2' : 'P3'
          findings.push({
            severity,
            code: `MISSING_${flag.toUpperCase()}`,
            message: `Page declares ${flag} but no evidence found in ${contract.pageFile}`,
          })
        }
      }
    }

    // 3. Mutation presence
    const mutations = { createPresent: false, updatePresent: false, deletePresent: false }
    if (contract.entity) {
      const mappings = ENTITY_MUTATIONS[contract.entity] ?? {}
      if (mappings.module) {
        const exports = hookExports(mappings.module)
        mutations.createPresent = mappings.create ? exports.has(mappings.create) : false
        mutations.updatePresent = mappings.update ? exports.has(mappings.update) : false
        mutations.deletePresent = mappings.delete ? exports.has(mappings.delete) : false

        if (contract.expected.has_create && mappings.create && !mutations.createPresent) {
          findings.push({
            severity: 'P1',
            code: 'HOOK_CREATE_MISSING',
            message: `Expected ${mappings.create}() in ${mappings.module} but not exported`,
          })
        }
        if (contract.expected.has_edit && mappings.update && !mutations.updatePresent) {
          findings.push({
            severity: 'P1',
            code: 'HOOK_UPDATE_MISSING',
            message: `Expected ${mappings.update}() in ${mappings.module} but not exported`,
          })
        }
        if (contract.expected.has_delete && mappings.delete && !mutations.deletePresent) {
          findings.push({
            severity: 'P1',
            code: 'HOOK_DELETE_MISSING',
            message: `Expected ${mappings.delete}() in ${mappings.module} but not exported`,
          })
        }
      }
    }

    // 4. Scoring
    const expectedCount = Object.values(contract.expected).filter(Boolean).length
    const satisfiedCount = Object.entries(contract.expected).filter(
      ([flag, exp]) => exp && actual[flag as keyof ActualFlags],
    ).length
    const score =
      contract.status === 'stub' ? -1 : expectedCount === 0 ? 100 : Math.round((satisfiedCount / expectedCount) * 100)

    results.push({ contract, actual, mutations, findings, score })
  }

  const countable = results.filter((r) => r.score >= 0)
  const averageScore =
    countable.length === 0 ? 0 : Math.round(countable.reduce((s, r) => s + r.score, 0) / countable.length)
  const passingRoutes = countable.filter((r) => r.score === 100).length

  return {
    generatedAt: new Date().toISOString(),
    totalRoutes: PAGE_REGISTRY.length,
    passingRoutes,
    averageScore,
    results,
    globalFindings,
  }
}
