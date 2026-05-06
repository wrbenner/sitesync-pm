import React, { useState, useEffect, useCallback } from 'react';

import { fromTable } from '../../lib/db/queries'
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import { Card } from '../../components/Primitives';
import {
  Bell,
  Mail,
  Clock,
  Volume2,
  VolumeX,
  FileQuestion,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  DollarSign,
  CalendarCheck,
  ListChecks,
  Calendar,
} from 'lucide-react';

// ── Trigger config ───────────────────────────────────────────────────────────

interface TriggerConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const TRIGGER_CONFIG: TriggerConfig[] = [
  {
    key: 'rfi_assigned',
    label: 'RFI Assigned',
    description: 'When an RFI is assigned to you',
    icon: FileQuestion,
  },
  {
    key: 'rfi_response',
    label: 'RFI Response',
    description: 'When an RFI you submitted receives a response',
    icon: MessageSquare,
  },
  {
    key: 'rfi_overdue',
    label: 'RFI Overdue',
    description: 'When an RFI passes its due date',
    icon: AlertTriangle,
  },
  {
    key: 'submittal_approved',
    label: 'Submittal Approved',
    description: 'When a submittal you submitted is approved',
    icon: CheckCircle,
  },
  {
    key: 'submittal_revision',
    label: 'Submittal Revision',
    description: 'When a submittal requires revision',
    icon: RotateCcw,
  },
  {
    key: 'change_order_pending',
    label: 'Change Order Pending',
    description: 'When a change order needs your review',
    icon: DollarSign,
  },
  {
    key: 'daily_log_reminder',
    label: 'Daily Log Reminder',
    description: 'Daily reminder to submit your field log',
    icon: CalendarCheck,
  },
  {
    key: 'pay_app_review',
    label: 'Pay App Review',
    description: 'When a pay application is ready for review',
    icon: DollarSign,
  },
  {
    key: 'punch_item_assigned',
    label: 'Punch Item Assigned',
    description: 'When a punch list item is assigned to you',
    icon: ListChecks,
  },
  {
    key: 'meeting_scheduled',
    label: 'Meeting Scheduled',
    description: 'When a new meeting is scheduled on your project',
    icon: Calendar,
  },
];

const DEFAULT_PREFERENCES: Record<string, PreferenceValue> = Object.fromEntries(
  TRIGGER_CONFIG.map((t) => [t.key, 'instant' as PreferenceValue]),
);

// ── Types ────────────────────────────────────────────────────────────────────

type PreferenceValue = 'instant' | 'digest' | 'off';

const OPTIONS: { value: PreferenceValue; label: string; icon: React.ElementType }[] = [
  { value: 'instant', label: 'Instant', icon: Bell },
  { value: 'digest', label: 'Digest', icon: Mail },
  { value: 'off', label: 'Off', icon: VolumeX },
];

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

// ── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div
    style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      padding: spacing['5'],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['4'],
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], flex: 1 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceInset,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: 140,
            height: 14,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surfaceInset,
            marginBottom: spacing['2'],
          }}
        />
        <div
          style={{
            width: 220,
            height: 12,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.surfaceInset,
          }}
        />
      </div>
    </div>
    <div style={{ display: 'flex', gap: spacing['2'] }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 72,
            height: 40,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surfaceInset,
          }}
        />
      ))}
    </div>
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

