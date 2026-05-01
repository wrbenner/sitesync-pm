import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, Building2, Briefcase, Shield, Camera,
  Bell, BellOff, ChevronRight, LogOut, Check, Pencil,
  Moon, Sun, KeyRound, Palette,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/theme';
import { useNavigate } from 'react-router-dom';
import { MfaEnrollment } from '../components/auth/MfaEnrollment';

/* ─────────────────────── Constants ─────────────────────── */

const APPLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  company_admin: { label: 'Administrator', color: colors.primaryOrange },
  admin: { label: 'Administrator', color: colors.primaryOrange },
  project_manager: { label: 'Project Manager', color: colors.statusInfo },
  superintendent: { label: 'Superintendent', color: colors.statusActive },
  engineer: { label: 'Engineer', color: colors.statusReview },
  subcontractor: { label: 'Subcontractor', color: colors.statusPending },
  foreman: { label: 'Foreman', color: colors.statusActive },
  architect: { label: 'Architect', color: colors.statusReview },
  viewer: { label: 'Viewer', color: colors.textTertiary },
  crew: { label: 'Crew', color: colors.textTertiary },
  client: { label: 'Client', color: colors.statusInfo },
};

function getRoleInfo(role: string) {
  return ROLE_LABELS[role] ?? { label: role?.replace('_', ' ') || 'Member', color: colors.textTertiary };
}

/* ─────────────────────── Sub-components ─────────────────────── */

const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}> = ({ title, icon, delay = 0, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, ease: APPLE_EASE, delay }}
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
      overflow: 'hidden',
    }}
  >
    <div style={{
      padding: `${spacing['4']} ${spacing['5']}`,
      borderBottom: `1px solid ${colors.borderSubtle}`,
      display: 'flex', alignItems: 'center', gap: spacing['2.5'],
    }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.orangeSubtle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.primaryOrange,
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: typography.fontSize.base,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </span>
    </div>
    <div style={{ padding: `${spacing['4']} ${spacing['5']}` }}>
      {children}
    </div>
  </motion.div>
);

const ProfileField: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  editable?: boolean;
  editing?: boolean;
  onChange?: (v: string) => void;
  onEditToggle?: () => void;
  type?: string;
  last?: boolean;
}> = ({ label, value, icon, editable, editing, onChange, onEditToggle, type = 'text', last }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: spacing['3'],
    padding: `${spacing['3']} 0`,
    borderBottom: last ? 'none' : `1px solid ${colors.borderSubtle}`,
  }}>
    <div style={{
      width: 36, height: 36,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surfaceInset,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: colors.textTertiary, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{
        fontSize: '11px', fontWeight: typography.fontWeight.medium,
        color: colors.textTertiary, margin: 0, textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {label}
      </p>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEditToggle?.(); if (e.key === 'Escape') onEditToggle?.(); }}
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.medium,
            color: colors.textPrimary,
            backgroundColor: 'transparent',
            border: 'none', borderBottom: `2px solid ${colors.primaryOrange}`,
            outline: 'none', width: '100%', padding: `${spacing['1']} 0`,
            fontFamily: typography.fontFamily,
          }}
        />
      ) : (
        <p style={{
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.medium,
          color: value ? colors.textPrimary : colors.textTertiary,
          margin: 0, marginTop: 2,
        }}>
          {value || 'Not set'}
        </p>
      )}
    </div>
    {editable && (
      <button
        onClick={onEditToggle}
        style={{
          width: 32, height: 32, border: 'none',
          backgroundColor: editing ? colors.orangeSubtle : colors.surfaceInset,
          borderRadius: borderRadius.base, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: editing ? colors.primaryOrange : colors.textTertiary,
          transition: 'all 120ms ease', flexShrink: 0,
        }}
      >
        {editing ? <Check size={14} /> : <Pencil size={14} />}
      </button>
    )}
  </div>
);

