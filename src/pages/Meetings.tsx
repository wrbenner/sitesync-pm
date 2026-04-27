import React, { useState } from 'react';
import { Plus, Calendar, MapPin, AlertTriangle, RefreshCw, Trash2, Clock, Users, FileText, ChevronUp, CheckCircle, UserPlus, Video, Link2, Copy, Download, Bell, ArrowRight, Layout } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageContainer, Tag, Btn, MetricBox, Skeleton, EmptyState, Modal, InputField } from '../components/Primitives';
import { MetricCardSkeleton } from '../components/ui/Skeletons';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { useMeetings, useMeetingAttendees, useMeetingAttendeeCounts } from '../hooks/queries';
import { useDeleteMeeting, useAddAttendee, useRemoveAttendee } from '../hooks/mutations';
import { useProjectActionItems } from '../hooks/queries/meeting-enhancements';
import { useProjectId } from '../hooks/useProjectId';
import { PermissionGate } from '../components/auth/PermissionGate';
import CreateMeetingModal from '../components/forms/CreateMeetingModal';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useRealtimeInvalidation } from '../hooks/useRealtimeInvalidation';
import { PageInsightBanners } from '../components/ai/PredictiveAlert';

// ── Inline hooks for meeting detail ──────────────────────────────────────────

interface AgendaItem {
  id: string;
  meeting_id: string;
  title: string;
  presenter: string | null;
  duration_minutes: number | null;
  notes: string | null;
  decision: string | null;
  sort_order: number | null;
  status: string | null;
  attachments: unknown;
  created_at: string;
}

interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  invited: boolean;
  attended: boolean;
  rsvp_status: string;
  created_at: string;
}

interface MeetingDetail {
  id: string;
  title: string;
  status: string;
  type: string;
  date: string;
  location: string | null;
  duration_minutes: number | null;
  notes: string | null;
  minutes_published: boolean;
  minutes_published_at: string | null;
  video_conference_url: string | null;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['closed', 'cancelled'],
  closed: [],
  cancelled: [],
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  closed: 'Closed',
  cancelled: 'Cancelled',
  scheduled: 'Upcoming',
  completed: 'Completed',
};

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  draft: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  open: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  in_progress: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  closed: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  cancelled: { fg: colors.statusCritical ?? colors.statusNeutral, bg: colors.statusNeutralSubtle },
  scheduled: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  completed: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
};

// ── Recurring Meeting Templates ─────────────────────────────────────────────

interface MeetingTemplate {
  id: string;
  name: string;
  type: string;
  defaultTitle: string;
  defaultAgenda: string[];
  defaultParticipants: string[];
  defaultDuration: number;
  recurrence: 'weekly' | 'biweekly' | 'monthly';
}

const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'oac',
    name: 'OAC Meeting',
    type: 'oac',
    defaultTitle: 'OAC Meeting #{n}',
    defaultAgenda: ['Safety Review', 'Schedule Update', 'Budget Review', 'RFI / Submittal Status', 'Change Order Log', 'Old Business', 'New Business'],
    defaultParticipants: ['Owner Rep', 'Architect', 'General Contractor PM', 'MEP Engineer'],
    defaultDuration: 90,
    recurrence: 'biweekly',
  },
  {
    id: 'progress',
    name: 'Progress Meeting',
    type: 'subcontractor',
    defaultTitle: 'Progress Meeting - Week {w}',
    defaultAgenda: ['Three-Week Look-Ahead', 'Manpower Report', 'Material Deliveries', 'Quality Issues', 'Coordination Items'],
    defaultParticipants: ['Project Manager', 'Superintendent', 'Subcontractor Foremen'],
    defaultDuration: 60,
    recurrence: 'weekly',
  },
  {
    id: 'safety',
    name: 'Safety Meeting',
    type: 'safety',
    defaultTitle: 'Weekly Safety Meeting',
    defaultAgenda: ['Incident Review', 'Near-Miss Reports', 'Toolbox Talk Topic', 'Site Hazard Assessment', 'PPE Compliance', 'Emergency Procedures'],
    defaultParticipants: ['Safety Manager', 'Superintendent', 'All Foremen'],
    defaultDuration: 45,
    recurrence: 'weekly',
  },
  {
    id: 'coordination',
    name: 'Coordination Meeting',
    type: 'coordination',
    defaultTitle: 'Trade Coordination Meeting',
    defaultAgenda: ['BIM Clash Review', 'Spatial Coordination', 'Sequencing Conflicts', 'Shared Resources', 'Access / Logistics'],
    defaultParticipants: ['BIM Manager', 'MEP Coordinator', 'Structural Lead', 'Trade Foremen'],
    defaultDuration: 60,
    recurrence: 'weekly',
  },
  {
    id: 'preconstruction',
    name: 'Pre-Construction Meeting',
    type: 'internal',
    defaultTitle: 'Pre-Construction Kickoff',
    defaultAgenda: ['Project Scope Overview', 'Contract Requirements', 'Schedule Milestones', 'Submittal Log Setup', 'Communication Plan', 'Site Logistics Plan', 'Quality Plan'],
    defaultParticipants: ['Owner', 'Architect', 'GC Project Executive', 'GC PM', 'Superintendent', 'Safety Director'],
    defaultDuration: 120,
    recurrence: 'monthly',
  },
];

// ── Video Conference Helpers ────────────────────────────────────────────────

type VideoPlatform = 'zoom' | 'teams' | 'meet' | 'webex' | 'unknown';

function detectVideoPlatform(url: string): VideoPlatform {
  if (/zoom\.us/i.test(url)) return 'zoom';
  if (/teams\.microsoft\.com|teams\.live\.com/i.test(url)) return 'teams';
  if (/meet\.google\.com/i.test(url)) return 'meet';
  if (/webex\.com/i.test(url)) return 'webex';
  return 'unknown';
}

const PLATFORM_LABELS: Record<VideoPlatform, string> = {
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  meet: 'Google Meet',
  webex: 'Webex',
  unknown: 'Video Call',
};

const PLATFORM_COLORS: Record<VideoPlatform, string> = {
  zoom: '#2D8CFF',
  teams: '#6264A7',
  meet: '#00897B',
  webex: '#07C160',
  unknown: colors.statusInfo,
};

// ── Action Item Priority helpers ────────────────────────────────────────────

type ActionItemPriority = 'high' | 'medium' | 'low';

const PRIORITY_CONFIG: Record<ActionItemPriority, { label: string; fg: string; bg: string }> = {
  high: { label: 'High', fg: colors.statusCritical ?? '#dc2626', bg: colors.statusNeutralSubtle },
  medium: { label: 'Medium', fg: colors.statusPending, bg: colors.statusPendingSubtle },
  low: { label: 'Low', fg: colors.statusActive, bg: colors.statusActiveSubtle },
};

