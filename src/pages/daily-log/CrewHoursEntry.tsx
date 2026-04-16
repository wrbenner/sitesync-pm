import React, { useState } from 'react';
import { Card, SectionHeader } from '../../components/Primitives';
import { CrewHoursSummary } from '../../components/dailylog/CrewHoursSummary';
import type { CrewHoursEntry as CrewHoursEntryType } from '../../components/dailylog/CrewHoursSummary';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import type { ManpowerRow } from './types';

interface CrewHoursEntryProps {
  manpowerRows: ManpowerRow[];
  setManpowerRows: React.Dispatch<React.SetStateAction<ManpowerRow[]>>;
  isLocked: boolean;
  crewHours: CrewHoursEntryType[];
}

export const CrewHoursEntry: React.FC<CrewHoursEntryProps> = ({ manpowerRows, setManpowerRows, isLocked, crewHours }) => {
  const [showAddManpowerRow, setShowAddManpowerRow] = useState(false);
  const [newManpowerRow, setNewManpowerRow] = useState({ trade: '', company: '', headcount: 0, hours: 0 });
  const [hoveredManpowerRow, setHoveredManpowerRow] = useState<string | null>(null);

  return (
    <Card>
      <SectionHeader title="Manpower" action={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
            {manpowerRows.reduce((s, r) => s + r.headcount, 0)} workers,{' '}
            {manpowerRows.reduce((s, r) => s + r.headcount * r.hours, 0).toLocaleString()} total hrs
          </span>
          {!isLocked && (
            <button
              onClick={() => setShowAddManpowerRow(true)}
              style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], padding: `${spacing['1']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, fontFamily: typography.fontFamily, color: colors.primaryOrange, backgroundColor: colors.orangeSubtle, border: `1px solid ${colors.primaryOrange}`, borderRadius: borderRadius.md, cursor: 'pointer' }}
            >
              + Add Row
            </button>
          )}
        </div>
      } />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: typography.fontSize.sm }}>
          <thead>
            <tr style={{ backgroundColor: colors.surfaceInset }}>
              {['Trade', 'Company', 'Headcount', 'Hours Worked', 'Total Hrs', ...(isLocked ? [] : [''])].map(h => (
                <th key={h} style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'left', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {manpowerRows.length === 0 && !showAddManpowerRow && (
              <tr>
                <td colSpan={isLocked ? 5 : 6} style={{ padding: `${spacing['4']} ${spacing['3']}`, color: colors.textTertiary, fontSize: typography.fontSize.sm, textAlign: 'center' }}>
                  No crew entries. Use "Add Row" or "Same as yesterday" to add manpower.
                </td>
              </tr>
            )}
            {manpowerRows.map((row) => (
              <tr
                key={row.id}
                onMouseEnter={() => setHoveredManpowerRow(row.id)}
                onMouseLeave={() => setHoveredManpowerRow(null)}
                style={{ backgroundColor: hoveredManpowerRow === row.id ? colors.surfaceHover : 'transparent', transition: `background-color 160ms`, borderBottom: `1px solid ${colors.borderSubtle}` }}
              >
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, fontWeight: typography.fontWeight.medium }}>{row.trade || '—'}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textSecondary }}>{row.company || '—'}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, textAlign: 'right' }}>{row.headcount}</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.textPrimary, textAlign: 'right' }}>{row.hours}h</td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold, textAlign: 'right' }}>{(row.headcount * row.hours).toLocaleString()}h</td>
                {!isLocked && (
                  <td style={{ padding: `${spacing['2']} ${spacing['3']}`, textAlign: 'right' }}>
                    <button onClick={() => setManpowerRows(prev => prev.filter(r => r.id !== row.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, padding: 0 }}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
            {showAddManpowerRow && !isLocked && (
              <tr style={{ backgroundColor: colors.orangeSubtle, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                <td style={{ padding: `${spacing['2']} ${spacing['2']}` }}>
                  <input
                    type="text"
                    placeholder="Trade"
                    value={newManpowerRow.trade}
                    onChange={e => setNewManpowerRow(p => ({ ...p, trade: e.target.value }))}
                    style={{ width: '100%', padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, outline: 'none', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['2']}` }}>
                  <input
                    type="text"
                    placeholder="Company"
                    value={newManpowerRow.company}
                    onChange={e => setNewManpowerRow(p => ({ ...p, company: e.target.value }))}
                    style={{ width: '100%', padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, outline: 'none', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['2']}` }}>
                  <input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={newManpowerRow.headcount || ''}
                    onChange={e => setNewManpowerRow(p => ({ ...p, headcount: parseInt(e.target.value) || 0 }))}
                    style={{ width: '72px', padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, outline: 'none', textAlign: 'right' }}
                  />
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['2']}` }}>
                  <input
                    type="number"
                    placeholder="0"
                    min={0}
                    step={0.5}
                    value={newManpowerRow.hours || ''}
                    onChange={e => setNewManpowerRow(p => ({ ...p, hours: parseFloat(e.target.value) || 0 }))}
                    style={{ width: '72px', padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, outline: 'none', textAlign: 'right' }}
                  />
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['3']}`, color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold, textAlign: 'right', fontSize: typography.fontSize.sm }}>
                  {(newManpowerRow.headcount * newManpowerRow.hours).toLocaleString()}h
                </td>
                <td style={{ padding: `${spacing['2']} ${spacing['2']}` }}>
                  <div style={{ display: 'flex', gap: spacing['1'] }}>
                    <button
                      onClick={() => {
                        if (!newManpowerRow.trade) return;
                        setManpowerRows(prev => [...prev, { id: crypto.randomUUID(), ...newManpowerRow }]);
                        setNewManpowerRow({ trade: '', company: '', headcount: 0, hours: 0 });
                        setShowAddManpowerRow(false);
                      }}
                      style={{ padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', fontWeight: typography.fontWeight.medium }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowAddManpowerRow(false); setNewManpowerRow({ trade: '', company: '', headcount: 0, hours: 0 }); }}
                      style={{ padding: `${spacing['1']} ${spacing['2']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: 'transparent', color: colors.textSecondary, border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {manpowerRows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: colors.surfaceInset, borderTop: `2px solid ${colors.borderDefault}` }}>
                <td colSpan={2} style={{ padding: `${spacing['3']} ${spacing['3']}`, fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total</td>
                <td style={{ padding: `${spacing['3']} ${spacing['3']}`, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'right' }}>{manpowerRows.reduce((s, r) => s + r.headcount, 0)}</td>
                <td style={{ padding: `${spacing['3']} ${spacing['3']}`, color: colors.textTertiary, textAlign: 'right' }}></td>
                <td style={{ padding: `${spacing['3']} ${spacing['3']}`, fontWeight: typography.fontWeight.semibold, color: colors.primaryOrange, textAlign: 'right' }}>{manpowerRows.reduce((s, r) => s + r.headcount * r.hours, 0).toLocaleString()}h</td>
                {!isLocked && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {crewHours.length > 0 && manpowerRows.length === 0 && (
        <div style={{ marginTop: spacing['4'] }}>
          <CrewHoursSummary crews={crewHours} />
        </div>
      )}
    </Card>
  );
};
