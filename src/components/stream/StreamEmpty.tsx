import React from 'react';
import { PageQuestion } from '../atoms';
import { spacing } from '../../styles/theme';

export const StreamEmpty: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      minHeight: '40vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: `${spacing[16]} ${spacing[4]}`,
      textAlign: 'center',
    }}
  >
    <PageQuestion size="medium" style={{ color: 'var(--color-ink-2)' }}>
      Nothing waiting on you.
    </PageQuestion>
  </div>
);

export default StreamEmpty;
