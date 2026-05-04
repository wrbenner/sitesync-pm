import { fromTable } from '../../lib/db/queries'
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {

  UserPlus, Mail, Search, Check, Shield, Users,
  X, _Copy, _Clock, AlertCircle, _MoreHorizontal,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { supabase, fromTable } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import type { Profile } from '../../types/database';

import { PermissionGate } from '../../components/auth/PermissionGate';

/* ─────────────────────── Constants ─────────────────────── */

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  company_admin: { label: 'Admin', color: colors.primaryOrange, description: 'Full access to all settings and data' },
  admin: { label: 'Admin', color: colors.primaryOrange, description: 'Full access to all settings and data' },
  project_manager: { label: 'Project Manager', color: colors.statusInfo, description: 'Manage projects, teams, and workflows' },
  superintendent: { label: 'Superintendent', color: colors.statusActive, description: 'Field oversight and daily operations' },
  engineer: { label: 'Engineer', color: colors.statusReview, description: 'Technical review and documentation' },
  subcontractor: { label: 'Subcontractor', color: colors.statusPending, description: 'Trade-specific access' },
  subcontractor_pm: { label: 'Sub PM', color: colors.statusPending, description: 'Subcontractor project management' },
  foreman: { label: 'Foreman', color: colors.statusActive, description: 'Crew and field management' },
  crew: { label: 'Crew', color: colors.textTertiary, description: 'Basic field access' },
  architect: { label: 'Architect', color: colors.statusReview, description: 'Design review and coordination' },
  client: { label: 'Client', color: colors.statusInfo, description: 'View-only project oversight' },
  viewer: { label: 'Viewer', color: colors.textTertiary, description: 'Read-only access' },
};

const INVITE_ROLES = [
  'company_admin', 'project_manager', 'superintendent', 'engineer',
  'subcontractor', 'foreman', 'viewer',
] as const;

const APPLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: role, color: colors.textTertiary, description: '' };
}

function getInitials(first?: string | null, last?: string | null): string {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || 'U';
}

/* ─────────────────────── Main Component ─────────────────────── */

