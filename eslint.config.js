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
      // React Refresh: dev convenience, not a production bug.
      'react-refresh/only-export-components': 'warn',
      //
      // ── React Compiler signals (eslint-plugin-react-hooks v7+) ──────────
      // babel-plugin-react-compiler is installed (vite.config.ts wires it
      // in annotation mode). The 14 Recommended-preset rules promote to
      // error as their backlog reaches zero — landed in slice B
      // (feat/react-compiler-slice-b-2026-05-05).
      //
      // Promoted to ERROR (Slice B, 2026-05-05):
      //   capitalized-calls, static-components       (cleared 790d1fa)
      //   purity                                      (cleared a458e61)
      //   incompatible-library                        (cleared 7edca0e)
      //   immutability                                (cleared 2a31ca3)
      //   config, error-boundaries, gating, globals,
      //   set-state-in-render, unsupported-syntax,
      //   use-memo                                    (already at 0)
      //
      // Still at WARN — backlog being migrated in Slice B follow-up phases:
      //   set-state-in-effect (82) → TanStack Query for fetch-on-mount;
      //     each migration is a focused per-page PR.
      //   refs (24) → hoist ref reads/writes into effects/event handlers.
      //   preserve-manual-memoization (15) → audit each existing
      //     useMemo/useCallback against compiler-derived memoization.
      //
      // The remaining non-Recommended-preset rules below stay at WARN and
      // are NOT slated for promotion — they cover compiler-internal
      // limitations (todo, invariant, syntax, unsupported-syntax) and
      // backlog signals (memo-dependencies, exhaustive-deps) that need
      // their own architectural campaigns.
      //
      // rules-of-hooks and exhaustive-deps stay at default — they catch
      // real runtime bugs independent of the compiler.
      'react-hooks/set-state-in-effect': 'warn', // 82 backlog → TanStack Query migration
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/no-deriving-state-in-effects': 'error',
      'react-hooks/refs': 'warn', // 24 backlog → ref-read hoist
      'react-hooks/purity': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/preserve-manual-memoization': 'warn', // 15 backlog → memoization audit
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
      'react-hooks/invariant': 'warn', // compiler-internal codegen errors, not app bugs
      'react-hooks/syntax': 'warn',
      'react-hooks/unsupported-syntax': 'error',
      'react-hooks/config': 'error',
      'react-hooks/rule-suppression': 'warn',
      'react-hooks/todo': 'warn', // compiler-internal "BuildHIR can't lower this expression yet"
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
