import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme';
import { globalShortcuts } from '../../hooks/useKeyboardShortcuts';

interface ShortcutOverlayProps {
  open: boolean;
  onClose: () => void;
}

function formatKey(shortcut: typeof globalShortcuts[0]): string[] {
  const keys: string[] = [];
  if (shortcut.meta) keys.push('⌘');
  if (shortcut.shift) keys.push('⇧');
  keys.push(shortcut.key === 'Escape' ? 'Esc' : shortcut.key === '/' ? '/' : shortcut.key.toUpperCase());
  return keys;
}

export const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ open, onClose }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: zIndex.modal as number }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '480px', maxWidth: '90vw', backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.xl, boxShadow: shadows.panel,
              zIndex: zIndex.modal as number + 1, overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['4']} ${spacing['5']}`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
              <h3 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>Keyboard Shortcuts</h3>
              <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: borderRadius.base, cursor: 'pointer', color: colors.textTertiary }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: `${spacing['3']} ${spacing['5']}`, maxHeight: '400px', overflowY: 'auto' }}>
              {globalShortcuts.map((shortcut) => {
                const keys = formatKey(shortcut);
                return (
                  <div key={shortcut.description} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{shortcut.description}</span>
                    <div style={{ display: 'flex', gap: spacing['1'] }}>
                      {keys.map((key, i) => (
                        <kbd key={i} style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: '24px', height: '24px', padding: `0 ${spacing['2']}`,
                          backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm,
                          fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
                          color: colors.textPrimary, fontFamily: 'monospace',
                          border: `1px solid ${colors.borderSubtle}`,
                        }}>
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
