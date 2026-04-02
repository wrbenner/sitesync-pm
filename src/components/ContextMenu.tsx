import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../styles/theme';

// ── Toast System ─────────────────────────────────────────

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  severity: ToastSeverity;
}

interface ToastContextValue {
  showToast: (message: string, severity: ToastSeverity) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const TOAST_SEVERITY_STYLES: Record<ToastSeverity, { bg: string; border: string; text: string }> = {
  success: { bg: colors.statusSuccessSubtle, border: colors.statusSuccess, text: colors.statusSuccess },
  error:   { bg: colors.statusCriticalSubtle, border: colors.statusCritical, text: colors.statusCritical },
  warning: { bg: colors.statusWarningSubtle, border: colors.statusWarning, text: colors.statusWarning },
  info:    { bg: colors.statusInfoSubtle, border: colors.statusInfo, text: colors.statusInfo },
};

function ToastEntry({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const style = TOAST_SEVERITY_STYLES[toast.severity];

  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div
      role={toast.severity === 'error' ? 'alert' : 'status'}
      aria-live={toast.severity === 'error' ? 'assertive' : 'polite'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        padding: `${spacing['3']} ${spacing['4']}`,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: borderRadius.md,
        boxShadow: shadows.dropdown,
        minWidth: '280px',
        maxWidth: '380px',
        fontFamily: typography.fontFamily,
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: typography.fontSize.sm,
          color: colors.textPrimary,
          lineHeight: 1.4,
        }}
      >
        {toast.message}
      </span>
      <button
        aria-label="Dismiss notification"
        onClick={() => onClose(toast.id)}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: colors.textTertiary,
          fontSize: '18px',
          lineHeight: 1,
          padding: `0 ${spacing['1']}`,
          display: 'flex',
          alignItems: 'center',
          borderRadius: borderRadius.sm,
          flexShrink: 0,
          transition: `color ${transitions.instant}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
      >
        &#x2715;
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, severity: ToastSeverity) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => {
      const next = [...prev, { id, message, severity }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: spacing['6'],
          right: spacing['6'],
          zIndex: zIndex.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing['2'],
          pointerEvents: toasts.length === 0 ? 'none' : 'auto',
        }}
      >
        {toasts.map(toast => (
          <ToastEntry key={toast.id} toast={toast} onClose={closeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Context Menu ─────────────────────────────────────────

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
          aria-orientation="vertical"
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
                tabIndex={-1}
                aria-label={item.label}
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
