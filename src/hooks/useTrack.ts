// Typed wrapper over posthog capture (BRT sub-7 §4.3).
// Forces every event to be a known member of AppEvent — adding a new event
// requires updating src/lib/observability/events.ts in the same change.
//
// Usage:
//   const track = useTrack();
//   track('signup_completed', { org_id, total_seconds: 42 });

import { useCallback } from 'react';
import analytics from '../lib/analytics';
import type { AppEventName, EventPropsFor } from '../lib/observability/events';

export function useTrack() {
  return useCallback(
    <N extends AppEventName>(name: N, props: EventPropsFor<N>) => {
      analytics.capture(name, props as Record<string, unknown>);
    },
    [],
  );
}

// Imperative variant for non-component call sites (e.g., service-layer fire-and-forget).
export function track<N extends AppEventName>(name: N, props: EventPropsFor<N>) {
  analytics.capture(name, props as Record<string, unknown>);
}
