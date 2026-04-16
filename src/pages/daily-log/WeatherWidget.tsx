import React from 'react';
import { Cloud } from 'lucide-react';
import { WeatherCard } from '../../components/dailylog/WeatherCard';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';
import type { WeatherData } from '../../lib/weather';

interface WeatherWidgetProps {
  weather: WeatherData;
  weatherIsAuto: boolean;
  isLocked: boolean;
  onUpdate: (updated: WeatherData) => void;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, weatherIsAuto, isLocked, onUpdate }) => (
  <div>
    {weatherIsAuto && (
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'], marginBottom: spacing['2'] }}>
        <Cloud size={12} color={colors.statusInfo} />
        <span style={{
          fontSize: typography.fontSize.caption,
          fontWeight: typography.fontWeight.semibold,
          color: colors.statusInfo,
          backgroundColor: colors.statusInfoSubtle,
          padding: `1px ${spacing['2']}`,
          borderRadius: borderRadius.full,
          letterSpacing: '0.2px',
        }}>
          Auto
        </span>
        <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          Weather populated from project records
        </span>
      </div>
    )}
    <WeatherCard weather={weather} onUpdate={!isLocked ? onUpdate : undefined} locked={isLocked} />
  </div>
);
