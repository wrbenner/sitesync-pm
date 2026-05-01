/**
 * expectedDbState.ts — Per-persona post-walk DB row assertions.
 *
 * These are intentionally loose — Tab C is observational. Tests that run
 * against a real DB use these to confirm the persona's actions produced
 * the expected mutations; tests without a real DB skip the DB
 * assertions and log a seed_unavailable finding.
 */
export interface DbAssertion {
  table: string
  /** Free-form predicate description; checked manually if real DB is wired. */
  predicate: string
}

export interface ExpectedDbState {
  persona: string
  assertions: DbAssertion[]
}

export const EXPECTED_DB_STATE: ExpectedDbState[] = [
  {
    persona: 'super-morning',
    assertions: [
      { table: 'daily_logs', predicate: 'one row exists for today with crew_check_ins.length >= 1' },
      { table: 'check_ins', predicate: 'inserted rows reference today and crew members' },
    ],
  },
  {
    persona: 'super-midday',
    assertions: [
      { table: 'photos', predicate: 'classified row exists with iris_label not null' },
      { table: 'rfis', predicate: 'a draft row exists with iris_drafted = true' },
    ],
  },
  {
    persona: 'super-evening',
    assertions: [
      { table: 'daily_logs', predicate: 'auto-drafted row signed by superintendent today' },
    ],
  },
  {
    persona: 'pm-morning',
    assertions: [
      { table: 'rfis', predicate: '3 rows updated with status=responded today' },
      { table: 'submittals', predicate: '2 rows updated with status=approved today' },
    ],
  },
  {
    persona: 'pm-midday',
    assertions: [
      { table: 'pay_apps', predicate: 'one row updated to status=submitted today' },
      { table: 'reconciliation_runs', predicate: 'a fresh row references this pay app' },
    ],
  },
  {
    persona: 'pm-afternoon',
    assertions: [
      { table: 'punch_items', predicate: '12 rows updated with assignee set today' },
    ],
  },
  {
    persona: 'compliance-weekly',
    assertions: [
      { table: 'wh347_runs', predicate: 'a row exists for the prior week with violations=0' },
    ],
  },
  {
    persona: 'compliance-monthly',
    assertions: [
      { table: 'osha_300_exports', predicate: 'a fresh export row exists for the current month' },
    ],
  },
  {
    persona: 'owner-weekly',
    assertions: [
      { table: 'magic_link_tokens', predicate: 'an unused token exists for the owner email' },
    ],
  },
  {
    persona: 'it-admin-onboarding',
    assertions: [
      { table: 'invitations', predicate: '12 rows pending acceptance' },
      { table: 'cost_codes', predicate: 'rows imported referencing the test library' },
    ],
  },
]
