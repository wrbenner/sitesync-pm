// Typed wrapper over posthog capture (BRT sub-7 §4.3).
// Forces every event to be a known member of AppEvent — adding a new event
// requires updating src/lib/observability/events.ts in the same change.
//
// BRT sub-7 §4.5 (I4 invariant): every event payload passes through the
// PII scrubber before reaching analytics.capture(). Adding a new event
// with a sensitive field requires updating SENSITIVE_KEYS in scrubbers.ts.
//
// Usage:
//   const track = useTrack();
//   track('signup_completed', { org_id, total_seconds: 42 });

import { useCallback } from 'react';
import analytics from '../lib/analytics';
import { scrubEvent } from '../lib/observability/scrubbers';
import type { AppEventName, EventPropsFor } from '../lib/observability/events';

export function useTrack() {
  return useCallback(
    <N extends AppEventName>(name: N, props: EventPropsFor<N>) => {
      const safe = scrubEvent(props as Record<string, unknown>);
      analytics.capture(name, safe);
    },
    [],
  );
}

// Imperative variant for non-component call sites (e.g., service-layer fire-and-forget).
export function track<N extends AppEventName>(name: N, props: EventPropsFor<N>) {
  const safe = scrubEvent(props as Record<string, unknown>);
  analytics.capture(name, safe);
}