function getDaysOverdue(dueDate: string): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function useMeetingAgendaItems(meetingId: string | null) {
  return useQuery<AgendaItem[]>({
    queryKey: ['meeting_agenda_items', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];
      const { data, error } = await supabase
        .from('meeting_agenda_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meetingId,
  });
}

function useCreateAgendaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { meeting_id: string; title: string; presenter?: string; duration_minutes?: number; notes?: string }) => {
      const { data, error } = await supabase.from('meeting_agenda_items').insert({
        meeting_id: item.meeting_id,
        title: item.title,
        presenter: item.presenter || null,
        duration_minutes: item.duration_minutes || null,
        notes: item.notes || null,
        sort_order: 0,
        status: 'pending',
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meeting_agenda_items', variables.meeting_id] });
      toast.success('Agenda item added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add agenda item'),
  });
}

function useDeleteAgendaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, meetingId }: { id: string; meetingId: string }) => {
      const { error } = await supabase.from('meeting_agenda_items').delete().eq('id', id);
      if (error) throw error;
      return { meetingId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meeting_agenda_items', variables.meetingId] });
      toast.success('Agenda item removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete agenda item'),
  });
}

function useMeetingParticipants(meetingId: string | null) {
  return useQuery<MeetingParticipant[]>({
    queryKey: ['meeting_participants', meetingId],
    queryFn: async () => {
      if (!meetingId) return [];
      const { data, error } = await supabase
        .from('meeting_participants')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meetingId,
  });
}

function useAddParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: { meeting_id: string; name: string; email?: string }) => {
      const { data, error } = await supabase.from('meeting_participants').insert({
        meeting_id: p.meeting_id,
        name: p.name,
        email: p.email || null,
        invited: true,
        attended: false,
        rsvp_status: 'pending',
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meeting_participants', variables.meeting_id] });
      toast.success('Participant added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add participant'),
  });
}

function useToggleAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, attended, meetingId }: { id: string; attended: boolean; meetingId: string }) => {
      const { error } = await supabase.from('meeting_participants').update({ attended: !attended }).eq('id', id);
      if (error) throw error;
      return { meetingId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meeting_participants', variables.meetingId] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update attendance'),
  });
}

// ── Meeting Detail Panel ─────────────────────────────────────────────────────

