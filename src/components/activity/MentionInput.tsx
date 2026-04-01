import React, { useState, useRef, useEffect } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
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
      })
      .catch(() => {
        // Fall back to people prop if fetch fails
      });
  }, [projectId]);

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

  return (
    <div style={{ position: 'relative' }}>
      {showMentions && filtered.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
          backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.md,
          boxShadow: shadows.dropdown, maxHeight: '200px', overflowY: 'auto', zIndex: 10,
        }}>
          {filtered.map((person) => (
            <button
              key={person.userId}
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
          ))}
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
          style={{
            flex: 1, border: 'none', backgroundColor: 'transparent', outline: 'none',
            fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, color: colors.textPrimary,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim()}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: value.trim() ? colors.primaryOrange : 'transparent',
            color: value.trim() ? 'white' : colors.textTertiary,
            border: 'none', borderRadius: borderRadius.full, cursor: value.trim() ? 'pointer' : 'default',
          }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
};
