import React, { useState } from 'react';
import {
  FileQuestion,
  FileCheck,
  DollarSign,
  AlertCircle,
  PenTool,
  Calendar,
  Users,
  FileText,
  CreditCard,
  ShieldAlert,
  Plus,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { colors, spacing, typography
} from '../../styles/theme';

// ── Types ────────────────────────────────────────────────

export type EntityType =
  | 'rfi'
  | 'submittal'
  | 'change_order'
  | 'punch_item'
  | 'daily_log'
  | 'drawing'
  | 'meeting'
  | 'contract'
  | 'pay_app'
  | 'safety_incident';

export interface LinkedItem {
  type: EntityType;
  id: string;
  number: string | number;
  title: string;
  status: string;
  date?: string;
}

interface LinkedEntitiesProps {
  links: LinkedItem[];
  onNavigate?: (type: string, id: string) => void;
  onAdd?: () => void;
  compact?: boolean;
}

// ── Config ───────────────────────────────────────────────

const ENTITY_CONFIG: Record<EntityType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  rfi:             { label: 'RFIs',             icon: FileQuestion, color: '#7C3AED', bg: '#F3EEFF' },
  submittal:       { label: 'Submittals',       icon: FileCheck,    color: '#0D9488', bg: '#ECFDF5' },
  change_order:    { label: 'Change Orders',    icon: DollarSign,   color: '#D97706', bg: '#FFFBEB' },
  punch_item:      { label: 'Punch Items',      icon: AlertCircle,  color: '#DC2626', bg: '#FEF2F2' },
  daily_log:       { label: 'Daily Logs',       icon: Calendar,     color: '#2563EB', bg: '#EFF6FF' },
  drawing:         { label: 'Drawings',         icon: PenTool,      color: '#2563EB', bg: '#EFF6FF' },
  meeting:         { label: 'Meetings',         icon: Users,        color: '#7C3AED', bg: '#F3EEFF' },
  contract:        { label: 'Contracts',        icon: FileText,     color: '#059669', bg: '#ECFDF5' },
  pay_app:         { label: 'Pay Apps',         icon: CreditCard,   color: '#D97706', bg: '#FFFBEB' },
  safety_incident: { label: 'Safety Incidents', icon: ShieldAlert,  color: '#DC2626', bg: '#FEF2F2' },
};

// ── Helpers ──────────────────────────────────────────────

function groupByType(links: LinkedItem[]): Map<EntityType, LinkedItem[]> {
  const map = new Map<EntityType, LinkedItem[]>();
  for (const link of links) {
    const list = map.get(link.type) ?? [];
    list.push(link);
    map.set(link.type, list);
  }
  return map;
}

function statusColor(status: string): { text: string; bg: string } {
  const s = status.toLowerCase();
  if (s.includes('open') || s.includes('active') || s.includes('approved')) return { text: '#059669', bg: '#ECFDF5' };
  if (s.includes('closed') || s.includes('complete')) return { text: '#6B7280', bg: '#F3F4F6' };
  if (s.includes('pending') || s.includes('review')) return { text: '#D97706', bg: '#FFFBEB' };
  if (s.includes('reject') || s.includes('overdue')) return { text: '#DC2626', bg: '#FEF2F2' };
  return { text: '#6B7280', bg: '#F3F4F6' };
}

// ── Component ────────────────────────────────────────────

