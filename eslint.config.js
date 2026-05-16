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
    // IrisApprovalGate exports ACTION_LABELS (a plain object) alongside
    // components. react-refresh fires because the file isn't pure-components.
    // Moving ACTION_LABELS is a separate refactor; suppress here until then.
    files: ['src/components/iris/IrisApprovalGate.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // ChangeOrders.tsx uses try/finally without catch in a local async
    // wrapper — a pattern the React Compiler's HIR builder doesn't yet
    // handle. The react-hooks/todo signal is a compiler todo, not a
    // bug; suppress at file scope until the compiler lifts the limit.
    files: ['src/pages/ChangeOrders.tsx'],
    rules: {
      'react-hooks/todo': 'off',
    },
  },
  {
    // SavedViewsSidebar's SaveViewDialog uses div overlay + inner div
    // click handlers (pre-dates the a11y tightening) and intentional
    // autoFocus on the name input (dialog best-practice). Suppress the
    // three legacy a11y signals until the dialog is refactored to use
    // a native <dialog> element or a headless accessible primitive.
    files: ['src/components/submittals/SavedViews/SavedViewsSidebar.tsx'],
    rules: {
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/no-autofocus': 'off',
    },
  },
])
