import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Users, Building2, MapPin, Calendar, DollarSign,
  FileText, HardHat, CheckCircle, Settings, Shield,
  UserPlus, Mail, Check, X, AlertCircle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useProjectContext } from '../../stores/projectContextStore';
import { useAuthStore } from '../../stores/authStore';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { fromTable } from '../../lib/supabase';
import { resetDemoProject } from '../../services/demoSeed';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';

/* ─────────────────────── Constants ─────────────────────── */

const PROJECT_TYPES = [
  { value: 'commercial_office', label: 'Commercial Office', icon: '🏢' },
  { value: 'mixed_use', label: 'Mixed Use', icon: '🏙️' },
  { value: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { value: 'education', label: 'Education', icon: '🎓' },
  { value: 'multifamily', label: 'Multifamily', icon: '🏘️' },
  { value: 'industrial', label: 'Industrial', icon: '🏭' },
  { value: 'data_center', label: 'Data Center', icon: '💾' },
  { value: 'retail', label: 'Retail', icon: '🛍️' },
  { value: 'hospitality', label: 'Hospitality', icon: '🏨' },
  { value: 'government', label: 'Government', icon: '🏛️' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '🌉' },
] as const;

const ROLE_COLORS: Record<string, string> = {
  project_manager: colors.statusInfo,
  superintendent: colors.statusActive,
  admin: colors.primaryOrange,
  company_admin: colors.primaryOrange,
  engineer: colors.statusReview,
  subcontractor: colors.statusPending,
  foreman: colors.statusActive,
  viewer: colors.textTertiary,
};

const INVITE_ROLES: { value: string; label: string }[] = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'foreman', label: 'Foreman' },
  { value: 'viewer', label: 'Viewer' },
];

const APPLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function formatCurrency(val: string): string {
  const num = val.replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString('en-US');
}

/* ─────────────────────── Sub-components ─────────────────────── */

interface MemberWithProfile {
  profile?: { first_name?: string; last_name?: string; avatar_url?: string | null } | null;
}

const SettingsField: React.FC<{
  label: string;
  icon: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, icon, hint, children }) => (
  <div>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: spacing['1.5'],
    }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: spacing['1.5'],
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.textSecondary,
        userSelect: 'none',
      }}>
        <span style={{ color: colors.textTertiary, display: 'flex' }}>{icon}</span>
        {label}
      </label>
      {hint && (
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
        }}>
          {hint}
        </span>
      )}
    </div>
    {children}
  </div>
);

const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, icon, badge, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: APPLE_EASE }}
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
      boxShadow: shadows.card,
      overflow: 'hidden',
      marginBottom: spacing['5'],
    }}
  >
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: `${spacing['4']} ${spacing['6']}`,
      borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      <h2 style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        margin: 0,
        display: 'flex', alignItems: 'center', gap: spacing['2.5'],
      }}>
        <span style={{ color: colors.primaryOrange, display: 'flex' }}>{icon}</span>
        {title}
      </h2>
      {badge && (
        <span style={{
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          padding: `${spacing['1']} ${spacing['3']}`,
          backgroundColor: colors.surfaceInset,
          borderRadius: borderRadius.full,
          fontWeight: typography.fontWeight.medium,
        }}>
          {badge}
        </span>
      )}
    </div>
    <div style={{ padding: `${spacing['5']} ${spacing['6']}` }}>
      {children}
    </div>
  </motion.div>
);

/* ─────────────────────── Main Component ─────────────────────── */

// ── Demo project controls ─────────────────────────────────
// Visible only on projects flagged is_demo = true. Lets the owner reset
// the curated Maple Ridge fixture back to its pristine state — useful
// during sales demos when previous demos have left the data dirty.

