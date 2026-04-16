import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { getProjectMembersForMention } from '../../api/endpoints/projectMembers';

export interface MentionPerson {
  userId: string;
  name: string;
  initials: string;
  role: string;
}

interface MentionInputProps {
  onSend: (text: string, mentionedUserIds: string[]) => void;
  placeholder?: string;
  people?: MentionPerson[];
  projectId?: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  onSend,
  placeholder = 'Write a comment... Use @ to mention',
  people = [],
  projectId,
}) => {
  const [value, setValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [dbMembers, setDbMembers] = useState<MentionPerson[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = useCallback(() => {
    if (!projectId) return;
    setMembersLoading(true);
    setMemberLoadError(false);
    getProjectMembersForMention(projectId)
      .then((members) => {
        setDbMembers(
          members.map((m) => ({
            userId: m.userId,
            name: m.name,
            initials: m.initials,
            role: m.role,
          })),
        );
        setMembersLoading(false);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('Failed to load project members for mention:', err);
        setMemberLoadError(true);
        setMembersLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchMembers(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchMembers]);

  const activePeople = projectId && dbMembers.length > 0 ? dbMembers : people;

  const filtered = mentionFilter
    ? activePeople.filter((p) => p.name.toLowerCase().includes(mentionFilter.toLowerCase()))
    : activePeople;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setValue(text);
    const atIndex = text.lastIndexOf('@');
    if (atIndex >= 0 && atIndex === text.length - 1) {
      setShowMentions(true);
      setMentionFilter('');
    } else if (atIndex >= 0 && !text.slice(atIndex).includes(' ')) {
      setShowMentions(true);
      setMentionFilter(text.slice(atIndex + 1));
    } else {
      setShowMentions(false);
    }
  };

  const handleMention = (person: MentionPerson) => {
    const atIndex = value.lastIndexOf('@');
    setValue(value.slice(0, atIndex) + `@${person.name} `);
    setShowMentions(false);
    setMentionedUserIds((prev) =>
      prev.includes(person.userId) ? prev : [...prev, person.userId],
    );
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!value.trim()) return;
    onSend(value.trim(), mentionedUserIds);
    setValue('');
    setMentionedUserIds([]);
  };

  const isSendDisabled = !value.trim();

  return (
    <div style={{ position: 'relative' }}>
      <style>{`@keyframes sitesync-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {showMentions && (
        <div
          role="listbox"
          style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
            backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
            boxShadow: shadows.dropdown, maxHeight: '200px', overflowY: 'auto', zIndex: 10,
          }}
        >
          {membersLoading ? (
            <div style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              fontFamily: typography.fontFamily,
              animation: 'sitesync-pulse 1.5s ease-in-out infinite',
            }}>
              Loading team...
            </div>
          ) : memberLoadError ? (
            <div style={{
              padding: `${spacing['2']} ${spacing['3']}`,
              display: 'flex', alignItems: 'center', gap: spacing['2'],
            }}>
              <span style={{
                fontSize: typography.fontSize.sm,
                color: '#EF4444',
                fontFamily: typography.fontFamily,
              }}>
                Could not load team members
              </span>
              <button
                onClick={fetchMembers}
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.primaryOrange,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: typography.fontFamily,
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            filtered.map((person) => (
              <button
                key={person.userId}
                role="option"
                onClick={() => handleMention(person)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`, border: 'none', backgroundColor: 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontFamily,
                  transition: `background-color ${transitions.instant}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                <Avatar initials={person.initials} size={24} />
                <div>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{person.name}</span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginLeft: spacing['2'] }}>{person.role}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`,
        backgroundColor: colors.surfaceInset, borderRadius: borderRadius.full,
      }}>
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) handleSend();
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
          }}
          placeholder={placeholder}
          aria-expanded={showMentions}
          aria-haspopup="listbox"
          style={{
            flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none',
            fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary,
          }}
        />
        <button
          onClick={handleSend}
          aria-disabled={isSendDisabled}
          aria-label="Send comment"
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: !isSendDisabled ? colors.primaryOrange : 'transparent',
            color: !isSendDisabled ? 'white' : colors.textTertiary,
            border: 'none', borderRadius: borderRadius.full,
            cursor: !isSendDisabled ? 'pointer' : 'default',
            opacity: isSendDisabled ? 0.5 : 1,
            pointerEvents: isSendDisabled ? 'none' : 'auto',
          }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
};
