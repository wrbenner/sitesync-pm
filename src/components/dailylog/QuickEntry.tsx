import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Cloud, Users, Wrench, HardHat, ShieldCheck, UserPlus, FileText, ChevronLeft, ChevronRight, Save, Send } from 'lucide-react';
import { colors, spacing, typography, borderRadius, transitions } from '../../styles/theme';
import type { WeatherData } from '../../lib/weather';

type Section = 'weather' | 'workforce' | 'equipment' | 'work' | 'safety' | 'visitors' | 'notes';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'weather', label: 'Weather', icon: <Cloud size={18} /> },
  { id: 'workforce', label: 'Workforce', icon: <Users size={18} /> },
  { id: 'equipment', label: 'Equipment', icon: <Wrench size={18} /> },
  { id: 'work', label: 'Work Performed', icon: <HardHat size={18} /> },
  { id: 'safety', label: 'Safety', icon: <ShieldCheck size={18} /> },
  { id: 'visitors', label: 'Visitors', icon: <UserPlus size={18} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={18} /> },
];

// Touch-friendly input style (44px+ tap target)
const touchInput: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: '16px', fontFamily: typography.fontFamily,
  border: 'none', backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
  outline: 'none', boxSizing: 'border-box', minHeight: '48px',
};

const touchTextarea: React.CSSProperties = {
  ...touchInput, resize: 'vertical', minHeight: '96px', lineHeight: '1.5',
};

const touchLabel: React.CSSProperties = {
  display: 'block', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
  color: colors.textPrimary, marginBottom: spacing['2'],
};

export interface QuickEntryData {
  weather: WeatherData | null;
  workforce: Array<{ trade: string; workers: number; hours: number }>;
  equipment: string;
  workPerformed: string;
  safety: string;
  visitors: string;
  notes: string;
}

interface QuickEntryProps {
  initialWeather?: WeatherData | null;
  onSave: (data: QuickEntryData) => void;
  onSubmit: (data: QuickEntryData) => void;
  onClose: () => void;
}

