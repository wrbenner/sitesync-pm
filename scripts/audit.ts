// Static-only audit entrypoint. Runs the registry check + per-page source scan
// and writes PAGE_HEALTH.{md,json}. No browser, no dev server required.
//
//   npm run audit:static
//
// Exit 0 if all P0 findings are resolved (stubs are allowed), exit 1 otherwise.
// P1-P3 findings are reported but do not fail the script — they appear in the
// report and are tracked via the PAGE_HEALTH.md diff in PRs.

import { runStaticAudit } from '../audit/harness/static-audit'
import { writeReport } from '../audit/harness/reporter'

function main(): void {
  const report = runStaticAudit()
  const { mdPath, jsonPath } = writeReport(report)

  const p0Count =
    report.globalFindings.filter((f) => f.severity === 'P0').length +
    report.results.reduce((n, r) => n + r.findings.filter((f) => f.severity === 'P0').length, 0)
  const p1Count =
    report.globalFindings.filter((f) => f.severity === 'P1').length +
    report.results.reduce((n, r) => n + r.findings.filter((f) => f.severity === 'P1').length, 0)

  // eslint-disable-next-line no-console
  console.log(
    `Audit: ${report.passingRoutes}/${report.totalRoutes} routes at 100%, avg ${report.averageScore}%. ` +
      `P0=${p0Count} P1=${p1Count}. Report → ${mdPath.replace(process.cwd() + '/', '')}, ${jsonPath.replace(process.cwd() + '/', '')}`,
  )

  if (p0Count > 0) {
    process.exit(1)
  }
}

main()
