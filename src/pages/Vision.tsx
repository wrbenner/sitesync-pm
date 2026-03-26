import { Card, SectionHeader, Btn } from '../components/Primitives';
import { colors, spacing, typography, borderRadius } from '../styles/theme';
import { visionContent } from '../data/mockData';

export const Vision: React.FC = () => {
  return (
    <main
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.lightBackground,
        padding: spacing.xl,
        marginLeft: '260px',
      }}
    >
      {/* Hero Section */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: spacing.xxxl,
          paddingTop: spacing.xl,
        }}
      >
        <h1
          style={{
            fontSize: typography.fontSize['6xl'],
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.lg,
            lineHeight: typography.lineHeight.tight,
          }}
        >
          {visionContent.heading}
        </h1>
        <p
          style={{
            fontSize: typography.fontSize.xl,
            color: colors.textSecondary,
            margin: 0,
            marginBottom: spacing.xl,
            maxWidth: '600px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          The platform where field teams and project managers see the same thing at the same time.
        </p>
        <Btn variant="primary" size="lg">
          Get Started
        </Btn>
      </div>

      {/* Three Pillars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: spacing.xl,
          marginBottom: spacing.xxxl,
        }}
      >
        {visionContent.pillars.map((pillar) => (
          <Card key={pillar.id} padding={spacing.xl}>
            <div style={{ fontSize: typography.fontSize['3xl'], marginBottom: spacing.lg }}>
              {pillar.icon}
            </div>
            <h3
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: typography.fontWeight.bold,
                color: colors.textPrimary,
                margin: 0,
                marginBottom: spacing.md,
              }}
            >
              {pillar.title}
            </h3>
            <p
              style={{
                fontSize: typography.fontSize.base,
                color: colors.textSecondary,
                margin: 0,
                lineHeight: typography.lineHeight.relaxed,
              }}
            >
              {pillar.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Pricing Disruption */}
      <div style={{ marginBottom: spacing.xxxl }}>
        <SectionHeader title="Pricing Disruption" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: spacing.xl,
          }}
        >
          {/* Industry Standard */}
          <Card padding={spacing.xl}>
            <p
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: colors.textPrimary,
                margin: 0,
                marginBottom: spacing.lg,
              }}
            >
              {visionContent.pricingDisruption.industry.title}
            </p>
            <div
              style={{
                backgroundColor: colors.lightBackground,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                marginBottom: spacing.lg,
              }}
            >
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing.sm,
                }}
              >
                Base fee
              </p>
              <p
                style={{
                  fontSize: typography.fontSize['2xl'],
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                  margin: 0,
                }}
              >
                ${visionContent.pricingDisruption.industry.basePrice.toLocaleString()}
              </p>
            </div>
            <div
              style={{
                backgroundColor: colors.lightBackground,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
                marginBottom: spacing.lg,
              }}
            >
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing.sm,
                }}
              >
                Per user
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.xl,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                  margin: 0,
                }}
              >
                ${visionContent.pricingDisruption.industry.perUser}
              </p>
            </div>
            <div
              style={{
                backgroundColor: colors.lightBackground,
                padding: spacing.lg,
                borderRadius: borderRadius.md,
              }}
            >
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                  margin: 0,
                  marginBottom: spacing.sm,
                }}
              >
                Per project
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.xl,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                  margin: 0,
                }}
              >
                ${visionContent.pricingDisruption.industry.perProject.toLocaleString()}
              </p>
            </div>
          </Card>

          {/* SiteSync */}
          <Card padding={spacing.xl}>
            <p
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: colors.primaryOrange,
                margin: 0,
                marginBottom: spacing.lg,
              }}
            >
              {visionContent.pricingDisruption.sitesync.title}
            </p>
            <div
              style={{
                backgroundColor: colors.primaryOrange,
                padding: spacing.xl,
                borderRadius: borderRadius.md,
                color: colors.white,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  margin: 0,
                  marginBottom: spacing.sm,
                  opacity: 0.9,
                }}
              >
                Everything included
              </p>
              <p
                style={{
                  fontSize: typography.fontSize['3xl'],
                  fontWeight: typography.fontWeight.bold,
                  margin: 0,
                  marginBottom: spacing.xs,
                }}
              >
                ${visionContent.pricingDisruption.sitesync.basePrice}
              </p>
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  margin: 0,
                  opacity: 0.9,
                }}
              >
                per project per month
              </p>
            </div>
            <p
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
                margin: 0,
                marginTop: spacing.lg,
                textAlign: 'center',
              }}
            >
              Unlimited users • All features • AI included
            </p>
          </Card>
        </div>
      </div>

      {/* Roadmap */}
      <div>
        <SectionHeader title="Platform Roadmap" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: spacing.lg,
          }}
        >
          {visionContent.roadmap.map((phase) => (
            <Card key={phase.phase} padding={spacing.lg}>
              <p
                style={{
                  fontSize: typography.fontSize.xs,
                  color: colors.primaryOrange,
                  margin: 0,
                  marginBottom: spacing.sm,
                  fontWeight: typography.fontWeight.bold,
                  textTransform: 'uppercase',
                }}
              >
                Phase {phase.phase} • {phase.quarter}
              </p>
              <h3
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.textPrimary,
                  margin: 0,
                  marginBottom: spacing.md,
                }}
              >
                {phase.name}
              </h3>
              <p
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                  margin: 0,
                  lineHeight: typography.lineHeight.relaxed,
                }}
              >
                {phase.features}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
};
