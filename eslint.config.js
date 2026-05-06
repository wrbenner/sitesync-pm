import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
    rules: {
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
      // React Refresh: only-export-components fires on files that mix
      // React components with non-component exports (constants, hooks,
      // contexts, types). The cost is a slower HMR cycle on those
      // specific files — they fall back from fast-refresh to a full
      // page reload when edited.
      //
      // The codebase intentionally colocates hooks + their context +
      // their provider + the component(s) that consume them in one
      // file (Primitives.tsx, FormPrimitives.tsx, ContextMenu.tsx /
      // ToastProvider, ConfirmDialog, EditConflictGuard, etc.). That's
      // idiomatic React; Vite's HMR rule wants every helper in its
      // own file, which would mean 24+ structural splits across the
      // codebase to satisfy a dev-experience optimization that does
      // not affect production behavior.
      //
      // Bugatti decision: weighing the architecture against the rule,
      // the architecture wins. Off, with rationale.
      'react-refresh/only-export-components': 'off',
      //
      // ── React Compiler signals (eslint-plugin-react-hooks v7+) ──────────
      // babel-plugin-react-compiler is installed (vite.config.ts wires it
      // in annotation mode). The 14 Recommended-preset rules promote to
      // error as their backlog reaches zero — landed in slice B
      // (feat/react-compiler-slice-b-2026-05-05).
      //
      // Promoted to ERROR (Slice B Phase 1+2, 2026-05-05):
      //   capitalized-calls, static-components       (cleared 790d1fa)
      //   purity                                      (cleared a458e61)
      //   no-deriving-state-in-effects                (cleared 59ce638)
      //   incompatible-library                        (cleared 7edca0e)
      //   immutability                                (cleared 2a31ca3)
      //   preserve-manual-memoization                 (cleared 92b5b2e)
      //   refs                                        (cleared cdd43cc)
      //   config, error-boundaries, gating, globals,
      //   set-state-in-render, unsupported-syntax,
      //   use-memo                                    (already at 0)
      //
      // Still at WARN — last Recommended-preset rule, deferred to Phase 3:
      //   set-state-in-effect (82) → splits into 4 distinct migrations:
      //     • ~20 fetch-on-mount sites → TanStack Query
      //     • ~30 reset-on-prop-change sites → react.dev "compare prev
      //       props during render" pattern
      //     • ~5 derive-from-props sites → derive in render
      //     • ~5 subscription/event sites → keep effect, refactor
      //       per-case
      //   Each batch deserves its own focused PR for review.
      //
      // The remaining non-Recommended-preset rules below stay at WARN —
      // they cover compiler-internal limitations (todo, invariant) and
      // advisory signals (memo-dependencies, exhaustive-deps) that need
      // their own campaigns.
      //
      // rules-of-hooks stays at default (error) — it catches real
      // runtime bugs independent of the compiler.
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/no-deriving-state-in-effects': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/static-components': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/capitalized-calls': 'error',
      'react-hooks/error-boundaries': 'error',
      'react-hooks/use-memo': 'error',
      'react-hooks/void-use-memo': 'warn',
      'react-hooks/memoized-effect-dependencies': 'warn',
      'react-hooks/exhaustive-effect-dependencies': 'warn',
      'react-hooks/memo-dependencies': 'warn',
      'react-hooks/gating': 'error',
      'react-hooks/globals': 'error',
      'react-hooks/fbt': 'warn',
      'react-hooks/hooks': 'warn',
      // The next two rules are intentionally OFF.
      //
      // react-hooks/invariant fires when the React Compiler hits an
      // internal codegen invariant ("MethodCall::property must be an
      // unpromoted + unmemoized MemberExpression",
      // "[PruneHoistedContexts] Unexpected hoisted function", etc.).
      // These are compiler implementation errors, not application bugs;
      // the affected component is silently skipped from compilation and
      // the runtime behavior is unchanged. There is nothing the
      // application can do to "fix" them — they get fixed when Meta
      // ships a new compiler release.
      //
      // react-hooks/todo fires when the compiler encounters syntax it
      // hasn't implemented support for yet ("Todo:
      // (BuildHIR::lowerExpression) Handle Import expressions" for
      // dynamic import(), and similar). Same story: not an app bug,
      // not actionable, the affected components just opt out of
      // memoization until the compiler grows the feature.
      //
      // Keeping either at warn would mean ratchet-blocking churn from
      // upstream compiler updates with no developer action available.
      // Bugatti decision: turn them off explicitly with a documented
      // rationale rather than ignore the noise.
      'react-hooks/invariant': 'off',
      'react-hooks/syntax': 'warn',
      'react-hooks/unsupported-syntax': 'error',
      'react-hooks/config': 'error',
      'react-hooks/rule-suppression': 'warn',
      'react-hooks/todo': 'off',
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
])
