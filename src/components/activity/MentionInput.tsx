import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';
import { Avatar } from '../Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';

export interface MentionPerson {
  name: string;
  initials: string;
  role: string;
}

interface MentionInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  people?: MentionPerson[];
}

export const MentionInput: React.FC<MentionInputProps> = ({ onSend, placeholder = 'Write a comment... Use @ to mention', people = [] }) => {
  const [value, setValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = mentionFilter
    ? people.filter((p) => p.name.toLowerCase().includes(mentionFilter.toLowerCase()))
    : people;

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
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (value.trim()) { onSend(value.trim()); setValue(''); }
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
              key={person.name}
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
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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
