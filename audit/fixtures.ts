// Minimal Create payloads for each entity — just enough to satisfy required
// field validation. Used by the generated Playwright CRUD tests.
//
// Each fixture is an array of [label-regex, value] tuples matched against the
// form's <label> text. If a label isn't in the tuple list, the field is left
// blank (assumed optional).

import type { EntityKind } from './registry'

export type FieldFill = { label: RegExp; value: string }

export const CREATE_FIXTURES: Partial<Record<EntityKind, FieldFill[]>> = {
  rfi: [
    { label: /title|subject/i, value: 'Audit harness test RFI' },
    { label: /description|question/i, value: 'Automated end-to-end smoke payload.' },
  ],
  submittal: [
    { label: /title|name/i, value: 'Audit harness test submittal' },
    { label: /description/i, value: 'Automated end-to-end smoke payload.' },
  ],
  task: [
    { label: /title|task name/i, value: 'Audit harness test task' },
  ],
  'change-order': [
    { label: /title|description/i, value: 'Audit harness test CO' },
    { label: /amount|cost|value/i, value: '1000' },
  ],
  'daily-log': [
    { label: /date/i, value: new Date().toISOString().slice(0, 10) },
    { label: /notes|summary|work performed/i, value: 'Audit harness daily log.' },
  ],
  meeting: [
    { label: /title|subject/i, value: 'Audit harness meeting' },
    { label: /date|scheduled/i, value: new Date().toISOString().slice(0, 10) },
  ],
  crew: [
    { label: /name|crew name/i, value: 'Audit crew' },
    { label: /trade/i, value: 'General' },
  ],
  'punch-item': [
    { label: /title|description/i, value: 'Audit punch item' },
    { label: /location/i, value: 'Lobby' },
  ],
  contact: [
    { label: /name|full name/i, value: 'Audit Contact' },
    { label: /email/i, value: 'audit-harness@example.com' },
  ],
  project: [
    { label: /project name|name/i, value: 'Audit Project' },
  ],
  'budget-item': [
    { label: /description/i, value: 'Audit budget line' },
    { label: /amount/i, value: '5000' },
  ],
  phase: [
    { label: /name|phase name/i, value: 'Audit phase' },
    { label: /start/i, value: new Date().toISOString().slice(0, 10) },
  ],
  transmittal: [
    { label: /title|subject/i, value: 'Audit transmittal' },
  ],
}
