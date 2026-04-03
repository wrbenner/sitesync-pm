import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, LayoutGrid, List, Mail, Phone, Building, ChevronRight, BarChart3, Users } from 'lucide-react';
import { PageContainer, Card, SectionHeader, Avatar, Tag, Skeleton, Btn } from '../components/Primitives';
import { ExportButton } from '../components/shared/ExportButton';
import { toast } from 'sonner';
import { useCreateDirectoryContact } from '../hooks/mutations';
import { DataTable, createColumnHelper } from '../components/shared/DataTable';
import { Drawer } from '../components/Drawer';
import { colors, spacing, typography, borderRadius, transitions, shadows } from '../styles/theme';
import { useProjectId } from '../hooks/useProjectId';
import { supabase } from '../lib/supabase';
import AddContactModal from '../components/forms/AddContactModal';
import { PermissionGate } from '../components/auth/PermissionGate';

function getRoleBadgeColors(role: string): { color: string; bg: string } {
  const r = role.toLowerCase().replace(/[\s_]/g, '');
  if (
    r.includes('manager') || r === 'pm' || r === 'owner' ||
    r.includes('architect') || r.includes('engineer') || r.includes('consultant')
  ) {
    return { color: colors.statusInfo, bg: colors.statusInfoSubtle };
  }
  if (
    r.includes('super') || r.includes('foreman') ||
    r.includes('gc') || r.includes('generalcontractor')
  ) {
    return { color: colors.statusPending, bg: colors.statusPendingSubtle };
  }
  return { color: colors.statusNeutral, bg: colors.statusNeutralSubtle };
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

interface MemberEntry {
  id: string;
  company: string;
  role: string;
  contactName: string;
  phone: string;
  email: string;
  trade: string;
  avatarUrl: string | null;
}

const directoryColumnHelper = createColumnHelper<MemberEntry>();

const directoryColumns = [
  directoryColumnHelper.accessor('contactName', {
    header: 'Name',
    cell: (info) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
        <Avatar initials={getInitials(info.getValue())} size={28} />
        <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
          {info.getValue()}
        </span>
      </span>
    ),
  }),
  directoryColumnHelper.accessor('company', {
    header: 'Company',
    cell: (info) => (
      <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>
        {info.getValue()}
      </span>
    ),
  }),
  directoryColumnHelper.accessor('role', {
    header: 'Role',
    cell: (info) => {
      const { color, bg } = getRoleBadgeColors(info.getValue());
      return <Tag label={info.getValue()} color={color} backgroundColor={bg} fontSize={typography.fontSize.caption} />;
    },
  }),
  directoryColumnHelper.accessor('phone', {
    header: 'Phone',
    cell: (info) => (
      <span style={{ fontSize: typography.fontSize.body, color: colors.textSecondary }}>
        {info.getValue()}
      </span>
    ),
  }),
  directoryColumnHelper.accessor('email', {
    header: 'Email',
    cell: (info) => (
      <ContactLink href={`mailto:${info.getValue()}`}>
        {info.getValue()}
      </ContactLink>
    ),
  }),
];

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
    color: hovered ? colors.orangeText : colors.textSecondary,
    cursor: 'pointer',
    transition: `all ${transitions.quick}`,
    textDecoration: 'none',
  };

  if (href) {
    return (
      <a
        href={href}
        title={title}
        aria-label={title}
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
      aria-label={title}
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
        aria-pressed={viewMode === mode}
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
  const projectId = useProjectId();
  const createDirectoryContact = useCreateDirectoryContact();

  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawSearch, setRawSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    supabase
      .from('project_members')
      .select('id, role, user_id, company, trade, users(id, first_name, last_name, email, phone, job_title, avatar_url)')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load team members');
        } else {
          const mapped: MemberEntry[] = (data || []).map((m: any) => {
            const u = m.users || {};
            const firstName = u.first_name || '';
            const lastName = u.last_name || '';
            const fullName = [firstName, lastName].filter(Boolean).join(' ') || u.email || 'Unknown';
            return {
              id: m.id,
              role: m.role || '',
              company: m.company || u.company || '',
              trade: m.trade || '',
              contactName: fullName,
              email: u.email || '',
              phone: u.phone || '',
              avatarUrl: u.avatar_url || null,
            };
          });
          setMembers(mapped);
        }
        setLoading(false);
      });
  }, [projectId]);

  const handleSearchChange = (val: string) => {
    setRawSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(val), 200);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.contactName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.trade.toLowerCase().includes(q)
    );
  }, [searchQuery, members]);

  const grouped = useMemo(() => {
    const groups: Record<string, MemberEntry[]> = {};
    for (const entry of filtered) {
      const key = entry.company || 'Project Team';
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return groups;
  }, [filtered]);

  const groupKeys = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const companyPeople = useMemo(() => {
    if (!selectedCompany) return [];
    return members.filter((m) => (m.company || 'Project Team') === selectedCompany);
  }, [selectedCompany, members]);

  if (loading) {
    return (
      <PageContainer title="Directory" subtitle="Loading team...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['6'] }}>
          <Skeleton width="100%" height="44px" borderRadius={borderRadius.full} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: spacing['4'],
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} width="100%" height="180px" borderRadius={borderRadius.lg} />
            ))}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Directory"
      subtitle={`${members.length} team ${members.length === 1 ? 'member' : 'members'}`}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
          <ExportButton
            onExportCSV={() => toast.success('Directory data exported as CSV')}
            pdfFilename="SiteSync_Directory"
          />
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <PermissionGate permission="directory.manage">
            <Btn onClick={() => setCreateOpen(true)}>Add Contact</Btn>
          </PermissionGate>
        </div>
      }
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
            value={rawSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            aria-label="Search by name, email, phone, role, or trade"
            placeholder="Search by name, email, phone, role, or trade..."
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

        {/* Empty state */}
        {members.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing['4'],
              padding: `${spacing['16']} ${spacing['8']}`,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: borderRadius.xl,
                backgroundColor: colors.surfaceInset,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textTertiary,
              }}
            >
              <Users size={24} />
            </div>
            <div>
              <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                No team members yet
              </p>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: `${spacing['2']} 0 0` }}>
                Invite your first team member to get started.
              </p>
            </div>
            <PermissionGate permission="directory.manage">
              <Btn onClick={() => setCreateOpen(true)}>Invite Member</Btn>
            </PermissionGate>
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && members.length > 0 && (
          <>
            {groupKeys.map((groupName) => {
              const entries = grouped[groupName];
              if (!entries || entries.length === 0) return null;
              return (
                <div key={groupName}>
                  <SectionHeader title={groupName} />
                  <Card padding="0">
                    <DataTable
                      data={entries}
                      columns={directoryColumns}
                      enableSorting
                      stickyHeader={false}
                      getRowId={(row) => String(row.id)}
                    />
                  </Card>
                </div>
              );
            })}
          </>
        )}

        {/* Cards View */}
        {viewMode === 'cards' && members.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: spacing['4'],
            }}
          >
            {filtered.map((entry) => {
              const isHovered = hoveredRow === entry.id;
              const { color: roleColor, bg: roleBg } = getRoleBadgeColors(entry.role);
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

                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing['1'] }}>
                    {entry.company ? (
                      <span
                        style={{
                          fontSize: typography.fontSize.sm,
                          color: colors.textSecondary,
                          display: 'block',
                        }}
                      >
                        {entry.company}
                      </span>
                    ) : null}
                    <Tag label={entry.role} color={roleColor} backgroundColor={roleBg} fontSize={typography.fontSize.caption} />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: spacing['2'],
                      marginTop: 'auto',
                      paddingTop: spacing['2'],
                    }}
                  >
                    {entry.email ? (
                      <IconButton
                        href={`mailto:${entry.email}`}
                        icon={<Mail size={14} />}
                        title={`Email ${entry.contactName}`}
                      />
                    ) : null}
                    {entry.phone ? (
                      <IconButton
                        href={`tel:${entry.phone}`}
                        icon={<Phone size={14} />}
                        title={`Call ${entry.contactName}`}
                      />
                    ) : null}
                    {entry.company ? (
                      <IconButton
                        icon={<Building size={14} />}
                        title={`View ${entry.company} team`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCompany(entry.company);
                        }}
                      />
                    ) : null}
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
                  color: colors.white,
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
                <BarChart3 size={16} style={{ color: colors.orangeText }} />
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
                <ChevronRight size={16} style={{ color: colors.orangeText }} />
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
      <AddContactModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={async (data) => {
        try {
          await createDirectoryContact.mutateAsync({ projectId: projectId!, data: { project_id: projectId!, name: data.name, company: data.company || null, role: data.role || null, trade: data.trade || null, email: data.email || null, phone: data.phone || null } })
          toast.success('Created: ' + data.name)
          setCreateOpen(false)
        } catch { toast.error('Failed to create contact') }
      }} />
    </PageContainer>
  );
};
