import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../../styles/theme';
import { globalShortcuts, type GlobalShortcutEntry } from '../../hooks/useKeyboardShortcuts';

interface ShortcutOverlayProps {
  open: boolean;
  onClose: () => void;
}

function formatKey(shortcut: GlobalShortcutEntry): string[] {
  const keys: string[] = [];
  if (shortcut.meta) keys.push('⌘');
  if (shortcut.shift) keys.push('⇧');
  keys.push(shortcut.key === 'Escape' ? 'Esc' : shortcut.key === '/' ? '/' : shortcut.key.toUpperCase());
  return keys;
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: '24px', height: '24px', padding: `0 ${spacing['2']}`,
  backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold,
  color: colors.textPrimary, fontFamily: 'monospace',
  border: `1px solid ${colors.borderSubtle}`,
};

function ShortcutKeys({ shortcut }: { shortcut: GlobalShortcutEntry }) {
  if (shortcut.chord) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
        <kbd style={kbdStyle}>{shortcut.chord[0]}</kbd>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>then</span>
        <kbd style={kbdStyle}>{shortcut.chord[1]}</kbd>
      </div>
    );
  }
  const keys = formatKey(shortcut);
  return (
    <div style={{ display: 'flex', gap: spacing['1'] }}>
      {keys.map((key, i) => <kbd key={i} style={kbdStyle}>{key}</kbd>)}
    </div>
  );
}

export const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ open, onClose }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: colors.overlayDark, backdropFilter: 'blur(4px)', zIndex: zIndex.modal as number }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '640px', maxWidth: '92vw', backgroundColor: colors.surfaceRaised,
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
            <div style={{ padding: `${spacing['3']} ${spacing['5']}`, maxHeight: '480px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `0 ${spacing['4']}` }}>
                {globalShortcuts.map((shortcut) => (
                  <div key={shortcut.description} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['2']} 0`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                    <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{shortcut.description}</span>
                    <ShortcutKeys shortcut={shortcut} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
