import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../styles/theme';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  label?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  label,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: typography.fontSize.label,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: spacing['1'],
            textTransform: 'uppercase',
            letterSpacing: typography.letterSpacing.wider,
          }}
        >
          {label}
        </label>
      )}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing['2']} ${spacing['3']}`,
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.base,
          fontSize: typography.fontSize.body,
          fontFamily: typography.fontFamily,
          color: selected ? colors.textPrimary : colors.textTertiary,
          cursor: 'pointer',
          transition: `border-color ${transitions.instant}`,
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={16}
          style={{
            color: colors.textTertiary,
            transition: `transform ${transitions.instant}`,
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: spacing['1'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            boxShadow: shadows.dropdown,
            zIndex: zIndex.dropdown,
            overflow: 'hidden',
            maxHeight: '240px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {searchable && (
            <div style={{ padding: spacing['2'], borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], padding: `${spacing['1']} ${spacing['2']}`, backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm }}>
                <Search size={14} style={{ color: colors.textTertiary, flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  style={{
                    border: 'none',
                    background: 'none',
                    outline: 'none',
                    fontSize: typography.fontSize.sm,
                    fontFamily: typography.fontFamily,
                    color: colors.textPrimary,
                    width: '100%',
                  }}
                />
              </div>
            </div>
          )}
          <div style={{ overflow: 'auto', maxHeight: '200px' }}>
            {filtered.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setSearch('');
                }}
                style={{
                  width: '100%',
                  display: 'block',
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: 'none',
                  backgroundColor: opt.value === value ? colors.orangeSubtle : 'transparent',
                  color: opt.value === value ? colors.primaryOrange : colors.textPrimary,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  fontWeight: opt.value === value ? typography.fontWeight.medium : typography.fontWeight.normal,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: `background-color ${transitions.instant}`,
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  if (opt.value !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {opt.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: spacing['4'], textAlign: 'center', color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
