import React, { useState, useEffect, useRef, useCallback, createContext, useContext, Component } from 'react';
import { colors, spacing, typography, borderRadius, shadows, zIndex, transitions } from '../styles/theme';

// ── Toast System ─────────────────────────────────────────

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  severity: ToastSeverity;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  showToast: (message: string, severity: ToastSeverity, action?: { label: string; onClick: () => void }) => void;
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

const TOAST_DURATION: Record<ToastSeverity, number | null> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: null,
};

function ToastEntry({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const style = TOAST_SEVERITY_STYLES[toast.severity];
  const [dismissFocused, setDismissFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef<number | null>(TOAST_DURATION[toast.severity]);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const duration = TOAST_DURATION[toast.severity];
    if (duration === null) return;
    remainingRef.current = duration;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => onClose(toast.id), duration);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.severity, onClose]);

  const handleMouseEnter = useCallback(() => {
    if (remainingRef.current === null) return;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (remainingRef.current === null) return;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => onClose(toast.id), remainingRef.current);
  }, [toast.id, onClose]);

  return (
    <div
      role={toast.severity === 'error' ? 'alert' : 'status'}
      aria-live={toast.severity === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onClose(toast.id); }}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: style.text,
            fontSize: typography.fontSize.sm,
            fontFamily: typography.fontFamily,
            fontWeight: 600,
            padding: `0 ${spacing['2']}`,
            flexShrink: 0,
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        aria-label="Dismiss notification"
        onClick={() => onClose(toast.id)}
        onFocus={() => setDismissFocused(true)}
        onBlur={() => setDismissFocused(false)}
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
          outline: dismissFocused ? `2px solid ${colors.primary}` : 'none',
          outlineOffset: dismissFocused ? '2px' : undefined,
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

  const showToast = useCallback((message: string, severity: ToastSeverity, action?: { label: string; onClick: () => void }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => {
      const next = [...prev, { id, message, severity, action }];
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
        role="region"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: spacing['4'],
          right: spacing['4'],
          zIndex: zIndex.toast || 9999,
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

// ── Error Boundary ───────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            gap: spacing['4'],
            padding: spacing['6'],
            fontFamily: typography.fontFamily,
          }}
        >
          <span style={{ fontSize: '32px', lineHeight: 1 }}>⚠️</span>
          <span
            style={{
              fontSize: typography.fontSize.lg,
              color: colors.textPrimary,
              fontWeight: 600,
            }}
          >
            Something went wrong
          </span>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.textTertiary,
              textAlign: 'center',
              maxWidth: '360px',
            }}
          >
            {this.state.error?.message}
          </span>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: colors.primaryOrange,
              color: '#ffffff',
              borderRadius: borderRadius.md,
              padding: `${spacing['2']} ${spacing['4']}`,
              cursor: 'pointer',
              border: 'none',
              fontSize: typography.fontSize.sm,
              fontFamily: typography.fontFamily,
              fontWeight: 500,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    triggerRef.current = e.currentTarget as HTMLElement;
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
      setVisible(false);
      setFocusedIndex(0);
      requestAnimationFrame(() => {
        setVisible(true);
      });
    } else {
      setVisible(false);
      setFocusedIndex(-1);
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (focusedIndex >= 0) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < items.length) {
        items[focusedIndex].onClick();
        setOpen(false);
      }
    }
  }, [focusedIndex, items]);

  const focusedItemId = focusedIndex >= 0
    ? (items[focusedIndex]?.id ?? `context-menu-item-${focusedIndex}`)
    : undefined;

  return (
    <>
      <div onContextMenu={handleContextMenu} aria-haspopup="menu">{children}</div>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Context menu"
          aria-orientation="vertical"
          aria-activedescendant={focusedItemId}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            zIndex: zIndex.popover,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.md,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: `${spacing['1']} 0`,
            minWidth: '180px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            transition: 'opacity 150ms ease-out, transform 150ms ease-out',
            transformOrigin: 'top left',
          }}
        >
          {items.map((item, i) => {
            const itemId = item.id ?? `context-menu-item-${i}`;
            return (
              <React.Fragment key={itemId}>
                {item.divider && (
                  <div
                    style={{
                      height: 1,
                      backgroundColor: '#E5E7EB',
                      margin: '4px 0',
                    }}
                  />
                )}
                <button
                  id={itemId}
                  role="menuitem"
                  tabIndex={focusedIndex === i ? 0 : -1}
                  ref={el => { itemRefs.current[i] = el; }}
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
            );
          })}
        </div>
      )}
    </>
  );
};