const DemoProjectSection: React.FC<{ orgId: string }> = ({ orgId }) => {
  const [resetting, setResetting] = useState(false)

  const handleReset = async () => {
    if (!orgId) {
      toast.error('Organization context unavailable; cannot reset demo.')
      return
    }
    if (!window.confirm(
      'Reset all demo data back to its starting state? Any changes made to RFIs, submittals, change orders, etc. on this demo project will be overwritten.',
    )) return

    setResetting(true)
    try {
      const result = await resetDemoProject(orgId)
      if (result.ok) {
        toast.success(`Demo reset complete (${result.rows_inserted} rows refreshed). Reloading…`)
        setTimeout(() => window.location.reload(), 800)
      } else {
        const failedTables = result.errors.map((e) => e.table).join(', ')
        toast.error(`Demo reset partially failed for: ${failedTables}. See console for details.`)
        console.error('[demo reset] errors:', result.errors)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Demo reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <section
      style={{
        marginTop: spacing['6'],
        padding: spacing['5'],
        borderRadius: borderRadius.lg,
        border: `1px dashed ${colors.borderDefault}`,
        background: colors.surfaceInset,
      }}
      aria-label="Demo project controls"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing['3'] }}>
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: borderRadius.md,
            background: `${colors.statusInfo}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={18} color={colors.statusInfo} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
            This is the Maple Ridge demo project
          </h3>
          <p style={{ margin: `${spacing['1']} 0 ${spacing['3']}`, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
            Pre-populated with realistic RFIs, submittals, change orders, daily logs, and punch items so new users never see an empty dashboard. Click below to restore the original demo data — useful before a sales walkthrough.
          </p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: `${spacing['2']} ${spacing['4']}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              background: colors.surfaceRaised,
              color: colors.textPrimary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: resetting ? 'wait' : 'pointer',
              opacity: resetting ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} />
            {resetting ? 'Resetting…' : 'Reset demo data'}
          </button>
        </div>
      </div>
    </section>
  )
}

