// Standalone demo render of the AutoDraftPanel against a fixture.
// Renders the panel with a realistic mock DraftedDailyLog so designers
// + reviewers can iterate without needing a populated database.
//
// Usage from a temporary playground page:
//   import { AutoDraftPanelDemo } from 'src/components/dailylog/__demo__/AutoDraftPanel.demo'
//   <AutoDraftPanelDemo />

import React from 'react';
import { AutoDraftPanel } from '../AutoDraftPanel';
import { assembleDailyLogDraft } from '../../../lib/dailyLogDrafting';
import type { DayContext } from '../../../types/dailyLogDraft';

const ctx: DayContext = {
  project_id: 'demo-project',
  date: '2026-04-30',
  timezone: 'America/New_York',
  weather: {
    condition: 'Mostly sunny',
    high_temp_f: 78,
    low_temp_f: 62,
    precipitation_in: 0,
    wind_mph: 11,
    weather_source: 'observed',
  },
  crews: [
    { trade: 'Concrete', sub_company: 'PourPro', count: 8, hours: 64, source: 'crew_check_in' },
    { trade: 'Electrical', sub_company: 'Hudson Electric', count: 4, hours: 32, source: 'crew_check_in' },
    { trade: 'Drywall', sub_company: 'Apex Interiors', count: 6, source: 'roster_scheduled' },
  ],
  photos: [
    { id: 'p001', caption: 'Rebar mat installed in pier 7 footing', pinned_zone: 'B-line / 7' },
    { id: 'p002', caption: 'Concrete pour in progress at column line 7' },
    { id: 'p003', caption: 'Drywall taping started on level 3 west' },
    { id: 'p004', caption: 'EMT conduit pulled to electrical panel A' },
  ],
  captures: [
    { id: 'c001', text: 'Inspector flagged a missing smoke detector in stair tower 2.', kind: 'voice' },
  ],
  rfis_today: [
    { id: 'r047', number: 47, title: 'Slab elevation conflict with underground plumbing', event: 'filed' },
    { id: 'r032', number: 32, title: 'Door hardware spec section 08 71 00', event: 'answered' },
  ],
  meeting_action_items: [
    { id: 'a001', description: 'Confirm rebar shop drawing rev D matches column schedule', meeting_title: 'Foreman standup' },
  ],
  schedule_events: [
    { id: 's001', title: 'Slab on grade — pier 7', delta_percent: 25 },
  ],
  inspections: [
    { id: 'i001', type: 'Building inspection', inspector: 'City of Austin', result: 'pass' },
    { id: 'i002', type: 'Fire alarm rough-in', result: 'fail', notes: 'missing smokes in 204; needs re-inspection 2026-05-02' },
  ],
  deliveries: [
    { id: 'd001', item: 'Rebar #5 bars', quantity: 4200, sub: 'SteelSouth' },
  ],
};

const demoDraft = assembleDailyLogDraft(ctx, { generated_by: 'demo-fixture' });

export const AutoDraftPanelDemo: React.FC = () => {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>AutoDraftPanel — fixture render</h2>
      <AutoDraftPanel
        draft={demoDraft}
        onApprove={async (d) => {
          // eslint-disable-next-line no-console
          console.log('[demo] approve →', d);
        }}
        onReject={async (reason) => {
          // eslint-disable-next-line no-console
          console.log('[demo] reject →', reason);
        }}
        onRegenerateSection={async (id) => {
          // eslint-disable-next-line no-console
          console.log('[demo] regenerate section →', id);
        }}
      />
    </div>
  );
};

export default AutoDraftPanelDemo;
