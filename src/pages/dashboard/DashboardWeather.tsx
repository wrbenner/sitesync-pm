import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudSun, Wind, Droplets } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import { duration, easingArray, skeletonStyle } from '../../styles/animations';
import { getWeatherImpact } from '../../lib/weather';
import type { WeatherData, WeatherDay } from '../../lib/weather';

const skeletonCard: React.CSSProperties = {
  ...skeletonStyle,
  border: `1px solid ${colors.borderSubtle}`,
  boxShadow: shadows.card,
};

interface DashboardWeatherProps {
  weatherData: WeatherData | undefined;
  forecastData: WeatherDay[] | undefined;
  weatherPending: boolean;
  reducedMotion: boolean;
}

export const DashboardWeather: React.FC<DashboardWeatherProps> = ({
  weatherData,
  forecastData,
  weatherPending,
  reducedMotion,
}) => {
  return (
    <>
      {weatherPending && !weatherData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.5, 1] }}
          style={{
            ...skeletonCard,
            height: 60,
            borderRadius: borderRadius.lg,
            marginBottom: spacing['4'],
          }}
        />
      )}
      <AnimatePresence>
      {weatherData && (
        <motion.div
          key="weather-strip"
          initial={reducedMotion ? undefined : { opacity: 0, y: 8 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4, transition: { duration: 0.15 } }}
          transition={reducedMotion ? undefined : { duration: duration.smooth / 1000, ease: easingArray.apple, delay: 0.05 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing['5'],
            padding: `${spacing['3']} ${spacing['5']}`,
            backgroundColor: colors.surfaceRaised,
            borderRadius: borderRadius.lg,
            boxShadow: shadows.card,
            marginBottom: spacing['4'],
            border: `1px solid ${colors.borderSubtle}`,
            flexWrap: 'wrap',
          }}
        >
          {/* Current conditions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], minWidth: 160 }}>
            <span style={{ fontSize: 28, lineHeight: '1' }}>{weatherData.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                {weatherData.temp_high}° / {weatherData.temp_low}°
              </p>
              <p style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                {weatherData.conditions}
              </p>
            </div>
          </div>

          {/* Impact indicator */}
          {(() => {
            const impact = getWeatherImpact(weatherData);
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: spacing['2'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: impact.level === 'none' ? colors.statusActiveSubtle : impact.level === 'low' ? colors.statusPendingSubtle : colors.statusCriticalSubtle,
                borderRadius: borderRadius.full,
                whiteSpace: 'nowrap',
              }}>
                <CloudSun size={13} color={impact.color} />
                <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium, color: impact.color }}>
                  {impact.label}
                </span>
              </div>
            );
          })()}

          {/* Wind + precip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['4'] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <Wind size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{weatherData.wind_speed}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
              <Droplets size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary }}>{weatherData.precipitation}</span>
            </div>
          </div>

          {/* 5-day mini forecast */}
          {forecastData && forecastData.length > 0 && (
            <div style={{ display: 'flex', gap: spacing['3'], marginLeft: 'auto' }}>
              {forecastData.slice(0, 5).map((day) => (
                <div key={day.date} style={{ textAlign: 'center', minWidth: 36 }}>
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 2 }}>
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 16, lineHeight: '1.2' }}>{day.icon}</div>
                  <div style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
                    {day.temp_high}°
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};
