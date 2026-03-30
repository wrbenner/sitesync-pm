import React, { useState, useRef, useCallback } from 'react';
import { Cloud, Sun, Users, Wrench, HardHat, ShieldCheck, FileText, Camera, Mic,
  ChevronLeft, ChevronRight, Send, Save, Check, Plus, Minus } from 'lucide-react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../../styles/theme';
import { useHaptics } from '../../hooks/useMobileCapture';

// ── Types ────────────────────────────────────────────────

interface DailyLogSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const SECTIONS: DailyLogSection[] = [
  { id: 'weather', label: 'Weather', icon: <Sun size={20} />, color: colors.statusPending },
  { id: 'workforce', label: 'Crew', icon: <Users size={20} />, color: colors.statusInfo },
  { id: 'equipment', label: 'Equipment', icon: <Wrench size={20} />, color: colors.statusReview },
  { id: 'work', label: 'Work', icon: <HardHat size={20} />, color: colors.primaryOrange },
  { id: 'safety', label: 'Safety', icon: <ShieldCheck size={20} />, color: colors.statusActive },
  { id: 'notes', label: 'Notes', icon: <FileText size={20} />, color: colors.statusNeutral },
];

interface CrewEntry {
  trade: string;
  workers: number;
  hours: number;
}

interface LogData {
  weather: { conditions: string; tempHigh: string; tempLow: string; wind: string };
  workforce: CrewEntry[];
  equipment: string;
  workPerformed: string;
  safety: string;
  notes: string;
  photos: string[];
}

interface MobileDailyLogProps {
  date: string;
  initialData?: Partial<LogData>;
  onSave: (data: LogData) => void;
  onSubmit: (data: LogData) => void;
  onClose: () => void;
  onCapturePhoto: () => void;
  onVoiceNote: () => void;
}

// ── Touch Input Styles ───────────────────────────────────

const touchInput: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: '16px',
  fontFamily: typography.fontFamily, border: 'none',
  backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md,
  outline: 'none', boxSizing: 'border-box', minHeight: '48px',
};

const touchTextarea: React.CSSProperties = {
  ...touchInput, resize: 'vertical', minHeight: '120px', lineHeight: '1.5',
};

// ── Component ────────────────────────────────────────────