export const QuickEntry: React.FC<QuickEntryProps> = ({ initialWeather, onSave, onSubmit, onClose }) => {
  const [activeSection, setActiveSection] = useState(0);
  const [data, setData] = useState<QuickEntryData>({
    weather: initialWeather ?? null,
    workforce: [
      { trade: 'Concrete', workers: 0, hours: 0 },
      { trade: 'Electrical', workers: 0, hours: 0 },
      { trade: 'Mechanical', workers: 0, hours: 0 },
      { trade: 'Plumbing', workers: 0, hours: 0 },
      { trade: 'Steel', workers: 0, hours: 0 },
      { trade: 'Carpentry', workers: 0, hours: 0 },
      { trade: 'General Labor', workers: 0, hours: 0 },
    ],
    equipment: '',
    workPerformed: '',
    safety: '',
    visitors: '',
    notes: '',
  });

  const lastSavedRef = useRef<string>('');

  // Auto-save every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const current = JSON.stringify(data);
      if (current !== lastSavedRef.current) {
        onSave(data);
        lastSavedRef.current = current;
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [data, onSave]);

  const goNext = useCallback(() => {
    if (activeSection < SECTIONS.length - 1) setActiveSection(s => s + 1);
  }, [activeSection]);

  const goPrev = useCallback(() => {
    if (activeSection > 0) setActiveSection(s => s - 1);
  }, [activeSection]);

  // Swipe detection
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  const updateWorkforce = (index: number, field: 'workers' | 'hours', value: number) => {
    setData(prev => ({
      ...prev,
      workforce: prev.workforce.map((w, i) => i === index ? { ...w, [field]: value } : w),
    }));
  };

  const section = SECTIONS[activeSection];

  const renderSection = () => {
    switch (section.id) {
      case 'weather':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            {data.weather && (
              <div style={{ padding: spacing['4'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.lg, textAlign: 'center' }}>
                <span style={{ fontSize: '48px' }}>{data.weather.icon}</span>
                <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: `${spacing['2']} 0 0` }}>
                  {data.weather.temp_high}°F / {data.weather.temp_low}°F
                </p>
                <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
                  {data.weather.conditions} · Wind {data.weather.wind_speed}
                </p>
              </div>
            )}
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, textAlign: 'center' }}>
              Weather was auto fetched. You can override values on the main log view.
            </p>
          </div>
        );
      case 'workforce':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: spacing['2'], padding: `0 ${spacing['1']}` }}>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase' }}>Trade</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', textAlign: 'center' }}>Workers</span>
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', textAlign: 'center' }}>Hours</span>
            </div>
            {data.workforce.map((crew, idx) => (
              <div key={crew.trade} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: spacing['2'], alignItems: 'center' }}>
                <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>{crew.trade}</span>
                <input type="number" inputMode="numeric" value={crew.workers || ''} placeholder="0"
                  onChange={e => updateWorkforce(idx, 'workers', Number(e.target.value))}
                  style={{ ...touchInput, textAlign: 'center', padding: '12px 8px' }}
                />
                <input type="number" inputMode="numeric" value={crew.hours || ''} placeholder="0"
                  onChange={e => updateWorkforce(idx, 'hours', Number(e.target.value))}
                  style={{ ...touchInput, textAlign: 'center', padding: '12px 8px' }}
                />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: spacing['2'], padding: `${spacing['2']} 0`, borderTop: `1px solid ${colors.borderSubtle}` }}>
              <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Total</span>
              <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' }}>{data.workforce.reduce((s, w) => s + w.workers, 0)}</span>
              <span style={{ fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' }}>{data.workforce.reduce((s, w) => s + w.hours, 0)}</span>
            </div>
          </div>
        );
      case 'equipment':
        return (
          <div>
            <label style={touchLabel}>Equipment on site and status</label>
            <textarea value={data.equipment} onChange={e => setData(prev => ({ ...prev, equipment: e.target.value }))}
              placeholder="Tower Crane: Operating&#10;Concrete Pump: Active&#10;Scissor Lifts (4): Active"
              style={touchTextarea} />
          </div>
        );
      case 'work':
        return (
          <div>
            <label style={touchLabel}>Work performed today</label>
            <textarea value={data.workPerformed} onChange={e => setData(prev => ({ ...prev, workPerformed: e.target.value }))}
              placeholder="Concrete pour Level 9 complete&#10;Electrical rough in Floors 3 to 5&#10;Steel erection Floors 10 and 11"
              style={{ ...touchTextarea, minHeight: '160px' }} />
          </div>
        );
      case 'safety':
        return (
          <div>
            <label style={touchLabel}>Safety observations and incidents</label>
            <textarea value={data.safety} onChange={e => setData(prev => ({ ...prev, safety: e.target.value }))}
              placeholder="Toolbox talk conducted at 7am&#10;No incidents or near misses&#10;All PPE compliance verified"
              style={touchTextarea} />
          </div>
        );
      case 'visitors':
        return (
          <div>
            <label style={touchLabel}>Site visitors</label>
            <textarea value={data.visitors} onChange={e => setData(prev => ({ ...prev, visitors: e.target.value }))}
              placeholder="Owner rep site walk 10am to 12pm&#10;Fire Marshal inspection 2pm"
              style={touchTextarea} />
          </div>
        );
      case 'notes':
        return (
          <div>
            <label style={touchLabel}>Additional notes</label>
            <textarea value={data.notes} onChange={e => setData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional observations, follow up items, or notes for tomorrow's planning"
              style={{ ...touchTextarea, minHeight: '160px' }} />
          </div>
        );
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: colors.surfacePage, zIndex: 1060, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing['3']} ${spacing['4']}`, borderBottom: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised }}>
        <button onClick={onClose} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary, minHeight: '44px' }}>Cancel</button>
        <span style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>Quick Entry</span>
        <button onClick={() => onSave(data)} style={{ padding: `${spacing['2']} ${spacing['3']}`, fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold, minHeight: '44px', display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          <Save size={16} /> Save
        </button>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing['2'], padding: `${spacing['3']} ${spacing['4']}` }}>
        {SECTIONS.map((s, i) => (
          <button key={s.id} onClick={() => setActiveSection(i)} style={{
            width: i === activeSection ? 24 : 8, height: 8,
            borderRadius: borderRadius.full, border: 'none', cursor: 'pointer',
            backgroundColor: i === activeSection ? colors.primaryOrange : i < activeSection ? colors.statusActive : colors.borderDefault,
            transition: `all ${transitions.quick}`,
          }} />
        ))}
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], padding: `${spacing['2']} ${spacing['5']}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.orangeSubtle, color: colors.primaryOrange }}>
          {section.icon}
        </div>
        <div>
          <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>{section.label}</p>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>Step {activeSection + 1} of {SECTIONS.length}</p>
        </div>
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: `${spacing['4']} ${spacing['5']}` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {renderSection()}
      </div>

      {/* Footer navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['5']}`, borderTop: `1px solid ${colors.borderSubtle}`,
        backgroundColor: colors.surfaceRaised,
        paddingBottom: `max(${spacing['3']}, env(safe-area-inset-bottom))`,
      }}>
        <button onClick={goPrev} disabled={activeSection === 0} style={{
          display: 'flex', alignItems: 'center', gap: spacing['1'],
          padding: `${spacing['3']} ${spacing['4']}`, minHeight: '48px',
          fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.medium,
          backgroundColor: 'transparent', border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.md, cursor: activeSection === 0 ? 'default' : 'pointer',
          color: activeSection === 0 ? colors.textTertiary : colors.textPrimary,
          opacity: activeSection === 0 ? 0.5 : 1,
        }}>
          <ChevronLeft size={16} /> Back
        </button>

        {activeSection < SECTIONS.length - 1 ? (
          <button onClick={goNext} style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['3']} ${spacing['5']}`, minHeight: '48px',
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.semibold,
            backgroundColor: colors.primaryOrange, color: colors.white,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
          }}>
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => onSubmit(data)} style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['5']}`, minHeight: '48px',
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily, fontWeight: typography.fontWeight.semibold,
            backgroundColor: colors.statusActive, color: colors.white,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
          }}>
            <Send size={16} /> Submit Log
          </button>
        )}
      </div>
    </div>
  );
};
