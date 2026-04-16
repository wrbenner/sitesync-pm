// ── QuickRFIButton ───────────────────────────────────────────
// Floating action button that opens the QuickRFI capture flow.
// Fixed bottom-right, construction orange, pulses to draw attention.

import React, { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { colors, spacing, borderRadius, shadows, zIndex, typography } from '../../styles/theme';
import { duration, easingArray } from '../../styles/animations';

const QuickRFI = lazy(() => import('./QuickRFI'));

const QuickRFIButton: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed',
          bottom: spacing['6'],
          right: spacing['6'],
          zIndex: zIndex.fixed,
          width: '64px',
          height: '64px',
          borderRadius: borderRadius.full,
          border: 'none',
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          boxShadow: shadows.glow,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <Camera size={26} />

        {/* Pulse ring */}
        <motion.div
          animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: borderRadius.full,
            border: `2px solid ${colors.primaryOrange}`,
            pointerEvents: 'none',
          }}
        />
      </motion.button>

      {/* Label tooltip on first render */}
      {!open && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, duration: duration.smooth / 1000, ease: easingArray.apple }}
          style={{
            position: 'fixed',
            bottom: `calc(${spacing['6']} + 18px)`,
            right: `calc(${spacing['6']} + 72px)`,
            zIndex: zIndex.fixed,
            padding: `${spacing['1.5']} ${spacing['3']}`,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surfaceRaised,
            boxShadow: shadows.dropdown,
            fontSize: typography.fontSize.label,
            fontWeight: typography.fontWeight.medium,
            color: colors.textSecondary,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          Quick RFI
        </motion.div>
      )}

      {/* QuickRFI Modal */}
      <Suspense fallback={null}>
        {open && <QuickRFI open={open} onClose={() => setOpen(false)} />}
      </Suspense>
    </>
  );
};

export default QuickRFIButton;
