import React, { useState } from 'react';
import { UserPlus, Mail, Search, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import type { Profile, UserRole } from '../../types/database';

const ROLE_LABELS: Record<UserRole, string> = {
  company_admin: 'Admin',
  project_manager: 'Project Manager',
  superintendent: 'Superintendent',
  engineer: 'Engineer',
  subcontractor: 'Subcontractor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<UserRole, string> = {
  company_admin: colors.primaryOrange,
  project_manager: colors.statusInfo,
  superintendent: colors.statusActive,
  engineer: colors.statusReview,
  subcontractor: colors.statusPending,
  viewer: colors.textTertiary,
};

export function UserManagement() {
  const { company, profile } = useAuthStore();
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('project_manager');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);

  // Load company members
  React.useEffect(() => {
    loadMembers();
  }, [company?.id]);

  const loadMembers = async () => {
    if (!company?.id) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at');

    if (data) setMembers(data as Profile[]);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !company?.id) return;

    await (supabase.from('invitations') as any).insert({
      company_id: company.id,
      email: inviteEmail,
      role: inviteRole,
      invited_by: profile!.id,
      status: 'pending',
      token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    setInviteSuccess(true);
    setTimeout(() => {
      setInviteSuccess(false);
      setInviteEmail('');
      setShowInvite(false);
    }, 2000);
  };

  const filteredMembers = members.filter((m) =>
    `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: `${spacing['8']} ${spacing['6']}`,
      fontFamily: typography.fontFamily,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing['8'],
      }}>
        <div>
          <h1 style={{
            fontSize: typography.fontSize.heading,
            fontWeight: typography.fontWeight.semibold,
            color: colors.textPrimary,
            letterSpacing: typography.letterSpacing.tight,
            margin: 0,
          }}>
            Team Members
          </h1>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            marginTop: spacing['1'],
          }}>
            {company?.name} &middot; {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['2'],
            padding: `${spacing['2']} ${spacing['4']}`,
            backgroundColor: colors.primaryOrange,
            color: '#fff',
            border: 'none',
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
            transition: `background-color ${transitions.quick}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.orangeHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.primaryOrange)}
        >
          <UserPlus size={16} />
          Invite Member
        </button>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div style={{
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          padding: spacing['5'],
          marginBottom: spacing['6'],
          boxShadow: shadows.card,
        }}>
          {inviteSuccess ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing['2'],
              color: colors.statusActive,
              fontSize: typography.fontSize.body,
            }}>
              <Check size={16} />
              Invitation sent to {inviteEmail}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  marginBottom: spacing['1'],
                }}>
                  Email address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{
                    position: 'absolute', left: '10px', top: '50%',
                    transform: 'translateY(-50%)', color: colors.textTertiary,
                  }} />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    style={{
                      width: '100%',
                      padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} 36px`,
                      border: `1px solid ${colors.borderDefault}`,
                      borderRadius: borderRadius.base,
                      fontSize: typography.fontSize.sm,
                      color: colors.textPrimary,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ width: 180 }}>
                <label style={{
                  display: 'block',
                  fontSize: typography.fontSize.label,
                  fontWeight: typography.fontWeight.medium,
                  color: colors.textSecondary,
                  marginBottom: spacing['1'],
                }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  style={{
                    width: '100%',
                    padding: `${spacing['2']} ${spacing['3']}`,
                    border: `1px solid ${colors.borderDefault}`,
                    borderRadius: borderRadius.base,
                    fontSize: typography.fontSize.sm,
                    color: colors.textPrimary,
                    backgroundColor: colors.surfaceRaised,
                    outline: 'none',
                  }}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleInvite}
                style={{
                  padding: `${spacing['2']} ${spacing['4']}`,
                  backgroundColor: colors.primaryOrange,
                  color: '#fff',
                  border: 'none',
                  borderRadius: borderRadius.base,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Send Invite
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: spacing['5'] }}>
        <Search size={16} style={{
          position: 'absolute', left: '12px', top: '50%',
          transform: 'translateY(-50%)', color: colors.textTertiary,
        }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team members..."
          style={{
            width: '100%',
            padding: `${spacing['2']} ${spacing['4']} ${spacing['2']} 38px`,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.sm,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Members list */}
      <div style={{
        backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: shadows.card,
        overflow: 'hidden',
      }}>
        {filteredMembers.map((member, i) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: `${spacing['4']} ${spacing['5']}`,
              borderBottom: i < filteredMembers.length - 1 ? `1px solid ${colors.borderSubtle}` : 'none',
              transition: `background-color ${transitions.instant}`,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surfaceHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {/* Avatar */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: borderRadius.full,
              backgroundColor: ROLE_COLORS[member.role] + '15',
              color: ROLE_COLORS[member.role],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              marginRight: spacing['3'],
              flexShrink: 0,
            }}>
              {member.first_name[0]}{member.last_name[0]}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: typography.fontSize.body,
                fontWeight: typography.fontWeight.medium,
                color: colors.textPrimary,
              }}>
                {member.first_name} {member.last_name}
              </div>
              <div style={{
                fontSize: typography.fontSize.caption,
                color: colors.textTertiary,
                marginTop: '1px',
              }}>
                {member.email}
              </div>
            </div>

            {/* Role badge */}
            <div style={{
              padding: `${spacing['1']} ${spacing['3']}`,
              borderRadius: borderRadius.full,
              backgroundColor: ROLE_COLORS[member.role] + '10',
              color: ROLE_COLORS[member.role],
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
              letterSpacing: typography.letterSpacing.wide,
            }}>
              {ROLE_LABELS[member.role]}
            </div>

            {/* Status */}
            <div style={{
              width: 8,
              height: 8,
              borderRadius: borderRadius.full,
              backgroundColor: member.is_active ? colors.statusActive : colors.textTertiary,
              marginLeft: spacing['4'],
            }} />
          </div>
        ))}

        {filteredMembers.length === 0 && (
          <div style={{
            padding: spacing['10'],
            textAlign: 'center',
            color: colors.textTertiary,
            fontSize: typography.fontSize.sm,
          }}>
            {search ? 'No members match your search.' : 'No team members yet. Invite your first member above.'}
          </div>
        )}
      </div>
    </div>
  );
}
