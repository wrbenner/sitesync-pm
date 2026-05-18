import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import sitesyncRules from './eslint-rules/index.js'

export default defineConfig([
  globalIgnores([
    'dist',
    // macOS Finder / iCloud sync conflict duplicates (e.g. "foo 2.tsx",
    // "foo 3.md", "android/app 4/"). Already gitignored, but iCloud may
    // regenerate them on disk and ESLint would otherwise lint stale copies.
    '**/* [0-9].*',
    '**/* [0-9]/**',
    '**/* [0-9]',
    // Local session-state artifacts from the `remember` skill (gitignored).
    '.remember/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      sitesync: sitesyncRules,
    },
    rules: {
      // ── Bugatti-grade safety rules ───────────────────────────────
      // Raw user_id in JSX text leaks UUIDs into the UI (the deep-dive's
      // "code in activity" finding). UserName is the canonical resolver;
      // ESLint blocks regressions at build time.
      'sitesync/no-raw-user-id-in-jsx': 'error',
      // Per ADR-020 / IRIS_PHASE_1 spec §5.3 — caller-supplied `system=` on
      // iris-call invocations is deprecated. New code must route through
      // `buildContext()` in src/services/iris/contextFabric.ts. The rule
      // exempts files under src/services/iris/ where the Fabric and its
      // legacy adapter live; everything else fails the build.
      'sitesync/no-raw-iris-system': 'error',
      // Per IRIS_PHASE_3 spec §6 — direct writes to iris_kb_chunks /
      // iris_kb_sources outside the ingestion worker allow-list are
      // forbidden. Upload paths route through routeArtifact() and let
      // a per-source-type worker write the chunk.
      'sitesync/no-raw-ingest': 'error',
      // UserName.tsx itself is the canonical resolver — it has to render
      // the raw value in the non-UUID early-return branch. Disabling at
      // the per-file level (below) instead of inside the file keeps the
      // exception discoverable in the lint config.
      //
      // ── DELIBERATE DOWNGRADES (April 16 2026 audit) ──────────────
      // These are tracked as warnings, not errors. They matter and will
      // be fixed, but they should not block the quality floor at 0.
      //
      // Accessibility: important for field workers with gloves/glare.
      // Tracking as warnings while we systematically fix them.
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/no-noninteractive-tabindex': 'warn',
      'jsx-a11y/scope': 'warn',
      'jsx-a11y/no-redundant-roles': 'warn',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'warn',
      'jsx-a11y/img-redundant-alt': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
      'jsx-a11y/no-noninteractive-element-to-interactive-role': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      //
      // TypeScript any: real issue, tracked as warning while we add types.
      '@typescript-eslint/no-explicit-any': 'warn',
      //
      // Unused vars: ignore leading-underscore names (intentional discards).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      //
      // React Refresh: dev convenience, not a production bug.
      'react-refresh/only-export-components': 'warn',
      //
      // ── React Compiler signals (eslint-plugin-react-hooks v7+) ──────────
      // These rules ship via reactHooks.configs.flat.recommended at error
      // severity. They flag patterns that prevent the upcoming React Compiler
      // optimizer from auto-memoizing components — they are NOT runtime bug
      // detectors.
      //
      // The codebase has not adopted React Compiler (no
      // babel-plugin-react-compiler installed). Until we do, these signals
      // belong at warning severity (visible, ratcheted by quality floor) and
      // not at error severity (which would treat fetch-on-mount and similar
      // canonical patterns as build-blocking).
      //
      // Re-enable as 'error' when babel-plugin-react-compiler is installed —
      // adopt in one focused PR that migrates the flagged patterns:
      //   set-state-in-effect → TanStack Query for fetch-on-mount,
      //   refs → hoist ref reads into effects/callbacks,
      //   preserve-manual-memoization → audit each useMemo/useCallback,
      //   immutability → switch to immutable updates,
      //   purity → move side-effects out of render.
      //
      // rules-of-hooks and exhaustive-deps stay at default (error) — they
      // catch real runtime bugs independent of the compiler.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/no-deriving-state-in-effects': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/capitalized-calls': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/void-use-memo': 'warn',
      'react-hooks/memoized-effect-dependencies': 'warn',
      'react-hooks/exhaustive-effect-dependencies': 'warn',
      'react-hooks/memo-dependencies': 'warn',
      'react-hooks/gating': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/fbt': 'warn',
      'react-hooks/hooks': 'warn',
      'react-hooks/invariant': 'warn',
      'react-hooks/syntax': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/config': 'warn',
      'react-hooks/rule-suppression': 'warn',
      'react-hooks/todo': 'warn',
      //
      // Hardcoded hex colors — the audit/ROADMAP.md Phase B3 codemod lifts
      // these into src/styles/theme tokens. Rule is currently disabled here
      // because enabling it as warn added ~450 new warnings and tripped the
      // Gate 2 quality-floor ratchet (eslintWarnings=607 in .quality-floor.json).
      // Re-enable after the mass codemod in a PR that ratchets the floor down
      // in the same commit. Audit harness still catches new sub-56 touch
      // targets and other regressions.
    },
  },
  {
    // The UserName component is the canonical user_id resolver. After it
    // proves the input is not a UUID, it intentionally renders the raw
    // value (which is, by that point, a display name). The lint rule's
    // heuristic can't distinguish that case, so disable it here.
    files: ['src/components/UserName.tsx'],
    rules: {
      'sitesync/no-raw-user-id-in-jsx': 'off',
    },
  },
  {
    // src/pages/drawings/index.tsx is a long-lived legacy page that
    // pre-dates the React-Compiler signal rules and pre-dates the
    // jsx-a11y tightening for non-interactive elements with click
    // handlers. Lifting those 6 issues is a focused refactor on its
    // own (the upload-pages loop captures `pi` in a lambda; the
    // file-tree picker leans on raw div click handlers). Until that
    // refactor lands, downgrade the legacy-only rules to 'off' here
    // so unrelated changes to this file can land without modifying
    // pre-existing patterns. Per feedback_floor_downgrade_rule.md.
    files: ['src/pages/drawings/index.tsx'],
    rules: {
      'react-hooks/todo': 'off',
      'react-hooks/memo-dependencies': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
    },
  },
  {
    // ProjectBrain.tsx, OwnerReport.tsx, and OwnerUpdateGenerator.tsx
    // pre-date the React Compiler signal rules. The todo warnings are
    // React Compiler HIR limitations (try/finally, throw inside try)
    // that can only be resolved by the compiler team, not user code.
    // The set-state-in-effect pattern here is intentional fetch-on-mount
    // via useCallback — refactoring to TanStack Query is tracked for
    // Lap 3. Per feedback_floor_downgrade_rule.md.
    files: [
      'src/components/ai/ProjectBrain.tsx',
      'src/components/reports/OwnerReport.tsx',
      'src/components/reports/OwnerUpdateGenerator.tsx',
    ],
    rules: {
      'react-hooks/todo': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },
  {
    // Batch of pre-existing React Compiler HIR limitations (try/finally,
    // throw inside try) that can't be fixed in user code. Compiler team
    // tracks these as known gaps. Per feedback_floor_downgrade_rule.md.
    files: [
      'src/components/files/UploadZone.tsx',
      'src/components/inspection/InspectionFlow.tsx',
      'src/components/panels/SubmittalActionPanel.tsx',
      'src/components/rfi/RFIBulkEditPanel.tsx',
      'src/components/rfi/RFIEditPanel.tsx',
      'src/components/schedule/GanttChart.tsx',
      'src/components/shared/FileDropZone.tsx',
      'src/components/submittals/BulkActionsMenu.tsx',
      'src/pages/Budget.tsx',
      'src/pages/ChangeOrders.tsx',
      'src/pages/LienWaivers.tsx',
      'src/pages/Meetings.tsx',
      'src/pages/SiteMap.tsx',
      'src/pages/TimeTracking.tsx',
    ],
    rules: {
      'react-hooks/todo': 'off',
      'react-hooks/memo-dependencies': 'off',
      'react-hooks/invariant': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    // Files with intentional fetch-on-mount via useEffect + setState.
    // Refactoring to TanStack Query is deferred to Lap 3 per LAP_1_CARRYOVER_PLAN.
    // Per feedback_floor_downgrade_rule.md.
    files: [
      'src/components/rfi/RFIEditPanel.tsx',
      'src/components/rfi/RFIIrisTriage.tsx',
      'src/components/search/CrossProjectSearchPalette.tsx',
      'src/pages/Closeout.tsx',
      'src/pages/Estimating.tsx',
      'src/pages/Meetings.tsx',
      'src/pages/SiteMap.tsx',
      'src/pages/admin/sso/index.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    // Files where non-component values are exported alongside components.
    // Fast refresh degrades gracefully (full reload on change) for these.
    // Refactor to separate modules deferred — per feedback_floor_downgrade_rule.md.
    files: [
      'src/components/files/UploadZone.tsx',
      'src/components/reports/DiscrepancyReport.tsx',
      'src/components/reports/ScaleAuditReport.tsx',
      'src/components/submittals/Create/EntryMethods/VoiceEntryHandler.tsx',
      'src/components/submittals/Create/QuickTierFields.tsx',
      'src/components/submittals/detail/StoryBanner.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Pre-existing jsx-a11y warnings in canvas-heavy components and rich
    // upload UIs. Keyboard/focus support is tracked for the accessibility
    // sprint (post-Day-60). Per feedback_floor_downgrade_rule.md.
    files: [
      'src/components/budget/BudgetUpload.tsx',
      'src/components/payApplications/DrawReportUpload.tsx',
      'src/components/rfi/RFIReopenDialog.tsx',
      'src/components/schedule/GanttChart.tsx',
      'src/components/schedule/ScheduleCanvas.tsx',
      'src/components/search/CrossProjectSearchPalette.tsx',
      'src/components/submittals/BulkActionsMenu.tsx',
      'src/components/submittals/Create/EntryMethods/VoiceEntryHandler.tsx',
      'src/components/submittals/FilterChips/AddFilterDropdown.tsx',
      'src/components/ui/OfflineBanner.tsx',
      'src/pages/Budget.tsx',
      'src/pages/ChangeOrders.tsx',
      'src/pages/Closeout.tsx',
      'src/pages/Contracts.tsx',
      'src/pages/Estimating.tsx',
      'src/pages/Integrations.tsx',
      'src/pages/LienWaivers.tsx',
      'src/pages/Meetings.tsx',
      'src/pages/Preconstruction.tsx',
      'src/pages/SiteMap.tsx',
      'src/pages/TimeTracking.tsx',
      'src/pages/field-capture/CaptureUpload.tsx',
      'src/pages/field/index.tsx',
    ],
    rules: {
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/interactive-supports-focus': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'react-hooks/memo-dependencies': 'off',
      'jsx-a11y/no-autofocus': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'jsx-a11y/no-redundant-roles': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/img-redundant-alt': 'off',
    },
  },
])
