import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, CheckCircle, Search, Loader2 } from 'lucide-react';
import { colors, spacing, typography, borderRadius, zIndex } from '../../styles/theme';
import { useProjectStore } from '../../stores/projectStore';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../hooks/useOrganization';
import { useQueryClient } from '@tanstack/react-query';

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface Props {
  open: boolean;
  onClose: () => void;
}

interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
}

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

// ═══════════════════════════════════════════════════════════
// Design Constants
// ═══════════════════════════════════════════════════════════

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** 10 curated project accent colors — deterministically assigned from name */
const ACCENT_PALETTE = [
  '#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#06B6D4', '#F59E0B', '#6366F1', '#14B8A6', '#EF4444',
];

const PROJECT_TYPES = [
  { value: 'commercial_office', label: 'Office',         icon: '🏢' },
  { value: 'mixed_use',         label: 'Mixed Use',      icon: '🏙️' },
  { value: 'healthcare',        label: 'Healthcare',     icon: '🏥' },
  { value: 'education',         label: 'Education',      icon: '🎓' },
  { value: 'multifamily',       label: 'Residential',    icon: '🏘️' },
  { value: 'industrial',        label: 'Industrial',     icon: '🏭' },
  { value: 'data_center',       label: 'Data Center',    icon: '💾' },
  { value: 'retail',            label: 'Retail',         icon: '🛍️' },
  { value: 'hospitality',       label: 'Hospitality',    icon: '🏨' },
  { value: 'government',        label: 'Government',     icon: '🏛️' },
  { value: 'infrastructure',    label: 'Infrastructure', icon: '🌉' },
  { value: 'renovation',        label: 'Renovation',     icon: '🔨' },
] as const;

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function accentFromName(name: string): string {
  if (!name) return ACCENT_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return ACCENT_PALETTE[Math.abs(h) % ACCENT_PALETTE.length];
}

function formatStructuredAddress(a?: NominatimAddress): { line1: string; line2: string } | null {
  if (!a) return null;
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || '';
  const parts = [city, a.state].filter(Boolean).join(', ');
  const line2 = a.postcode ? `${parts} ${a.postcode}` : parts;
  if (!street && !line2) return null;
  return { line1: street, line2 };
}

