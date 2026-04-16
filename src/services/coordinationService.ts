import type { MappedSchedulePhase } from '../types/entities';

// ── Types ───────────────────────────────────────────────

export type ConflictUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface TradeConflict {
  id: string;
  phaseA: MappedSchedulePhase;
  phaseB: MappedSchedulePhase;
  overlapStart: string;
  overlapEnd: string;
  overlapDays: number;
  location: string;
  urgency: ConflictUrgency;
  impactIfAFirst: number; // extra days if A goes first
  impactIfBFirst: number; // extra days if B goes first
  historicalNote: string | null;
  suggestedResolution: string;
  suggestedOrder: 'A' | 'B';
  resolved: boolean;
  resolvedAt: string | null;
}

export interface ResolutionHistoryEntry {
  projectName: string;
  tradeA: string;
  tradeB: string;
  resolution: string;
  extraDays: number;
  date: string;
}

export interface ConflictResolution {
  conflictId: string;
  chosenOrder: 'A' | 'B';
  notifyForemen: boolean;
  updateLookahead: boolean;
}

// ── Helpers ─────────────────────────────────────────────

function dateRangeOverlap(
  startA: string, endA: string,
  startB: string, endB: string,
): { overlapStart: string; overlapEnd: string; days: number } | null {
  const sA = new Date(startA + 'T00:00:00');
  const eA = new Date(endA + 'T00:00:00');
  const sB = new Date(startB + 'T00:00:00');
  const eB = new Date(endB + 'T00:00:00');

  const overlapStart = sA > sB ? sA : sB;
  const overlapEnd = eA < eB ? eA : eB;

  if (overlapStart > overlapEnd) return null;

  const days = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
  return {
    overlapStart: overlapStart.toISOString().split('T')[0],
    overlapEnd: overlapEnd.toISOString().split('T')[0],
    days,
  };
}

function computeUrgency(overlapDays: number, daysUntilStart: number, isCriticalPath: boolean): ConflictUrgency {
  if (isCriticalPath && daysUntilStart <= 2) return 'critical';
  if (daysUntilStart <= 3) return 'high';
  if (daysUntilStart <= 7) return 'medium';
  return 'low';
}

function getTradeLabel(phase: MappedSchedulePhase): string {
  return phase.assigned_trade ?? extractTradeFromName(phase.name);
}

function extractTradeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('electrical') || lower.includes('electric')) return 'electrical';
  if (lower.includes('plumbing') || lower.includes('plumb')) return 'plumbing';
  if (lower.includes('mechanical') || lower.includes('hvac') || lower.includes('mech')) return 'mechanical';
  if (lower.includes('concrete')) return 'concrete';
  if (lower.includes('structural') || lower.includes('steel')) return 'structural';
  if (lower.includes('framing') || lower.includes('carpentry') || lower.includes('drywall')) return 'carpentry';
  if (lower.includes('fire') || lower.includes('sprinkler')) return 'fire_protection';
  if (lower.includes('roofing') || lower.includes('roof')) return 'roofing';
  if (lower.includes('painting') || lower.includes('finishing') || lower.includes('finishes')) return 'finishing';
  if (lower.includes('facade') || lower.includes('exterior') || lower.includes('glazing')) return 'glazing';
  if (lower.includes('excavation') || lower.includes('site prep')) return 'excavation';
  return 'general';
}

function getLocationLabel(phaseA: MappedSchedulePhase, phaseB: MappedSchedulePhase): string {
  if (phaseA.location && phaseB.location) {
    if (phaseA.location === phaseB.location) return phaseA.location;
    return `${phaseA.location} / ${phaseB.location}`;
  }
  return phaseA.location ?? phaseB.location ?? 'Same area';
}

function locationsOverlap(a: MappedSchedulePhase, b: MappedSchedulePhase): boolean {
  // If both have locations, check for match
  if (a.location && b.location) {
    return a.location.toLowerCase() === b.location.toLowerCase();
  }
  // If neither has location data, check if trades commonly conflict in same areas
  // (MEP trades typically overlap in ceiling/wall cavities)
  const tradeA = getTradeLabel(a);
  const tradeB = getTradeLabel(b);
  const mepTrades = new Set(['electrical', 'plumbing', 'mechanical', 'fire_protection']);
  if (mepTrades.has(tradeA) && mepTrades.has(tradeB)) return true;

  // Same trade working on overlapping dates is also a conflict
  if (tradeA === tradeB) return false; // same trade won't self-conflict

  return false;
}

// ── Historical Resolution Data ──────────────────────────
// Simulated historical data — in production this comes from the DB

