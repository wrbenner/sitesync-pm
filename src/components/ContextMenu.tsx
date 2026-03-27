import React, { useState, useEffect, useRef, useCallback } from 'react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../styles/theme';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ items, children }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('scroll', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('scroll', close);
    };
  }, [open]);

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            zIndex: zIndex.popover,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            boxShadow: shadows.dropdown,
            padding: `${spacing['1']} 0`,
            minWidth: '180px',
            animation: 'scaleIn 100ms ease-out',
          }}
        >
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.divider && (
                <div
                  style={{
                    height: 1,
                    backgroundColor: colors.borderSubtle,
                    margin: `${spacing['1']} 0`,
                  }}
                />
              )}
              <button
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing['3'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: item.danger ? colors.statusCritical : colors.textPrimary,
                  fontSize: typography.fontSize.sm,
                  fontFamily: typography.fontFamily,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: `background-color ${transitions.instant}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.surfaceHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {item.icon && <span style={{ display: 'flex', color: item.danger ? colors.statusCritical : colors.textTertiary }}>{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
};