const NotificationSettings: React.FC = () => {
  const { user } = useAuth();

  const [preferences, setPreferences] = useState<Record<string, PreferenceValue>>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState('08:00');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  );

  // ── Fetch on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      // .maybeSingle() returns null without error when no row exists. New
      // users haven't had defaults written yet — we want to fall through
      // to DEFAULT_PREFERENCES instead of surfacing a 406 in the console.
      const { data, error } = await fromTable('notification_preferences')
        .select('*')
        .eq('user_id' as never, user.id)
        .maybeSingle();

      if (!error && data) {
        const row = data as unknown as Record<string, unknown>;
        const updated: Record<string, PreferenceValue> = { ...DEFAULT_PREFERENCES };
        for (const trigger of TRIGGER_CONFIG) {
          const val = row[trigger.key];
          if (val === 'instant' || val === 'digest' || val === 'off') {
            updated[trigger.key] = val;
          }
        }
        setPreferences(updated);
        setDigestEnabled(typeof row.daily_digest === 'boolean' ? row.daily_digest : false);
        if (typeof row.digest_time === 'string' && row.digest_time) {
          setDigestTime(row.digest_time);
        }
        if (typeof row.timezone === 'string' && row.timezone) {
          setTimezone(row.timezone);
        }
      }

      setLoading(false);
    };

    fetchPreferences();
  }, [user]);

  // ── Handle trigger preference change ──────────────────────────────────────

  const handleChange = useCallback(
    async (triggerKey: string, value: PreferenceValue) => {
      if (!user) return;

      const previous = preferences[triggerKey];
      setPreferences((prev) => ({ ...prev, [triggerKey]: value }));

      const { error } = await fromTable('notification_preferences').upsert(
        { user_id: user.id, [triggerKey]: value } as never,
        { onConflict: 'user_id' },
      );

      if (error) {
        toast.error('Failed to save preference. Please try again.');
        setPreferences((prev) => ({ ...prev, [triggerKey]: previous }));
      }
    },
    [user, preferences],
  );

  // ── Handle digest settings change ─────────────────────────────────────────

  const handleDigestToggle = useCallback(async () => {
    if (!user) return;
    const next = !digestEnabled;
    setDigestEnabled(next);

    const { error } = await fromTable('notification_preferences').upsert(
      { user_id: user.id, daily_digest: next },
      { onConflict: 'user_id' },
    );

    if (error) {
      toast.error('Failed to save digest setting.');
      setDigestEnabled(!next);
    }
  }, [user, digestEnabled]);

  const handleDigestTimeChange = useCallback(
    async (time: string) => {
      if (!user) return;
      setDigestTime(time);

      const { error } = await fromTable('notification_preferences').upsert(
        { user_id: user.id, digest_time: time },
        { onConflict: 'user_id' },
      );

      if (error) {
        toast.error('Failed to save digest time.');
      }
    },
    [user],
  );

  const handleTimezoneChange = useCallback(
    async (tz: string) => {
      if (!user) return;
      const previous = timezone;
      setTimezone(tz);

      const { error } = await fromTable('notification_preferences').upsert(
        { user_id: user.id, timezone: tz } as never,
        { onConflict: 'user_id' },
      );

      if (error) {
        toast.error('Failed to save timezone.');
        setTimezone(previous);
      }
    },
    [user, timezone],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: `${spacing['8']} ${spacing['6']}`,
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: spacing['8'] }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: colors.textPrimary,
            margin: 0,
            fontFamily: typography.fontFamily,
            letterSpacing: typography.letterSpacing.tight,
          }}
        >
          Notification Preferences
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.body,
            color: colors.textSecondary,
            margin: `${spacing['2']} 0 0`,
            lineHeight: typography.lineHeight.normal,
          }}
        >
          Control how you receive notifications for each event type.
        </p>
      </div>

      {/* Option legend */}
      <div
        style={{
          display: 'flex',
          gap: spacing['6'],
          marginBottom: spacing['5'],
          paddingBottom: spacing['4'],
          borderBottom: `1px solid ${colors.borderSubtle}`,
        }}
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <div
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing['2'],
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
              }}
            >
              <Icon size={14} />
              <span>{opt.label}</span>
            </div>
          );
        })}
      </div>

      {/* Per-trigger rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
        {loading
          ? TRIGGER_CONFIG.map((t) => <SkeletonRow key={t.key} />)
          : TRIGGER_CONFIG.map((t) => {
              const Icon = t.icon;
              const current = preferences[t.key] ?? 'instant';

              return (
                <Card key={t.key} padding={spacing['5']}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: spacing['4'],
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: icon + label + description */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'], flex: 1, minWidth: 200 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: borderRadius.md,
                          backgroundColor: colors.orangeSubtle,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: colors.primaryOrange,
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: typography.fontSize.body,
                            fontWeight: typography.fontWeight.medium,
                            color: colors.textPrimary,
                            lineHeight: typography.lineHeight.tight,
                          }}
                        >
                          {t.label}
                        </div>
                        <div
                          style={{
                            fontSize: typography.fontSize.sm,
                            color: colors.textSecondary,
                            marginTop: spacing['1'],
                            lineHeight: typography.lineHeight.normal,
                          }}
                        >
                          {t.description}
                        </div>
                      </div>
                    </div>

                    {/* Right: option buttons */}
                    <div style={{ display: 'flex', gap: spacing['2'], flexShrink: 0 }}>
                      {OPTIONS.map((opt) => {
                        const OptIcon = opt.icon;
                        const isActive = current === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => handleChange(t.key, opt.value)}
                            style={{
                              height: 40,
                              paddingLeft: spacing['4'],
                              paddingRight: spacing['4'],
                              borderRadius: borderRadius.md,
                              border: isActive ? 'none' : `1px solid ${colors.borderDefault}`,
                              backgroundColor: isActive ? colors.primaryOrange : colors.surfaceRaised,
                              color: isActive ? '#FFFFFF' : colors.textSecondary,
                              fontSize: typography.fontSize.sm,
                              fontWeight: isActive ? typography.fontWeight.medium : typography.fontWeight.normal,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: spacing['1.5'],
                              transition: 'all 120ms ease-out',
                              fontFamily: typography.fontFamily,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <OptIcon size={13} />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
      </div>

      {/* Daily digest section */}
      <div style={{ marginTop: spacing['8'] }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['3'],
            marginBottom: spacing['5'],
          }}
        >
          <Mail size={18} color={colors.textSecondary} />
          <h2
            style={{
              fontSize: typography.fontSize.title,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              fontFamily: typography.fontFamily,
            }}
          >
            Daily Digest Settings
          </h2>
        </div>

        <Card padding={spacing['6']}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5'] }}>
            {/* Toggle row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing['4'],
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: typography.fontSize.body,
                    fontWeight: typography.fontWeight.medium,
                    color: colors.textPrimary,
                    marginBottom: spacing['1'],
                  }}
                >
                  Enable daily digest
                </div>
                <div
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textSecondary,
                    lineHeight: typography.lineHeight.normal,
                  }}
                >
                  Receive a daily summary email instead of individual notifications for digest items.
                </div>
              </div>
              <button
                onClick={handleDigestToggle}
                role="switch"
                aria-checked={digestEnabled}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: borderRadius.full,
                  backgroundColor: digestEnabled ? colors.primaryOrange : colors.borderDefault,
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 160ms ease-out',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: digestEnabled ? 23 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: borderRadius.full,
                    backgroundColor: '#FFFFFF',
                    transition: 'left 160ms ease-out',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </button>
            </div>

            {/* Digest time + timezone */}
            {digestEnabled && (
              <div
                style={{
                  display: 'flex',
                  gap: spacing['4'],
                  flexWrap: 'wrap',
                  paddingTop: spacing['4'],
                  borderTop: `1px solid ${colors.borderSubtle}`,
                }}
              >
                {/* Time picker */}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['2'],
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textSecondary,
                      marginBottom: spacing['2'],
                    }}
                  >
                    <Clock size={13} />
                    Send time
                  </label>
                  <input
                    type="time"
                    value={digestTime}
                    onChange={(e) => handleDigestTimeChange(e.target.value)}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.borderDefault}`,
                      backgroundColor: colors.surfaceRaised,
                      color: colors.textPrimary,
                      fontSize: typography.fontSize.body,
                      fontFamily: typography.fontFamily,
                      padding: `0 ${spacing['3']}`,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Timezone */}
                <div style={{ flex: 2, minWidth: 220 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing['2'],
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.textSecondary,
                      marginBottom: spacing['2'],
                    }}
                  >
                    <Volume2 size={13} />
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => handleTimezoneChange(e.target.value)}
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.borderDefault}`,
                      backgroundColor: colors.surfaceRaised,
                      color: colors.textPrimary,
                      fontSize: typography.fontSize.body,
                      fontFamily: typography.fontFamily,
                      padding: `0 ${spacing['3']}`,
                      boxSizing: 'border-box',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NotificationSettings;
