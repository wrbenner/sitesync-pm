import React, { useState } from 'react';
import { Download, Eye, Edit3, Zap, Upload, Scan } from 'lucide-react';
import { Card, SectionHeader, Btn, Tag, TableHeader, TableRow } from '../components/Primitives';
import { colors, spacing, typography } from '../styles/theme';
import { drawings } from '../data/mockData';

const disciplineColors: Record<string, string> = {
  Architectural: colors.purple,
  Structural: colors.blue,
  Mechanical: colors.amber,
  Electrical: colors.red,
  Plumbing: colors.green,
};

export const Drawings: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const [selectedDrawing, setSelectedDrawing] = useState<(typeof drawings)[0] | null>(null);

  const disciplines = ['All', 'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Plumbing'];

  const filteredDrawings =
    filter === 'All' ? drawings : drawings.filter((d) => d.discipline === filter);

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.lightBackground,
        padding: spacing.xl,
        marginLeft: '260px',
        display: 'grid',
        gridTemplateColumns: selectedDrawing ? '1fr 400px' : '1fr',
        gap: spacing.xl,
      }}
    >
      <div>
        <SectionHeader
          title="Drawings"
          action={
            <div style={{ display: 'flex', gap: spacing.md }}>
              <Btn variant="secondary" size="md" icon={<Upload size={16} />}>
                Upload Set
              </Btn>
              <Btn variant="primary" size="md" icon={<Scan size={16} />}>
                AI Scan
              </Btn>
            </div>
          }
        />

        {/* Discipline Filters */}
        <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.xl, flexWrap: 'wrap' }}>
          {disciplines.map((discipline) => (
            <button
              key={discipline}
              onClick={() => setFilter(discipline)}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                backgroundColor:
                  filter === discipline ? colors.primaryOrange : colors.cardBackground,
                color: filter === discipline ? colors.white : colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                fontWeight: typography.fontWeight.medium,
                transition: 'all 150ms ease-in-out',
              }}
              onMouseEnter={(e) => {
                if (filter !== discipline) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primaryOrange;
                }
              }}
              onMouseLeave={(e) => {
                if (filter !== discipline) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
                }
              }}
            >
              {discipline}
            </button>
          ))}
        </div>

        {/* Drawings Table */}
        <Card padding="0">
          <TableHeader
            columns={[
              { label: 'Set', width: '80px' as string },
              { label: 'Title', width: '1fr' as string },
              { label: 'Discipline', width: '120px' as string },
              { label: 'Revision', width: '80px' as string },
              { label: 'Date', width: '100px' as string },
              { label: 'Sheets', width: '70px' as string },
              { label: 'Actions', width: '120px' as string },
            ]}
          />
          {filteredDrawings.map((drawing, index) => (
            <TableRow
              key={drawing.id}
              divider={index < filteredDrawings.length - 1}
              onClick={() => setSelectedDrawing(drawing)}
              columns={[
                {
                  width: '80px' as string,
                  content: (
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.primaryOrange,
                      }}
                    >
                      {drawing.setNumber}
                    </span>
                  ),
                },
                {
                  width: '1fr' as string,
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary }}>
                      {drawing.title}
                    </span>
                  ),
                },
                {
                  width: '120px' as string,
                  content: (
                    <Tag
                      label={drawing.discipline}
                      color={colors.white}
                      backgroundColor={disciplineColors[drawing.discipline]}
                    />
                  ),
                },
                {
                  width: '80px' as string,
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {drawing.revision}
                    </span>
                  ),
                },
                {
                  width: '100px' as string,
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {drawing.date}
                    </span>
                  ),
                },
                {
                  width: '70px' as string,
                  content: (
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      {drawing.sheetCount}
                    </span>
                  ),
                },
                {
                  width: '120px' as string,
                  content: (
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                      <button
                        style={{
                          width: 28,
                          height: 28,
                          padding: 0,
                          backgroundColor: colors.lightBackground,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="View"
                      >
                        <Eye size={14} color={colors.textPrimary} />
                      </button>
                      <button
                        style={{
                          width: 28,
                          height: 28,
                          padding: 0,
                          backgroundColor: colors.lightBackground,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Download"
                      >
                        <Download size={14} color={colors.textPrimary} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ))}
        </Card>
      </div>

      {/* Detail Panel */}
      {selectedDrawing && (
        <div style={{ position: 'sticky', top: spacing.xl, height: 'fit-content' }}>
          <Card padding={spacing.lg}>
            <button
              onClick={() => setSelectedDrawing(null)}
              style={{
                position: 'absolute',
                top: spacing.lg,
                right: spacing.lg,
                background: 'none',
                border: 'none',
                fontSize: typography.fontSize['2xl'],
                cursor: 'pointer',
                color: colors.textSecondary,
              }}
            >
              ×
            </button>

            <div style={{ marginBottom: spacing.lg }}>
              <p
                style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing.xs,
                  textTransform: 'uppercase',
                }}
              >
                {selectedDrawing.setNumber}
              </p>
              <h3
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary,
                  margin: 0,
                  marginBottom: spacing.md,
                }}
              >
                {selectedDrawing.title}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, margin: 0 }}>
                    Discipline
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.discipline}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, margin: 0 }}>
                    Revision
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.revision}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, margin: 0 }}>
                    Date
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.date}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, margin: 0 }}>
                    Sheets
                  </p>
                  <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0 }}>
                    {selectedDrawing.sheetCount}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <Btn variant="primary" size="md" icon={<Eye size={16} />} fullWidth>
                Open Viewer
              </Btn>
              <Btn variant="secondary" size="md" icon={<Edit3 size={16} />} fullWidth>
                Markup
              </Btn>
              <Btn variant="secondary" size="md" icon={<Zap size={16} />} fullWidth>
                AI Scan
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
};