const HISTORICAL_RESOLUTIONS: ResolutionHistoryEntry[] = [
  {
    projectName: 'Johnson Medical Center',
    tradeA: 'electrical',
    tradeB: 'plumbing',
    resolution: 'Plumbing waste rough-in first, then electrical conduit. Aligned with inspection sequence.',
    extraDays: 0,
    date: '2024-08-15',
  },
  {
    projectName: 'Riverside Tower',
    tradeA: 'mechanical',
    tradeB: 'electrical',
    resolution: 'HVAC ductwork installed first (larger cross-section), electrical routed around. Saved 1 day vs reverse.',
    extraDays: 0,
    date: '2024-11-03',
  },
  {
    projectName: 'Parkview Office Complex',
    tradeA: 'mechanical',
    tradeB: 'plumbing',
    resolution: 'Plumbing waste lines first (gravity-dependent), then HVAC duct. Critical for slope maintenance.',
    extraDays: 1,
    date: '2025-01-22',
  },
  {
    projectName: 'Metro Station Expansion',
    tradeA: 'concrete',
    tradeB: 'structural',
    resolution: 'Structural steel erected first, then concrete pour around connections. Avoided rework.',
    extraDays: 0,
    date: '2024-06-10',
  },
  {
    projectName: 'Lakewood School',
    tradeA: 'fire_protection',
    tradeB: 'mechanical',
    resolution: 'Fire protection mains first (code-required clearances), HVAC duct routed around sprinkler mains.',
    extraDays: 0,
    date: '2025-02-14',
  },
  {
    projectName: 'City Center Retail',
    tradeA: 'electrical',
    tradeB: 'mechanical',
    resolution: 'Electrical ran conduit on one side while HVAC installed duct on the other. Parallel work possible with space coordination.',
    extraDays: 0,
    date: '2024-09-28',
  },
];

// ── Trade sequencing priorities ─────────────────────────
// Lower number = should go first when in conflict

const TRADE_PRIORITY: Record<string, number> = {
  concrete: 1,
  structural: 2,
  plumbing: 3,     // Gravity-dependent waste lines must go first
  fire_protection: 4,  // Code-required clearances
  mechanical: 5,
  electrical: 6,
  carpentry: 7,
  finishing: 8,
  glazing: 9,
  roofing: 10,
  general: 11,
};

// ── Service Functions ───────────────────────────────────

export function detectConflicts(phases: MappedSchedulePhase[]): TradeConflict[] {
  const conflicts: TradeConflict[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Only look at non-completed phases
  const activePending = phases.filter(
    (p) => p.status !== 'completed' && (p.percent_complete ?? 0) < 100,
  );

  for (let i = 0; i < activePending.length; i++) {
    for (let j = i + 1; j < activePending.length; j++) {
      const a = activePending[i];
      const b = activePending[j];

      // Must be different trades
      const tradeA = getTradeLabel(a);
      const tradeB = getTradeLabel(b);
      if (tradeA === tradeB) continue;

      // Must overlap in time
      const overlap = dateRangeOverlap(a.startDate, a.endDate, b.startDate, b.endDate);
      if (!overlap) continue;

      // Must overlap in location (or be MEP trades)
      if (!locationsOverlap(a, b)) continue;

      const daysUntilStart = Math.max(
        0,
        Math.ceil((new Date(overlap.overlapStart + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000),
      );

      const isCriticalPath = (a.is_critical_path ?? false) || (b.is_critical_path ?? false);
      const urgency = computeUrgency(overlap.days, daysUntilStart, isCriticalPath);

      // Determine suggested order based on trade priority
      const prioA = TRADE_PRIORITY[tradeA] ?? 99;
      const prioB = TRADE_PRIORITY[tradeB] ?? 99;
      const suggestedOrder: 'A' | 'B' = prioA <= prioB ? 'A' : 'B';

      // Simulate schedule impact
      const impactIfAFirst = prioA <= prioB ? 0 : Math.min(overlap.days, 2);
      const impactIfBFirst = prioB <= prioA ? 0 : Math.min(overlap.days, 2);

      // Look up historical resolution
      const history = getResolutionHistory(tradeA, tradeB);
      const historicalNote = history.length > 0
        ? `On the ${history[0].projectName} project (${history[0].date.slice(0, 4)}), this was resolved by: ${history[0].resolution} Result: ${history[0].extraDays === 0 ? 'no added days' : `+${history[0].extraDays} day${history[0].extraDays > 1 ? 's' : ''}`}.`
        : null;

      const firstTrade = suggestedOrder === 'A' ? tradeA : tradeB;
      const secondTrade = suggestedOrder === 'A' ? tradeB : tradeA;
      const suggestedResolution = `Recommend ${firstTrade} work first, then ${secondTrade}. ${
        historicalNote
          ? 'This aligns with historical resolution data.'
          : `${firstTrade} has higher installation priority based on construction sequencing.`
      } One-tap to notify both foremen and update the lookahead.`;

      conflicts.push({
        id: `conflict-${a.id}-${b.id}`,
        phaseA: a,
        phaseB: b,
        overlapStart: overlap.overlapStart,
        overlapEnd: overlap.overlapEnd,
        overlapDays: overlap.days,
        location: getLocationLabel(a, b),
        urgency,
        impactIfAFirst,
        impactIfBFirst,
        historicalNote,
        suggestedResolution,
        suggestedOrder,
        resolved: false,
        resolvedAt: null,
      });
    }
  }

  // Sort by urgency: critical first, then high, etc.
  const urgencyOrder: Record<ConflictUrgency, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  conflicts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return conflicts;
}

export function getResolutionHistory(tradeA: string, tradeB: string): ResolutionHistoryEntry[] {
  return HISTORICAL_RESOLUTIONS.filter(
    (h) =>
      (h.tradeA === tradeA && h.tradeB === tradeB) ||
      (h.tradeA === tradeB && h.tradeB === tradeA),
  );
}

export function resolveConflict(
  conflicts: TradeConflict[],
  resolution: ConflictResolution,
): TradeConflict[] {
  return conflicts.map((c) =>
    c.id === resolution.conflictId
      ? { ...c, resolved: true, resolvedAt: new Date().toISOString() }
      : c,
  );
}

export { getTradeLabel };
