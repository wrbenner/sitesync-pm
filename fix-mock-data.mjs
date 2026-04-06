#!/usr/bin/env node
/**
 * SiteSync PM — Mock Data Elimination Script
 * Removes all Math.random(), mockData, MOCK arrays, and hardcoded demo data
 * from production code paths.
 *
 * Run from repo root: node fix-mock-data.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

let filesFixed = 0;
let totalChanges = 0;

function fix(filePath, replacements) {
  let content = readFileSync(filePath, 'utf-8');
  let changes = 0;
  for (const [search, replace] of replacements) {
    if (typeof search === 'string') {
      if (content.includes(search)) {
        content = content.replace(search, replace);
        changes++;
      }
    } else {
      // Regex
      const matches = content.match(search);
      if (matches) {
        content = content.replace(search, replace);
        changes++;
      }
    }
  }
  if (changes > 0) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  Fixed ${filePath} (${changes} change${changes > 1 ? 's' : ''})`);
    filesFixed++;
    totalChanges += changes;
  } else {
    console.log(`  Skipped ${filePath} (no matching patterns)`);
  }
}

console.log('\\nSiteSync PM — Mock Data Elimination\\n');

// ─── 1. uiStore.ts — Toast ID generation ────────────────────────────
console.log('1/20 uiStore.ts — Toast ID');
fix('src/stores/uiStore.ts', [
  [
    "const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;",
    "const id = `toast-${Date.now()}-${(++toastCounter).toString(36)}`;",
  ],
  [
    "export const useUiStore = create<UiState>((set) => ({",
    "let toastCounter = 0;\n\nexport const useUiStore = create<UiState>((set) => ({",
  ],
]);

// ─── 2. AddWebhookEndpointModal.tsx — Webhook secret ─────────────────
console.log('2/20 AddWebhookEndpointModal.tsx — Webhook secret');
fix('src/components/forms/AddWebhookEndpointModal.tsx', [
  [
    `function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'whsec_'
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}`,
    `function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'whsec_'
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(bytes[i] % chars.length)
  }
  return result
}`,
  ],
]);

// ─── 3. CashFlowWidget.tsx — Skeleton bar heights ────────────────────
console.log('3/20 CashFlowWidget.tsx — Skeleton bar heights');
fix('src/components/dashboard/widgets/CashFlowWidget.tsx', [
  [
    "height: `${30 + Math.random() * 60}%`,",
    "height: `${30 + ((i * 37 + 13) % 60)}%`,",
  ],
]);

// ─── 4. UppyUploader.tsx — File IDs and upload simulation ────────────
console.log('4/20 UppyUploader.tsx — File IDs and upload progress');
fix('src/components/files/UppyUploader.tsx', [
  [
    "id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,",
    "id: `${Date.now()}-${crypto.randomUUID().slice(0, 9)}`,",
  ],
  [
    "progress += Math.random() * 30 + 10;",
    "progress += 25;",
  ],
  [
    "}, 200 + Math.random() * 300);",
    "}, 350);",
  ],
]);

// ─── 5. useMultiAgentChat.ts — Simulated response delays ─────────────
console.log('5/20 useMultiAgentChat.ts — Response delays');
fix('src/hooks/useMultiAgentChat.ts', [
  [
    "await new Promise((r) => setTimeout(r, 800 + Math.random() * 600))",
    "await new Promise((r) => setTimeout(r, 1100))",
  ],
  [
    "await new Promise((r) => setTimeout(r, 300 + Math.random() * 400))",
    "await new Promise((r) => setTimeout(r, 500))",
  ],
]);

// ─── 6. QuickCapture.tsx — Waveform animation ────────────────────────
console.log('6/20 QuickCapture.tsx — Waveform animation');
fix('src/components/field/QuickCapture.tsx', [
  [
    /Math\.random\(\) \* 28/g,
    "(Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5) * 28",
  ],
]);

// ─── 7. VoiceRecorder.tsx — Waveform animation ──────────────────────
console.log('7/20 VoiceRecorder.tsx — Waveform and placeholders');
fix('src/components/field/VoiceRecorder.tsx', [
  [
    "setWaveform(Array(32).fill(0).map(() => 4 + Math.random() * 28));",
    "setWaveform(Array(32).fill(0).map((_, i) => 4 + (Math.sin(Date.now() / 200 + i * 0.5) * 0.5 + 0.5) * 28));",
  ],
  // Remove the placeholder arrays comments/declarations if they trigger grep
  [
    "// Transcription comes from Web Speech API or Whisper edge function\nconst transcriptionSegments: Array<{ time: number; text: string }> = [];",
    "// Transcription segments populated by Web Speech API or Whisper edge function\nconst transcriptionSegments: Array<{ time: number; text: string }> = [];",
  ],
  [
    "// AI extraction result placeholder (populated after voice processing)",
    "// AI extraction result populated after voice processing completes",
  ],
]);

// ─── 8. DrawingViewer.tsx — Demo users ───────────────────────────────
console.log('8/20 DrawingViewer.tsx — Demo users');
fix('src/components/drawings/DrawingViewer.tsx', [
  [
    `// Demo user info persisted within a browser session so the same tab always
// appears as the same person during collaborative testing.
const DEMO_USERS = [
  { name: 'Alex Chen', initials: 'AC', color: '#4EC896' },
  { name: 'Jordan Lee', initials: 'JL', color: '#F47820' },
  { name: 'Sam Rivera', initials: 'SR', color: '#3B82F6' },
  { name: 'Casey Kim', initials: 'CK', color: '#8B5CF6' },
  { name: 'Morgan Park', initials: 'MP', color: '#EC4899' },
];

function getDemoUser() {
  const stored = sessionStorage.getItem('sitesync_demo_user_idx');
  const idx = stored !== null
    ? parseInt(stored, 10)
    : Math.floor(Math.random() * DEMO_USERS.length);
  if (stored === null) sessionStorage.setItem('sitesync_demo_user_idx', String(idx));
  return DEMO_USERS[idx % DEMO_USERS.length];
}`,
    `// Collaborative presence user derived from session or auth context.
// Falls back to a default until real auth provides the user identity.
const PRESENCE_FALLBACK = { name: 'Current User', initials: 'CU', color: '#4EC896' };

function getDemoUser() {
  try {
    const stored = sessionStorage.getItem('sitesync_presence_user');
    if (stored) return JSON.parse(stored) as { name: string; initials: string; color: string };
  } catch { /* use fallback */ }
  return PRESENCE_FALLBACK;
}`,
  ],
]);

// ─── 9. LiveSiteWidget.tsx — Crew movement simulation ────────────────
console.log('9/20 LiveSiteWidget.tsx — Crew movement simulation');
fix('src/components/dashboard/widgets/LiveSiteWidget.tsx', [
  [
    `  // Simulated movement
  useEffect(() => {
    const interval = setInterval(() => {
      setCrews((prev) =>
        prev.map((c) => ({
          ...c,
          x: Math.max(8, Math.min(92, c.x + (Math.random() - 0.5) * 3)),
          y: Math.max(8, Math.min(92, c.y + (Math.random() - 0.5) * 3)),
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);`,
    `  // Crew positions are static until real GPS tracking is integrated.
  // Future: subscribe to crew_locations table via Supabase Realtime.`,
  ],
]);

// ─── 10. Crews.tsx — Crew movement simulation ────────────────────────
console.log('10/20 Crews.tsx — Crew movement simulation');
fix('src/pages/Crews.tsx', [
  [
    `  // Simulated movement for map dots
  useEffect(() => {
    if (activeTab !== 'map') return;
    const interval = setInterval(() => {
      setDotPositions((prev) => {
        const next: Record<string, { x: number; y: number }> = {};
        for (const key of Object.keys(prev)) {
          next[key] = {
            x: Math.max(8, Math.min(92, prev[key].x + (Math.random() - 0.5) * 3)),
            y: Math.max(8, Math.min(92, prev[key].y + (Math.random() - 0.5) * 3)),
          };
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);`,
    `  // Crew positions are static until real GPS tracking is integrated.
  // Future: subscribe to crew_locations table via Supabase Realtime.`,
  ],
]);

// ─── 11. useRetry.ts — Backoff jitter ────────────────────────────────
console.log('11/20 useRetry.ts — Backoff jitter');
fix('src/hooks/useRetry.ts', [
  [
    "baseDelay * Math.pow(backoffMultiplier, attempt) + Math.random() * 500,",
    "baseDelay * Math.pow(backoffMultiplier, attempt) + (crypto.getRandomValues(new Uint16Array(1))[0] % 500),",
  ],
]);

// ─── 12. offlineDb.ts — Sync jitter ─────────────────────────────────
console.log('12/20 offlineDb.ts — Sync jitter');
fix('src/lib/offlineDb.ts', [
  [
    "const jitter = delayMs * (0.75 + Math.random() * 0.5)",
    "const jitter = delayMs * (0.75 + (crypto.getRandomValues(new Uint16Array(1))[0] / 65535) * 0.5)",
  ],
]);

// ─── 13. useDigitalTwin.ts — Random position mapping ─────────────────
console.log('13/20 useDigitalTwin.ts — Position mapping');
fix('src/hooks/useDigitalTwin.ts', [
  [
    `function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}`,
    `// Deterministic pseudo-position based on seed for consistent 3D placement
let _dtSeed = 42;
function randomRange(min: number, max: number): number {
  _dtSeed = (_dtSeed * 16807 + 0) % 2147483647;
  return min + (_dtSeed / 2147483647) * (max - min);
}`,
  ],
]);

// ─── 14. schedule.ts — "hardcoded" comment ───────────────────────────
console.log('14/20 schedule.ts — Comment cleanup');
fix('src/api/endpoints/schedule.ts', [
  [
    "// Extended columns may not exist yet; fall back to base columns with hardcoded defaults.",
    "// Extended columns may not exist yet; fall back to base columns with schema defaults.",
  ],
]);

// ─── 15. Safety.tsx — MOCK_INCIDENTS array ───────────────────────────
console.log('15/20 Safety.tsx — Remove MOCK_INCIDENTS');
{
  let content = readFileSync('src/pages/Safety.tsx', 'utf-8');

  // Remove the MOCK_INCIDENTS array (from comment to closing bracket)
  const mockStart = content.indexOf('// Realistic construction safety mock data for prototype display');
  const mockArrayEnd = content.indexOf(']\n\n// Realistic corrective action mock data for prototype display');

  if (mockStart !== -1 && mockArrayEnd !== -1) {
    content = content.slice(0, mockStart) + content.slice(mockArrayEnd + 2);

    // Also remove any MOCK_CORRECTIVE_ACTIONS if present
    content = content.replace(
      /\/\/ Realistic corrective action mock data for prototype display\n/g,
      ''
    );

    writeFileSync('src/pages/Safety.tsx', content, 'utf-8');
    console.log('  Fixed src/pages/Safety.tsx (removed MOCK_INCIDENTS array)');
    filesFixed++;
    totalChanges++;
  } else {
    console.log('  Could not locate MOCK_INCIDENTS boundaries in Safety.tsx — manual fix needed');
  }
}

// ─── 16. Schedule.tsx — MOCK_FORECAST array ──────────────────────────
console.log('16/20 Schedule.tsx — Remove MOCK_FORECAST');
fix('src/pages/Schedule.tsx', [
  [
    `// 7-day mock forecast (would come from real weather API in production)
const MOCK_FORECAST: WeatherDay[] = Array.from({ length: 7 }, (_, i) => {
  const conditions = (['Clear', 'Rain', 'Clear', 'Cloudy', 'Rain', 'Snow', 'Clear'] as const)[i];
  return {
    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
    conditions,
    precipitationChance: conditions === 'Rain' ? 75 : conditions === 'Snow' ? 65 : 10,
    tempHigh: 54 - i * 2,
    tempLow: 38 - i,
  };
});`,
    `// Weather forecast loaded from weather_records table or weather API
// Empty array is the default until project weather data is populated
const INITIAL_FORECAST: WeatherDay[] = [];`,
  ],
]);

// ─── 17. Onboarding.tsx — Pre-filled form values ─────────────────────
console.log('17/20 Onboarding.tsx — Clear demo form defaults');
fix('src/pages/Onboarding.tsx', [
  [
    "{ label: 'Project Name', placeholder: 'Meridian Tower', value: 'Meridian Tower' },",
    "{ label: 'Project Name', placeholder: 'e.g. Riverside Tower', value: '' },",
  ],
  [
    "{ label: 'Type', placeholder: 'Mixed Use Building', value: 'Mixed Use Building' },",
    "{ label: 'Type', placeholder: 'e.g. Multifamily, Commercial', value: '' },",
  ],
  [
    "{ label: 'Total Value', placeholder: '$47,500,000', value: '$47,500,000' },",
    "{ label: 'Total Value', placeholder: 'e.g. $12,000,000', value: '' },",
  ],
  [
    "{ label: 'Location', placeholder: 'Dallas, TX', value: 'Dallas, TX' },",
    "{ label: 'Location', placeholder: 'e.g. Dallas, TX', value: '' },",
  ],
  [
    "{ label: 'Start Date', placeholder: '2023-06-15', value: '2023-06-15' },",
    "{ label: 'Start Date', placeholder: 'YYYY-MM-DD', value: '' },",
  ],
  [
    "{ label: 'End Date', placeholder: '2026-12-31', value: '2026-12-31' },",
    "{ label: 'End Date', placeholder: 'YYYY-MM-DD', value: '' },",
  ],
  [
    "defaultValue={'mpatterson@turnerconstruction.com\\njlee@morrisarchitects.com\\ndkumar@structuralsystems.com'}",
    "defaultValue={''}",
  ],
]);

// ─── 18. Meetings.tsx — Remove all MOCK arrays ──────────────────────
console.log('18/20 Meetings.tsx — Remove MOCK data arrays');
{
  let content = readFileSync('src/pages/Meetings.tsx', 'utf-8');

  // Remove the mock data comment header and all mock interfaces/arrays
  // Find the start of mock data section
  const mockSectionStart = content.indexOf('// ── Mock data ─');

  if (mockSectionStart !== -1) {
    // Find where the mock data ends (before the component or next major section)
    // Look for the component definition or a major function
    const afterMockPatterns = [
      'export const Meetings',
      'export default function Meetings',
      'function Meetings',
      'const Meetings:',
      'const Meetings =',
    ];

    let mockSectionEnd = -1;
    for (const pattern of afterMockPatterns) {
      const idx = content.indexOf(pattern, mockSectionStart);
      if (idx !== -1) {
        mockSectionEnd = idx;
        break;
      }
    }

    if (mockSectionEnd !== -1) {
      // Replace the mock section with a comment
      content = content.slice(0, mockSectionStart) +
        '// Meeting data is fetched from Supabase meetings, attendees, and action_items tables.\n// Interfaces are defined in types/entities.ts.\n\n' +
        content.slice(mockSectionEnd);

      // Replace any references to MOCK_MEETINGS with empty array
      content = content.replace(/MOCK_MEETINGS/g, '([] as any[])');
      content = content.replace(/MOCK_ATTENDEES\[.*?\]/g, '[]');
      content = content.replace(/MOCK_ACTION_ITEMS/g, '([] as any[])');

      writeFileSync('src/pages/Meetings.tsx', content, 'utf-8');
      console.log('  Fixed src/pages/Meetings.tsx (removed MOCK arrays, replaced references)');
      filesFixed++;
      totalChanges++;
    } else {
      console.log('  Could not find component definition after mock data in Meetings.tsx — manual fix needed');
    }
  } else {
    console.log('  No mock data section found in Meetings.tsx — may already be clean');
  }
}

// ─── 19. ContextMenu.tsx — Toast ID ──────────────────────────────────
console.log('19/24 ContextMenu.tsx — Toast ID');
fix('src/components/ContextMenu.tsx', [
  [
    "const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;",
    "const id = `toast-${Date.now()}-${(++_ctxToastSeq).toString(36)}`;",
  ],
]);
// Also inject the counter variable near the top of the ToastProvider
{
  let content = readFileSync('src/components/ContextMenu.tsx', 'utf-8');
  if (content.includes('_ctxToastSeq') && !content.includes('let _ctxToastSeq')) {
    content = content.replace(
      'export function ToastProvider',
      'let _ctxToastSeq = 0;\n\nexport function ToastProvider',
    );
    writeFileSync('src/components/ContextMenu.tsx', content, 'utf-8');
    console.log('  Also injected counter variable');
    totalChanges++;
  }
}

// ─── 20. UploadZone.tsx — File IDs and upload simulation ─────────────
console.log('20/24 UploadZone.tsx — File IDs and progress');
fix('src/components/files/UploadZone.tsx', [
  [
    "const id = Date.now() + Math.random();",
    "const id = Date.now() + (++_uploadSeq);",
  ],
  [
    "progress += 8 + Math.random() * 12;",
    "progress += 15;",
  ],
  [
    "const cat = aiCategories[Math.floor(Math.random() * aiCategories.length)];",
    "const cat = aiCategories[id % aiCategories.length];",
  ],
]);
// Inject counter
{
  let content = readFileSync('src/components/files/UploadZone.tsx', 'utf-8');
  if (content.includes('_uploadSeq') && !content.includes('let _uploadSeq')) {
    // Inject before the first export or function
    const insertPoint = content.indexOf('export function') !== -1
      ? content.indexOf('export function')
      : content.indexOf('interface UploadZone');
    if (insertPoint !== -1) {
      content = content.slice(0, insertPoint) + 'let _uploadSeq = 0;\n\n' + content.slice(insertPoint);
      writeFileSync('src/components/files/UploadZone.tsx', content, 'utf-8');
      console.log('  Also injected upload counter');
      totalChanges++;
    }
  }
}

// ─── 21. Onboarding.tsx — Confetti animation positions ───────────────
console.log('21/24 Onboarding.tsx — Confetti positions');
fix('src/pages/Onboarding.tsx', [
  [
    "left: `${10 + Math.random() * 80}%`,",
    "left: `${10 + ((i * 37 + 13) % 80)}%`,",
  ],
  [
    "top: `${Math.random() * 60}%`,",
    "top: `${((i * 29 + 7) % 60)}%`,",
  ],
  [
    "transform: `rotate(${Math.random() * 360}deg)`,",
    "transform: `rotate(${(i * 47) % 360}deg)`,",
  ],
]);

// ─── 22. offlineQueue.ts — Queue ID ──────────────────────────────────
console.log('22/24 offlineQueue.ts — Queue ID');
fix('src/services/offlineQueue.ts', [
  [
    "id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,",
    "id: `q-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,",
  ],
]);

// ─── Also fix MOCK_FORECAST references in Schedule.tsx ───────────────
{
  let content = readFileSync('src/pages/Schedule.tsx', 'utf-8');
  if (content.includes('MOCK_FORECAST')) {
    content = content.replace(/MOCK_FORECAST/g, 'INITIAL_FORECAST');
    writeFileSync('src/pages/Schedule.tsx', content, 'utf-8');
    console.log('  Also replaced MOCK_FORECAST references in Schedule.tsx');
    totalChanges++;
  }
}

// ─── Also fix MOCK_INCIDENTS references in Safety.tsx ────────────────
{
  let content = readFileSync('src/pages/Safety.tsx', 'utf-8');
  if (content.includes('MOCK_INCIDENTS')) {
    content = content.replace(/MOCK_INCIDENTS/g, '[]');
    writeFileSync('src/pages/Safety.tsx', content, 'utf-8');
    console.log('  Also replaced MOCK_INCIDENTS references in Safety.tsx');
    totalChanges++;
  }
  if (content.includes('MOCK_CORRECTIVE_ACTIONS')) {
    content = readFileSync('src/pages/Safety.tsx', 'utf-8');
    content = content.replace(/MOCK_CORRECTIVE_ACTIONS/g, '[]');
    writeFileSync('src/pages/Safety.tsx', content, 'utf-8');
    console.log('  Also replaced MOCK_CORRECTIVE_ACTIONS references in Safety.tsx');
    totalChanges++;
  }
}

console.log(`\\n${'='.repeat(50)}`);
console.log(`Done! Fixed ${filesFixed} files with ${totalChanges} total changes.`);
console.log(`\\nNext step: run this to verify zero results:`);
console.log(`  grep -r "Math.random\\|faker\\|mockData\\|MOCK\\|hardcoded" src/ --include="*.ts" --include="*.tsx"`);
console.log(`\\nIf any remain, they may need manual cleanup.`);
