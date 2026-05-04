import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Leaf } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fromTable } from '../../lib/db/queries'
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

// ────────────────────────────────────────────────────────────────
// Carbon Footprint — CO2 KPI sourced from project_carbon_entries,
// with a 12-week sparkline of cumulative kg CO2e. Falls back to
// estimating from deliveries × carbon_factors when entries are empty.
// ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string | undefined;
}

interface CarbonEntry {
  carbon_kg: number;
  created_at: string;
}

interface CarbonFactor {
  id: string;
  material_name: string;
  embodied_carbon_kg_per_unit: number;
  unit: string;
}

interface DeliveryRow {
  actual_date: string | null;
  created_at: string;
  items: unknown;
}

interface DeliveryItem {
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
}

function extractDeliveryItems(raw: unknown): DeliveryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is DeliveryItem => !!x && typeof x === 'object');
}

function useCarbonData(projectId: string | undefined) {
  return useQuery({
    queryKey: ['carbon_dashboard', projectId],
    queryFn: async () => {
      if (!projectId) return { entries: [] as CarbonEntry[], fallbackTotal: 0 };

      const entriesRes = await fromTable('project_carbon_entries')
        .select('carbon_kg, created_at')
        .eq('project_id' as never, projectId)
        .order('created_at', { ascending: true });

      const entries = ((entriesRes.data ?? []) as CarbonEntry[]).filter((e) => typeof e.carbon_kg === 'number');

      if (entries.length > 0) {
        return { entries, fallbackTotal: 0 };
      }

      // Fallback: estimate from deliveries.items matched against carbon_factors.
      const [deliveriesRes, factorsRes] = await Promise.all([
        fromTable('deliveries').select('actual_date, created_at, items').eq('project_id' as never, projectId),
        fromTable('carbon_factors').select('id, material_name, embodied_carbon_kg_per_unit, unit'),
      ]);

      const deliveries = (deliveriesRes.data ?? []) as DeliveryRow[];
      const factors = (factorsRes.data ?? []) as CarbonFactor[];

      let fallbackTotal = 0;
      const derived: CarbonEntry[] = [];
      for (const d of deliveries) {
        const items = extractDeliveryItems(d.items);
        for (const item of items) {
          const label = (item.name ?? item.description ?? '').toLowerCase();
          const factor = factors.find((f) => label && label.includes(f.material_name.toLowerCase().split(' ')[0]));
          const qty = typeof item.quantity === 'number' ? item.quantity : 0;
          if (!factor || qty <= 0) continue;
          const carbonKg = qty * factor.embodied_carbon_kg_per_unit;
          fallbackTotal += carbonKg;
          derived.push({ carbon_kg: carbonKg, created_at: d.actual_date ?? d.created_at });
        }
      }
      derived.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return { entries: derived, fallbackTotal };
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

function formatKg(kg: number): { value: string; unit: string } {
  if (kg >= 1_000_000) return { value: (kg / 1_000_000).toFixed(1), unit: 'kt CO₂e' };
  if (kg >= 1_000) return { value: (kg / 1_000).toFixed(1), unit: 't CO₂e' };
  return { value: Math.round(kg).toString(), unit: 'kg CO₂e' };
}

interface Sparkpoint { x: number; y: number; }

function buildSparkline(entries: CarbonEntry[], width: number, height: number, now: number): { points: Sparkpoint[]; path: string; area: string } {
  if (entries.length === 0) return { points: [], path: '', area: '' };
  // Bucket by ISO week for the last 12 weeks.
  const WEEKS = 12;
  const msPerWeek = 7 * 86400000;
  const buckets = new Array<number>(WEEKS).fill(0);
  for (const e of entries) {
    const t = new Date(e.created_at).getTime();
    if (!Number.isFinite(t)) continue;
    const weeksAgo = Math.floor((now - t) / msPerWeek);
    if (weeksAgo < 0 || weeksAgo >= WEEKS) continue;
    const idx = WEEKS - 1 - weeksAgo;
    buckets[idx] += e.carbon_kg;
  }
  // Cumulative
  const cum: number[] = [];
  let running = 0;
  for (const v of buckets) { running += v; cum.push(running); }
  const max = Math.max(...cum, 1);
  const points: Sparkpoint[] = cum.map((v, i) => ({
    x: (i / Math.max(1, WEEKS - 1)) * width,
    y: height - (v / max) * height,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  return { points, path, area };
}

export const DashboardCarbon: React.FC<Props> = ({ projectId }) => {
  const { data, isLoading } = useCarbonData(projectId);
  const entries = data?.entries ?? [];
  const [now] = useState(() => Date.now());

  const total = useMemo(() => entries.reduce((s, e) => s + (e.carbon_kg ?? 0), 0), [entries]);
  const formatted = formatKg(total);

  // Last 7d change
  const change = useMemo(() => {
    const dayAgo = now - 7 * 86400000;
    const recent = entries.filter((e) => new Date(e.created_at).getTime() > dayAgo).reduce((s, e) => s + e.carbon_kg, 0);
    return recent;
  }, [entries, now]);

  const WIDTH = 180;
  const HEIGHT = 40;
  const spark = useMemo(() => buildSparkline(entries, WIDTH, HEIGHT, now), [entries, now]);

  const showSetup = !isLoading && total === 0;

  return (
    <div style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Leaf size={12} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Carbon Footprint
          </span>
        </div>
        {change > 0 && (
          <span style={{ fontSize: '10px', color: colors.statusPending, fontWeight: typography.fontWeight.semibold }}>
            +{formatKg(change).value}{formatKg(change).unit.split(' ')[0]} this week
          </span>
        )}
      </div>

      {showSetup ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing['2'],
          padding: spacing['3'], backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.md, color: colors.textSecondary, fontSize: typography.fontSize.sm,
        }}>
          <Leaf size={14} />
          <span>No carbon data yet. Log material deliveries to begin tracking.</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: spacing['1.5'], marginBottom: spacing['2'] }}>
            <span style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {formatted.value}
            </span>
            <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
              {formatted.unit}
            </span>
          </div>
          <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.statusActive} stopOpacity="0.25" />
                <stop offset="100%" stopColor={colors.statusActive} stopOpacity="0" />
              </linearGradient>
            </defs>
            {spark.area && <path d={spark.area} fill="url(#carbonGrad)" />}
            {spark.path && <path d={spark.path} fill="none" stroke={colors.statusActive} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: spacing['1'] }}>
            Cumulative · last 12 weeks
          </div>
        </>
      )}
    </div>
  );
};

DashboardCarbon.displayName = 'DashboardCarbon';
