import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Btn, PageContainer } from '../../components/Primitives';
import { colors, spacing, typography } from '../../styles/theme';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          gap: spacing['6'],
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: colors.orangeSubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapPin size={36} color={colors.primaryOrange} />
        </div>
        <div>
          <h1
            style={{
              fontSize: typography.fontSize.heading,
              fontWeight: typography.fontWeight.semibold,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: spacing['2'],
            }}
          >
            Page not found
          </h1>
          <p
            style={{
              fontSize: typography.fontSize.body,
              color: colors.textSecondary,
              margin: 0,
              maxWidth: '400px',
            }}
          >
            The page you are looking for does not exist or has been moved. Head back to the dashboard to get back on track.
          </p>
        </div>
        <Btn onClick={() => navigate('/')}>Back to Dashboard</Btn>
      </div>
    </PageContainer>
  );
};
