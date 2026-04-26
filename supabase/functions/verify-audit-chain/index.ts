// verify-audit-chain: walks the audit_log hash chain and reports any break.
//
// Auth: cron-only. Authenticated via CRON_SECRET (Bearer header).
// Schedule via supabase/config.toml [functions.verify-audit-chain] block
// or pg_cron — see migrations folder.
//
// Behavior:
//   1. Reads the last successful checkpoint from audit_chain_checkpoints
//      (table created lazily on first run if absent).
//   2. Calls public.verify_audit_chain(start_after) — a SECURITY DEFINER
//      Postgres function that recomputes every entry_hash since the
//      checkpoint and returns rows describing any break.
//   3. If the result is empty, advances the checkpoint and returns 200.
//   4. If non-empty, returns 500 + a structured payload that monitoring
//      can alert on. Does NOT advance the checkpoint, so the next run
//      will re-detect the same break.

import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const supabase = authenticateCron(req)

    // Read the last checkpoint (table created by the audit-hash-chain migration).
    const { data: checkpointRow } = await supabase
      .from('audit_chain_checkpoints')
      .select('last_verified')
      .eq('id', 1)
      .maybeSingle()

    const startAfter = checkpointRow?.last_verified ?? null

    // Call the verifier Postgres function.
    const { data: breaks, error: rpcErr } = await supabase.rpc(
      'verify_audit_chain',
      { start_after: startAfter },
    )

    if (rpcErr) {
      throw new HttpError(500, `verify_audit_chain failed: ${rpcErr.message}`)
    }

    const breakRows = (breaks as Array<{ broken_at_id: string; broken_at_seq: number; expected_hash: string; actual_hash: string }> | null) ?? []

    if (breakRows.length > 0) {
      console.error('AUDIT CHAIN BROKEN', breakRows[0])
      return new Response(
        JSON.stringify({
          ok: false,
          broken: breakRows[0],
          message: 'Audit log hash chain integrity check failed. Investigate immediately.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Advance checkpoint to now() so next run starts there.
    const { error: cpErr } = await supabase
      .from('audit_chain_checkpoints')
      .upsert({
        id: 1,
        last_verified: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
      })

    if (cpErr) {
      // Non-fatal — we verified successfully even if checkpoint write failed.
      console.warn('checkpoint advance failed:', cpErr.message)
    }

    return new Response(
      JSON.stringify({ ok: true, verified_through: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return errorResponse(e)
  }
})