export function ProjectSettings() {
  const { activeProject, updateProject, members, loadMembers } = useProjectContext();
  const { company, profile } = useAuthStore();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('project_manager');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeProject) {
      setTimeout(() => {
        setName(activeProject.name);
        setAddress(activeProject.address ?? '');
        setProjectType(activeProject.project_type ?? '');
        setTotalValue(activeProject.total_value ? formatCurrency(String(activeProject.total_value)) : '');
        setDescription(activeProject.description ?? '');
        setStartDate(activeProject.start_date ?? '');
        setEndDate(activeProject.scheduled_end_date ?? '');
        setHasChanges(false);
        loadMembers(activeProject.id);
      }, 0);
    }
  }, [activeProject?.id]);

  const markDirty = () => setHasChanges(true);

  const handleSave = async () => {
    if (!activeProject) return;
    setSaving(true);
    const rawValue = totalValue.replace(/[^0-9]/g, '');
    await updateProject(activeProject.id, {
      name,
      address: address || null,
      project_type: projectType || null,
      total_value: rawValue ? parseFloat(rawValue) : null,
      description: description || null,
      start_date: startDate || null,
      scheduled_end_date: endDate || null,
    });
    setSaving(false);
    setSaved(true);
    setHasChanges(false);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputStyle = (_focused?: boolean): React.CSSProperties => ({
    width: '100%',
    height: 40,
    padding: `0 ${spacing['3']}`,
    border: `1px solid ${colors.borderSubtle}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceInset,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  });

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = colors.primaryOrange;
      e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.orangeSubtle}`;
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = colors.borderSubtle;
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  if (!activeProject) {
    return (
      <div style={{
        maxWidth: 800, margin: '0 auto', padding: `${spacing['14']} ${spacing['6']}`,
        textAlign: 'center', fontFamily: typography.fontFamily,
      }}>
        <Settings size={40} color={colors.textTertiary} strokeWidth={1} style={{ marginBottom: spacing['4'] }} />
        <h2 style={{
          margin: 0, fontSize: typography.fontSize.subtitle,
          fontWeight: typography.fontWeight.semibold, color: colors.textPrimary,
        }}>
          No project selected
        </h2>
        <p style={{
          margin: 0, marginTop: spacing['2'],
          fontSize: typography.fontSize.body, color: colors.textTertiary,
        }}>
          Select a project from the sidebar to configure its settings
        </p>
      </div>
    );
  }



  return (
    <div style={{
      maxWidth: 800,
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
              <Settings size={18} color={colors.white} strokeWidth={2} />
            </div>
            <h1 style={{
              fontSize: typography.fontSize.heading,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              letterSpacing: typography.letterSpacing.tight,
              margin: 0,
            }}>
              Project Settings
            </h1>
          </div>
          <p style={{
            fontSize: typography.fontSize.body,
            color: colors.textTertiary,
            margin: 0, marginTop: spacing['1'], marginLeft: 48,
          }}>
            Configure {activeProject.name}
          </p>
        </div>

        <PermissionGate permission="project.settings">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving || !hasChanges}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing['2'],
              padding: `${spacing['2.5']} ${spacing['5']}`,
              background: saved
                ? `linear-gradient(135deg, ${colors.statusActive}, #34D399)`
                : hasChanges
                  ? `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`
                  : colors.surfaceInset,
              color: saved || hasChanges ? colors.white : colors.textTertiary,
              border: saved || hasChanges ? 'none' : `1px solid ${colors.borderSubtle}`,
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              fontFamily: typography.fontFamily,
              cursor: saving || !hasChanges ? 'default' : 'pointer',
              boxShadow: hasChanges ? '0 2px 8px rgba(244, 120, 32, 0.25)' : 'none',
              transition: 'all 200ms ease',
            }}
          >
            {saved ? (
              <>
                <CheckCircle size={16} />
                Saved
              </>
            ) : saving ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'flex' }}
                >
                  <Save size={16} />
                </motion.span>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </motion.button>
        </PermissionGate>
      </div>

      {/* ─── Project Details ─── */}
      <SectionCard title="Project Details" icon={<Building2 size={18} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>
          {/* Name */}
          <SettingsField label="Project Name" icon={<Building2 size={14} />}>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              style={inputStyle()}
              {...focusHandlers}
            />
          </SettingsField>

          {/* Address */}
          <SettingsField label="Project Address" icon={<MapPin size={14} />} hint="Used for weather & location">
            <input
              value={address}
              onChange={(e) => { setAddress(e.target.value); markDirty(); }}
              placeholder="123 Main St, City, State ZIP"
              style={inputStyle()}
              {...focusHandlers}
            />
          </SettingsField>

          {/* Type + Value side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
            <SettingsField label="Project Type" icon={<HardHat size={14} />}>
              <select
                value={projectType}
                onChange={(e) => { setProjectType(e.target.value); markDirty(); }}
                style={{ ...inputStyle(), cursor: 'pointer' }}
                {...focusHandlers}
              >
                <option value="">Select type</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </SettingsField>

            <SettingsField label="Contract Value" icon={<DollarSign size={14} />}>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: spacing['3'], top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: typography.fontSize.body,
                  color: totalValue ? colors.textPrimary : colors.textTertiary,
                  pointerEvents: 'none',
                }}>
                  $
                </span>
                <input
                  value={totalValue}
                  onChange={(e) => { setTotalValue(formatCurrency(e.target.value)); markDirty(); }}
                  placeholder="0"
                  inputMode="numeric"
                  style={{ ...inputStyle(), paddingLeft: spacing['6'] }}
                  {...focusHandlers}
                />
              </div>
            </SettingsField>
          </div>

          {/* Dates side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['4'] }}>
            <SettingsField label="Start Date" icon={<Calendar size={14} />}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); markDirty(); }}
                style={{ ...inputStyle(), colorScheme: 'light' }}
                {...focusHandlers}
              />
            </SettingsField>

            <SettingsField label="Target Completion" icon={<Calendar size={14} />}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); markDirty(); }}
                min={startDate || undefined}
                style={{ ...inputStyle(), colorScheme: 'light' }}
                {...focusHandlers}
              />
            </SettingsField>
          </div>

          {/* Description */}
          <SettingsField label="Description" icon={<FileText size={14} />} hint="Brief project overview">
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); markDirty(); }}
              placeholder="Scope, goals, or special considerations..."
              rows={3}
              style={{
                ...inputStyle(),
                height: 'auto',
                padding: `${spacing['2.5']} ${spacing['3']}`,
                resize: 'vertical',
                minHeight: 72,
                lineHeight: typography.lineHeight.normal,
              }}
              {...focusHandlers}
            />
          </SettingsField>
        </div>
      </SectionCard>

      {/* ─── Project Team ─── */}
      <SectionCard
        title="Project Team"
        icon={<Users size={18} />}
        badge={`${members.length} member${members.length !== 1 ? 's' : ''}`}
      >
        {/* Invite inline */}
        <AnimatePresence>
          {showInvite && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: parseInt(spacing['4']) }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: APPLE_EASE }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: spacing['4'],
                borderRadius: borderRadius.lg,
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
              }}>
                {inviteSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: spacing['3'],
                      padding: spacing['2'],
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: borderRadius.full,
                      backgroundColor: colors.statusActive,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={14} color={colors.white} strokeWidth={2.5} />
                    </div>
                    <span style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium, color: colors.statusActive,
                    }}>
                      Invitation sent to {inviteEmail}
                    </span>
                  </motion.div>
                ) : (
                  <>
                    <AnimatePresence>
                      {inviteError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: spacing['2'],
                            padding: spacing['2'], borderRadius: borderRadius.md,
                            backgroundColor: colors.statusCriticalSubtle,
                            color: colors.statusCritical,
                            fontSize: typography.fontSize.sm,
                            marginBottom: spacing['3'],
                          }}
                        >
                          <AlertCircle size={14} />
                          {inviteError}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Mail size={14} style={{
                          position: 'absolute', left: spacing['2.5'], top: '50%',
                          transform: 'translateY(-50%)', color: colors.textTertiary,
                        }} />
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Email address"
                          onKeyDown={(e) => { if (e.key === 'Enter' && inviteEmail) handleInvite(); }}
                          style={{
                            width: '100%', height: 36,
                            padding: `0 ${spacing['2.5']} 0 32px`,
                            border: `1px solid ${colors.borderSubtle}`,
                            borderRadius: borderRadius.md,
                            fontSize: typography.fontSize.sm,
                            fontFamily: typography.fontFamily,
                            color: colors.textPrimary,
                            backgroundColor: colors.surfaceRaised,
                            outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 120ms ease',
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = colors.primaryOrange}
                          onBlur={(e) => e.currentTarget.style.borderColor = colors.borderSubtle}
                        />
                      </div>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        style={{
                          height: 36, width: 150,
                          padding: `0 ${spacing['2.5']}`,
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md,
                          fontSize: typography.fontSize.sm,
                          fontFamily: typography.fontFamily,
                          color: colors.textPrimary,
                          backgroundColor: colors.surfaceRaised,
                          outline: 'none', cursor: 'pointer',
                        }}
                      >
                        {INVITE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleInvite}
                        disabled={inviteLoading || !inviteEmail}
                        style={{
                          height: 36,
                          padding: `0 ${spacing['4']}`,
                          background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
                          color: colors.white,
                          border: 'none', borderRadius: borderRadius.md,
                          fontSize: typography.fontSize.sm,
                          fontWeight: typography.fontWeight.semibold,
                          fontFamily: typography.fontFamily,
                          cursor: inviteLoading || !inviteEmail ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap',
                          opacity: inviteLoading || !inviteEmail ? 0.6 : 1,
                          boxShadow: '0 2px 8px rgba(244, 120, 32, 0.2)',
                        }}
                      >
                        {inviteLoading ? 'Sending...' : 'Send'}
                      </motion.button>
                      <button
                        onClick={() => { setShowInvite(false); setInviteError(null); }}
                        style={{
                          width: 36, height: 36, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'transparent',
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: borderRadius.md, cursor: 'pointer',
                          color: colors.textTertiary, flexShrink: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {members.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: `${spacing['8']} ${spacing['4']}`,
          }}>
            <Users size={36} color={colors.textTertiary} strokeWidth={1} style={{ marginBottom: spacing['3'] }} />
            <p style={{
              margin: 0, fontSize: typography.fontSize.body,
              fontWeight: typography.fontWeight.medium, color: colors.textPrimary,
            }}>
              No team members yet
            </p>
            <p style={{
              margin: 0, marginTop: spacing['2'],
              fontSize: typography.fontSize.sm, color: colors.textTertiary,
            }}>
              Invite your first team member to get started
            </p>
            {!showInvite && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowInvite(true)}
                style={{
                  marginTop: spacing['4'],
                  display: 'inline-flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['4']}`,
                  background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
                  color: colors.white,
                  border: 'none', borderRadius: borderRadius.md,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(244, 120, 32, 0.2)',
                }}
              >
                <UserPlus size={14} />
                Invite Member
              </motion.button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2'] }}>
              {members.map((member) => {
                const prof = (member as unknown as MemberWithProfile).profile;
                const name = prof
                  ? `${prof.first_name ?? ''} ${prof.last_name ?? ''}`.trim()
                  : '';
                const displayName = name || 'Team Member';
                const initials = name
                  ? `${(prof?.first_name || '')[0] || ''}${(prof?.last_name || '')[0] || ''}`.toUpperCase()
                  : member.user_id?.substring(0, 2).toUpperCase() ?? '??';
                const roleColor = ROLE_COLORS[member.role] ?? colors.textTertiary;

                return (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: `${spacing['3']} ${spacing['3']}`,
                      borderRadius: borderRadius.lg,
                      transition: `background-color 120ms ease`,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.surfaceHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{
                      width: 36, height: 36,
                      borderRadius: borderRadius.full,
                      background: prof?.avatar_url
                        ? `url(${prof.avatar_url}) center/cover`
                        : `linear-gradient(135deg, ${roleColor}30, ${roleColor}15)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.semibold,
                      color: roleColor,
                      marginRight: spacing['3'],
                      border: `2px solid ${roleColor}20`,
                      flexShrink: 0,
                    }}>
                      {!prof?.avatar_url && initials}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: typography.fontSize.body,
                        fontWeight: typography.fontWeight.medium,
                        color: colors.textPrimary,
                      }}>
                        {displayName}
                      </div>
                    </div>

                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'],
                      padding: `${spacing['1']} ${spacing['3']}`,
                      borderRadius: borderRadius.full,
                      backgroundColor: `${roleColor}10`,
                      border: `1px solid ${roleColor}18`,
                    }}>
                      <Shield size={11} color={roleColor} />
                      <span style={{
                        fontSize: typography.fontSize.caption,
                        fontWeight: typography.fontWeight.medium,
                        color: roleColor,
                        textTransform: 'capitalize',
                      }}>
                        {member.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add member button below list */}
            {!showInvite && (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowInvite(true)}
                style={{
                  marginTop: spacing['3'],
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: spacing['2'],
                  padding: `${spacing['2.5']} ${spacing['4']}`,
                  backgroundColor: 'transparent',
                  border: `1px dashed ${colors.borderDefault}`,
                  borderRadius: borderRadius.lg,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  fontFamily: typography.fontFamily,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.primaryOrange;
                  e.currentTarget.style.color = colors.primaryOrange;
                  e.currentTarget.style.backgroundColor = colors.orangeSubtle;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.borderDefault;
                  e.currentTarget.style.color = colors.textSecondary;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <UserPlus size={14} />
                Add Team Member
              </motion.button>
            )}
          </>
        )}
      </SectionCard>

      {/* Demo project controls — only visible on the seeded demo project. */}
      {(activeProject as { is_demo?: boolean } | null)?.is_demo && (
        <DemoProjectSection
          orgId={(activeProject as { organization_id?: string }).organization_id ?? ''}
        />
      )}

      {/* Unsaved changes indicator */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: APPLE_EASE }}
            style={{
              position: 'fixed',
              bottom: spacing['6'],
              left: '50%',
              transform: 'translateX(-50%)',
              padding: `${spacing['3']} ${spacing['5']}`,
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.full,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              border: `1px solid ${colors.borderSubtle}`,
              display: 'flex', alignItems: 'center', gap: spacing['3'],
              zIndex: 100,
            }}
          >
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: colors.primaryOrange,
            }} />
            <span style={{
              fontSize: typography.fontSize.sm,
              color: colors.textPrimary,
              fontWeight: typography.fontWeight.medium,
            }}>
              Unsaved changes
            </span>
            <PermissionGate permission="project.settings">
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: `${spacing['1']} ${spacing['3']}`,
                  background: `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
                  color: colors.white,
                  border: 'none',
                  borderRadius: borderRadius.full,
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.semibold,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </PermissionGate>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