const SettingsRow: React.FC<{
  label: string;
  description?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  trailing?: React.ReactNode;
  last?: boolean;
}> = ({ label, description, icon, onClick, trailing, last }) => {
  const sharedStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: spacing['3'],
    padding: `${spacing['3']} 0`, width: '100%',
    border: 'none', background: 'none', cursor: onClick ? 'pointer' : 'default',
    textAlign: 'left', borderBottom: last ? 'none' : `1px solid ${colors.borderSubtle}`,
    fontFamily: typography.fontFamily,
  }
  const inner = (
    <>
      <div style={{
        width: 36, height: 36,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surfaceInset,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textTertiary, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: typography.fontSize.base,
          fontWeight: typography.fontWeight.medium,
          color: colors.textPrimary, margin: 0,
        }}>
          {label}
        </p>
        {description && (
          <p style={{
            fontSize: typography.fontSize.xs, color: colors.textTertiary,
            margin: 0, marginTop: 2,
          }}>
            {description}
          </p>
        )}
      </div>
      {trailing ?? (onClick ? <ChevronRight size={16} color={colors.textTertiary} /> : null)}
    </>
  )
  // Use <div> when trailing contains interactive children (e.g. Toggle) to avoid button-in-button.
  return onClick
    ? <button onClick={onClick} style={sharedStyle}>{inner}</button>
    : <div style={sharedStyle}>{inner}</div>
};

/* ─────────────────────── Toggle Component ─────────────────────── */

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      backgroundColor: checked ? colors.primaryOrange : colors.surfaceInset,
      position: 'relative', transition: 'background-color 200ms ease',
      flexShrink: 0,
    }}
  >
    <motion.div
      animate={{ x: checked ? 20 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: colors.white,
        position: 'absolute', top: 2, left: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }}
    />
  </button>
);

/* ─────────────────────── Main Component ─────────────────────── */

