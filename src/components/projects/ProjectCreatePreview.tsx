// ─────────────────────────────────────────────────────────────────────────────
// ProjectCreatePreview — live cockpit-style card mirroring the form
// ─────────────────────────────────────────────────────────────────────────────
// Renders on the right column of the CreateProject page. Reflects in real
// time what the project will look like once created. Deliberately minimal:
// matches the cockpit's flat surface, hairline borders, tabular figures,
// indigo Iris accents — nothing that contradicts DESIGN-RESET.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Briefcase, Calendar, MapPin, Sparkles, Users } from 'lucide-react';
import { typography } from '../../styles/theme';

const SURFACE = '#FFFFFF';
const SURFACE_INSET = '#F5F4F1';
const BORDER = '#E8E5DF';
const INK = '#1A1613';
const INK_2 = '#5C5550';
const INK_3 = '#8C857E';
const INK_4 = '#C4BDB4';
const ON_TRACK = '#2D8A6E';
const IRIS = '#4F46E5';
const IRIS_SUBTLE = '#4F46E512';
const BRAND = '#F47820';

export interface ProjectPreviewData {
  name: string;
  number: string;
  address: string;
  type: string;
  startDate: string;
  endDate: string;
  contractValue: number | null;
  squareFeet: number | null;
  ownerName: string;
  gcName: string;
  architectName: string;
  template: string;
  irisAutoImport: boolean;
  irisProviders: string[];
}

interface Props {
  data: ProjectPreviewData;
}

function placeholder(value: string, fallback: string) {
  if (value && value.trim()) return { text: value, isPlaceholder: false };
  return { text: fallback, isPlaceholder: true };
}

function fmtMoney(n: number | null): string {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, notation: 'compact',
  }).format(n);
}

