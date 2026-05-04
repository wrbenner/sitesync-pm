/**
 * QuickCreateFAB — Context-aware Floating Action Button for The Nine.
 *
 * Every page gets a + button that lets you create the most relevant
 * entity for that context. Expands into a menu when multiple options exist.
 *
 * The Conversation: New RFI, New Submittal
 * The Day: New Task
 * The Field: Capture (already has this)
 * The Ledger: New Change Order, New Budget Item
 * The Crew: New Crew
 * The Site: Quick links only
 * The Set: (drawings — no quick create)
 * The File: Upload File
 * The Plan: New Task
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { colors, typography, transitions } from '../styles/theme';
import { useIsMobile } from '../hooks/useWindowSize';

// ── Types ─────────────────────────────────────────────────

export interface FABOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface QuickCreateFABProps {
  /** Single action — just tap the FAB */
  onPrimaryAction?: () => void;
  /** Multiple options — FAB expands into menu */
  options?: FABOption[];
  /** Override the icon (default: Plus) */
  icon?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────

export const QuickCreateFAB: React.FC<QuickCreateFABProps> = ({
  onPrimaryAction,
  options,
  icon,
}) => {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();
  const fabRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

  const handleFABClick = useCallback(() => {
    if (onPrimaryAction && (!options || options.length === 0)) {
      onPrimaryAction();
    } else {
      setExpanded((prev) => !prev);
    }
  }, [onPrimaryAction, options]);

  const handleOptionClick = useCallback((opt: FABOption) => {
    setExpanded(false);
    opt.onClick();
  }, []);

  return (
    <div
      ref={fabRef}
      style={{
        position: 'fixed',
        bottom: isMobile ? 24 : 32,
        right: isMobile ? 20 : 32,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {/* ── Option Menu (expands above FAB) ──── */}
      <AnimatePresence>
        {expanded && options && options.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 8,
            }}
          >
            {options.map((opt) => (
              <motion.button
                key={opt.id}
                onClick={() => handleOptionClick(opt)}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '12px',
                  backgroundColor: colors.parchment,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  fontFamily: typography.fontFamily,
                  fontSize: '13px',
                  fontWeight: 500,
                  color: colors.ink,
                  whiteSpace: 'nowrap',
                  transition: transitions.quick,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.parchment2; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.parchment; }}
              >
                <span style={{ display: 'flex', color: colors.primaryOrange }}>{opt.icon}</span>
                {opt.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB Button ────────────────────────── */}
      <motion.button
        onClick={handleFABClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(244, 120, 32, 0.35), 0 1px 3px rgba(0,0,0,0.1)',
          transition: transitions.quick,
        }}
      >
        <motion.div
          animate={{ rotate: expanded ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {icon ?? <Plus size={24} />}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default QuickCreateFAB;