export const MobileDailyLog: React.FC<MobileDailyLogProps> = ({
  date, initialData, onSave, onSubmit, onClose, onCapturePhoto, onVoiceNote,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [data, setData] = useState<LogData>({
    weather: { conditions: 'Sunny', tempHigh: '78', tempLow: '62', wind: '5 mph NW' },
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
    notes: '',
    photos: [],
    ...initialData,
  });

  const { impact, notification } = useHaptics();
  const touchStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const section = SECTIONS[activeIndex];

  // ── Navigation ─────────────────────────────────────

  const goNext = useCallback(() => {
    if (activeIndex < SECTIONS.length - 1) {
      impact('light');
      setActiveIndex((i) => i + 1);
    }
  }, [activeIndex, impact]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) {
      impact('light');
      setActiveIndex((i) => i - 1);
    }
  }, [activeIndex, impact]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // ── Crew helpers ───────────────────────────────────

  const updateCrew = (index: number, field: 'workers' | 'hours', delta: number) => {
    impact('light');
    setData((prev) => ({
      ...prev,
      workforce: prev.workforce.map((w, i) =>
        i === index ? { ...w, [field]: Math.max(0, w[field] + delta) } : w
      ),
    }));
  };

  // ── Render Sections ────────────────────────────────

  const renderSection = () => {
    switch (section.id) {
      case 'weather':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
            <div style={{
              padding: spacing['5'], backgroundColor: `${colors.statusPending}08`,
              borderRadius: borderRadius.xl, textAlign: 'center',
            }}>
              <div style={{ fontSize: '56px', marginBottom: spacing['2'] }}>☀️</div>
              <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                {data.weather.tempHigh}°F / {data.weather.tempLow}°F
              </p>
              <p style={{ fontSize: typography.fontSize.body, color: colors.textSecondary, margin: `${spacing['1']} 0 0` }}>
                {data.weather.conditions} · Wind {data.weather.wind}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing['3'] }}>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing['1'], display: 'block' }}>Conditions</label>
                <input value={data.weather.conditions} onChange={(e) => setData((d) => ({ ...d, weather: { ...d.weather, conditions: e.target.value } }))} style={touchInput} />
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing['1'], display: 'block' }}>Wind</label>
                <input value={data.weather.wind} onChange={(e) => setData((d) => ({ ...d, weather: { ...d.weather, wind: e.target.value } }))} style={touchInput} />
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing['1'], display: 'block' }}>High °F</label>
                <input type="number" inputMode="numeric" value={data.weather.tempHigh} onChange={(e) => setData((d) => ({ ...d, weather: { ...d.weather, tempHigh: e.target.value } }))} style={{ ...touchInput, textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginBottom: spacing['1'], display: 'block' }}>Low °F</label>
                <input type="number" inputMode="numeric" value={data.weather.tempLow} onChange={(e) => setData((d) => ({ ...d, weather: { ...d.weather, tempLow: e.target.value } }))} style={{ ...touchInput, textAlign: 'center' }} />
              </div>
            </div>
          </div>
        );

      case 'workforce':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            {/* Summary */}
            <div style={{
              display: 'flex', justifyContent: 'space-around',
              padding: spacing['4'], backgroundColor: `${colors.statusInfo}08`,
              borderRadius: borderRadius.lg, marginBottom: spacing['2'],
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  {data.workforce.reduce((s, w) => s + w.workers, 0)}
                </p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Workers</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: typography.fontSize.heading, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                  {data.workforce.reduce((s, w) => s + w.hours, 0)}
                </p>
                <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>Hours</p>
              </div>
            </div>

            {/* Crew entries with +/- buttons (glove friendly) */}
            {data.workforce.map((crew, idx) => (
              <div key={crew.trade} style={{
                display: 'flex', alignItems: 'center', gap: spacing['3'],
                padding: spacing['3'], backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.md, boxShadow: shadows.sm,
              }}>
                <span style={{ flex: 1, fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                  {crew.trade}
                </span>

                {/* Workers stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  <StepperButton icon={<Minus size={14} />} onClick={() => updateCrew(idx, 'workers', -1)} />
                  <span style={{ width: 32, textAlign: 'center', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, fontFeatureSettings: '"tnum"' }}>
                    {crew.workers}
                  </span>
                  <StepperButton icon={<Plus size={14} />} onClick={() => updateCrew(idx, 'workers', 1)} />
                </div>

                <div style={{ width: 1, height: 24, backgroundColor: colors.borderSubtle }} />

                {/* Hours stepper */}
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
                  <StepperButton icon={<Minus size={14} />} onClick={() => updateCrew(idx, 'hours', -1)} />
                  <span style={{ width: 32, textAlign: 'center', fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.semibold, fontFeatureSettings: '"tnum"' }}>
                    {crew.hours}
                  </span>
                  <StepperButton icon={<Plus size={14} />} onClick={() => updateCrew(idx, 'hours', 1)} />
                </div>
              </div>
            ))}
          </div>
        );

      case 'equipment':
        return (
          <div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `0 0 ${spacing['3']}` }}>
              List equipment on site and current status
            </p>
            <textarea
              value={data.equipment}
              onChange={(e) => setData((d) => ({ ...d, equipment: e.target.value }))}
              placeholder="Tower Crane: Operating&#10;Concrete Pump: Active&#10;Scissor Lifts (4): Active"
              style={touchTextarea}
            />
            <VoiceInputButton onPress={onVoiceNote} />
          </div>
        );

      case 'work':
        return (
          <div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `0 0 ${spacing['3']}` }}>
              Describe work performed today
            </p>
            <textarea
              value={data.workPerformed}
              onChange={(e) => setData((d) => ({ ...d, workPerformed: e.target.value }))}
              placeholder="Concrete pour Level 9 complete&#10;Electrical rough in Floors 3 to 5&#10;Steel erection Floors 10 and 11"
              style={{ ...touchTextarea, minHeight: '160px' }}
            />
            <div style={{ display: 'flex', gap: spacing['2'], marginTop: spacing['3'] }}>
              <VoiceInputButton onPress={onVoiceNote} />
              <PhotoButton onPress={onCapturePhoto} />
            </div>
          </div>
        );

      case 'safety':
        return (
          <div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `0 0 ${spacing['3']}` }}>
              Safety observations, toolbox talks, and incidents
            </p>
            <textarea
              value={data.safety}
              onChange={(e) => setData((d) => ({ ...d, safety: e.target.value }))}
              placeholder="Toolbox talk conducted at 7am&#10;No incidents or near misses&#10;All PPE compliance verified"
              style={touchTextarea}
            />
            <VoiceInputButton onPress={onVoiceNote} />
          </div>
        );

      case 'notes':
        return (
          <div>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: `0 0 ${spacing['3']}` }}>
              Additional observations or follow up items
            </p>
            <textarea
              value={data.notes}
              onChange={(e) => setData((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Any additional notes for tomorrow's planning"
              style={{ ...touchTextarea, minHeight: '160px' }}
            />
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.surfacePage }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['4']}`, backgroundColor: colors.surfaceRaised,
        borderBottom: `1px solid ${colors.borderSubtle}`, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          padding: `${spacing['2']} ${spacing['3']}`, minHeight: '44px',
          fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
          backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: colors.textSecondary,
        }}>
          Cancel
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
            Daily Log
          </p>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0 }}>{date}</p>
        </div>
        <button onClick={() => onSave(data)} style={{
          display: 'flex', alignItems: 'center', gap: spacing['1'],
          padding: `${spacing['2']} ${spacing['3']}`, minHeight: '44px',
          fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
          backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
          color: colors.primaryOrange, fontWeight: typography.fontWeight.semibold,
        }}>
          <Save size={16} /> Save
        </button>
      </div>

      {/* Section tabs (scrollable) */}
      <div style={{
        display: 'flex', gap: spacing['1'], padding: `${spacing['3']} ${spacing['4']}`,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexShrink: 0,
      }}>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { impact('light'); setActiveIndex(i); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              padding: `${spacing['2']} ${spacing['3']}`, minWidth: '60px', minHeight: '52px',
              backgroundColor: i === activeIndex ? `${s.color}12` : 'transparent',
              color: i === activeIndex ? s.color : colors.textTertiary,
              border: i === activeIndex ? `1.5px solid ${s.color}30` : '1.5px solid transparent',
              borderRadius: borderRadius.lg, cursor: 'pointer',
              fontFamily: typography.fontFamily, transition: `all ${transitions.instant}`,
            }}
          >
            {s.icon}
            <span style={{ fontSize: '10px', fontWeight: i === activeIndex ? typography.fontWeight.semibold : typography.fontWeight.medium }}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, backgroundColor: colors.surfaceInset, flexShrink: 0 }}>
        <div style={{
          height: '100%', backgroundColor: section.color,
          width: `${((activeIndex + 1) / SECTIONS.length) * 100}%`,
          transition: `width ${transitions.quick}`,
        }} />
      </div>

      {/* Card content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, overflow: 'auto', padding: spacing['5'], WebkitOverflowScrolling: 'touch' }}
      >
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['3'], marginBottom: spacing['5'] }}>
          <div style={{
            width: 44, height: 44, borderRadius: borderRadius.lg,
            backgroundColor: `${section.color}12`, color: section.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {section.icon}
          </div>
          <div>
            <p style={{ fontSize: typography.fontSize.subtitle, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
              {section.label}
            </p>
            <p style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, margin: 0 }}>
              Step {activeIndex + 1} of {SECTIONS.length}
            </p>
          </div>
        </div>

        {renderSection()}
      </div>

      {/* Footer navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${spacing['3']} ${spacing['5']}`,
        borderTop: `1px solid ${colors.borderSubtle}`, backgroundColor: colors.surfaceRaised,
        paddingBottom: `max(${spacing['3']}, env(safe-area-inset-bottom))`,
        flexShrink: 0,
      }}>
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['3']} ${spacing['4']}`, minHeight: '48px',
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.medium,
            backgroundColor: 'transparent',
            border: `1px solid ${activeIndex === 0 ? colors.borderSubtle : colors.borderDefault}`,
            borderRadius: borderRadius.md, cursor: activeIndex === 0 ? 'default' : 'pointer',
            color: activeIndex === 0 ? colors.textTertiary : colors.textPrimary,
            opacity: activeIndex === 0 ? 0.5 : 1,
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>

        {activeIndex < SECTIONS.length - 1 ? (
          <button onClick={goNext} style={{
            display: 'flex', alignItems: 'center', gap: spacing['1'],
            padding: `${spacing['3']} ${spacing['5']}`, minHeight: '48px',
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.semibold,
            backgroundColor: colors.primaryOrange, color: colors.white,
            border: 'none', borderRadius: borderRadius.md, cursor: 'pointer',
          }}>
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => { notification('success'); onSubmit(data); }} style={{
            display: 'flex', alignItems: 'center', gap: spacing['2'],
            padding: `${spacing['3']} ${spacing['5']}`, minHeight: '48px',
            fontSize: typography.fontSize.body, fontFamily: typography.fontFamily,
            fontWeight: typography.fontWeight.semibold,
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

// ── Sub-components ───────────────────────────────────────

const StepperButton: React.FC<{ icon: React.ReactNode; onClick: () => void }> = ({ icon, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: 36, height: 36, borderRadius: '50%',
      backgroundColor: colors.surfaceInset, border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: colors.textSecondary,
      minWidth: 44, minHeight: 44, /* touch target */
    }}
  >
    {icon}
  </button>
);

const VoiceInputButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <button
    onClick={onPress}
    style={{
      display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: `${spacing['3']} ${spacing['4']}`, minHeight: '48px',
      backgroundColor: `${colors.statusReview}08`,
      border: `1px solid ${colors.statusReview}25`, borderRadius: borderRadius.md,
      cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
      fontWeight: typography.fontWeight.medium, color: colors.statusReview,
      marginTop: spacing['3'],
    }}
  >
    <Mic size={16} /> Voice to text
  </button>
);

const PhotoButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
  <button
    onClick={onPress}
    style={{
      display: 'flex', alignItems: 'center', gap: spacing['2'],
      padding: `${spacing['3']} ${spacing['4']}`, minHeight: '48px',
      backgroundColor: `${colors.statusInfo}08`,
      border: `1px solid ${colors.statusInfo}25`, borderRadius: borderRadius.md,
      cursor: 'pointer', fontSize: typography.fontSize.sm, fontFamily: typography.fontFamily,
      fontWeight: typography.fontWeight.medium, color: colors.statusInfo,
      marginTop: spacing['3'],
    }}
  >
    <Camera size={16} /> Add photo
  </button>
);
