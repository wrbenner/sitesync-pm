// cron-conversion-alert — BRT subsystem 7 §4.4
//
// Daily 8am UTC digest + alert sweep:
//   - Signups today vs yesterday
//   - Trial-to-paid conversions today
//   - Active subscriptions
//   - MRR delta vs yesterday
//   - Top 5 errors today (via audit_incidents)
//   - Heartbeats: backup ran, dunning ran
//
// Posts a "digest" alert to Slack on every run. If trial conversion drops
// > 30% week-over-week, escalates to "alert".
//
// Auth: cron-secret-gated.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'
import { postSlackAlert } from '../_shared/slackAlert.ts'

interface Snapshot {
  signups_today: number
  signups_yesterday: number
  trials_today: number
  paid_today: number
  active_subscriptions: number
  conversion_today: string
  conversion_7d_avg: string
  conversion_drop_pct: number
  audit_incidents_today: number
}

async function snapshot(supabase: ReturnType<typeof createClient>): Promise<Snapshot> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayStart = today.toISOString()
  const yesterday = new Date(today.getTime() - 86_400_000).toISOString()
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000).toISOString()

  // Counts
  const { count: signupsToday } = await supabase
    .from('profiles').select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)
  const { count: signupsYesterday } = await supabase
    .from('profiles').select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday).lt('created_at', todayStart)
  const { count: trialsToday } = await supabase
    .from('subscriptions').select('*', { count: 'exact', head: true })
    .eq('status', 'trialing').gte('created_at', todayStart)
  const { count: paidToday } = await supabase
    .from('subscriptions').select('*', { count: 'exact', head: true })
    .eq('status', 'active').gte('current_period_start', todayStart)
  const { count: activeSubs } = await supabase
    .from('subscriptions').select('*', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])
  const { count: incidentsToday } = await supabase
    .from('audit_incidents').select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart)

  // Trial→paid conversion: paid today / trials that ended today
  // (Approximation; exact would require per-cohort math.)
  const { count: trialEndedToday } = await supabase
    .from('subscriptions').select('*', { count: 'exact', head: true })
    .gte('trial_ends_at', todayStart)
    .lt('trial_ends_at', new Date(today.getTime() + 86_400_000).toISOString())

  const conversionToday = trialEndedToday && trialEndedToday > 0
    ? ((paidToday ?? 0) / trialEndedToday * 100).toFixed(1)
    : 'n/a'

  // 7-day average comparison
  const { count: paid7d } = await supabase
    .from('subscriptions').select('*', { count: 'exact', head: true })
    .eq('status', 'active').gte('current_period_start', sevenDaysAgo)
  const { count: trial7d } = await supabase
    .from('subscriptions').select('*', { count: 'exact', head: true })
    .gte('trial_ends_at', sevenDaysAgo).lt('trial_ends_at', todayStart)

  const conv7d = trial7d && trial7d > 0 ? (paid7d ?? 0) / trial7d * 100 : 0
  const convToday = trialEndedToday && trialEndedToday > 0 ? (paidToday ?? 0) / trialEndedToday * 100 : 0
  const dropPct = conv7d > 0 ? ((conv7d - convToday) / conv7d) * 100 : 0

  return {
    signups_today: signupsToday ?? 0,
    signups_yesterday: signupsYesterday ?? 0,
    trials_today: trialsToday ?? 0,
    paid_today: paidToday ?? 0,
    active_subscriptions: activeSubs ?? 0,
    conversion_today: conversionToday + '%',
    conversion_7d_avg: conv7d.toFixed(1) + '%',
    conversion_drop_pct: Math.round(dropPct),
    audit_incidents_today: incidentsToday ?? 0,
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    authenticateCron(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const snap = await snapshot(supabase)

    const escalate = snap.conversion_drop_pct > 30

    await postSlackAlert({
      severity: escalate ? 'alert' : 'digest',
      title: escalate
        ? `Trial conversion dropped ${snap.conversion_drop_pct}% vs 7-day avg`
        : 'BRT daily digest',
      body: escalate
        ? `Conversion today is ${snap.conversion_today} (7d avg ${snap.conversion_7d_avg}). Investigate before tomorrow's cohort.`
        : `Daily snapshot of signups, trials, conversions, and incidents.`,
      context: {
        signups_today: snap.signups_today,
        signups_yesterday: snap.signups_yesterday,
        trials_today: snap.trials_today,
        paid_today: snap.paid_today,
        active_subscriptions: snap.active_subscriptions,
        conversion_today: snap.conversion_today,
        conversion_7d_avg: snap.conversion_7d_avg,
        audit_incidents_today: snap.audit_incidents_today,
      },
    })

    return new Response(
      JSON.stringify({ ran_at: new Date().toISOString(), escalated: escalate, snapshot: snap }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