export const LinkedEntities: React.FC<LinkedEntitiesProps> = ({ links, onNavigate, onAdd, compact = false }) => {
  const [collapsed, setCollapsed] = useState<Set<EntityType>>(new Set());
  const grouped = groupByType(links);

  const toggleGroup = (type: EntityType) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) { next.delete(type) } else { next.add(type) }
      return next;
    });
  };

  // ── Compact mode ─────────────────────────────────────
  if (compact) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['1.5'], alignItems: 'center' }}>
        {links.map((link) => {
          const cfg = ENTITY_CONFIG[link.type];
          const Icon = cfg.icon;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate?.(link.type, link.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `${spacing['0.5']} ${spacing['2']}`,
                background: cfg.bg, color: cfg.color, border: 'none', borderRadius: '9999px',
                fontSize: typography.fontSize?.xs ?? '12px', fontWeight: 500,
                cursor: onNavigate ? 'pointer' : 'default', whiteSpace: 'nowrap',
              }}
            >
              <Icon size={12} />
              <span>#{link.number}</span>
            </button>
          );
        })}
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['0.5']} ${spacing['2']}`,
              background: colors.surfaceInset, color: colors.textSecondary,
              border: `1px dashed ${colors.borderDefault}`, borderRadius: '9999px',
              fontSize: typography.fontSize?.xs ?? '12px', cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Link
          </button>
        )}
      </div>
    );
  }

  // ── Full mode ────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <Link2 size={16} color={colors.textSecondary} />
          <span style={{ fontSize: typography.fontSize?.sm ?? '14px', fontWeight: 600, color: colors.textPrimary }}>
            Linked Entities
          </span>
          <span style={{
            fontSize: typography.fontSize?.xs ?? '12px', fontWeight: 500,
            background: colors.surfaceInset, color: colors.textSecondary,
            padding: `${spacing['0.5']} ${spacing['2']}`, borderRadius: '9999px',
          }}>
            {links.length}
          </span>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
              padding: `${spacing['1']} ${spacing['3']}`,
              background: 'transparent', color: colors.textSecondary,
              border: `1px solid ${colors.borderDefault}`, borderRadius: '6px',
              fontSize: typography.fontSize?.xs ?? '12px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Link Entity
          </button>
        )}
      </div>

      {/* Grouped sections */}
      {Array.from(grouped.entries()).map(([type, items]) => {
        const cfg = ENTITY_CONFIG[type];
        const Icon = cfg.icon;
        const isCollapsed = collapsed.has(type);
        const Toggle = isCollapsed ? ChevronDown : ChevronUp;

        return (
          <div key={type} style={{ border: `1px solid ${colors.borderSubtle}`, borderRadius: '8px', overflow: 'hidden' }}>
            {/* Group header */}
            <button
              onClick={() => toggleGroup(type)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['2']} ${spacing['3']}`,
                background: cfg.bg, border: 'none', cursor: 'pointer',
              }}
            >
              <Icon size={14} color={cfg.color} />
              <span style={{ fontSize: typography.fontSize?.xs ?? '12px', fontWeight: 600, color: cfg.color, flex: 1, textAlign: 'left' }}>
                {cfg.label}
              </span>
              <span style={{
                fontSize: '11px', fontWeight: 600, color: colors.white,
                background: cfg.color, borderRadius: '9999px',
                padding: `0 ${spacing['1.5']}`, minWidth: '20px', textAlign: 'center', lineHeight: '20px',
              }}>
                {items.length}
              </span>
              <Toggle size={14} color={cfg.color} />
            </button>

            {/* Items */}
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((item, idx) => {
                  const sc = statusColor(item.status);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate?.(item.type, item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: `${spacing['2']} ${spacing['3']}`,
                        background: 'transparent', border: 'none', cursor: onNavigate ? 'pointer' : 'default',
                        borderTop: idx > 0 ? `1px solid ${colors.borderSubtle}` : 'none',
                        width: '100%', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: typography.fontSize?.xs ?? '12px', fontWeight: 600, color: cfg.color, whiteSpace: 'nowrap' }}>
                        #{item.number}
                      </span>
                      <span style={{
                        fontSize: typography.fontSize?.xs ?? '12px', color: colors.textPrimary,
                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 500, color: sc.text, background: sc.bg,
                        padding: `${spacing['0.5']} ${spacing['2']}`, borderRadius: '9999px', whiteSpace: 'nowrap',
                      }}>
                        {item.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
