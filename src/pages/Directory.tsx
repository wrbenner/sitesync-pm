import React, { useState, useEffect, useMemo } from 'react';
import { Search, LayoutGrid, List, Mail, Phone, Building, ChevronRight, BarChart3 } from 'lucide-react';
import { PageContainer, Card, SectionHeader, Avatar, Tag, Skeleton } from '../components/Primitives';
import { Drawer } from '../components/Drawer';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useDirectoryStore } from '../stores/directoryStore';
import { useProjectContext } from '../stores/projectContextStore';

const GROUP_ORDER = ['Owner', 'Design Team', 'Construction', 'Subcontractors'] as const;

const roleToGroup: Record<string, (typeof GROUP_ORDER)[number]> = {
  Owner: 'Owner',
  Architect: 'Design Team',
  'Structural Engineer': 'Design Team',
  'MEP Consultant': 'Design Team',
  'General Contractor': 'Construction',
};

function getGroup(role: string): (typeof GROUP_ORDER)[number] {
  return roleToGroup[role] || 'Subcontractors';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ContactLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: typography.fontSize.body,
        color: colors.textSecondary,
        textDecoration: hovered ? 'underline' : 'none',
        transition: `color ${transitions.quick}`,
      }}
    >
      {children}
    </a>
  );
};

const IconButton: React.FC<{
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  title?: string;
}> = ({ icon, onClick, href, title }) => {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.base,
    backgroundColor: hovered ? colors.surfaceHover : 'transparent',
    color: hovered ? colors.primaryOrange : colors.textSecondary,
    cursor: 'pointer',
    transition: `all ${transitions.quick}`,
    textDecoration: 'none',
  };

  if (href) {
    return (
      <a
        href={href}
        title={title}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
      >
        {icon}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
    >
      {icon}
    </button>
  );
};

const ViewToggle: React.FC<{
  viewMode: 'table' | 'cards';
  onChange: (mode: 'table' | 'cards') => void;
}> = ({ viewMode, onChange }) => (
  <div
    style={{
      display: 'flex',
      backgroundColor: colors.surfaceInset,
      borderRadius: borderRadius.full,
      padding: '2px',
    }}
  >
    {[
      { mode: 'table' as const, icon: <List size={14} />, label: 'Table' },
      { mode: 'cards' as const, icon: <LayoutGrid size={14} />, label: 'Cards' },
    ].map(({ mode, icon, label }) => (
      <button
        key={mode}
        onClick={() => onChange(mode)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing['1'],
          padding: `${spacing['1']} ${spacing['3']}`,
          border: 'none',
          borderRadius: borderRadius.full,
          backgroundColor: viewMode === mode ? colors.surfaceRaised : 'transparent',
          color: viewMode === mode ? colors.textPrimary : colors.textTertiary,
          fontSize: typography.fontSize.sm,
          fontWeight: viewMode === mode ? typography.fontWeight.medium : typography.fontWeight.normal,
          fontFamily: typography.fontFamily,
          cursor: 'pointer',
          transition: `all ${transitions.quick}`,
          boxShadow: viewMode === mode ? shadows.sm : 'none',
        }}
      >
        {icon}
        {label}
      </button>
    ))}
  </div>
);

