import React, { useState } from 'react';
import { Camera, MapPin, X, Tag, Mic } from 'lucide-react';
import { Btn } from '../../components/Primitives';
import { PermissionGate } from '../../components/auth/PermissionGate';
import { colors, spacing, typography, borderRadius, shadows, transitions, zIndex } from '../../styles/theme';
import { CONSTRUCTION_TAGS, LINK_OPTIONS, type OverlayMeta } from './types';

interface PhotoOverlayProps {
  dataUrl: string;
  location: string | null;
  isSaving: boolean;
  onSave: (meta: OverlayMeta) => void;
  onCancel: () => void;
}

export const PhotoOverlay: React.FC<PhotoOverlayProps> = ({ dataUrl, location, isSaving, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [linkTo, setLinkTo] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${spacing['3']} ${spacing['3']}`,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.body,
    fontFamily: typography.fontFamily,
    color: colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: colors.surfacePage,
    minHeight: '56px',
  };

  return (
    <div
      role="dialog"
      aria-label="Add photo details"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal as number,
        backgroundColor: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: colors.white,
          borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
          width: '100%',
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Preview image */}
        <div style={{ position: 'relative' }}>
          <img loading="lazy"
            src={dataUrl}
            alt="Captured photo preview"
            style={{
              width: '100%',
              maxHeight: '220px',
              objectFit: 'cover',
              borderRadius: `${borderRadius['2xl']} ${borderRadius['2xl']} 0 0`,
              display: 'block',
            }}
          />
          <button
            aria-label="Close"
            onClick={onCancel}
            style={{
              position: 'absolute',
              top: spacing['3'],
              right: spacing['3'],
              width: '56px',
              height: '56px',
              borderRadius: borderRadius.full,
              backgroundColor: 'rgba(0,0,0,0.55)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color="#fff" />
          </button>
        </div>

        {/* Form fields */}
        <div style={{ padding: spacing['5'], display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
          {/* Timestamp + GPS row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.full,
              }}
            >
              <span style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.medium }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          </div>
          {/* GPS badge */}
          {location && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: spacing['1'],
                padding: `${spacing['1']} ${spacing['3']}`,
                backgroundColor: `${colors.primaryOrange}12`,
                borderRadius: borderRadius.full,
                alignSelf: 'flex-start',
              }}
            >
              <MapPin size={12} color={colors.primaryOrange} />
              <span style={{ fontSize: typography.fontSize.caption, color: colors.primaryOrange, fontWeight: typography.fontWeight.medium }}>
                {location}
              </span>
            </div>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional)"
            style={inputStyle}
          />

          {/* Notes */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              style={{
                ...inputStyle,
                minHeight: '80px',
                resize: 'vertical',
                paddingRight: spacing['10'],
              }}
            />
            <button
              type="button"
              aria-label="Voice to text"
              title="Voice to text"
              style={{
                position: 'absolute',
                top: spacing['3'],
                right: spacing['3'],
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: colors.textTertiary,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Mic size={16} />
            </button>
          </div>

          {/* Tags multi-select */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], marginBottom: spacing['2'] }}>
              <Tag size={13} color={colors.textTertiary} />
              <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textSecondary }}>
                Tags
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing['2'] }}>
              {CONSTRUCTION_TAGS.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: `${spacing['3']} ${spacing['4']}`,
                      minHeight: '56px',
                      backgroundColor: active ? colors.primaryOrange : 'transparent',
                      color: active ? colors.white : colors.textSecondary,
                      border: `1px solid ${active ? colors.primaryOrange : colors.borderDefault}`,
                      borderRadius: borderRadius.full,
                      cursor: 'pointer',
                      fontSize: typography.fontSize.caption,
                      fontWeight: typography.fontWeight.medium,
                      fontFamily: typography.fontFamily,
                      transition: `all ${transitions.quick}`,
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Link to */}
          <select
            value={linkTo}
            onChange={e => setLinkTo(e.target.value)}
            aria-label="Link photo to an item"
            style={{
              ...inputStyle,
              appearance: 'auto',
              color: linkTo ? colors.textPrimary : colors.textTertiary,
            }}
          >
            <option value="">Link to drawing, task, punch, RFI, or daily log (optional)</option>
            {LINK_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Actions */}
          <div style={{ display: 'flex', gap: spacing['3'], paddingBottom: spacing['2'] }}>
            <Btn variant="ghost" size="md" onClick={onCancel} style={{ flex: 1, minHeight: '56px' } as React.CSSProperties}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              size="md"
              onClick={() => onSave({ title, notes, tags: selectedTags, linkTo, location })}
              disabled={isSaving}
              style={{ flex: 1, minHeight: '56px' } as React.CSSProperties}
            >
              {isSaving ? 'Saving...' : 'Save Photo'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CaptureButtonsProps {
  onCaptureClick: () => void;
}

export const CaptureButtons: React.FC<CaptureButtonsProps> = ({ onCaptureClick }) => (
  <>
    <style>{`
      .fc-capture-btn { width: 100%; height: 64px; border-radius: 12px; }
      @media (min-width: 768px) { .fc-capture-btn { width: auto; height: 56px; border-radius: 10px; padding: 0 24px; align-self: flex-start; } }
      .fc-fab { display: none; }
      @media (min-width: 768px) { .fc-fab { display: flex; position: fixed; top: 20px; right: 36px; height: 56px; border-radius: 10px; padding: 0 20px; z-index: 100; } }
    `}</style>
    <PermissionGate
      permission="field_capture.create"
      fallback={
        <button
          className="fc-capture-btn"
          aria-label="Capture requires additional permissions"
          title="Your role doesn't allow capturing photos. Request access from your admin."
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            backgroundColor: colors.primaryOrange,
            color: colors.white,
            border: 'none',
            cursor: 'not-allowed',
            opacity: 0.5,
            fontSize: typography.fontSize.title,
            fontWeight: typography.fontWeight.semibold,
            fontFamily: typography.fontFamily,
            marginBottom: spacing['5'],
          }}
        >
          <Camera size={22} />
          Capture
        </button>
      }
    >
      <button
        className="fc-capture-btn"
        aria-label="Capture new field photo"
        onClick={onCaptureClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing['2'],
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          border: 'none',
          cursor: 'pointer',
          boxShadow: shadows.glow,
          fontSize: typography.fontSize.title,
          fontWeight: typography.fontWeight.semibold,
          fontFamily: typography.fontFamily,
          marginBottom: spacing['5'],
          transition: `background-color ${transitions.quick}`,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
      >
        <Camera size={22} />
        Capture
      </button>
    </PermissionGate>
    {/* Desktop FAB (duplicate trigger, hidden on mobile) */}
    <PermissionGate permission="field_capture.create">
      <button
        className="fc-fab"
        aria-label="Capture new field photo"
        onClick={onCaptureClick}
        style={{
          alignItems: 'center',
          gap: spacing['2'],
          backgroundColor: colors.primaryOrange,
          color: colors.white,
          border: 'none',
          cursor: 'pointer',
          boxShadow: shadows.glow,
          fontSize: typography.fontSize.body,
          fontWeight: typography.fontWeight.semibold,
          fontFamily: typography.fontFamily,
          transition: `background-color ${transitions.quick}`,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.orangeHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = colors.primaryOrange; }}
      >
        <Camera size={18} />
        Capture
      </button>
    </PermissionGate>
  </>
);
