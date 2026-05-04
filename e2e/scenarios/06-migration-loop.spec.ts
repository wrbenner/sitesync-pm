/**
 * Scenario 6 — The migration loop
 *
 *   Admin pastes Procore token
 *     → import pulls 5 projects
 *     → entities mapped via external_ids
 *     → cost code library imported via Sage 300 importer
 *     → portfolio dashboard shows the 5 projects
 *     → cross-project search finds RFIs across them.
 *
 * STATUS: SKIPPED — depends on:
 *   • Procore importer edge function (not shipped)
 *   • Sage 300 importer edge function (not shipped)
 *   • external_ids mapping table (not shipped)
 *
 * What is shipped this session:
 *   ✓ org_search_index view + search_org RPC (cross-project search)
 *   ✓ project_health_summary materialized view (portfolio dashboard data)
 *
 * The cross-project search half could be tested independently against
 * the Avery Oaks seed; that's covered in `08-realtime-loop` indirectly.
 */

import { test, expect } from '@playwright/test'
import { setupScenario } from '../helpers/scenarioRunner'

test.skip('migration — Procore + Sage 300 → portfolio + cross-project search', async ({ page }) => {
  const { ctx, teardown } = await setupScenario(page, {
    name: '06-migration',
    aiResponses: {},
  })
  try {
    // 1. Admin pastes Procore token via UI / API.
    await page.request.post('/test/integrations/procore/import', {
      data: { token: 'fake-procore-token', org_id: 'e2000001-0000-4000-8000-000000000002' },
    })

    // 2. Assert 5 projects landed with external_ids.procore set.
    // 3. Cost code library imported via Sage 300 endpoint.
    // 4. Portfolio dashboard shows them.
    // 5. Cross-project search across them finds RFIs.
    void ctx
  } finally {
    await teardown()
  }
})