function osmEmbedUrl(lat: string, lon: string): string {
  const la = parseFloat(lat);
  const lo = parseFloat(lon);
  const d = 0.005;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lo - d},${la - d * 0.65},${lo + d},${la + d * 0.65}&layer=mapnik&marker=${lat},${lon}`;
}

// ═══════════════════════════════════════════════════════════
// Nominatim Geocoding
// ═══════════════════════════════════════════════════════════

async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (query.length < 3) return [];
  try {
    const params = new URLSearchParams({
      q: query, format: 'json', limit: '5',
      countrycodes: 'us', addressdetails: '1',
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'SiteSyncPM/1.0' } },
    );
    if (!res.ok) return [];
    return (await res.json()) as AddressSuggestion[];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════════════════════

const backdropV = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.25 } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
};

const panelV = {
  hidden: { opacity: 0, scale: 0.92, y: 28 },
  show:   { opacity: 1, scale: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
  exit:   { opacity: 0, scale: 0.96, y: 14, transition: { duration: 0.2, ease: EASE } },
};

const row = (delay: number) => ({
  hidden:  { opacity: 0, y: 14 },
  show:    { opacity: 1, y: 0, transition: { delay, duration: 0.38, ease: EASE } },
});

// ═══════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════

export const CreateProjectModal: React.FC<Props> = ({ open, onClose }) => {

  // ── Form state ──────────────────────────────────────────
  const [name, setName]                     = useState('');
  const [projectType, setProjectType]       = useState('');
  const [saving, setSaving]                 = useState(false);
  const [success, setSuccess]               = useState(false);
  const [error, setError]                   = useState('');
  const [nameError, setNameError]           = useState(false);

  // ── Address state ───────────────────────────────────────
  const [addressQuery, setAddressQuery]     = useState('');
  const [suggestions, setSuggestions]       = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching]           = useState(false);
  const [selected, setSelected]             = useState<AddressSuggestion | null>(null);
  const [mapLoaded, setMapLoaded]           = useState(false);
  const [hlIdx, setHlIdx]                   = useState(-1);
  const debounceRef    = useRef<ReturnType<typeof setTimeout>>();
  const addressInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef  = useRef<HTMLDivElement>(null);

  // ── Hooks ───────────────────────────────────────────────
  const { user }       = useAuth();
  const { currentOrg } = useOrganization();
  const createProject  = useProjectStore((s) => s.createProject);
  const queryClient    = useQueryClient();
  const nameRef        = useRef<HTMLInputElement>(null);

  // ── Derived ─────────────────────────────────────────────
  const accent       = name.trim() ? accentFromName(name.trim()) : colors.borderSubtle;
  const fmtAddr      = selected ? formatStructuredAddress(selected.address) : null;
  const isValid      = name.trim().length > 0;

  // ── Effects ─────────────────────────────────────────────

  // Auto-focus name on open
  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 160);
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setName(''); setProjectType(''); setSaving(false);
        setSuccess(false); setError(''); setNameError(false);
        setAddressQuery(''); setSuggestions([]); setShowSuggestions(false);
        setSearching(false); setSelected(null); setMapLoaded(false); setHlIdx(-1);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Click outside suggestions
  useEffect(() => {
    if (!showSuggestions) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(t) &&
        addressInputRef.current && !addressInputRef.current.contains(t)
      ) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showSuggestions]);

  // ── Address handlers ────────────────────────────────────

  const onAddressInput = useCallback((val: string) => {
    setAddressQuery(val);
    setSelected(null);
    setMapLoaded(false);
    setHlIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) {
      setSuggestions([]); setShowSuggestions(false); setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddress(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSearching(false);
    }, 400);
  }, []);

  const pickAddress = useCallback((s: AddressSuggestion) => {
    setSelected(s);
    setAddressQuery(s.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    setMapLoaded(false);
  }, []);

  const clearAddress = useCallback(() => {
    setSelected(null);
    setAddressQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setMapLoaded(false);
    setTimeout(() => addressInputRef.current?.focus(), 60);
  }, []);

  const onAddressKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHlIdx((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHlIdx((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter' && hlIdx >= 0) {
      e.preventDefault();
      pickAddress(suggestions[hlIdx]);
    }
  }, [showSuggestions, suggestions, hlIdx, pickAddress]);

  // ── Submit ──────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError(true); nameRef.current?.focus(); return; }
    setSaving(true); setError('');

    const result = await createProject({
      name: name.trim(),
      company_id: currentOrg?.id ?? '',
      created_by: user?.id ?? '',
      address: (selected?.display_name || addressQuery.trim()) || undefined,
      project_type: projectType || undefined,
    });

    if (result.error) { setError(result.error); setSaving(false); return; }
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    setSaving(false);
    setSuccess(true);
    setTimeout(onClose, 1600);
  };

  // ── Bail ────────────────────────────────────────────────

  if (!open && !success) return null;

  // ═══════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create new project"
          style={{
            position: 'fixed', inset: 0, zIndex: zIndex.modal,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* ── Backdrop ── */}
          <motion.div
            variants={backdropV}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          />

          {/* ── Panel ── */}
          <motion.div
            variants={panelV}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 540,
              margin: spacing['4'],
            }}
          >
            <form
              onSubmit={handleSubmit}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: 24,
                boxShadow:
                  '0 0 0 1px rgba(255,255,255,0.05),' +
                  '0 24px 80px rgba(0,0,0,0.4),' +
                  '0 8px 24px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* ══ Success Overlay ══ */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      position: 'absolute', inset: 0, zIndex: 20,
                      backgroundColor: colors.surfaceRaised,
                      borderRadius: 24,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 16,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Expanding color wash */}
                    <motion.div
                      initial={{ scale: 0, opacity: 0.15 }}
                      animate={{ scale: 8, opacity: 0.06 }}
                      transition={{ duration: 1, ease: EASE }}
                      style={{
                        position: 'absolute',
                        width: 80, height: 80, borderRadius: '50%',
                        backgroundColor: accent,
                      }}
                    />
                    {/* Check */}
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.12, type: 'spring', damping: 14, stiffness: 200 }}
                      style={{
                        width: 68, height: 68, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #34D399, #10B981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
                        position: 'relative', zIndex: 1,
                      }}
                    >
                      <CheckCircle size={34} color="#fff" strokeWidth={2.5} />
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.38 }}
                      style={{
                        margin: 0, fontSize: 18, fontWeight: 700,
                        color: colors.textPrimary,
                        textAlign: 'center', position: 'relative', zIndex: 1,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {name.trim()} created
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.55 }}
                      style={{
                        margin: 0, fontSize: 13,
                        color: colors.textTertiary,
                        position: 'relative', zIndex: 1,
                      }}
                    >
                      Opening your project…
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ══ Gradient Accent Bar ══ */}
              <div
                style={{
                  height: 4,
                  background: `linear-gradient(90deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`,
                }}
              />

              {/* ══ Header ══ */}
              <motion.div
                variants={row(0.04)}
                initial="hidden"
                animate="show"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '20px 28px 0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Live color dot — shifts hue as you type the name */}
                  <motion.div
                    animate={{
                      backgroundColor: accent,
                      scale: name.trim() ? 1 : 0.5,
                      opacity: name.trim() ? 1 : 0.4,
                    }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      backgroundColor: colors.borderSubtle,
                    }}
                  />
                  <h2
                    style={{
                      margin: 0, fontSize: 17, fontWeight: 700,
                      color: colors.textPrimary,
                      letterSpacing: '-0.02em',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    New Project
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 30, height: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none',
                    borderRadius: 10, cursor: 'pointer',
                    color: colors.textTertiary,
                    transition: 'all 100ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.surfaceHover;
                    e.currentTarget.style.color = colors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colors.textTertiary;
                  }}
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </motion.div>

              {/* ══ Form Body ══ */}
              <div
                style={{
                  padding: '20px 28px 8px',
                  display: 'flex', flexDirection: 'column',
                  gap: 28,
                }}
              >

                {/* ─── Name Input ─── */}
                <motion.div variants={row(0.07)} initial="hidden" animate="show">
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError(false);
                    }}
                    placeholder="What's this project called?"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      padding: '8px 0',
                      fontSize: 26,
                      fontWeight: 700,
                      fontFamily: typography.fontFamily,
                      color: colors.textPrimary,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: `2.5px solid ${
                        nameError ? '#EF4444' : name.trim() ? accent : colors.borderSubtle
                      }`,
                      outline: 'none',
                      letterSpacing: '-0.025em',
                      transition: 'border-color 200ms ease',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      if (!nameError)
                        e.currentTarget.style.borderBottomColor = name.trim()
                          ? accent
                          : colors.primaryOrange;
                    }}
                    onBlur={(e) => {
                      if (!name.trim() && !nameError)
                        e.currentTarget.style.borderBottomColor = colors.borderSubtle;
                    }}
                  />
                  <AnimatePresence>
                    {nameError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{
                          margin: 0, marginTop: 8,
                          fontSize: 13, color: '#EF4444', fontFamily: typography.fontFamily,
                        }}
                      >
                        Every great project needs a name
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* ─── Location ─── */}
                <motion.div variants={row(0.13)} initial="hidden" animate="show">
                  <p
                    style={{
                      margin: 0, marginBottom: 10,
                      fontSize: 11, fontWeight: 700,
                      color: colors.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    Location
                  </p>

                  {/* -- Search mode -- */}
                  {!selected ? (
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 14px',
                          borderRadius: 14,
                          border: `1.5px solid ${
                            showSuggestions ? colors.primaryOrange : colors.borderSubtle
                          }`,
                          backgroundColor: colors.surfaceInset,
                          transition: 'all 150ms ease',
                          boxShadow: showSuggestions
                            ? `0 0 0 3px ${colors.orangeSubtle}`
                            : 'none',
                        }}
                      >
                        {searching ? (
                          <Loader2
                            size={16}
                            color={colors.textTertiary}
                            style={{ flexShrink: 0, animation: 'cpm-spin 0.8s linear infinite' }}
                          />
                        ) : (
                          <Search size={16} color={colors.textTertiary} style={{ flexShrink: 0 }} />
                        )}
                        <input
                          ref={addressInputRef}
                          value={addressQuery}
                          onChange={(e) => onAddressInput(e.target.value)}
                          onFocus={() => {
                            if (suggestions.length > 0) setShowSuggestions(true);
                          }}
                          onKeyDown={onAddressKeyDown}
                          placeholder="Search for a project address…"
                          autoComplete="off"
                          style={{
                            flex: 1, border: 'none', outline: 'none',
                            fontSize: 14, fontFamily: typography.fontFamily,
                            color: colors.textPrimary,
                            backgroundColor: 'transparent', padding: 0,
                          }}
                        />
                        {addressQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddressQuery('');
                              setSuggestions([]);
                              addressInputRef.current?.focus();
                            }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              padding: 2, display: 'flex',
                              color: colors.textTertiary, flexShrink: 0,
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Suggestions dropdown */}
                      <AnimatePresence>
                        {showSuggestions && suggestions.length > 0 && (
                          <motion.div
                            ref={suggestionsRef}
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: EASE }}
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 6px)',
                              left: 0, right: 0,
                              backgroundColor: colors.surfaceRaised,
                              border: `1px solid ${colors.borderSubtle}`,
                              borderRadius: 16,
                              boxShadow:
                                '0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
                              zIndex: zIndex.dropdown,
                              overflow: 'hidden',
                              maxHeight: 280,
                              overflowY: 'auto',
                            }}
                          >
                            {suggestions.map((s, i) => {
                              const fa = formatStructuredAddress(s.address);
                              const hl = i === hlIdx;
                              return (
                                <button
                                  key={`${s.lat}-${s.lon}-${i}`}
                                  type="button"
                                  onClick={() => pickAddress(s)}
                                  style={{
                                    width: '100%',
                                    display: 'flex', alignItems: 'flex-start',
                                    gap: 10, padding: '12px 16px',
                                    border: 'none',
                                    borderBottom:
                                      i < suggestions.length - 1
                                        ? `1px solid ${colors.borderSubtle}`
                                        : 'none',
                                    backgroundColor: hl ? colors.surfaceHover : 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontFamily: typography.fontFamily,
                                    transition: 'background-color 80ms ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = colors.surfaceHover;
                                    setHlIdx(i);
                                  }}
                                  onMouseLeave={(e) => {
                                    if (i !== hlIdx)
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 26, height: 26, borderRadius: 8,
                                      backgroundColor: colors.orangeSubtle,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      flexShrink: 0, marginTop: 1,
                                    }}
                                  >
                                    <MapPin size={13} color={colors.primaryOrange} />
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    {fa ? (
                                      <>
                                        <div
                                          style={{
                                            fontSize: 14, fontWeight: 600,
                                            color: colors.textPrimary,
                                            lineHeight: '1.3',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                        >
                                          {fa.line1 || s.display_name.split(',')[0]}
                                        </div>
                                        {fa.line2 && (
                                          <div
                                            style={{
                                              fontSize: 12, color: colors.textTertiary,
                                              marginTop: 2, lineHeight: '1.3',
                                            }}
                                          >
                                            {fa.line2}
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div
                                        style={{
                                          fontSize: 13, color: colors.textPrimary,
                                          lineHeight: '1.4',
                                        }}
                                      >
                                        {s.display_name}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    /* -- Confirmed address card -- */
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      style={{
                        borderRadius: 16,
                        border: `1.5px solid ${colors.statusActiveSubtle}`,
                        backgroundColor: colors.statusActiveExtraSubtle,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Address text */}
                      <div
                        style={{
                          padding: '14px 16px',
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 32, height: 32, borderRadius: 10,
                            backgroundColor: colors.statusActiveSubtle,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <MapPin size={15} color={colors.statusActive} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {fmtAddr ? (
                            <>
                              <div
                                style={{
                                  fontSize: 15, fontWeight: 600,
                                  color: colors.textPrimary,
                                  lineHeight: '1.3',
                                  fontFamily: typography.fontFamily,
                                }}
                              >
                                {fmtAddr.line1 || selected.display_name.split(',')[0]}
                              </div>
                              {fmtAddr.line2 && (
                                <div
                                  style={{
                                    fontSize: 13, color: colors.textSecondary,
                                    marginTop: 3, lineHeight: '1.3',
                                    fontFamily: typography.fontFamily,
                                  }}
                                >
                                  {fmtAddr.line2}
                                </div>
                              )}
                            </>
                          ) : (
                            <div
                              style={{
                                fontSize: 14, fontWeight: 500,
                                color: colors.textPrimary,
                                lineHeight: '1.4',
                                fontFamily: typography.fontFamily,
                              }}
                            >
                              {selected.display_name}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={clearAddress}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '3px 0', fontSize: 12, fontWeight: 600,
                            color: colors.primaryOrange,
                            fontFamily: typography.fontFamily, flexShrink: 0,
                            transition: 'opacity 100ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        >
                          Change
                        </button>
                      </div>
                      {/* Map preview */}
                      <div
                        style={{
                          height: 110, position: 'relative',
                          borderTop: `1px solid ${colors.statusActiveSubtle}`,
                          backgroundColor: colors.surfaceInset,
                        }}
                      >
                        {!mapLoaded && (
                          <div
                            style={{
                              position: 'absolute', inset: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <Loader2
                              size={14}
                              color={colors.textTertiary}
                              style={{ animation: 'cpm-spin 1s linear infinite' }}
                            />
                            <span
                              style={{
                                fontSize: 12, color: colors.textTertiary,
                                fontFamily: typography.fontFamily,
                              }}
                            >
                              Loading map…
                            </span>
                          </div>
                        )}
                        <iframe
                          src={osmEmbedUrl(selected.lat, selected.lon)}
                          onLoad={() => setMapLoaded(true)}
                          title="Location preview"
                          style={{
                            width: '100%', height: '100%',
                            border: 'none', display: 'block',
                            opacity: mapLoaded ? 1 : 0,
                            transition: 'opacity 400ms ease',
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* ─── Project Type Grid ─── */}
                <motion.div variants={row(0.19)} initial="hidden" animate="show">
                  <p
                    style={{
                      margin: 0, marginBottom: 10,
                      fontSize: 11, fontWeight: 700,
                      color: colors.textTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontFamily: typography.fontFamily,
                    }}
                  >
                    Type
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 8,
                    }}
                  >
                    {PROJECT_TYPES.map((t) => {
                      const active = projectType === t.value;
                      return (
                        <motion.button
                          key={t.value}
                          type="button"
                          onClick={() => setProjectType(active ? '' : t.value)}
                          whileTap={{ scale: 0.93 }}
                          style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            gap: 3, padding: '10px 4px',
                            borderRadius: 14,
                            border: `1.5px solid ${
                              active ? colors.primaryOrange : colors.borderSubtle
                            }`,
                            backgroundColor: active ? colors.orangeSubtle : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.borderColor = colors.borderDefault;
                              e.currentTarget.style.backgroundColor = colors.surfaceHover;
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.borderColor = colors.borderSubtle;
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }
                          }}
                        >
                          <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: active ? 700 : 500,
                              fontFamily: typography.fontFamily,
                              color: active ? colors.orangeText : colors.textSecondary,
                              lineHeight: '1.2',
                              textAlign: 'center',
                            }}
                          >
                            {t.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        margin: 0, padding: '10px 14px',
                        borderRadius: 12,
                        backgroundColor: colors.statusCriticalSubtle,
                        fontSize: 13, color: colors.statusCritical,
                        fontFamily: typography.fontFamily,
                      }}
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* ══ Footer ══ */}
              <motion.div
                variants={row(0.24)}
                initial="hidden"
                animate="show"
                style={{
                  padding: '16px 28px 22px',
                  display: 'flex', justifyContent: 'flex-end',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 22px',
                    borderRadius: 12,
                    border: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: 'transparent',
                    color: colors.textSecondary,
                    fontSize: 14, fontWeight: 500,
                    fontFamily: typography.fontFamily,
                    cursor: 'pointer',
                    transition: 'all 100ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.surfaceHover;
                    e.currentTarget.style.borderColor = colors.borderDefault;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = colors.borderSubtle;
                  }}
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  disabled={saving || !isValid}
                  whileHover={isValid && !saving ? { scale: 1.02 } : {}}
                  whileTap={isValid && !saving ? { scale: 0.97 } : {}}
                  style={{
                    padding: '10px 30px',
                    borderRadius: 12,
                    border: 'none',
                    background: isValid
                      ? `linear-gradient(135deg, ${colors.primaryOrange}, ${colors.orangeGradientEnd})`
                      : colors.surfaceInset,
                    color: isValid ? '#fff' : colors.textTertiary,
                    fontSize: 14, fontWeight: 700,
                    fontFamily: typography.fontFamily,
                    cursor: saving || !isValid ? 'default' : 'pointer',
                    transition: 'all 200ms ease',
                    boxShadow: isValid
                      ? '0 4px 20px rgba(244,120,32,0.35), 0 1px 3px rgba(244,120,32,0.2)'
                      : 'none',
                    minWidth: 148,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={14}
                        style={{ animation: 'cpm-spin 0.8s linear infinite' }}
                      />
                      Creating…
                    </>
                  ) : (
                    'Create Project'
                  )}
                </motion.button>
              </motion.div>
            </form>
          </motion.div>

          {/* ── Keyframe for spinner ── */}
          <style>{`
            @keyframes cpm-spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateProjectModal;
