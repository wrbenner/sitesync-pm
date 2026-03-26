import React from 'react';
import { Camera, Mic, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, SectionHeader } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { recentCaptures } from '../data/mockData';

export const FieldCapture: React.FC = () => {
  const quickActions = [
    {
      id: 1,
      title: 'Photo Log',
      icon: Camera,
      color: colors.primaryOrange,
      description: 'Capture site photos',
    },
    {
      id: 2,
      title: 'Voice Note',
      icon: Mic,
      color: colors.purple,
      description: 'Record observations',
    },
    {
      id: 3,
      title: 'Mark Complete',
      icon: CheckCircle,
      color: colors.tealSuccess,
      description: 'Complete punch items',
    },
    {
      id: 4,
      title: 'Flag Issue',
      icon: AlertTriangle,
      color: colors.red,
      description: 'Report problems',
    },
  ];

  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.lightBackground,
        padding: spacing.xl,
        marginLeft: '260px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: '560px', width: '100%' }}>
        <SectionHeader title="Field Capture" subtitle="Mobile first documentation" />

        {/* Quick Action Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          {quickActions.map((action) => {
            const IconComponent = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => console.log(`${action.title} clicked`)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.md,
                  padding: spacing.xl,
                  backgroundColor: colors.cardBackground,
                  border: `2px solid ${action.color}`,
                  borderRadius: borderRadius.lg,
                  cursor: 'pointer',
                  transition: 'all 200ms ease-in-out',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = action.color;
                  (e.currentTarget as HTMLButtonElement).style.color = colors.white;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.cardBackground;
                  (e.currentTarget as HTMLButtonElement).style.color = 'inherit';
                }}
              >
                <IconComponent size={32} color="currentColor" />
                <div>
                  <p
                    style={{
                      fontSize: typography.fontSize.lg,
                      fontWeight: typography.fontWeight.semibold,
                      color: 'currentColor',
                      margin: 0,
                    }}
                  >
                    {action.title}
                  </p>
                  <p
                    style={{
                      fontSize: typography.fontSize.sm,
                      color: 'inherit',
                      opacity: 0.7,
                      margin: 0,
                    }}
                  >
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Recent Captures */}
        <div>
          <h2
            style={{
              fontSize: typography.fontSize['2xl'],
              fontWeight: typography.fontWeight.bold,
              color: colors.textPrimary,
              margin: 0,
              marginBottom: spacing.lg,
            }}
          >
            Recent Captures
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            {recentCaptures.map((capture) => (
              <Card key={capture.id} padding={spacing.lg}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.lightBackground,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      flexShrink: 0,
                    }}
                  >
                    {capture.thumbnail}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.semibold,
                        color: colors.textPrimary,
                        margin: 0,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {capture.title}
                    </h3>
                    <p
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.textSecondary,
                        margin: 0,
                        marginBottom: spacing.xs,
                      }}
                    >
                      {capture.capturedBy}
                    </p>
                    <p
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.textTertiary,
                        margin: 0,
                      }}
                    >
                      {Math.floor(
                        (Date.now() - capture.timestamp.getTime()) / (1000 * 60)
                      )}m ago
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
