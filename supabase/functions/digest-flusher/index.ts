// digest-flusher — runs on a schedule. Picks each user whose digest_schedule
// time matches "now" in their tz, aggregates queued notifications, and
// hands them to the existing email transport.
//
// Critical events were never queued for digest — they go out immediately
// at insert time. So we only see info/normal in the queue here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY', { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceKey)

  // Pull all users with digest_schedule configured.
  const { data: prefs = [] } = await sb
    .from('notification_preferences')
    .select('user_id, dnd_timezone, digest_schedule')
    .not('digest_schedule', 'is', null)

  const now = new Date()
  let dispatched = 0

  for (const p of prefs ?? []) {
    const sched = p.digest_schedule as { cadence: 'daily' | 'weekly'; time: string; weekday?: number } | null
    if (!sched) continue
    const tz = p.dnd_timezone ?? 'UTC'

    // Compute user's local time. If sched.time is within ±5 min of "now"
    // local — and if weekly, the weekday matches — fire.
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    })
    let hh = 0
    let mm = 0
    let weekdayShort = ''
    for (const part of fmt.formatToParts(now)) {
      if (part.type === 'hour') hh = parseInt(part.value, 10)
      if (part.type === 'minute') mm = parseInt(part.value, 10)
      if (part.type === 'weekday') weekdayShort = part.value
    }
    if (hh === 24) hh = 0
    const nowMin = hh * 60 + mm
    const [shStr, smStr] = (sched.time || '08:00').split(':')
    const targetMin = parseInt(shStr, 10) * 60 + parseInt(smStr, 10)
    if (Math.abs(nowMin - targetMin) > 5) continue

    if (sched.cadence === 'weekly') {
      const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const targetDay = sched.weekday ?? 1
      if (SHORT[targetDay] !== weekdayShort) continue
    }

    // Fetch queued notifications for this user (channel === 'digest').
    const { data: queued = [] } = await sb
      .from('notification_queue')
      .select('*')
      .eq('user_id', p.user_id)
      .eq('channel', 'digest')
      .is('sent_at', null)

    if (!queued || queued.length === 0) continue

    // Mark sent. Real email transport happens in another function listening
    // to the row event; this flusher just consolidates.
    const ids = queued.map((q: { id: string }) => q.id)
    await sb
      .from('notification_queue')
      .update({ sent_at: new Date().toISOString() })
      .in('id', ids)

    dispatched += queued.length
  }

  return new Response(JSON.stringify({ dispatched }), { headers: { 'Content-Type': 'application/json' } })
})
