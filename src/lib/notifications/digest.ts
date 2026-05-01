/**
 * Digest builder.
 *
 * Consolidates queued notifications into a single email body grouped by
 * entity_type. Critical items always immediate, NEVER digested — they
 * are removed from `digest()` output and surfaced separately in
 * `criticalCount`.
 */

import type { NotificationEvent, Digest, DigestGroup } from '../../types/notifications'

export function digest(
  user_id: string,
  events: NotificationEvent[],
  generated_at: Date,
): Digest {
  const critical = events.filter((e) => e.severity === 'critical')
  const queueable = events.filter((e) => e.severity !== 'critical')

  const grouped = new Map<string, NotificationEvent[]>()
  for (const e of queueable) {
    const key = e.entity_type ?? 'general'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(e)
  }

  const groups: DigestGroup[] = Array.from(grouped.entries())
    .map(([entity_type, events]) => ({ entity_type, events, count: events.length }))
    // Sort by count desc, then alphabetical, for deterministic output.
    .sort((a, b) => b.count - a.count || a.entity_type.localeCompare(b.entity_type))

  return {
    user_id,
    generated_at: generated_at.toISOString(),
    groups,
    total_events: queueable.length,
    critical_count: critical.length,
  }
}

/**
 * Render a plain-text digest body. Edge function can convert to email HTML.
 */
export function renderDigestText(d: Digest): string {
  if (d.total_events === 0 && d.critical_count === 0) {
    return 'No new notifications.'
  }
  const lines: string[] = []
  lines.push(`Your SiteSync digest — ${new Date(d.generated_at).toLocaleString()}`)
  lines.push('')
  if (d.critical_count > 0) {
    lines.push(`(${d.critical_count} critical event(s) were sent immediately and not included here.)`)
    lines.push('')
  }
  for (const group of d.groups) {
    lines.push(`── ${group.entity_type.toUpperCase()} (${group.count}) ──`)
    for (const e of group.events) {
      lines.push(`  • ${e.title}${e.body ? ` — ${e.body}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