export default function UserProfile() {
  const { user, profile, signOut } = useAuthStore();
  const { themeMode, setThemeMode } = useUiStore();
  const navigate = useNavigate();

  // Editable fields
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '');
  const [company, setCompany] = useState(profile?.company || '');

  // Edit states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [_saving, setSaving] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state or loading state; no external system sync
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
      setJobTitle(profile.job_title || '');
      setCompany(profile.company || '');
    }
  }, [profile]);

  const handleSave = useCallback(async (field: string) => {
    if (!user?.id) return;
    setSaving(true);

    const updates: Record<string, string> = {};
    switch (field) {
      case 'name': updates.first_name = firstName; updates.last_name = lastName; updates.full_name = `${firstName} ${lastName}`.trim(); break;
      case 'phone': updates.phone = phone; break;
      case 'jobTitle': updates.job_title = jobTitle; break;
      case 'company': updates.company = company; break;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    setSaving(false);
    setEditingField(null);

    if (error) {
      toast.error('Failed to save changes');
    } else {
      toast.success('Profile updated');
    }
  }, [user, firstName, lastName, phone, jobTitle, company]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/login');
  }, [signOut, navigate]);

  const roleInfo = getRoleInfo(profile?.role || '');
  const displayInitials = `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '?';

  return (
    <div style={{
      maxWidth: 680, margin: '0 auto',
      padding: `${spacing['8']} ${spacing['6']} ${spacing['16']}`,
    }}>
      {/* ── Hero / Avatar ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: APPLE_EASE }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          marginBottom: spacing['8'],
        }}
      >
        {/* Avatar */}
        <div style={{ position: 'relative', marginBottom: spacing['4'] }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: APPLE_EASE, delay: 0.1 }}
            style={{
              width: 96, height: 96,
              borderRadius: borderRadius.full,
              background: `linear-gradient(135deg, ${colors.primaryOrange} 0%, #FF9C42 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 32px rgba(244,120,32,0.25)`,
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                style={{
                  width: 96, height: 96, borderRadius: borderRadius.full,
                  objectFit: 'cover',
                }}
              />
            ) : (
              <span style={{
                fontSize: 36, fontWeight: typography.fontWeight.bold,
                color: colors.white, letterSpacing: '-0.02em',
              }}>
                {displayInitials}
              </span>
            )}
          </motion.div>
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
            style={{
              position: 'absolute', bottom: 0, right: -4,
              width: 32, height: 32, borderRadius: borderRadius.full,
              backgroundColor: colors.surfaceRaised,
              border: `2px solid ${colors.surfacePage}`,
              boxShadow: shadows.md,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: colors.textSecondary,
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toast('Photo upload coming soon')}
          >
            <Camera size={14} />
          </motion.button>
        </div>

        {/* Name + Role */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          style={{
            fontSize: '28px', fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary, margin: 0,
            letterSpacing: '-0.025em', textAlign: 'center',
          }}
        >
          {firstName && lastName ? `${firstName} ${lastName}` : user?.email || 'Your Profile'}
        </motion.h1>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: spacing['1.5'],
            marginTop: spacing['2'],
            padding: `${spacing['1']} ${spacing['3']}`,
            borderRadius: borderRadius.full,
            backgroundColor: `color-mix(in srgb, ${roleInfo.color} 12%, transparent)`,
          }}
        >
          <Shield size={12} style={{ color: roleInfo.color }} />
          <span style={{
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            color: roleInfo.color,
            textTransform: 'capitalize',
          }}>
            {roleInfo.label}
          </span>
        </motion.div>
      </motion.div>

      {/* ── Content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>

        {/* Personal Info */}
        <SectionCard title="Personal Information" icon={<User size={16} />} delay={0.08}>
          <ProfileField
            label="Full Name"
            value={editingField === 'name' ? `${firstName} ${lastName}` : `${firstName} ${lastName}`.trim()}
            icon={<User size={16} />}
            editable
            editing={editingField === 'name'}
            onChange={(v) => {
              const parts = v.split(' ');
              setFirstName(parts[0] || '');
              setLastName(parts.slice(1).join(' '));
            }}
            onEditToggle={() => {
              if (editingField === 'name') handleSave('name');
              else setEditingField('name');
            }}
          />
          <ProfileField
            label="Email"
            value={user?.email || ''}
            icon={<Mail size={16} />}
          />
          <ProfileField
            label="Phone"
            value={phone}
            icon={<Phone size={16} />}
            editable
            editing={editingField === 'phone'}
            onChange={setPhone}
            onEditToggle={() => {
              if (editingField === 'phone') handleSave('phone');
              else setEditingField('phone');
            }}
            type="tel"
          />
          <ProfileField
            label="Job Title"
            value={jobTitle}
            icon={<Briefcase size={16} />}
            editable
            editing={editingField === 'jobTitle'}
            onChange={setJobTitle}
            onEditToggle={() => {
              if (editingField === 'jobTitle') handleSave('jobTitle');
              else setEditingField('jobTitle');
            }}
          />
          <ProfileField
            label="Company"
            value={company}
            icon={<Building2 size={16} />}
            editable
            editing={editingField === 'company'}
            onChange={setCompany}
            onEditToggle={() => {
              if (editingField === 'company') handleSave('company');
              else setEditingField('company');
            }}
            last
          />
        </SectionCard>

        {/* Preferences */}
        <SectionCard title="Preferences" icon={<Palette size={16} />} delay={0.16}>
          <SettingsRow
            label="Appearance"
            description={themeMode === 'dark' ? 'Dark mode enabled' : 'Light mode enabled'}
            icon={themeMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            trailing={
              <Toggle
                checked={themeMode === 'dark'}
                onChange={(dark) => setThemeMode(dark ? 'dark' : 'light')}
              />
            }
          />
          <SettingsRow
            label="Email Notifications"
            description="Receive project updates via email"
            icon={<Mail size={16} />}
            trailing={
              <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
            }
          />
          <SettingsRow
            label="Push Notifications"
            description="In-app alerts and badges"
            icon={pushNotifs ? <Bell size={16} /> : <BellOff size={16} />}
            trailing={
              <Toggle checked={pushNotifs} onChange={setPushNotifs} />
            }
          />
          <SettingsRow
            label="Notification Settings"
            description="Configure per-event notification triggers"
            icon={<Bell size={16} />}
            onClick={() => navigate('/settings/notifications')}
            last
          />
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account" icon={<KeyRound size={16} />} delay={0.24}>
          <SettingsRow
            label="Project Settings"
            description="Manage project details, team, and workflows"
            icon={<Building2 size={16} />}
            onClick={() => navigate('/settings')}
          />
          <SettingsRow
            label="Team Management"
            description="Invite members and manage roles"
            icon={<Shield size={16} />}
            onClick={() => navigate('/settings/team')}
          />
          <div style={{ padding: spacing['3'] }}>
            <MfaEnrollment />
          </div>
          <div style={{ paddingTop: spacing['3'] }}>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignOut}
              style={{
                width: '100%', padding: `${spacing['3']} ${spacing['4']}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: spacing['2'],
                backgroundColor: 'transparent',
                border: `1px solid ${colors.statusCritical}`,
                borderRadius: borderRadius.lg, cursor: 'pointer',
                color: colors.statusCritical,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                fontFamily: typography.fontFamily,
                transition: 'all 120ms ease',
              }}
            >
              <LogOut size={16} />
              Sign Out
            </motion.button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
