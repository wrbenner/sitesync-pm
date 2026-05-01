/**
 * SlideOverPanel — The bridge between overview and action.
 *
 * This is the core infrastructure that makes The Nine pages actionable.
 * Instead of navigating away from a page to take action, the user
 * clicks a row and gets a full-detail panel sliding in from the right
 * with everything they need: context, history, and action buttons.
 *
 * Design: Parchment background, Garamond headings, fixed action bar.
 * Behavior: Animate in from right, close on Escape/backdrop/X button.
 * Mobile: Full-screen takeover with swipe-to-close.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { colors, typography, transitions } from '../styles/theme';
import { useIsMobile } from '../hooks/useWindowSize';

// ── Types ─────────────────────────────────────────────────

export interface SlideOverAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

export interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  /** Fixed action buttons at the bottom */
  actions?: SlideOverAction[];
  /** Link to the full detail page */
  detailHref?: string;
  /** Width on desktop — mobile is always full-screen */
  width?: string;
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────

export const SlideOverPanel: React.FC<SlideOverPanelProps> = ({
  open,
  onClose,
  title,
  subtitle,
  badge,
  actions,
  detailHref,
  width = '480px',
  children,
}) => {
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  // Focus trap — focus panel on open
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  const panelWidth = isMobile ? '100vw' : width;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(30, 28, 26, 0.4)',
              backdropFilter: 'blur(2px)',
              zIndex: 1000,
            }}
          />

          {/* Panel */}
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: panelWidth,
              maxWidth: '100vw',
              backgroundColor: colors.parchment,
              boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              outline: 'none',
            }}
          >
            {/* ── Header ────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: isMobile ? '16px 16px 12px' : '20px 24px 16px',
                borderBottom: `1px solid ${colors.hairline2}`,
                flexShrink: 0,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {subtitle && (
                  <div style={{
                    fontFamily: typography.fontFamily,
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: colors.ink4,
                    marginBottom: 4,
                  }}>
                    {subtitle}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2
                    style={{
                      fontFamily: typography.fontFamilySerif,
                      fontSize: isMobile ? '18px' : '20px',
                      fontWeight: 400,
                      color: colors.ink,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {title}
                  </h2>
                  {badge}
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: colors.ink3,
                  cursor: 'pointer',
                  transition: transitions.quick,
                  flexShrink: 0,
                  marginLeft: 12,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.parchment2; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Scrollable Content ────────────────── */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: isMobile ? '16px' : '20px 24px',
                minHeight: 0,
              }}
            >
              {children}
            </div>

            {/* ── Action Bar (fixed bottom) ─────────── */}
            {(actions && actions.length > 0 || detailHref) && (
              <div
                style={{
                  flexShrink: 0,
                  padding: isMobile ? '12px 16px' : '14px 24px',
                  borderTop: `1px solid ${colors.hairline2}`,
                  backgroundColor: colors.parchment2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {/* Actions */}
                {actions?.map((action, i) => (
                  <ActionButton key={i} action={action} />
                ))}

                {/* Spacer + detail link */}
                {detailHref && (
                  <>
                    <div style={{ flex: 1 }} />
                    <a
                      href={detailHref}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: typography.fontFamily,
                        fontSize: '12px',
                        fontWeight: 500,
                        color: colors.ink3,
                        textDecoration: 'none',
                        transition: transitions.quick,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = colors.primaryOrange; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = colors.ink3; }}
                    >
                      Full detail <ChevronRight size={12} />
                    </a>
                  </>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Action Button ─────────────────────────────────────────

const ActionButton: React.FC<{ action: SlideOverAction }> = ({ action }) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      border: 'none',
      borderRadius: '8px',
      fontFamily: typography.fontFamily,
      fontSize: '13px',
      fontWeight: 500,
      cursor: action.disabled ? 'not-allowed' : 'pointer',
      opacity: action.disabled ? 0.5 : 1,
      transition: transitions.quick,
      whiteSpace: 'nowrap',
    };

    switch (action.variant) {
      case 'primary':
        return { ...base, backgroundColor: '#F47820', color: '#fff' };
      case 'danger':
        return { ...base, backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#DC2626' };
      case 'ghost':
        return { ...base, backgroundColor: 'transparent', color: colors.ink2, padding: '8px 12px' };
      case 'secondary':
      default:
        return { ...base, backgroundColor: colors.parchment3, color: colors.ink2, border: `1px solid ${colors.hairline2}` };
    }
  };

  return (
    <button
      onClick={action.disabled ? undefined : action.onClick}
      disabled={action.disabled}
      style={getStyles()}
    >
      {action.loading ? (
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      ) : action.icon ? (
        action.icon
      ) : null}
      {action.label}
    </button>
  );
};

// ── Section helpers for panel content ─────────────────────

export const PanelSection: React.FC<{
  label?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ label, children, style }) => (
  <div style={{ marginBottom: 20, ...style }}>
    {label && (
      <div style={{
        fontFamily: typography.fontFamily,
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: colors.ink4,
        marginBottom: 8,
      }}>
        {label}
      </div>
    )}
    {children}
  </div>
);

export const PanelField: React.FC<{
  label: string;
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
    <span style={{ fontFamily: typography.fontFamily, fontSize: '13px', color: colors.ink3 }}>{label}</span>
    <span style={{ fontFamily: typography.fontFamily, fontSize: '13px', fontWeight: 500, color: colors.ink, textAlign: 'right' }}>{value || '—'}</span>
  </div>
);

export const StatusBadge: React.FC<{
  status: string;
  onClick?: () => void;
  color?: string;
}> = ({ status, onClick, color }) => {
  const statusColor = color || getStatusColor(status);
  const isClickable = !!onClick;

  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '12px',
        fontFamily: typography.fontFamily,
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: statusColor,
        backgroundColor: `${statusColor}15`,
        border: `1px solid ${statusColor}30`,
        cursor: isClickable ? 'pointer' : 'default',
        transition: transitions.quick,
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
};

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'closed' || s === 'answered' || s === 'approved') return '#16A34A';
  if (s === 'in_review' || s === 'pending_review' || s === 'submitted' || s === 'pending') return '#D97706';
  if (s === 'rejected' || s === 'revise_resubmit' || s === 'overdue') return '#DC2626';
  if (s === 'open' || s === 'draft') return '#3A7BC8';
  return '#6B7280';
}

export default SlideOverPanel;
