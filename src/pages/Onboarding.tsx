// ─────────────────────────────────────────────────────────────────────────────
// Onboarding — thin shell that mounts the new single-screen CreateProject
// ─────────────────────────────────────────────────────────────────────────────
// The old 6-step wizard ("Welcome / Project / Team / Import / Widgets /
// Complete") is replaced by a dense, two-column project creation page that
// looks like the rest of the platform. Existing /onboarding routes still
// work — they just render the new flow.
// ─────────────────────────────────────────────────────────────────────────────

export { CreateProject as Onboarding } from './CreateProject';
export { CreateProject as default } from './CreateProject';
