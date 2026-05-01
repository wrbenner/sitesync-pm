/**
 * ProjectGate — Full-page project selection / creation experience.
 *
 * Renders instead of normal page content when no project is active.
 * Construction PMs should never see a bare "No project selected" message.
 * Instead they get a beautiful, actionable screen:
 *   - If projects exist → card grid to pick one
 *   - If no projects → prominent "Create Your First Project" CTA
 *   - Inline creation without leaving the page
 */

import React, { useState } from 'react';
import { HardHat, Plus, MapPin, Calendar, Building2, ArrowRight, Search } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { useProjects } from '../hooks/queries';
import { useProjectContext } from '../stores/projectContextStore';
import { CreateProjectModal } from './forms/CreateProjectModal';

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  commercial_office: 'Commercial',
  mixed_use: 'Mixed Use',
  healthcare: 'Healthcare',
  education: 'Education',
  multifamily: 'Multifamily',
  industrial: 'Industrial',
  data_center: 'Data Center',
  retail: 'Retail',
  hospitality: 'Hospitality',
  government: 'Government',
  infrastructure: 'Infrastructure',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  planning: '#6366F1',
  completed: '#6B7280',
  on_hold: '#F59E0B',
};

/* ── Main Component ─────────────────────────────────────── */

export const ProjectGate: React.FC = () => {
  const { data: projects, isLoading } = useProjects();
  const setActiveProject = useProjectContext((s) => s.setActiveProject);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = (projects ?? []).filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.address ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const hasProjects = (projects?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '80vh',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['4'],
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: borderRadius.full,
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulse 1.5s infinite',
          }}>
            <HardHat size={24} color="white" />
          </div>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
            Loading projects...
          </p>
        </div>
      </div>
    );
  }

  /* ── No projects: First-run experience ── */
  if (!hasProjects) {
    return (
      <>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '80vh', padding: spacing['6'], textAlign: 'center',
        }}>
          {/* Icon */}
          <div style={{
            width: 80, height: 80, borderRadius: borderRadius['2xl'],
            background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing['6'],
            boxShadow: `0 12px 40px ${colors.primaryOrange}30`,
          }}>
            <HardHat size={36} color="white" />
          </div>

          <h1 style={{
            fontSize: '28px', fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary, margin: 0, marginBottom: spacing['2'],
            fontFamily: typography.fontFamily,
          }}>
            Welcome to SiteSync
          </h1>
          <p style={{
            fontSize: typography.fontSize.body, color: colors.textSecondary,
            margin: 0, marginBottom: spacing['8'], maxWidth: 420, lineHeight: '1.6',
          }}>
            Create your first project to start tracking schedules, budgets, daily logs, and everything on your job site.
          </p>

          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
              padding: `14px ${spacing['6']}`,
              background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})`,
              color: 'white', border: 'none', borderRadius: borderRadius.lg,
              fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              boxShadow: `0 4px 16px ${colors.primaryOrange}40`,
              transition: 'transform 150ms, box-shadow 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 6px 24px ${colors.primaryOrange}50`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 16px ${colors.primaryOrange}40`; }}
          >
            <Plus size={18} />
            Create Your First Project
          </button>
        </div>
        <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  /* ── Has projects: Selection grid ── */
  return (
    <>
      <div style={{
        maxWidth: 900, margin: '0 auto', padding: `${spacing['8']} ${spacing['6']}`,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: spacing['6'], flexWrap: 'wrap', gap: spacing['4'],
        }}>
          <div>
            <h1 style={{
              fontSize: '24px', fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary, margin: 0, marginBottom: spacing['1'],
              fontFamily: typography.fontFamily,
            }}>
              Your Projects
            </h1>
            <p style={{
              fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0,
            }}>
              Select a project to continue, or create a new one.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'],
              padding: `${spacing['2']} ${spacing['4']}`,
              background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})`,
              color: 'white', border: 'none', borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily, cursor: 'pointer',
              transition: 'transform 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Plus size={15} />
            New Project
          </button>
        </div>

        {/* Search bar — only if more than 3 projects */}
        {(projects?.length ?? 0) > 3 && (
          <div style={{
            position: 'relative', marginBottom: spacing['5'],
          }}>
            <Search size={16} style={{
              position: 'absolute', left: spacing['3'], top: '50%',
              transform: 'translateY(-50%)', color: colors.textTertiary,
            }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              style={{
                width: '100%', padding: `${spacing['2.5']} ${spacing['3']} ${spacing['2.5']} 40px`,
                border: `1px solid ${colors.borderSubtle}`, borderRadius: borderRadius.lg,
                fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
                backgroundColor: colors.surfaceInset, color: colors.textPrimary,
                outline: 'none', transition: `border-color ${transitions.instant}`,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = colors.primaryOrange; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = colors.borderSubtle; }}
            />
          </div>
        )}

        {/* Project Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: spacing['4'],
        }}>
          {filtered.map((project) => {
            const isHovered = hoveredId === project.id;
            const typeLabel = PROJECT_TYPE_LABELS[project.project_type ?? ''] ?? '';
            const statusColor = STATUS_COLORS[project.status ?? ''] ?? colors.textTertiary;
            const location = [project.city, project.state].filter(Boolean).join(', ');

            return (
              <button
                key={project.id}
                onClick={() => {
                  // Sync into store first, then set active
                  useProjectContext.setState((s) => ({
                    projects: s.projects.some((p) => p.id === project.id)
                      ? s.projects
                      : [...s.projects, project],
                  }));
                  setActiveProject(project.id);
                }}
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', flexDirection: 'column', textAlign: 'left',
                  padding: spacing['5'],
                  backgroundColor: isHovered ? colors.surfaceHover : colors.surfaceRaised,
                  border: `1.5px solid ${isHovered ? colors.primaryOrange : colors.borderSubtle}`,
                  borderRadius: borderRadius.xl, cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                  transition: 'all 150ms ease',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? `0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px ${colors.primaryOrange}20`
                    : '0 1px 3px rgba(0,0,0,0.06)',
                  minHeight: 140,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Top row: initial + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['3'] }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: borderRadius.lg, flexShrink: 0,
                    background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.brand300})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', fontWeight: typography.fontWeight.bold, color: 'white',
                  }}>
                    {project.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {project.name}
                    </div>
                    {typeLabel && (
                      <div style={{
                        fontSize: typography.fontSize.caption, color: colors.textTertiary,
                        marginTop: 2,
                      }}>
                        {typeLabel}
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1.5'], flex: 1 }}>
                  {location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      <MapPin size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
                    </div>
                  )}
                  {project.address && !location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      <MapPin size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.address}</span>
                    </div>
                  )}
                  {project.start_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1.5'], fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                      <Calendar size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                      <span>Started {formatDate(project.start_date)}</span>
                    </div>
                  )}
                </div>

                {/* Bottom: status + arrow */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: spacing['3'], paddingTop: spacing['3'],
                  borderTop: `1px solid ${colors.borderSubtle}`,
                }}>
                  {project.status ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
                      color: statusColor, textTransform: 'capitalize',
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor }} />
                      {(project.status ?? '').replace(/_/g, ' ')}
                    </div>
                  ) : (
                    <div />
                  )}
                  <ArrowRight
                    size={16}
                    color={isHovered ? colors.primaryOrange : colors.textTertiary}
                    style={{ transition: `color 150ms, transform 150ms`, transform: isHovered ? 'translateX(2px)' : 'translateX(0)' }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* No search results */}
        {search && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: `${spacing['8']} 0`,
            color: colors.textTertiary, fontSize: typography.fontSize.sm,
          }}>
            No projects matching "{search}"
          </div>
        )}
      </div>
      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
};

export default ProjectGate;
