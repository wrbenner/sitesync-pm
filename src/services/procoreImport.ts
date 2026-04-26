// Client-side wrapper around the procore-import edge function.
//
// Used by the "Import from Procore" UI. Submits the user's Procore
// credentials + target SiteSync project id, returns a structured
// summary of what was imported.

import { supabase } from '../lib/supabase'

export type ImportScope = 'rfis' | 'submittals' | 'change_orders' | 'drawings'

export interface ProcoreCredentials {
  apiKey: string
  companyId: string
  procoreProjectId: string | number
}

export interface ProcoreImportResult {
  ok: boolean
  imported: {
    rfis: number
    submittals: number
    change_orders: number
    drawings: number
  }
  errors: Array<{ scope: string; error: string }>
}

/**
 * Trigger a one-shot Procore → SiteSync import. The caller must already
 * be a member of the target SiteSync project with project_engineer or
 * higher role; the edge function enforces this server-side.
 */
export async function importFromProcore(
  targetProjectId: string,
  credentials: ProcoreCredentials,
  scopes?: ImportScope[],
): Promise<ProcoreImportResult> {
  const { data, error } = await supabase.functions.invoke<ProcoreImportResult>(
    'procore-import',
    {
      body: {
        target_project_id: targetProjectId,
        procore: {
          api_key: credentials.apiKey,
          company_id: credentials.companyId,
          procore_project_id: credentials.procoreProjectId,
        },
        scopes,
      },
    },
  )

  if (error) {
    // Supabase JS surfaces FunctionsError objects. Normalize to our shape
    // so callers can `result.errors[0].error` without a discriminator.
    return {
      ok: false,
      imported: { rfis: 0, submittals: 0, change_orders: 0, drawings: 0 },
      errors: [{ scope: 'invoke', error: error.message }],
    }
  }

  return (data as ProcoreImportResult) ?? {
    ok: false,
    imported: { rfis: 0, submittals: 0, change_orders: 0, drawings: 0 },
    errors: [{ scope: 'invoke', error: 'Empty response from procore-import' }],
  }
}
