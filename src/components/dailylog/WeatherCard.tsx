import React, { useState } from 'react';
import { Cloud, Thermometer, Wind, Droplets, Edit3, Check } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { WeatherData } from '../../lib/weather';
import { getWeatherImpact } from '../../lib/weather';

interface WeatherCardProps {
  weather: WeatherData;
  onUpdate?: (weather: WeatherData) => void;
  locked?: boolean;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather, onUpdate, locked }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(weather);
  const impact = getWeatherImpact(weather);

  const save = () => {
    onUpdate?.(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: spacing['3'],
        padding: spacing['4'], backgroundColor: colors.surfaceRaised,
        borderRadius: borderRadius.lg, border: `1px solid ${colors.borderFocus}`,
      }}>
        <div>
          <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>High</label>
          <input type="number" value={draft.temp_high}
            onChange={e => setDraft({ ...draft, temp_high: Number(e.target.value) })}
            style={{ width: '100%', padding: spacing['2'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Low</label>
          <input type="number" value={draft.temp_low}
            onChange={e => setDraft({ ...draft, temp_low: Number(e.target.value) })}
            style={{ width: '100%', padding: spacing['2'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Conditions</label>
          <select value={draft.conditions}
            onChange={e => setDraft({ ...draft, conditions: e.target.value })}
            style={{ width: '100%', padding: spacing['2'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, outline: 'none' }}
          >
            {['Clear', 'Cloudy', 'Light Rain', 'Rain', 'Thunderstorm', 'Snow', 'Fog', 'Haze'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'block', marginBottom: spacing['1'] }}>Wind</label>
          <input type="text" value={draft.wind_speed}
            onChange={e => setDraft({ ...draft, wind_speed: e.target.value })}
            style={{ width: '100%', padding: spacing['2'], fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.sm, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
          <button onClick={() => setEditing(false)} style={{ padding: `${spacing['1']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`, borderRadius: borderRadius.sm, cursor: 'pointer', color: colors.textSecondary }}>Cancel</button>
          <button onClick={save} style={{ padding: `${spacing['1']} ${spacing['3']}`, fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily, backgroundColor: colors.primaryOrange, color: colors.white, border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
            <Check size={13} /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['5'],
      padding: `${spacing['4']} ${spacing['5']}`, backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg, border: `1px solid ${colors.borderSubtle}`,
      position: 'relative',
    }}>
      {/* Icon + conditions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'] }}>
        <span style={{ fontSize: spacing['8'], lineHeight: typography.lineHeight.none }}>{weather.icon}</span>
        <div>
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{weather.conditions}</p>
          <p style={{ fontSize: typography.fontSize.sm, color: impact.color, margin: `${spacing['1']} 0 0`, fontWeight: typography.fontWeight.medium }}>{impact.label}</p>
        </div>
      </div>

      {/* Temp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Thermometer size={14} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>{weather.temp_high}°</span>
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>/</span>
        <span style={{ fontSize: typography.fontSize.body, color: colors.textTertiary }}>{weather.temp_low}°</span>
      </div>

      {/* Wind */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Wind size={14} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{weather.wind_speed}</span>
      </div>

      {/* Precipitation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Droplets size={14} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{weather.precipitation}</span>
      </div>

      {/* Humidity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
        <Cloud size={14} color={colors.textTertiary} />
        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{weather.humidity}%</span>
      </div>

      {/* Source badge */}
      {weather.source === 'openweathermap' && (
        <div style={{
          marginLeft: 'auto',
          fontSize: typography.fontSize.caption,
          color: colors.textTertiary,
          backgroundColor: colors.surfaceInset,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: borderRadius.sm,
          padding: `2px ${spacing['2']}`,
          whiteSpace: 'nowrap',
        }}>
          Auto-populated from OpenWeatherMap
        </div>
      )}

      {/* Edit button */}
      {!locked && onUpdate && (
        <button onClick={() => { setDraft(weather); setEditing(true); }}
          style={{
            position: 'absolute', top: spacing['2'], right: spacing['2'],
            padding: spacing['1'], backgroundColor: 'transparent', border: 'none',
            cursor: 'pointer', color: colors.textTertiary, borderRadius: borderRadius.sm,
            transition: `color ${transitions.quick}`,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textPrimary; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary; }}
        >
          <Edit3 size={13} />
        </button>
      )}
    </div>
  );
};
