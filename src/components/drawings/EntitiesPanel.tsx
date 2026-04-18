// Phase 7 — EntitiesPanel
// Displays AI-detected entities (doors, windows, fixtures, dimensions, etc.)
// on a drawing. Grouped by category with counts, clickable for zoom-to-location,
// with optional revision comparison and cross-project search.

import React, { useMemo, useState } from 'react';
import {
  DoorOpen,
  Square,
  Ruler,
  Flame,
  Lightbulb,
  Droplet,
  Wind,
  Search,
  ChevronDown,
  ChevronRight,
  GitCompare,
  X,
} from 'lucide-react';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { supabase } from '../../lib/supabase';

export interface DetectedEntity {
  id: string;
  category: string;
  label: string;
  // Normalized bbox on the drawing, 0..1 in each axis so zoom works across
  // rendered viewport sizes.
  bbox?: { x: number; y: number; width: number; height: number };
  page_number?: number;
  attributes?: Record<string, string | number | boolean | null>;
  confidence?: number;
  rating?: string; // e.g. "60min" for fire rating
}

export interface RevisionEntitySnapshot {
  label: string; // e.g. "Revision B"
  entities: DetectedEntity[];
}

interface EntitiesPanelProps {
  drawingId?: string;
  projectId?: string;
  entities: DetectedEntity[];
  /** When provided, shows a diff against the current set. */
  comparison?: RevisionEntitySnapshot;
  onEntityClick?: (entity: DetectedEntity) => void;
  /** Cross-drawing search scope. When projectId is set, search queries the project. */
  enableGlobalSearch?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  doors: <DoorOpen size={14} />,
  windows: <Square size={14} />,
  dimensions: <Ruler size={14} />,
  fire_rated: <Flame size={14} />,
  lighting: <Lightbulb size={14} />,
  plumbing: <Droplet size={14} />,
  hvac: <Wind size={14} />,
  fixtures: <Lightbulb size={14} />,
};

function categoryLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupByCategory(entities: DetectedEntity[]): Map<string, DetectedEntity[]> {
  const map = new Map<string, DetectedEntity[]>();
  for (const e of entities) {
    const key = e.category || 'other';
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return map;
}

function diffCounts(
  current: DetectedEntity[],
  previous: DetectedEntity[],
): Array<{ category: string; currentCount: number; previousCount: number; delta: number }> {
  const cur = groupByCategory(current);
  const prev = groupByCategory(previous);
  const cats = new Set([...cur.keys(), ...prev.keys()]);
  return Array.from(cats)
    .map((category) => {
      const currentCount = cur.get(category)?.length ?? 0;
      const previousCount = prev.get(category)?.length ?? 0;
      return { category, currentCount, previousCount, delta: currentCount - previousCount };
    })
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export const EntitiesPanel: React.FC<EntitiesPanelProps> = ({
  drawingId,
  projectId,
  entities,
  comparison,
  onEntityClick,
  enableGlobalSearch = false,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [globalHits, setGlobalHits] = useState<DetectedEntity[] | null>(null);
  const [searching, setSearching] = useState(false);

  const grouped = useMemo(() => {
    const src = entities.filter((e) =>
      query ? e.label.toLowerCase().includes(query.toLowerCase()) || e.category.toLowerCase().includes(query.toLowerCase()) : true,
    );
    return Array.from(groupByCategory(src).entries()).sort((a, b) => b[1].length - a[1].length);
  }, [entities, query]);

  const revisionDiff = useMemo(
    () => (comparison ? diffCounts(entities, comparison.entities) : []),
    [entities, comparison],
  );

  const toggle = (cat: string) => setExpanded((p) => ({ ...p, [cat]: !p[cat] }));

  const runGlobalSearch = async () => {
    if (!projectId || !query.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase.functions.invoke('search-entities', {
        body: { project_id: projectId, query, exclude_drawing_id: drawingId },
      });
      setGlobalHits((data?.results as DetectedEntity[]) ?? []);
    } catch {
      setGlobalHits([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'], height: '100%' }}>
      <div style={{ padding: spacing['3'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
          <Search size={14} color={colors.textSecondary} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={enableGlobalSearch ? 'Search entities (project-wide)…' : 'Filter entities…'}
            style={{
              flex: 1,
              padding: spacing['2'],
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              background: 'transparent',
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
            }}
          />
          {enableGlobalSearch && query && (
            <button
              onClick={runGlobalSearch}
              disabled={searching}
              style={{
                padding: `${spacing['2']} ${spacing['3']}`,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderSubtle}`,
                background: colors.surfaceRaised,
                color: colors.textPrimary,
                fontSize: typography.fontSize.xs,
                cursor: 'pointer',
              }}
            >
              {searching ? '…' : 'Find everywhere'}
            </button>
          )}
        </div>
        <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
          {entities.length} total entit{entities.length === 1 ? 'y' : 'ies'} detected
        </div>
      </div>

      {comparison && revisionDiff.length > 0 && (
        <div style={{ padding: spacing['3'], borderRadius: borderRadius.md, background: colors.statusInfoSubtle, margin: `0 ${spacing['3']}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
            <GitCompare size={14} color={colors.statusInfo} />
            <span style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.statusInfo }}>
              vs {comparison.label}
            </span>
          </div>
          {revisionDiff.map((d) => (
            <div key={d.category} style={{ fontSize: typography.fontSize.xs, color: colors.textPrimary }}>
              {categoryLabel(d.category)}: {d.delta > 0 ? '+' : ''}{d.delta}{' '}
              <span style={{ color: colors.textSecondary }}>
                ({d.previousCount} → {d.currentCount})
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing['3']} ${spacing['3']}` }}>
        {grouped.length === 0 && (
          <div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textSecondary, fontSize: typography.fontSize.sm }}>
            No entities match the current filter.
          </div>
        )}
        {grouped.map(([category, items]) => {
          const isOpen = expanded[category] ?? true;
          return (
            <div key={category} style={{ marginBottom: spacing['2'], border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.md }}>
              <button
                type="button"
                onClick={() => toggle(category)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing['3'],
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textPrimary,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                  {CATEGORY_ICONS[category] ?? <Square size={14} />}
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: 600 }}>{categoryLabel(category)}</span>
                  <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>({items.length})</span>
                </span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
                  {items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEntityClick?.(e)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: `${spacing['2']} ${spacing['3']}`,
                        background: 'transparent',
                        border: 'none',
                        borderTop: `1px solid ${colors.borderSubtle}`,
                        cursor: onEntityClick ? 'pointer' : 'default',
                        color: colors.textPrimary,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: typography.fontSize.sm }}>{e.label}</span>
                      <span style={{ display: 'flex', gap: spacing['2'], fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
                        {e.rating && <span style={{ color: colors.statusPending }}>{e.rating}</span>}
                        {e.page_number != null && <span>p.{e.page_number}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {globalHits && (
          <div style={{ marginTop: spacing['4'] }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['2'] }}>
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: 600, color: colors.textPrimary }}>
                Matches in other drawings ({globalHits.length})
              </span>
              <button
                onClick={() => setGlobalHits(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
                aria-label="Clear cross-drawing results"
              >
                <X size={14} />
              </button>
            </div>
            {globalHits.map((e) => (
              <div
                key={e.id}
                style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}`, fontSize: typography.fontSize.sm, color: colors.textPrimary }}
              >
                {e.label}{' '}
                <span style={{ color: colors.textSecondary, fontSize: typography.fontSize.xs }}>
                  ({categoryLabel(e.category)})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntitiesPanel;
