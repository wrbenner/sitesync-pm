// ────────────────────────────────────────────────────────────────────────────
// no-raw-ingest rule tests — Phase 3b
// ────────────────────────────────────────────────────────────────────────────

import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'

import noRawIngest from '../no-raw-ingest.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
  },
})

describe('sitesync/no-raw-ingest', () => {
  it('runs the RuleTester matrix', () => {
    ruleTester.run('no-raw-ingest', noRawIngest, {
      valid: [
        // Allowed: ingestion module
        {
          name: 'src/services/iris/ingestion/router.ts may write to iris_kb_chunks',
          filename: '/Users/x/src/services/iris/ingestion/router.ts',
          code: `supabase.from('iris_kb_chunks').insert({ ...payload })`,
        },
        // Allowed: edge fn worker prefix
        {
          name: 'iris-ingest-drawing-worker may write',
          filename: '/Users/x/supabase/functions/iris-ingest-drawing-worker/index.ts',
          code: `supabase.from('iris_kb_chunks').upsert({ ...payload })`,
        },
        // Allowed: tests
        {
          name: 'test files may write fixture chunks',
          filename: '/Users/x/src/services/iris/ingestion/__tests__/chunkers.test.ts',
          code: `supabase.from('iris_kb_chunks').insert({ id: 'fixture' })`,
        },
        // Allowed: writes to other tables are fine
        {
          name: 'writes to other tables are untouched',
          filename: '/Users/x/src/components/foo.ts',
          code: `supabase.from('rfis').insert({ x: 1 })`,
        },
        // Allowed: select/update/delete on iris_kb_chunks (only insert/upsert flagged)
        {
          name: 'select on iris_kb_chunks is fine',
          filename: '/Users/x/src/components/foo.ts',
          code: `supabase.from('iris_kb_chunks').select('id')`,
        },
      ],
      invalid: [
        // Direct insert outside the allow-list
        {
          name: 'inserting into iris_kb_chunks from a UI file is flagged',
          filename: '/Users/x/src/components/uploads/UploadForm.tsx',
          code: `await supabase.from('iris_kb_chunks').insert({ chunk_text: 'x' })`,
          errors: [{ messageId: 'rawIngest' }],
        },
        // upsert is also flagged
        {
          name: 'upsert into iris_kb_chunks from a non-worker is flagged',
          filename: '/Users/x/src/services/some-other-service.ts',
          code: `await supabase.from('iris_kb_chunks').upsert([{ id: '1' }])`,
          errors: [{ messageId: 'rawIngest' }],
        },
        // iris_kb_sources is also gated
        {
          name: 'inserting into iris_kb_sources from a UI file is flagged',
          filename: '/Users/x/src/pages/Admin.tsx',
          code: `await supabase.from('iris_kb_sources').insert({})`,
          errors: [{ messageId: 'rawIngest' }],
        },
      ],
    })
  })
})