export function UserManagement() {
  const { company, profile } = useAuthStore();
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('project_manager');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Search focus
  const [searchFocused, setSearchFocused] = useState(false);

  const loadMembers = async () => {
    // Without a company, there's nothing to fetch — but we still need to
    // exit the loading state so the page renders the empty state instead
    // of pulsing skeleton cards forever.
    if (!company?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', company.id)
      .order('created_at');
    if (data) setMembers(data as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, [company?.id]);

  const handleInvite = async () => {
    if (!inviteEmail || !company?.id) return;
    setInviteLoading(true);
    setInviteError(null);

    try {
      const { error } = await fromTable('invitations').insert({
        company_id: company.id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: profile!.id,
        status: 'pending',
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) {
        setInviteError(error.message ?? 'Failed to send invitation');
        setInviteLoading(false);
        return;
      }
      setInviteSuccess(true);
      setTimeout(() => {
        setInviteSuccess(false);
        setInviteEmail('');
        setShowInvite(false);
      }, 2000);
    } catch {
      setInviteError('Something went wrong');
    }
    setInviteLoading(false);
  };

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter((m) =>
      `${m.first_name ?? ''} ${m.last_name ?? ''} ${m.full_name ?? ''}`.toLowerCase().includes(q)
    );
  }, [members, search]);

  // Stats
  const roleBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of members) {
      const role = (m.role as string) || 'viewer';
      map[role] = (map[role] || 0) + 1;
    }
    return Object.entries(map)
      .map(([role, count]) => ({ ...getRoleConfig(role), role, count }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: `${spacing['8']} ${spacing['6']}`,
      fontFamily: typography.fontFamily,
    }}>
      {/* ─── Header ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing['6'],
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['1'] }}>
            <div style={{
              width: 36, height: 36, borderRadius: borderRadius.lg,
              background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(244, 120, 32, 0.25)',
            }}>
              <Users size={18} color={colors.white} strokeWidth={2} />
            </div>
            <h1 style={{
              fontSize: typography.fontSize.heading,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              letterSpacing: typography.letterSpacing.tight,
              margin: 0,
            }}>
              Team
            </h1>
          </div>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textTertiary,
            margin: 0, marginTop: spacing['1'],
            marginLeft: 48,
          }}>
            {company?.name} &middot; {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>

        <PermissionGate permission="project.members">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowInvite(!showInvite)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['2.5']} ${spacing['5']}`,
              background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(244, 120, 32, 0.25)',
            }}
          >
            <UserPlus size={16} />
            Invite Member
          </motion.button>
        </PermissionGate>
      </div>

      {/* ─── Role Breakdown Pills ─── */}
      {roleBreakdown.length > 0 && (
        <div style={{
          display: 'flex', gap: spacing['2'], flexWrap: 'wrap',
          marginBottom: spacing['5'],
        }}>
          {roleBreakdown.map(({ role, label, color, count }) => (
            <div key={role} style={{
              display: 'flex', alignItems: 'center', gap: spacing['1.5'],
              padding: `${spacing['1']} ${spacing['3']}`,
              borderRadius: borderRadius.full,
              backgroundColor: `${color}10`,
              border: `1px solid ${color}20`,
              fontSize: typography.fontSize.caption,
              fontWeight: typography.fontWeight.medium,
              color,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: color,
              }} />
              {count} {label}{count !== 1 ? 's' : ''}
            </div>
          ))}
        </div>
      )}

      {/* ─── Invite Panel ─── */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: parseInt(spacing['5']) }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.25, ease: APPLE_EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.xl,
              padding: spacing['5'],
              boxShadow: shadows.card,
            }}>
              {inviteSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['3'],
                    padding: spacing['3'],
                    borderRadius: borderRadius.md,
                    backgroundColor: colors.statusActiveSubtle,
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: borderRadius.full,
                    backgroundColor: colors.statusActive,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={16} color={colors.white} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p style={{
                      margin: 0, fontSize: typography.fontSize.body,
                      fontWeight: typography.fontWeight.medium, color: colors.statusActive,
                    }}>
                      Invitation sent
                    </p>
                    <p style={{
                      margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary,
                    }}>
                      {inviteEmail} will receive an email shortly
                    </p>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: spacing['4'],
                  }}>
                    <h3 style={{
                      margin: 0, fontSize: typography.fontSize.title,
                      fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
                    }}>
                      Invite a team member
                    </h3>
                    <button
                      onClick={() => setShowInvite(false)}
                      style={{
                        width: 28, height: 28, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', backgroundColor: 'transparent',
                        border: `1px solid ${colors.borderSubtle}`,
                        borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary,
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {inviteError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: spacing['3'], borderRadius: borderRadius.md,
                          backgroundColor: colors.statusCriticalSubtle,
                          color: colors.statusCritical,
                          fontSize: typography.fontSize.sm,
                          marginBottom: spacing['4'],
                        }}
                      >
                        <AlertCircle size={14} />
                        {inviteError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ display: 'flex', gap: spacing['3'], alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block', fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textSecondary, marginBottom: spacing['1.5'],
                      }}>
                        Email address
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={16} style={{
                          position: 'absolute', left: spacing['3'], top: '50%',
                          transform: 'translateY(-50%)', color: colors.textTertiary,
                        }} />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@company.com"
                          onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail) handleInvite() }}
                          style={{
                            width: '100%', height: 40,
                            padding: `0 ${spacing['3']} 0 38px`,
                            border: `1px solid ${colors.borderSubtle}`,
                            borderRadius: borderRadius.md,
                            fontSize: typography.fontSize.body,
                            fontFamily: typography.fontFamily,
                            color: colors.textPrimary,
                            backgroundColor: colors.surfaceInset,
                            outline: 'none',
                            boxSizing: 'border-box',
                            transition: `border-color 120ms ease`,
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = colors.primaryOrange}
                          onBlur={(e) => e.currentTarget.style.borderColor = colors.borderSubtle}
                        />
                      </div>
                    </div>

                    <div style={{ width: 180 }}>
                      <label style={{
                        display: 'block', fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textSecondary, marginBottom: spacing['1.5'],
                      }}>
                        Role
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        style={{
                          width: '100%', height: 40,
                          padding: `0 ${spacing['3']}`,
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          fontSize: typography.fontSize.body,
                          fontFamily: typography.fontFamily,
                          color: colors.textPrimary,
                          backgroundColor: colors.surfaceInset,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {INVITE_ROLES.map((r) => (
                          <option key={r} value={r}>{getRoleConfig(r).label}</option>
                        ))}
                      </select>
                    </div>

                    <PermissionGate permission="project.members">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleInvite}
                        disabled={inviteLoading || !inviteEmail}
                        style={{
                          height: 40,
                          padding: `0 ${spacing['5']}`,
                          background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
                          color: colors.white,
                          border: 'none',
                          borderRadius: borderRadius.md,
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          fontFamily: typography.fontFamily,
                          cursor: inviteLoading ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                          opacity: inviteLoading || !inviteEmail ? 0.6 : 1,
                          boxShadow: '0 2px 8px rgba(244, 120, 32, 0.2)',
                        }}
                      >
                        {inviteLoading ? 'Sending...' : 'Send Invite'}
                      </motion.button>
                    </PermissionGate>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Search ─── */}
      <div style={{ position: 'relative', marginBottom: spacing['4'] }}>
        <Search size={16} style={{
          position: 'absolute', left: spacing['3'], top: '50%',
          transform: 'translateY(-50%)',
          color: searchFocused ? colors.primaryOrange : colors.textTertiary,
          transition: 'color 120ms ease',
        }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team members..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: '100%', height: 40,
            padding: `0 ${spacing['4']} 0 38px`,
            border: `1px solid ${searchFocused ? colors.primaryOrange : colors.borderSubtle}`,
            borderRadius: borderRadius.md,
            fontSize: typography.fontSize.body,
            fontFamily: typography.fontFamily,
            color: colors.textPrimary,
            backgroundColor: colors.surfaceRaised,
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: searchFocused ? `0 0 0 3px ${colors.orangeSubtle}` : 'none',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: spacing['3'], top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none',
              color: colors.textTertiary, cursor: 'pointer',
              padding: 0, display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ─── Members Grid ─── */}
      {loading ? (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: spacing['3'],
        }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 100,
              borderRadius: borderRadius.xl,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: `${spacing['14']} ${spacing['6']}`,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.xl,
          border: `1px solid ${colors.borderSubtle}`,
        }}>
          <Users size={40} color={colors.textTertiary} strokeWidth={1} style={{ marginBottom: spacing['4'] }} />
          <h3 style={{
            margin: 0, fontSize: typography.fontSize.subtitle,
            fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
          }}>
            {search ? 'No results found' : 'No team members yet'}
          </h3>
          <p style={{
            margin: 0, marginTop: spacing['2'],
            fontSize: typography.fontSize.body, color: colors.textTertiary,
          }}>
            {search ? `No members match "${search}"` : 'Invite your first team member to get started'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: spacing['3'],
        }}>
          {filteredMembers.map((member, i) => {
            const roleConf = getRoleConfig((member.role as string) || 'viewer');
            const initials = getInitials(member.first_name, member.last_name);
            const name = member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown';
            const isCurrentUser = profile?.id === member.id;

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3, ease: APPLE_EASE }}
                style={{
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.xl,
                  border: `1px solid ${colors.borderSubtle}`,
                  padding: spacing['5'],
                  transition: `all 160ms ease`,
                  cursor: 'default',
                  position: 'relative',
                }}
                whileHover={{
                  boxShadow: shadows.cardHover,
                  borderColor: colors.borderDefault,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44,
                    borderRadius: borderRadius.full,
                    background: member.avatar_url
                      ? `url(${member.avatar_url}) center/cover`
                      : `linear-gradient(135deg, ${roleConf.color}30, ${roleConf.color}15)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: typography.fontSize.body,
                    fontWeight: typography.fontWeight.semibold,
                    color: roleConf.color,
                    flexShrink: 0,
                    border: `2px solid ${roleConf.color}20`,
                  }}>
                    {!member.avatar_url && initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
                      <span style={{
                        fontSize: typography.fontSize.body,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {name}
                      </span>
                      {isCurrentUser && (
                        <span style={{
                          fontSize: typography.fontSize.caption,
                          color: colors.primaryOrange,
                          fontWeight: typography.fontWeight.medium,
                          padding: `0 ${spacing['1.5']}`,
                          backgroundColor: colors.orangeSubtle,
                          borderRadius: borderRadius.sm,
                        }}>
                          You
                        </span>
                      )}
                    </div>

                    {member.job_title && (
                      <p style={{
                        margin: 0, marginTop: 2,
                        fontSize: typography.fontSize.sm,
                        color: colors.textSecondary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {member.job_title}
                      </p>
                    )}

                    {member.phone && (
                      <p style={{
                        margin: 0, marginTop: 2,
                        fontSize: typography.fontSize.caption,
                        color: colors.textTertiary,
                      }}>
                        {member.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role badge */}
                <div style={{
                  marginTop: spacing['3'],
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'],
                    padding: `${spacing['1']} ${spacing['3']}`,
                    borderRadius: borderRadius.full,
                    backgroundColor: `${roleConf.color}10`,
                    border: `1px solid ${roleConf.color}18`,
                  }}>
                    <Shield size={12} color={roleConf.color} />
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      color: roleConf.color,
                    }}>
                      {roleConf.label}
                    </span>
                  </div>

                  {member.trade && (
                    <span style={{
                      fontSize: typography.fontSize.caption,
                      color: colors.textTertiary,
                      fontWeight: typography.fontWeight.medium,
                    }}>
                      {member.trade}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );
}
