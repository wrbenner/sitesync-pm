import React, { useState, useEffect, useRef, useCallback } from 'react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../styles/theme';

interface ContextMenuItem {
  id?: string;
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
    const MENU_WIDTH = 188;
    const MENU_HEIGHT = items.length * 36 + 8;
    const clampedX = e.clientX + MENU_WIDTH > window.innerWidth ? e.clientX - MENU_WIDTH : e.clientX;
    const clampedY = e.clientY + MENU_HEIGHT > window.innerHeight ? e.clientY - MENU_HEIGHT : e.clientY;
    setPosition({ x: clampedX, y: clampedY });
    setOpen(true);
  }, [items.length]);

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

  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
      const focused = document.activeElement as HTMLButtonElement;
      const idx = items.indexOf(focused);
      if (e.key === 'ArrowUp') {
        items[Math.max(0, idx - 1)]?.focus();
      } else {
        items[Math.min(items.length - 1, idx + 1)]?.focus();
      }
    }
  }, []);

  return (
    <>
      <div onContextMenu={handleContextMenu} aria-haspopup="menu">{children}</div>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Context menu"
          onKeyDown={handleKeyDown}
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
            <React.Fragment key={item.id ?? `${item.label}-${i}`}>
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
                role="menuitem"
                tabIndex={0}
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