const MeetingDetailView: React.FC<{
  meetingId: string;
  meeting: MeetingListItem;
  onClose: () => void;
}> = ({ meetingId, meeting, onClose }) => {
  const queryClient = useQueryClient();
  const { data: agendaItems = [], isPending: agendaLoading } = useMeetingAgendaItems(meetingId);
  const { data: participants = [], isPending: participantsLoading } = useMeetingParticipants(meetingId);
  const { data: attendees = [], isPending: attendeesLoading } = useMeetingAttendees(meetingId);
  const createAgendaItem = useCreateAgendaItem();
  const deleteAgendaItem = useDeleteAgendaItem();
  const addParticipant = useAddParticipant();
  const toggleAttendance = useToggleAttendance();
  const addAttendee = useAddAttendee();
  const removeAttendee = useRemoveAttendee();
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);
  const [attendeeForm, setAttendeeForm] = useState({ role: '', company: '' });

  const handleAddAttendee = () => {
    const role = attendeeForm.role.trim();
    const company = attendeeForm.company.trim();
    if (!role && !company) {
      toast.error('Enter a name or role for the attendee');
      return;
    }
    addAttendee.mutate(
      { meeting_id: meetingId, role: role || null, company: company || null, attended: false },
      {
        onSuccess: () => {
          setAttendeeForm({ role: '', company: '' });
          setShowAttendeeForm(false);
        },
      },
    );
  };

  // Fetch full meeting detail for notes and minutes_published
  const { data: meetingDetail } = useQuery<MeetingDetail>({
    queryKey: ['meeting_detail', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, status, type, date, location, duration_minutes, notes, minutes_published, minutes_published_at, video_conference_url')
        .eq('id', meetingId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaForm, setAgendaForm] = useState({ title: '', presenter: '', duration_minutes: '', notes: '' });
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [participantForm, setParticipantForm] = useState({ name: '', email: '' });
  const [meetingNotes, setMeetingNotes] = useState(meetingDetail?.notes ?? '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [showMinutesPreview, setShowMinutesPreview] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [showLinkEdit, setShowLinkEdit] = useState(false);

  // Sync notes and meeting link when detail loads
  React.useEffect(() => {
    if (meetingDetail?.notes !== undefined) {
      setMeetingNotes(meetingDetail.notes ?? '');
    }
    if (meetingDetail?.video_conference_url !== undefined) {
      setMeetingLink(meetingDetail.video_conference_url ?? '');
    }
  }, [meetingDetail?.notes, meetingDetail?.video_conference_url]);

  const totalAgendaDuration = agendaItems.reduce((sum, item) => sum + (item.duration_minutes ?? 0), 0);
  const meetingDuration = meetingDetail?.duration_minutes ?? 0;

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      const { error } = await supabase.from('meetings').update({ notes: meetingNotes }).eq('id', meetingId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meeting_detail', meetingId] });
      toast.success('Notes saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handlePublishMinutes = async () => {
    try {
      const { error } = await supabase.from('meetings').update({
        minutes_published: true,
        minutes_published_at: new Date().toISOString(),
      }).eq('id', meetingId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meeting_detail', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Minutes published');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish minutes');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase.from('meetings').update({ status: newStatus }).eq('id', meetingId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['meeting_detail', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(`Status changed to ${STATUS_LABEL[newStatus] ?? newStatus}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleAddAgendaItem = () => {
    if (!agendaForm.title.trim()) return;
    createAgendaItem.mutate({
      meeting_id: meetingId,
      title: agendaForm.title.trim(),
      presenter: agendaForm.presenter.trim() || undefined,
      duration_minutes: agendaForm.duration_minutes ? parseInt(agendaForm.duration_minutes) : undefined,
      notes: agendaForm.notes.trim() || undefined,
    });
    setAgendaForm({ title: '', presenter: '', duration_minutes: '', notes: '' });
    setShowAgendaForm(false);
  };

  const handleAddParticipant = () => {
    if (!participantForm.name.trim()) return;
    addParticipant.mutate({
      meeting_id: meetingId,
      name: participantForm.name.trim(),
      email: participantForm.email.trim() || undefined,
    });
    setParticipantForm({ name: '', email: '' });
    setShowParticipantForm(false);
  };

  const currentStatus = meetingDetail?.status ?? meeting.status;
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] ?? [];
  const sc = STATUS_COLOR[currentStatus] ?? STATUS_COLOR.draft;

  const sectionStyle: React.CSSProperties = {
    background: colors.surfaceRaised,
    borderRadius: borderRadius.xl,
    boxShadow: shadows.card,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: typography.fontSize.title,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    margin: `0 0 ${spacing.md}`,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  return (
    <div style={{ marginBottom: spacing['2xl'] }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing.lg, flexWrap: 'wrap', gap: spacing.md,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textSecondary, fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily, padding: spacing.sm,
            }}
          >
            <ChevronUp size={16} /> Back to list
          </button>
          <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: 0 }}>
            {meeting.title}
          </h2>
          <Tag label={typeLabel(meeting.type)} color={typeColors(meeting.type).fg} backgroundColor={typeColors(meeting.type).bg} />
          <Tag label={STATUS_LABEL[currentStatus] ?? currentStatus} color={sc.fg} backgroundColor={sc.bg} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          {/* Status transition dropdown */}
          {allowedTransitions.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) handleStatusChange(e.target.value); }}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.borderDefault}`,
                backgroundColor: colors.surfaceRaised,
                color: colors.textPrimary,
                fontSize: typography.fontSize.sm,
                fontFamily: typography.fontFamily,
                cursor: 'pointer',
              }}
            >
              <option value="">Change Status...</option>
              {allowedTransitions.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </select>
          )}
          {/* Publish minutes */}
          {!meetingDetail?.minutes_published ? (
            <Btn variant="secondary" icon={<FileText size={14} />} onClick={handlePublishMinutes}>
              Publish Minutes
            </Btn>
          ) : (
            <Tag
              label={`Minutes published ${meetingDetail.minutes_published_at ? new Date(meetingDetail.minutes_published_at).toLocaleDateString() : ''}`}
              color={colors.statusActive}
              backgroundColor={colors.statusActiveSubtle}
            />
          )}
          {/* Export Minutes */}
          {(currentStatus === 'closed' || meetingDetail?.minutes_published) && (
            <Btn variant="secondary" icon={<Download size={14} />} onClick={() => setShowMinutesPreview(true)}>
              Export Minutes
            </Btn>
          )}
          {/* Video Conference Link */}
          {meetingLink ? (() => {
            const platform = detectVideoPlatform(meetingLink);
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.md}`, borderRadius: borderRadius.md,
                    background: PLATFORM_COLORS[platform], color: '#fff',
                    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                    textDecoration: 'none', fontFamily: typography.fontFamily,
                  }}
                >
                  <Video size={14} /> Join {PLATFORM_LABELS[platform]}
                </a>
                <button
                  onClick={() => { navigator.clipboard.writeText(meetingLink); toast.success('Meeting link copied'); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textTertiary, padding: spacing.xs }}
                  title="Copy meeting link"
                >
                  <Copy size={14} />
                </button>
              </div>
            );
          })() : (
            <Btn variant="secondary" icon={<Link2 size={14} />} onClick={() => setShowLinkEdit(true)}>
              Add Meeting Link
            </Btn>
          )}
        </div>
      </div>

      {/* Meeting Link Editor */}
      {showLinkEdit && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
          padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.lg,
        }}>
          <Video size={16} color={colors.textSecondary} />
          <input
            type="url"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
            placeholder="Paste Zoom, Teams, Meet, or Webex link..."
            style={{
              flex: 1, padding: spacing.sm, border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md, backgroundColor: colors.surfaceRaised,
              color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
              outline: 'none',
            }}
          />
          {meetingLink && (
            <Tag
              label={PLATFORM_LABELS[detectVideoPlatform(meetingLink)]}
              color={PLATFORM_COLORS[detectVideoPlatform(meetingLink)]}
              backgroundColor={colors.surfaceRaised}
            />
          )}
          <Btn variant="primary" onClick={async () => {
            try {
              const { error } = await supabase.from('meetings').update({ video_conference_url: meetingLink || null }).eq('id', meetingId);
              if (error) throw error;
              queryClient.invalidateQueries({ queryKey: ['meeting_detail', meetingId] });
              toast.success('Meeting link saved');
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : 'Failed to save meeting link');
            }
            setShowLinkEdit(false);
          }}>Save</Btn>
          <Btn variant="secondary" onClick={() => { setShowLinkEdit(false); setMeetingLink(''); }}>Cancel</Btn>
        </div>
      )}

      {/* Duration comparison */}
      {meetingDuration > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg,
          padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.sm, color: colors.textSecondary,
        }}>
          <Clock size={14} />
          <span>Meeting duration: <strong style={{ color: colors.textPrimary }}>{meetingDuration} min</strong></span>
          <span style={{ color: colors.borderDefault }}>|</span>
          <span>Agenda total: <strong style={{
            color: totalAgendaDuration > meetingDuration ? (colors.statusCritical ?? colors.statusPending) : colors.statusActive,
          }}>{totalAgendaDuration} min</strong></span>
          {totalAgendaDuration > meetingDuration && (
            <Tag label={`${totalAgendaDuration - meetingDuration} min over`} color={colors.statusPending} backgroundColor={colors.statusPendingSubtle} />
          )}
        </div>
      )}

      {/* Agenda Items */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <p style={sectionTitleStyle}>
            <FileText size={18} /> Agenda Items
          </p>
          <Btn variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAgendaForm(true)}>
            Add Item
          </Btn>
        </div>
        {agendaLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 40 }} />)}
          </div>
        ) : agendaItems.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: spacing.lg, textAlign: 'center' }}>
            No agenda items yet. Add one to get started.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={detailThStyle}>#</th>
                <th style={detailThStyle}>Title</th>
                <th style={detailThStyle}>Presenter</th>
                <th style={detailThStyle}>Duration</th>
                <th style={detailThStyle}>Notes</th>
                <th style={detailThStyle}></th>
              </tr>
            </thead>
            <tbody>
              {agendaItems.map((item, idx) => {
                const isLast = idx === agendaItems.length - 1;
                const rowBorder = isLast ? 'none' : `1px solid ${colors.borderSubtle}`;
                return (
                  <tr key={item.id}>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, color: colors.textTertiary }}>{idx + 1}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, fontWeight: typography.fontWeight.medium as number }}>{item.title}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, color: colors.textSecondary }}>{item.presenter ?? '-'}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, color: colors.textSecondary }}>{item.duration_minutes ? `${item.duration_minutes} min` : '-'}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, color: colors.textTertiary, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.notes ?? '-'}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder }}>
                      <button
                        onClick={() => {
                          if (!window.confirm(`Delete agenda item "${item.title}"?`)) return;
                          deleteAgendaItem.mutate({ id: item.id, meetingId });
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: colors.textTertiary, padding: spacing.xs,
                        }}
                        title="Delete agenda item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {/* Add agenda item form */}
        {showAgendaForm && (
          <div style={{ marginTop: spacing.md, padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: spacing.sm, marginBottom: spacing.sm }}>
              <InputField label="Title" value={agendaForm.title} onChange={(v) => setAgendaForm({ ...agendaForm, title: v })} placeholder="Agenda item title" />
              <InputField label="Presenter" value={agendaForm.presenter} onChange={(v) => setAgendaForm({ ...agendaForm, presenter: v })} placeholder="Name" />
              <InputField label="Duration (min)" value={agendaForm.duration_minutes} onChange={(v) => setAgendaForm({ ...agendaForm, duration_minutes: v })} type="number" placeholder="15" />
            </div>
            <InputField label="Notes" value={agendaForm.notes} onChange={(v) => setAgendaForm({ ...agendaForm, notes: v })} placeholder="Optional notes" />
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm }}>
              <Btn variant="secondary" onClick={() => setShowAgendaForm(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddAgendaItem} loading={createAgendaItem.isPending}>Add</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Attendees (meeting_attendees table) */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <p style={sectionTitleStyle}>
            <Users size={18} /> Attendees ({attendees.length})
          </p>
          <Btn variant="secondary" icon={<UserPlus size={14} />} onClick={() => setShowAttendeeForm(true)}>
            Add Attendee
          </Btn>
        </div>
        {attendeesLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {[0, 1].map((i) => <Skeleton key={i} style={{ height: 36 }} />)}
          </div>
        ) : attendees.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: spacing.lg, textAlign: 'center' }}>
            No attendees added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={detailThStyle}>Name / Role</th>
                <th style={detailThStyle}>Company</th>
                <th style={detailThStyle}>Attended</th>
                <th style={detailThStyle}></th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a, idx) => {
                const isLast = idx === attendees.length - 1;
                const rowBorder = isLast ? 'none' : `1px solid ${colors.borderSubtle}`;
                return (
                  <tr key={a.id}>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, fontWeight: typography.fontWeight.medium as number }}>
                      {a.role ?? (a.user_id ? `User ${a.user_id.slice(0, 8)}` : '—')}
                    </td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, color: colors.textSecondary }}>
                      {a.company ?? '—'}
                    </td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, textAlign: 'center' }}>
                      <span style={{ color: a.attended ? colors.statusActive : colors.textTertiary }}>
                        {a.attended ? <CheckCircle size={16} /> : '—'}
                      </span>
                    </td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, textAlign: 'right' }}>
                      <button
                        onClick={() => removeAttendee.mutate({ id: a.id, meeting_id: meetingId })}
                        disabled={removeAttendee.isPending}
                        aria-label="Remove attendee"
                        style={{
                          padding: `${spacing.xs} ${spacing.sm}`,
                          border: 'none',
                          background: 'transparent',
                          color: colors.textTertiary,
                          cursor: removeAttendee.isPending ? 'not-allowed' : 'pointer',
                          fontSize: typography.fontSize.sm,
                          fontFamily: typography.fontFamily,
                          borderRadius: borderRadius.sm,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {showAttendeeForm && (
          <div style={{ marginTop: spacing.md, padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.sm }}>
              <InputField label="Name / Role" value={attendeeForm.role} onChange={(v) => setAttendeeForm({ ...attendeeForm, role: v })} placeholder="e.g. Jane Smith — PM" />
              <InputField label="Company" value={attendeeForm.company} onChange={(v) => setAttendeeForm({ ...attendeeForm, company: v })} placeholder="e.g. Acme Construction" />
            </div>
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => { setShowAttendeeForm(false); setAttendeeForm({ role: '', company: '' }); }}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddAttendee} loading={addAttendee.isPending}>Add</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Participants */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <p style={sectionTitleStyle}>
            <Users size={18} /> Participants
          </p>
          <Btn variant="secondary" icon={<UserPlus size={14} />} onClick={() => setShowParticipantForm(true)}>
            Add Participant
          </Btn>
        </div>
        {participantsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {[0, 1].map((i) => <Skeleton key={i} style={{ height: 36 }} />)}
          </div>
        ) : participants.length === 0 ? (
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, padding: spacing.lg, textAlign: 'center' }}>
            No participants added yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={detailThStyle}>Name</th>
                <th style={detailThStyle}>Email</th>
                <th style={detailThStyle}>RSVP</th>
                <th style={detailThStyle}>Invited</th>
                <th style={detailThStyle}>Attended</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, idx) => {
                const isLast = idx === participants.length - 1;
                const rowBorder = isLast ? 'none' : `1px solid ${colors.borderSubtle}`;
                const rsvpColors: Record<string, { fg: string; bg: string }> = {
                  accepted: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
                  declined: { fg: colors.statusCritical ?? colors.statusNeutral, bg: colors.statusNeutralSubtle },
                  tentative: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
                  pending: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
                };
                const rc = rsvpColors[p.rsvp_status] ?? rsvpColors.pending;
                return (
                  <tr key={p.id}>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, fontWeight: typography.fontWeight.medium as number }}>{p.name}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, color: colors.textSecondary }}>{p.email ?? '-'}</td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder }}>
                      <Tag label={p.rsvp_status} color={rc.fg} backgroundColor={rc.bg} />
                    </td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, textAlign: 'center' }}>
                      <span style={{ color: p.invited ? colors.statusActive : colors.textTertiary }}>
                        {p.invited ? <CheckCircle size={16} /> : '-'}
                      </span>
                    </td>
                    <td style={{ ...detailTdStyle, borderBottom: rowBorder, textAlign: 'center' }}>
                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: spacing.xs }}>
                        <input
                          type="checkbox"
                          checked={p.attended}
                          onChange={() => toggleAttendance.mutate({ id: p.id, attended: p.attended, meetingId })}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {/* Add participant form */}
        {showParticipantForm && (
          <div style={{ marginTop: spacing.md, padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.lg }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, marginBottom: spacing.sm }}>
              <InputField label="Name" value={participantForm.name} onChange={(v) => setParticipantForm({ ...participantForm, name: v })} placeholder="Full name" />
              <InputField label="Email" value={participantForm.email} onChange={(v) => setParticipantForm({ ...participantForm, email: v })} placeholder="email@example.com" />
            </div>
            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={() => setShowParticipantForm(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleAddParticipant} loading={addParticipant.isPending}>Add</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Notes / Minutes */}
      <div style={sectionStyle}>
        <p style={sectionTitleStyle}>
          <FileText size={18} /> Meeting Notes / Minutes
        </p>
        <textarea
          value={meetingNotes}
          onChange={(e) => setMeetingNotes(e.target.value)}
          placeholder="Record meeting minutes and notes here..."
          style={{
            width: '100%',
            minHeight: 160,
            padding: spacing.md,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surfaceRaised,
            color: colors.textPrimary,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            lineHeight: typography.lineHeight.normal,
            resize: 'vertical' as const,
            outline: 'none',
            boxSizing: 'border-box' as const,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: spacing.sm }}>
          <Btn variant="primary" onClick={handleSaveNotes} loading={notesSaving}>
            {notesSaving ? 'Saving...' : 'Save Notes'}
          </Btn>
        </div>
      </div>

      {/* Minutes Preview / Export Modal */}
      {showMinutesPreview && (
        <Modal open={showMinutesPreview} onClose={() => setShowMinutesPreview(false)} title="Meeting Minutes Export">
          <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {/* Minutes Header */}
            <div style={{ borderBottom: `2px solid ${colors.borderDefault}`, paddingBottom: spacing.md, marginBottom: spacing.lg }}>
              <h2 style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, margin: `0 0 ${spacing.sm}` }}>
                {meeting.title}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm, fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                <span><strong>Type:</strong> {typeLabel(meeting.type)}</span>
                <span><strong>Date:</strong> {meeting.date ? new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}</span>
                <span><strong>Location:</strong> {meeting.location ?? 'N/A'}</span>
                <span><strong>Duration:</strong> {meetingDetail?.duration_minutes ? `${meetingDetail.duration_minutes} min` : 'N/A'}</span>
              </div>
            </div>
            {/* Attendees */}
            <div style={{ marginBottom: spacing.lg }}>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing.sm}` }}>Attendees</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.xs }}>
                {participants.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, fontSize: typography.fontSize.sm }}>
                    <span style={{ color: p.attended ? colors.statusActive : (colors.statusCritical ?? colors.statusPending) }}>
                      {p.attended ? <CheckCircle size={12} /> : '\u2717'}
                    </span>
                    <span style={{ color: colors.textPrimary }}>{p.name}</span>
                    <span style={{ color: colors.textTertiary }}>{p.attended ? '(Present)' : '(Absent)'}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Agenda with Notes */}
            <div style={{ marginBottom: spacing.lg }}>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing.sm}` }}>Agenda & Discussion</h3>
              {agendaItems.map((item, idx) => (
                <div key={item.id} style={{ marginBottom: spacing.md, padding: spacing.md, background: colors.surfaceInset, borderRadius: borderRadius.md }}>
                  <p style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing.xs}` }}>
                    {idx + 1}. {item.title} {item.presenter ? `(${item.presenter})` : ''} {item.duration_minutes ? `- ${item.duration_minutes} min` : ''}
                  </p>
                  {item.notes && <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>{item.notes}</p>}
                  {item.decision && <p style={{ fontSize: typography.fontSize.sm, color: colors.statusActive, margin: `${spacing.xs} 0 0`, fontWeight: typography.fontWeight.medium as number }}>Decision: {item.decision}</p>}
                </div>
              ))}
            </div>
            {/* Meeting Notes */}
            {meetingNotes && (
              <div style={{ marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `0 0 ${spacing.sm}` }}>General Notes</h3>
                <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0, whiteSpace: 'pre-wrap' as const }}>{meetingNotes}</p>
              </div>
            )}
            {/* Next Meeting placeholder */}
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing.md, marginBottom: spacing.md }}>
              <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0, fontStyle: 'italic' }}>
                Next meeting: To be scheduled
              </p>
            </div>
          </div>
          {/* Export actions */}
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.lg, borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: spacing.md }}>
            <Btn variant="secondary" icon={<Copy size={14} />} onClick={() => {
              const text = `${meeting.title}\nDate: ${meeting.date}\nLocation: ${meeting.location ?? 'N/A'}\n\nAttendees:\n${participants.map(p => `  ${p.attended ? '[x]' : '[ ]'} ${p.name}`).join('\n')}\n\nAgenda:\n${agendaItems.map((a, i) => `  ${i+1}. ${a.title}${a.notes ? ` - ${a.notes}` : ''}`).join('\n')}\n\nNotes:\n${meetingNotes}`;
              navigator.clipboard.writeText(text);
              toast.success('Minutes copied to clipboard');
            }}>
              Copy to Clipboard
            </Btn>
            <Btn variant="primary" icon={<Download size={14} />} onClick={() => {
              const text = `MEETING MINUTES\n${'='.repeat(60)}\n\n${meeting.title}\nDate: ${meeting.date ? new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}\nLocation: ${meeting.location ?? 'N/A'}\nDuration: ${meetingDetail?.duration_minutes ? `${meetingDetail.duration_minutes} min` : 'N/A'}\n\n${'─'.repeat(60)}\nATTENDEES\n${'─'.repeat(60)}\n${participants.map(p => `  ${p.attended ? '[x]' : '[ ]'} ${p.name} ${p.email ? `(${p.email})` : ''}`).join('\n')}\n\n${'─'.repeat(60)}\nAGENDA & DISCUSSION\n${'─'.repeat(60)}\n${agendaItems.map((a, i) => `  ${i+1}. ${a.title}${a.presenter ? ` (${a.presenter})` : ''}${a.duration_minutes ? ` - ${a.duration_minutes} min` : ''}\n${a.notes ? `     Notes: ${a.notes}\n` : ''}${a.decision ? `     Decision: ${a.decision}\n` : ''}`).join('\n')}\n\n${'─'.repeat(60)}\nGENERAL NOTES\n${'─'.repeat(60)}\n${meetingNotes || '(No notes recorded)'}\n`;
              const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${meeting.title.replace(/[^a-zA-Z0-9]/g, '_')}_Minutes.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success('Minutes exported');
              setShowMinutesPreview(false);
            }}>
              Export Minutes
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

const detailThStyle: React.CSSProperties = {
  padding: `${spacing.sm} ${spacing.md}`,
  textAlign: 'left' as const,
  fontSize: typography.fontSize.label,
  fontWeight: typography.fontWeight.semibold as number,
  color: colors.textTertiary,
  textTransform: 'uppercase' as const,
  letterSpacing: typography.letterSpacing.wider,
  whiteSpace: 'nowrap' as const,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceInset,
};

const detailTdStyle: React.CSSProperties = {
  padding: `${spacing.sm} ${spacing.md}`,
  fontSize: typography.fontSize.sm,
  color: colors.textPrimary,
};

// ── Type helpers ──────────────────────────────────────────────────────────────

const MEETING_TYPE_LABELS: Record<string, string> = {
  oac: 'OAC',
  safety: 'Safety',
  subcontractor: 'Subcontractor',
  internal: 'Internal',
  coordination: 'Coordination',
};

const MEETING_TYPE_COLORS: Record<string, { fg: string; bg: string }> = {
  oac: { fg: colors.statusInfo, bg: colors.statusInfoSubtle },
  safety: { fg: colors.statusPending, bg: colors.statusPendingSubtle },
  subcontractor: { fg: colors.statusActive, bg: colors.statusActiveSubtle },
  internal: { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle },
  coordination: { fg: colors.statusReview, bg: colors.statusReviewSubtle },
};

function typeLabel(type: string): string {
  return MEETING_TYPE_LABELS[type] ?? 'Meeting';
}

function typeColors(type: string): { fg: string; bg: string } {
  return MEETING_TYPE_COLORS[type] ?? { fg: colors.statusNeutral, bg: colors.statusNeutralSubtle };
}

interface MeetingListItem {
  id: string;
  title: string;
  status: string;
  type: string;
  date: string;
  location: string | null;
  attendees: Array<{ id: string; name: string }>;
  attendeeCount: number;
}

interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate: string;
  status: string;
  meetingTitle: string;
}

// ── Skeleton loading state ────────────────────────────────────────────────────

const MeetingsSkeleton: React.FC = () => (
  <PageContainer title="Meetings">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.lg, marginBottom: spacing['2xl'] }}>
      {[0, 1, 2, 3].map((i) => <MetricCardSkeleton key={i} />)}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ background: colors.surfaceRaised, borderRadius: borderRadius.xl, padding: spacing.xl, boxShadow: shadows.card }}>
          <Skeleton style={{ height: 20, width: '40%', marginBottom: spacing.sm }} />
          <Skeleton style={{ height: 16, width: '60%' }} />
        </div>
      ))}
    </div>
  </PageContainer>
);

// ── Meeting card ──────────────────────────────────────────────────────────────

const MeetingCard: React.FC<{
  meeting: MeetingListItem;
  onDelete?: (meeting: MeetingListItem) => void;
  onEdit?: (meeting: MeetingListItem) => void;
  onClick?: (meeting: MeetingListItem) => void;
  deletePending?: boolean;
  isSelected?: boolean;
}> = ({ meeting, onDelete, onEdit, onClick, deletePending, isSelected }) => {
  const tc = typeColors(meeting.type);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        background: colors.surfaceRaised,
        borderRadius: borderRadius.xl,
        boxShadow: hovered ? shadows.hover : shadows.card,
        padding: spacing.xl,
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.lg,
        cursor: 'pointer',
        transition: transitions.quick,
        transform: hovered ? 'translateY(-1px)' : 'none',
        borderLeft: isSelected ? `3px solid ${colors.primaryOrange}` : '3px solid transparent',
      }}
      onClick={() => onClick?.(meeting)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: borderRadius.lg,
          background: tc.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Calendar size={18} color={tc.fg} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            {meeting.title}
          </p>
          <Tag
            label={typeLabel(meeting.type)}
            color={tc.fg}
            backgroundColor={tc.bg}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
          <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            {meeting.date ? new Date(meeting.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
          </span>
          {meeting.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
              <MapPin size={12} />
              {meeting.location}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
            <Users size={12} />
            {meeting.attendeeCount} {meeting.attendeeCount === 1 ? 'attendee' : 'attendees'}
          </span>
        </div>
      </div>
      <Tag
        label={STATUS_LABEL[meeting.status] ?? meeting.status}
        color={(STATUS_COLOR[meeting.status] ?? STATUS_COLOR.draft).fg}
        backgroundColor={(STATUS_COLOR[meeting.status] ?? STATUS_COLOR.draft).bg}
      />
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(meeting); }}
          aria-label={`Edit meeting: ${meeting.title}`}
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            border: `1px solid ${colors.borderDefault}`,
            background: colors.surfaceRaised,
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            borderRadius: borderRadius.md,
          }}
        >
          Edit
        </button>
      )}
      {onDelete && (
        <PermissionGate permission="meetings.delete">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(meeting); }}
            disabled={deletePending}
            aria-label={`Delete meeting: ${meeting.title}`}
            data-testid="delete-meeting-button"
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              border: 'none',
              background: 'transparent',
              color: colors.textTertiary,
              cursor: deletePending ? 'not-allowed' : 'pointer',
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              borderRadius: borderRadius.md,
            }}
          >
            {deletePending ? 'Deleting…' : 'Delete'}
          </button>
        </PermissionGate>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const Meetings: React.FC = () => {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  useRealtimeInvalidation(projectId);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showOpenOnly, setShowOpenOnly] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<MeetingListItem | null>(null);
  const [editMeetingForm, setEditMeetingForm] = useState({ title: '', date: '', location: '', type: 'oac' });
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MeetingTemplate | null>(null);

  const { data: meetingsResult, isPending, error, refetch } = useMeetings(projectId);
  const deleteMeeting = useDeleteMeeting();

  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase.from('meetings').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings', projectId] });
      toast.success('Meeting updated');
      setEditingMeeting(null);
    },
    onError: (err: Error) => { toast.error(err.message || 'Failed to update meeting'); },
  });

  const openEditMeeting = (meeting: MeetingListItem) => {
    setEditMeetingForm({
      title: meeting.title ?? '',
      date: meeting.date ? meeting.date.slice(0, 16) : '',
      location: meeting.location ?? '',
      type: meeting.type ?? 'oac',
    });
    setEditingMeeting(meeting);
  };

  const handleEditMeetingSave = () => {
    if (!editingMeeting) return;
    updateMeetingMutation.mutate({
      id: editingMeeting.id,
      updates: {
        title: editMeetingForm.title || null,
        date: editMeetingForm.date || null,
        location: editMeetingForm.location || null,
        type: editMeetingForm.type || null,
      },
    });
  };

  const handleDeleteMeeting = async (meeting: MeetingListItem) => {
    if (!projectId) return;
    if (!window.confirm(`Delete "${meeting.title}"? This cannot be undone.`)) return;
    try {
      await deleteMeeting.mutateAsync({ id: String(meeting.id), projectId });
      await refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete meeting');
    }
  };
  const { data: actionItemsData } = useProjectActionItems(projectId);
  const meetingIds = (meetingsResult?.data ?? []).map((m) => m.id);
  const { data: attendeeCounts = {} } = useMeetingAttendeeCounts(meetingIds);
  const allMeetings: MeetingListItem[] = (meetingsResult?.data ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status ?? 'draft',
    type: m.type ?? 'oac',
    date: m.date ?? '',
    location: m.location ?? null,
    attendees: [],
    attendeeCount: attendeeCounts[m.id] ?? 0,
  }));

  if (!projectId) {
    return (
      <PageContainer title="Meetings">
        <EmptyState
          icon={<Calendar size={32} color={colors.textTertiary} />}
          title="No project selected"
          description="Select a project from the sidebar to view meetings."
        />
      </PageContainer>
    );
  }

  if (isPending) return <MeetingsSkeleton />;

  if (error) {
    return (
      <PageContainer title="Meetings">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: spacing.lg, textAlign: 'center' }}>
          <AlertTriangle size={48} color={colors.statusCritical} />
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            Failed to load meetings
          </p>
          <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: 0 }}>
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Btn variant="secondary" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
            Retry
          </Btn>
        </div>
      </PageContainer>
    );
  }

  const upcomingMeetings = allMeetings.filter((m) => ['scheduled', 'draft', 'open', 'in_progress'].includes(m.status));
  const pastMeetings = allMeetings.filter((m) => ['completed', 'closed', 'cancelled'].includes(m.status));
  const displayedMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

  const allActionItems: ActionItem[] = (actionItemsData ?? []).map((ai) => {
    const meetings = (ai as Record<string, unknown>).meetings as { title?: string } | { title?: string }[] | null;
    const meetingRef = Array.isArray(meetings) ? meetings[0] : meetings;
    return {
      id: ai.id,
      description: ai.description,
      assignee: ai.assigned_to ?? 'Unassigned',
      dueDate: ai.due_date ?? '',
      status: ai.status,
      meetingTitle: meetingRef?.title ?? '',
    };
  });
  const openActionItemsCount = allActionItems.filter((ai) => ai.status === 'open').length;
  const meetingsThisWeek = upcomingMeetings.length;
  const totalAttendees = allMeetings.reduce((sum, m) => sum + (m.attendeeCount ?? 0), 0);
  const avgAttendance = allMeetings.length > 0 ? Math.round(totalAttendees / allMeetings.length) : 0;

  const filteredActionItems = showOpenOnly
    ? allActionItems.filter((ai) => ai.status === 'open')
    : allActionItems;

  const TABS = [
    { key: 'upcoming' as const, label: 'Upcoming' },
    { key: 'past' as const, label: 'Past' },
  ];

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: spacing.xs,
    background: colors.surfaceInset,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    width: 'fit-content',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    border: 'none',
    cursor: 'pointer',
    fontSize: typography.fontSize.sm,
    fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
    fontFamily: typography.fontFamily,
    background: isActive ? colors.surfaceRaised : 'transparent',
    color: isActive ? colors.textPrimary : colors.textSecondary,
    boxShadow: isActive ? shadows.card : 'none',
    transition: transitions.quick,
  });

  const thStyle: React.CSSProperties = {
    padding: `${spacing.sm} ${spacing.lg}`,
    textAlign: 'left' as const,
    fontSize: typography.fontSize.label,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.letterSpacing.wider,
    whiteSpace: 'nowrap' as const,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceInset,
  };

  return (
    <PageContainer
      title="Meetings"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
          <Btn variant="secondary" icon={<Layout size={14} />} onClick={() => setShowTemplates(true)}>
            Templates
          </Btn>
          <PermissionGate
            permission="meetings.create"
            fallback={
              <span title="Your role doesn't allow scheduling meetings. Request access from your admin.">
                <Btn icon={<Plus size={14} />} disabled>Schedule Meeting</Btn>
              </span>
            }
          >
            <Btn icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)} data-testid="create-meeting-button">
              Schedule Meeting
            </Btn>
          </PermissionGate>
        </div>
      }
    >
      <PageInsightBanners page="meetings" />

      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.lg,
          marginBottom: spacing['2xl'],
        }}
      >
        <MetricBox label="Upcoming Meetings" value={upcomingMeetings.length} />
        <MetricBox
          label="Open Action Items"
          value={openActionItemsCount}
          colorOverride={openActionItemsCount > 5 ? 'warning' : undefined}
        />
        <MetricBox label="Meetings This Week" value={meetingsThisWeek} />
        <MetricBox label="Avg Attendees" value={avgAttendance} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <div style={tabBarStyle} role="tablist" aria-label="Meeting views">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              style={tabStyle(activeTab === tab.key)}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting list */}
      {displayedMeetings.length === 0 ? (
        <div
          style={{
            background: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            boxShadow: shadows.card,
            padding: spacing['2xl'],
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: `${spacing['2xl']} ${spacing.xl}`,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: borderRadius.full,
                background: colors.surfaceInset,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.xl,
              }}
            >
              <Calendar size={28} color={colors.textTertiary} />
            </div>
            <p
              style={{
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                margin: `0 0 ${spacing.sm}`,
              }}
            >
              No meetings scheduled
            </p>
            <p
              style={{
                fontSize: typography.fontSize.body,
                color: colors.textTertiary,
                margin: `0 0 ${spacing.xl}`,
                maxWidth: 360,
                lineHeight: typography.lineHeight.normal,
              }}
            >
              Set up your recurring OAC meeting or schedule a one off to keep the team aligned.
            </p>
            <PermissionGate
              permission="meetings.create"
              fallback={
                <span title="Your role doesn't allow scheduling meetings. Request access from your admin.">
                  <Btn icon={<Plus size={14} />} disabled>Schedule Meeting</Btn>
                </span>
              }
            >
              <Btn icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
                Schedule Meeting
              </Btn>
            </PermissionGate>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          {displayedMeetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              onEdit={openEditMeeting}
              onDelete={handleDeleteMeeting}
              onClick={(mtg) => setSelectedMeetingId(mtg.id === selectedMeetingId ? null : mtg.id)}
              deletePending={deleteMeeting.isPending}
              isSelected={m.id === selectedMeetingId}
            />
          ))}
        </div>
      )}

      {/* Meeting detail view (expanded) */}
      {selectedMeetingId && (() => {
        const selectedMeeting = allMeetings.find((m) => m.id === selectedMeetingId);
        if (!selectedMeeting) return null;
        return (
          <div style={{ marginTop: spacing.xl }}>
            <MeetingDetailView
              meetingId={selectedMeetingId}
              meeting={selectedMeeting}
              onClose={() => setSelectedMeetingId(null)}
            />
          </div>
        );
      })()}

      {/* Action items section */}
      <div style={{ marginTop: spacing['2xl'] }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.lg,
          }}
        >
          <div>
            <p
              style={{
                fontSize: typography.fontSize.title,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                margin: 0,
              }}
            >
              Action Items
            </p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `${spacing.xs} 0 0` }}>
              Tracked across all meetings
            </p>
          </div>
          <button
            onClick={() => setShowOpenOnly((v) => !v)}
            style={{
              padding: `${spacing.sm} ${spacing.md}`,
              border: `1px solid ${colors.borderDefault}`,
              borderRadius: borderRadius.md,
              background: showOpenOnly ? colors.primaryOrange : colors.surfaceRaised,
              color: showOpenOnly ? colors.white : colors.textSecondary,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              fontFamily: typography.fontFamily,
              cursor: 'pointer',
              transition: transitions.quick,
            }}
          >
            {showOpenOnly ? 'Showing Open Only' : 'Show All'}
          </button>
        </div>

        <div
          style={{
            background: colors.surfaceRaised,
            borderRadius: borderRadius.xl,
            boxShadow: shadows.card,
            overflow: 'hidden',
          }}
        >
          {/* Completion rate bar */}
          {allActionItems.length > 0 && (
            <div style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
                  Completion Rate: {Math.round(((allActionItems.length - openActionItemsCount) / allActionItems.length) * 100)}%
                </span>
                <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  {allActionItems.length - openActionItemsCount} of {allActionItems.length} completed
                </span>
              </div>
              <div style={{ height: 6, background: colors.surfaceInset, borderRadius: borderRadius.full, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: borderRadius.full, background: colors.statusActive,
                  width: `${Math.round(((allActionItems.length - openActionItemsCount) / allActionItems.length) * 100)}%`,
                  transition: transitions.quick,
                }} />
              </div>
            </div>
          )}
          {filteredActionItems.length === 0 ? (
            <div style={{ padding: spacing['2xl'], textAlign: 'center' }}>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textTertiary, margin: 0 }}>
                No open action items. All caught up.
              </p>
            </div>
          ) : (() => {
            // Group items by assignee for enhanced view
            const overdueItems = filteredActionItems.filter((ai) => ai.status === 'open' && getDaysOverdue(ai.dueDate) > 0);
            const groupedByAssignee = filteredActionItems.reduce<Record<string, typeof filteredActionItems>>((acc, item) => {
              const key = item.assignee || 'Unassigned';
              if (!acc[key]) acc[key] = [];
              acc[key].push(item);
              return acc;
            }, {});

            return (
              <div>
                {/* Overdue items banner */}
                {overdueItems.length > 0 && (
                  <div style={{
                    padding: `${spacing.md} ${spacing.lg}`, borderBottom: `1px solid ${colors.borderSubtle}`,
                    background: `${colors.statusCritical ?? colors.statusPending}08`,
                    display: 'flex', alignItems: 'center', gap: spacing.sm,
                  }}>
                    <AlertTriangle size={16} color={colors.statusCritical ?? colors.statusPending} />
                    <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.statusCritical ?? colors.statusPending }}>
                      {overdueItems.length} overdue action item{overdueItems.length > 1 ? 's' : ''} require attention
                    </span>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Assignee</th>
                      <th style={thStyle}>Priority</th>
                      <th style={thStyle}>Due Date</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Source Meeting</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedByAssignee).map(([assignee, items]) =>
                      items.map((item, idx) => {
                        const daysOver = getDaysOverdue(item.dueDate);
                        const isOverdue = item.status === 'open' && daysOver > 0;
                        const isLast = idx === items.length - 1;
                        const rowBorder = isLast ? `2px solid ${colors.borderSubtle}` : `1px solid ${colors.borderSubtle}`;
                        // Derive priority from overdue days
                        const priority: ActionItemPriority = daysOver > 7 ? 'high' : daysOver > 0 ? 'medium' : 'low';
                        const pc = PRIORITY_CONFIG[priority];
                        return (
                          <tr
                            key={item.id}
                            style={{
                              transition: transitions.quick,
                              background: isOverdue ? `${colors.statusCritical ?? colors.statusPending}06` : undefined,
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = colors.surfaceHover; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isOverdue ? `${colors.statusCritical ?? colors.statusPending}06` : ''; }}
                          >
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, maxWidth: 320 }}>
                              <p style={{ fontSize: typography.fontSize.sm, color: colors.textPrimary, margin: 0, lineHeight: typography.lineHeight.normal }}>
                                {item.description}
                              </p>
                              {isOverdue && (
                                <span style={{ fontSize: typography.fontSize.label, color: colors.statusCritical ?? colors.statusPending, fontWeight: typography.fontWeight.medium as number }}>
                                  {daysOver} day{daysOver > 1 ? 's' : ''} overdue
                                </span>
                              )}
                            </td>
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{item.assignee}</span>
                            </td>
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                              <Tag label={pc.label} color={pc.fg} backgroundColor={pc.bg} />
                            </td>
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder, whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: typography.fontSize.sm, color: isOverdue ? (colors.statusCritical ?? colors.statusPending) : colors.textSecondary, fontWeight: isOverdue ? (typography.fontWeight.semibold as number) : undefined }}>
                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                              </span>
                            </td>
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                              <Tag
                                label={item.status === 'open' ? 'Open' : 'Completed'}
                                color={item.status === 'open' ? colors.statusPending : colors.statusActive}
                                backgroundColor={item.status === 'open' ? colors.statusPendingSubtle : colors.statusActiveSubtle}
                              />
                            </td>
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                              <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, fontStyle: 'italic' }}>{item.meetingTitle}</span>
                            </td>
                            <td style={{ padding: `${spacing.md} ${spacing.lg}`, borderBottom: rowBorder }}>
                              {isOverdue && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data: { user } } = await supabase.auth.getUser();
                                      if (!user) { toast.error('Not authenticated'); return; }
                                      const { error } = await supabase.from('notifications').insert({
                                        user_id: user.id,
                                        title: `Overdue: ${item.description}`,
                                        body: `Action item assigned to ${item.assignee} is ${daysOver} day${daysOver > 1 ? 's' : ''} overdue.`,
                                        type: 'reminder',
                                        entity_type: 'meeting_action_item',
                                        entity_id: item.id,
                                        project_id: projectId ?? null,
                                      });
                                      if (error) throw error;
                                      toast.success(`Reminder sent to ${item.assignee}`);
                                    } catch (err: unknown) {
                                      toast.error(err instanceof Error ? err.message : 'Failed to send reminder');
                                    }
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
                                    padding: `${spacing.xs} ${spacing.sm}`, borderRadius: borderRadius.md,
                                    border: `1px solid ${colors.borderDefault}`, background: colors.surfaceRaised,
                                    color: colors.statusCritical ?? colors.statusPending, cursor: 'pointer',
                                    fontSize: typography.fontSize.label, fontFamily: typography.fontFamily,
                                  }}
                                  title={`Send reminder to ${item.assignee}`}
                                >
                                  <Bell size={12} /> Remind
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>

      {showCreateModal && projectId && (
        <CreateMeetingModal onClose={() => setShowCreateModal(false)} projectId={projectId} />
      )}

      {/* Meeting Templates Modal */}
      <Modal open={showTemplates} onClose={() => { setShowTemplates(false); setSelectedTemplate(null); }} title="Meeting Templates">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, margin: 0 }}>
            Select a template to quickly create a pre-configured recurring meeting with standard agenda and participants.
          </p>
          {MEETING_TEMPLATES.map((tmpl) => {
            const tc = typeColors(tmpl.type);
            const isSelected = selectedTemplate?.id === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => setSelectedTemplate(isSelected ? null : tmpl)}
                style={{
                  padding: spacing.lg, borderRadius: borderRadius.lg, cursor: 'pointer',
                  border: `2px solid ${isSelected ? colors.primaryOrange : colors.borderDefault}`,
                  background: isSelected ? `${colors.primaryOrange}08` : colors.surfaceRaised,
                  transition: transitions.quick,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                    <div style={{ width: 32, height: 32, borderRadius: borderRadius.md, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={16} color={tc.fg} />
                    </div>
                    <div>
                      <p style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{tmpl.name}</p>
                      <p style={{ fontSize: typography.fontSize.label, color: colors.textTertiary, margin: 0 }}>{tmpl.defaultDuration} min | {tmpl.recurrence}</p>
                    </div>
                  </div>
                  <Tag label={typeLabel(tmpl.type)} color={tc.fg} backgroundColor={tc.bg} />
                </div>
                {isSelected && (
                  <div style={{ marginTop: spacing.md }}>
                    <div style={{ marginBottom: spacing.sm }}>
                      <p style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, margin: `0 0 ${spacing.xs}`, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Default Agenda</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                        {tmpl.defaultAgenda.map((item, i) => (
                          <span key={i} style={{ padding: `${spacing.xs} ${spacing.sm}`, background: colors.surfaceInset, borderRadius: borderRadius.md, fontSize: typography.fontSize.label, color: colors.textSecondary }}>
                            {i + 1}. {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: typography.fontSize.label, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, margin: `0 0 ${spacing.xs}`, textTransform: 'uppercase' as const, letterSpacing: typography.letterSpacing.wider }}>Default Participants</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                        {tmpl.defaultParticipants.map((role, i) => (
                          <Tag key={i} label={role} color={colors.statusInfo} backgroundColor={colors.statusInfoSubtle} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm }}>
            <Btn variant="secondary" onClick={() => { setShowTemplates(false); setSelectedTemplate(null); }}>Cancel</Btn>
            <Btn
              variant="primary"
              icon={<ArrowRight size={14} />}
              disabled={!selectedTemplate}
              onClick={() => {
                if (selectedTemplate) {
                  toast.success(`Template "${selectedTemplate.name}" applied - creating meeting`);
                  setShowTemplates(false);
                  setSelectedTemplate(null);
                  setShowCreateModal(true);
                }
              }}
            >
              Create from Template
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!editingMeeting} onClose={() => setEditingMeeting(null)} title="Edit Meeting">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          <InputField label="Title" value={editMeetingForm.title} onChange={(v) => setEditMeetingForm({ ...editMeetingForm, title: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
            <InputField label="Date/Time" value={editMeetingForm.date} onChange={(v) => setEditMeetingForm({ ...editMeetingForm, date: v })} type="datetime-local" />
            <InputField label="Location" value={editMeetingForm.location} onChange={(v) => setEditMeetingForm({ ...editMeetingForm, location: v })} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: spacing['1'], fontSize: typography.fontSize.caption, color: colors.textSecondary }}>Type</label>
            <select value={editMeetingForm.type} onChange={(e) => setEditMeetingForm({ ...editMeetingForm, type: e.target.value })} style={{ width: '100%', padding: spacing['2'], borderRadius: borderRadius.md, border: `1px solid ${colors.borderDefault}`, backgroundColor: colors.surfaceRaised, color: colors.textPrimary, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily }}>
              <option value="oac">OAC</option>
              <option value="safety">Safety</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="internal">Internal</option>
              <option value="coordination">Coordination</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setEditingMeeting(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleEditMeetingSave} loading={updateMeetingMutation.isPending}>{updateMeetingMutation.isPending ? 'Saving...' : 'Save'}</Btn>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