function fmtSqFt(n: number | null): string {
  if (n == null || isNaN(n)) return '—';
  return `${new Intl.NumberFormat('en-US').format(n)} sq ft`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function durationDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T12:00:00`).getTime();
  const e = new Date(`${end}T12:00:00`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  return Math.round((e - s) / (24 * 60 * 60 * 1000));
}

const PreviewLine: React.FC<{
  label: string;
  value: string;
  isPlaceholder: boolean;
  icon?: React.ReactNode;
  numeric?: boolean;
}> = ({ label, value, isPlaceholder, icon, numeric }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '90px 1fr',
    gap: 12, alignItems: 'center', padding: '6px 0',
  }}>
    <div style={{
      fontSize: 10, fontWeight: 600, color: INK_3,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{label}</div>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 13,
      color: isPlaceholder ? INK_4 : INK,
      fontStyle: isPlaceholder ? 'italic' : 'normal',
      fontVariantNumeric: numeric ? 'tabular-nums' : 'normal',
    }}>
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  </div>
);

export const ProjectCreatePreview: React.FC<Props> = ({ data }) => {
  const name = placeholder(data.name, 'Project name appears here');
  const num = placeholder(data.number, 'Project number');
  const addr = placeholder(data.address, 'Project address');
  const type = placeholder(data.type, 'Project type');
  const start = placeholder(fmtDate(data.startDate), 'Start date');
  const end = placeholder(fmtDate(data.endDate), 'Target completion');
  const contract = placeholder(fmtMoney(data.contractValue), 'Contract value');
  const area = placeholder(fmtSqFt(data.squareFeet), 'Square footage');
  const owner = placeholder(data.ownerName, 'Owner');
  const gc = placeholder(data.gcName, 'General contractor');
  const arch = placeholder(data.architectName, 'Architect');
  const days = durationDays(data.startDate, data.endDate);

  return (
    <aside
      aria-label="Project preview"
      style={{
        position: 'sticky', top: 76,
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        overflow: 'hidden',
        fontFamily: typography.fontFamily,
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: `1px solid ${BORDER}`,
        backgroundColor: '#FAFAF8',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: INK_3,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Live preview
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 999,
          backgroundColor: `${ON_TRACK}10`, color: ON_TRACK,
          fontSize: 11, fontWeight: 600,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', backgroundColor: ON_TRACK,
          }} />
          Active
        </span>
      </header>

      <div style={{ padding: 16 }}>
        {/* Identity */}
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: BRAND,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: typography.fontFamilyMono,
            letterSpacing: '0.02em',
          }}>
            {num.isPlaceholder ? <span style={{ color: INK_4, fontStyle: 'italic' }}>{num.text}</span> : num.text}
          </div>
          <h2 style={{
            margin: '4px 0 0',
            fontSize: 22, fontWeight: 700, color: name.isPlaceholder ? INK_4 : INK,
            fontStyle: name.isPlaceholder ? 'italic' : 'normal',
            lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            {name.text}
          </h2>
        </div>

        {/* Field rows */}
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          <PreviewLine label="Address" value={addr.text} isPlaceholder={addr.isPlaceholder}
            icon={<MapPin size={11} color={INK_3} />} />
          <PreviewLine label="Type" value={type.text} isPlaceholder={type.isPlaceholder}
            icon={<Briefcase size={11} color={INK_3} />} />
          <PreviewLine label="Owner" value={owner.text} isPlaceholder={owner.isPlaceholder} />
          <PreviewLine label="GC" value={gc.text} isPlaceholder={gc.isPlaceholder} />
          <PreviewLine label="Architect" value={arch.text} isPlaceholder={arch.isPlaceholder} />
        </div>

        {/* Numbers strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 0, marginTop: 14,
          border: `1px solid ${BORDER}`, borderRadius: 6,
          backgroundColor: SURFACE_INSET,
        }}>
          {[
            { label: 'Contract', value: contract.text, ph: contract.isPlaceholder },
            { label: 'Area', value: area.text, ph: area.isPlaceholder },
            { label: 'Start', value: start.text, ph: start.isPlaceholder },
            { label: 'Target', value: end.text, ph: end.isPlaceholder },
          ].map((cell, i) => (
            <div key={cell.label} style={{
              padding: 10,
              borderRight: i % 2 === 0 ? `1px solid ${BORDER}` : 'none',
              borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: INK_3,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                marginBottom: 3,
              }}>
                {cell.label}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: cell.ph ? INK_4 : INK,
                fontStyle: cell.ph ? 'italic' : 'normal',
                fontVariantNumeric: 'tabular-nums',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {cell.value}
              </div>
            </div>
          ))}
        </div>

        {/* Schedule bar */}
        {days != null && days > 0 ? (
          <div style={{ marginTop: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: INK_3, marginBottom: 6,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} /> Day 0
              </span>
              <span>Day {days}</span>
            </div>
            <div style={{
              height: 4, borderRadius: 2,
              backgroundColor: SURFACE_INSET,
              border: `1px solid ${BORDER}`,
            }}>
              <div style={{
                width: '0%', height: '100%', borderRadius: 2,
                backgroundColor: BRAND,
              }} />
            </div>
          </div>
        ) : null}

        {/* Iris setup hint */}
        {data.irisAutoImport && data.irisProviders.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            marginTop: 14, padding: '10px 12px',
            border: `1px solid ${IRIS}33`,
            backgroundColor: IRIS_SUBTLE,
            borderRadius: 6,
          }}>
            <Sparkles size={14} color={IRIS} style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: INK_2, lineHeight: 1.4 }}>
              <strong style={{ color: IRIS }}>Iris</strong> will auto-import from{' '}
              {data.irisProviders.join(', ')} the moment the project is created.
            </div>
          </div>
        )}

        {/* Team chip strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 14, paddingTop: 12,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 11, color: INK_3,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <Users size={11} />
          {[data.ownerName, data.gcName, data.architectName].filter((s) => !!s.trim()).length} team
          {' '}{[data.ownerName, data.gcName, data.architectName].filter((s) => !!s.trim()).length === 1 ? 'member' : 'members'}
          {' '}assigned
          {data.template && data.template !== 'blank' && (
            <span style={{ marginLeft: 'auto', color: INK_2 }}>
              From: <strong style={{ color: INK }}>{data.template}</strong>
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ProjectCreatePreview;