export const Directory: React.FC = () => {
  const { activeProject } = useProjectContext();
  const { entries: directory, loading, loadEntries } = useDirectoryStore();

  useEffect(() => {
    if (activeProject?.id) loadEntries(activeProject.id);
  }, [activeProject?.id]);

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!directory) return [];
    if (!searchQuery.trim()) return directory;
    const q = searchQuery.toLowerCase();
    return directory.filter(
      (entry) =>
        entry.contactName.toLowerCase().includes(q) ||
        entry.company.toLowerCase().includes(q) ||
        entry.role.toLowerCase().includes(q) ||
        entry.email.toLowerCase().includes(q)
    );
  }, [searchQuery, directory]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const g of GROUP_ORDER) groups[g] = [];
    for (const entry of filtered) {
      const g = getGroup(entry.role);
      groups[g].push(entry);
    }
    return groups;
  }, [filtered]);

  const companyPeople = useMemo(() => {
    if (!selectedCompany || !directory) return [];
    return directory.filter((entry) => entry.company === selectedCompany);
  }, [selectedCompany, directory]);

  if (loading && directory.length === 0) {
    return (
      <PageContainer title="Directory" subtitle="Loading...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          <Skeleton width="100%" height="44px" borderRadius={borderRadius.full} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
              <Skeleton width="140px" height="20px" />
              <Skeleton width="100%" height="160px" />
            </div>
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Directory"
      subtitle={`${directory.length} contacts`}
      actions={<ViewToggle viewMode={viewMode} onChange={setViewMode} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            padding: `${spacing['3']} ${spacing['4']}`,
            backgroundColor: colors.surfaceInset,
            borderRadius: borderRadius.full,
          }}
        >
          <Search size={16} style={{ color: colors.textTertiary, flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts, companies, or roles..."
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: typography.fontSize.body,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              padding: `${spacing['1']} 0`,
            }}
          />
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <>
            {GROUP_ORDER.map((groupName) => {
              const entries = grouped[groupName];
              if (!entries || entries.length === 0) return null;

              return (
                <div key={groupName}>
                  <SectionHeader title={groupName} />
                  <Card padding="0">
                    {entries.map((entry, index) => {
                      const isHovered = hoveredRow === entry.id;
                      const isLast = index === entries.length - 1;
                      return (
                        <div
                          key={entry.id}
                          onMouseEnter={() => setHoveredRow(entry.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: `${spacing['3']} ${spacing['5']}`,
                            gap: spacing['4'],
                            backgroundColor: isHovered ? colors.surfaceHover : 'transparent',
                            transition: `background-color ${transitions.quick}`,
                            borderBottom: isLast ? 'none' : `1px solid ${colors.borderSubtle}`,
                            cursor: 'default',
                          }}
                        >
                          <Avatar initials={getInitials(entry.contactName)} size={28} />

                          <span
                            style={{
                              fontSize: typography.fontSize.body,
                              fontWeight: typography.fontWeight.medium,
                              color: colors.textPrimary,
                              minWidth: '140px',
                            }}
                          >
                            {entry.contactName}
                          </span>

                          <span
                            style={{
                              fontSize: typography.fontSize.body,
                              color: colors.textSecondary,
                              flex: 1,
                            }}
                          >
                            {entry.company}
                          </span>

                          <Tag
                            label={entry.role}
                            fontSize={typography.fontSize.caption}
                          />

                          <span
                            style={{
                              fontSize: typography.fontSize.body,
                              color: colors.textSecondary,
                              minWidth: '120px',
                            }}
                          >
                            {entry.phone}
                          </span>

                          <ContactLink href={`mailto:${entry.email}`}>
                            {entry.email}
                          </ContactLink>
                        </div>
                      );
                    })}
                  </Card>
                </div>
              );
            })}
          </>
        )}

        {/* Cards View */}
        {viewMode === 'cards' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: spacing['4'],
            }}
          >
            {filtered.map((entry) => {
              const isHovered = hoveredRow === entry.id;
              return (
                <div
                  key={entry.id}
                  onMouseEnter={() => setHoveredRow(entry.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: borderRadius.lg,
                    padding: spacing['5'],
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: spacing['3'],
                    boxShadow: isHovered ? shadows.cardHover : shadows.card,
                    transition: `box-shadow ${transitions.quick}`,
                    cursor: 'default',
                  }}
                >
                  <Avatar initials={getInitials(entry.contactName)} size={40} />

                  <span
                    style={{
                      fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.semibold,
                      color: colors.textPrimary,
                      textAlign: 'center',
                    }}
                  >
                    {entry.contactName}
                  </span>

                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        display: 'block',
                      }}
                    >
                      {entry.company}
                    </span>
                    <Tag
                      label={entry.role}
                      fontSize={typography.fontSize.caption}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: spacing['2'],
                      marginTop: 'auto',
                      paddingTop: spacing['2'],
                    }}
                  >
                    <IconButton
                      href={`mailto:${entry.email}`}
                      icon={<Mail size={14} />}
                      title={`Email ${entry.contactName}`}
                    />
                    <IconButton
                      href={`tel:${entry.phone}`}
                      icon={<Phone size={14} />}
                      title={`Call ${entry.contactName}`}
                    />
                    <IconButton
                      icon={<Building size={14} />}
                      title={`View ${entry.company} profile`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCompany(entry.company);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Company Profile Drawer */}
      <Drawer
        open={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        title={selectedCompany || ''}
      >
        {selectedCompany && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
            {/* Company Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['3'],
                padding: spacing['4'],
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.md,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.primaryOrange,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <Building size={22} />
              </div>
              <div>
                <p
                  style={{
                    fontSize: typography.fontSize.title,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: 0,
                  }}
                >
                  {selectedCompany}
                </p>
                <p
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textSecondary,
                    margin: 0,
                    marginTop: spacing['1'],
                  }}
                >
                  {companyPeople.length} {companyPeople.length === 1 ? 'contact' : 'contacts'} on this project
                </p>
              </div>
            </div>

            {/* Performance Stats */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  marginBottom: spacing['3'],
                }}
              >
                <BarChart3 size={16} style={{ color: colors.primaryOrange }} />
                <span
                  style={{
                    fontSize: typography.fontSize.body,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                  }}
                >
                  Performance
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: spacing['3'],
                }}
              >
                {[
                  { label: 'RFI Response Time', value: '3.2 days avg' },
                  { label: 'Submittal Approval Rate', value: '85%' },
                  { label: 'Active RFIs', value: '2' },
                  { label: 'Active Submittals', value: '1' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      padding: spacing['3'],
                      backgroundColor: colors.surfaceInset,
                      borderRadius: borderRadius.base,
                    }}
                  >
                    <p
                      style={{
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                        margin: 0,
                        marginBottom: spacing['1'],
                      }}
                    >
                      {stat.label}
                    </p>
                    <p
                      style={{
                        fontSize: typography.fontSize.title,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                        margin: 0,
                      }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Members / Org Chart */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['2'],
                  marginBottom: spacing['3'],
                }}
              >
                <ChevronRight size={16} style={{ color: colors.primaryOrange }} />
                <span
                  style={{
                    fontSize: typography.fontSize.body,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                  }}
                >
                  Team Members
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing['2'],
                }}
              >
                {companyPeople.map((person) => (
                  <div
                    key={person.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['3'],
                      padding: spacing['3'],
                      backgroundColor: colors.surfaceRaised,
                      borderRadius: borderRadius.base,
                      border: `1px solid ${colors.borderSubtle}`,
                    }}
                  >
                    <Avatar initials={getInitials(person.contactName)} size={32} />
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: typography.fontSize.body,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textPrimary,
                          margin: 0,
                        }}
                      >
                        {person.contactName}
                      </p>
                      <p
                        style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textSecondary,
                          margin: 0,
                        }}
                      >
                        {person.email}
                      </p>
                    </div>
                    <Tag label={person.role} fontSize={typography.fontSize.caption} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
};
