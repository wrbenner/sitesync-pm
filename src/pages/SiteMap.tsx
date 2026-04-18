// SiteMap — Interactive project site map.
// Two modes: GPS (OpenStreetMap tiles) and Site Plan (upload image as base layer).
// Pins are stored in site_map_pins and synced in realtime.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer, Btn, Card, Modal } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, transitions } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { useProjectId } from '../hooks/useProjectId';
import { toast } from 'sonner';
import {
  MapPin, Wrench, HardHat, Package, ShieldAlert, Camera, Plus,
  Image as ImageIcon, Globe, Search, Trash2, X, Eye, EyeOff, Crosshair,
} from 'lucide-react';
import type { Map as LeafletMap, LayerGroup, Marker, LatLngBoundsLiteral } from 'leaflet';

import 'leaflet/dist/leaflet.css';

// ── Pin types & config ─────────────────────────────────────────

type PinType = 'equipment' | 'crew' | 'delivery' | 'safety_zone' | 'photo' | 'custom';

interface Pin {
  id: string;
  project_id: string;
  pin_type: PinType;
  label: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  pixel_x: number | null;
  pixel_y: number | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  icon_color: string | null;
  created_at: string;
  updated_at: string;
}

const PIN_CONFIG: Record<PinType, { label: string; color: string; icon: React.ElementType; emoji: string }> = {
  equipment:   { label: 'Equipment',   color: '#F47820', icon: Wrench,      emoji: '🔧' },
  crew:        { label: 'Crew',        color: '#3B82F6', icon: HardHat,     emoji: '👷' },
  delivery:    { label: 'Delivery',    color: '#8B5CF6', icon: Package,     emoji: '📦' },
  safety_zone: { label: 'Safety',      color: '#EF4444', icon: ShieldAlert, emoji: '⚠️' },
  photo:       { label: 'Photo',       color: '#10B981', icon: Camera,      emoji: '📸' },
  custom:      { label: 'Custom',      color: '#64748B', icon: MapPin,      emoji: '📍' },
};

const PIN_TYPES: PinType[] = ['equipment', 'crew', 'delivery', 'safety_zone', 'photo', 'custom'];

type Mode = 'gps' | 'siteplan';

interface PendingPin {
  lat?: number;
  lng?: number;
  px?: number;
  py?: number;
  pin_type: PinType;
}

// Build an HTML div icon colored by type
function createDivIcon(L: typeof import('leaflet'), type: PinType, label?: string) {
  const cfg = PIN_CONFIG[type];
  return L.divIcon({
    className: 'sitesync-pin',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:${cfg.color};transform:rotate(-45deg);
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);font-size:14px;">${cfg.emoji}</span></div>
    ${label ? `<div style="
      position:absolute;top:34px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.82);color:#fff;font-size:11px;font-weight:600;
      padding:2px 6px;border-radius:4px;white-space:nowrap;pointer-events:none;
    ">${escapeHtml(label)}</div>` : ''}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// ── Pin creation form (shared between modes) ────────────────────

const PinForm: React.FC<{
  pending: PendingPin;
  onSave: (data: { pin_type: PinType; label: string; description: string }) => void;
  onCancel: () => void;
}> = ({ pending, onSave, onCancel }) => {
  const [pinType, setPinType] = useState<PinType>(pending.pin_type);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
      <div>
        <label style={{ display: 'block', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pin type
        </label>
        <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
          {PIN_TYPES.map((t) => {
            const cfg = PIN_CONFIG[t];
            const selected = pinType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPinType(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: selected ? cfg.color : colors.surfaceInset,
                  color: selected ? '#fff' : colors.textSecondary,
                  border: `1px solid ${selected ? cfg.color : colors.borderSubtle}`,
                  borderRadius: borderRadius.md,
                  cursor: 'pointer',
                  fontSize: typography.fontSize.sm,
                  fontWeight: typography.fontWeight.medium,
                  transition: transitions.fast,
                }}
              >
                <span>{cfg.emoji}</span>
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Label
        </label>
        <input
          autoFocus
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Tower Crane 2"
          style={{
            width: '100%',
            padding: `${spacing['3']} ${spacing['3']}`,
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            color: colors.textPrimary,
            fontSize: typography.fontSize.sm,
            outline: 'none',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: spacing['3'],
            backgroundColor: colors.surfaceInset,
            border: `1px solid ${colors.borderDefault}`,
            borderRadius: borderRadius.md,
            color: colors.textPrimary,
            fontSize: typography.fontSize.sm,
            outline: 'none',
            resize: 'vertical',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={() => {
          if (!label.trim()) { toast.error('Label is required'); return; }
          onSave({ pin_type: pinType, label: label.trim(), description: description.trim() });
        }}>Place pin</Btn>
      </div>
    </div>
  );
};

// ── Main SiteMap page ───────────────────────────────────────────

export default function SiteMap() {
  const projectId = useProjectId();
  const [mode, setMode] = useState<Mode>('gps');
  const [pins, setPins] = useState<Pin[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<Set<PinType>>(new Set(PIN_TYPES));
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingPin | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [placingType, setPlacingType] = useState<PinType>('equipment');
  const [sitePlanUrl, setSitePlanUrl] = useState<string | null>(null);
  const sitePlanInputRef = useRef<HTMLInputElement>(null);

  // ── Leaflet refs ──
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const imgOverlayRef = useRef<{ imgEl: HTMLImageElement | null }>({ imgEl: null });
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const leafletRef = useRef<typeof import('leaflet') | null>(null);

  // ── Load pins ──
  const loadPins = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('site_map_pins')
      .select('*')
      .eq('project_id', projectId);
    if (error) { toast.error(error.message); return; }
    setPins((data || []) as Pin[]);
  }, [projectId]);

  useEffect(() => { loadPins(); }, [loadPins]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`site-map-${projectId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'site_map_pins', filter: `project_id=eq.${projectId}` },
        () => loadPins(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, loadPins]);

  // ── Initialize Leaflet map ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled) return;
      leafletRef.current = L;

      // Fix default icon asset paths (Leaflet's icons assume a bundler-unfriendly path).
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [39.5, -98.35], // US center fallback
        zoom: 4,
        zoomControl: true,
      });
      mapRef.current = map;

      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 22,
      });
      tiles.addTo(map);

      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;

      map.on('click', (e) => {
        if (mode === 'gps') {
          setPending({ lat: e.latlng.lat, lng: e.latlng.lng, pin_type: placingType });
        } else if (mode === 'siteplan' && imgOverlayRef.current.imgEl) {
          // Convert latlng back to pixel coords relative to image overlay bounds.
          const bounds = (imgOverlayRef.current.imgEl.dataset.bounds || '').split(',').map(Number);
          if (bounds.length === 4) {
            const [s, w, n, ee] = bounds;
            const img = imgOverlayRef.current.imgEl;
            const px = ((e.latlng.lng - w) / (ee - w)) * img.naturalWidth;
            const py = ((n - e.latlng.lat) / (n - s)) * img.naturalHeight;
            setPending({ px, py, pin_type: placingType });
          }
        }
      });
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount once; mode + placingType are read via closure via refs below

  // Keep mode & placingType fresh for click handler via a ref
  const clickCtxRef = useRef({ mode, placingType });
  useEffect(() => { clickCtxRef.current = { mode, placingType }; }, [mode, placingType]);

  // ── Re-render markers when pins / filters change ──
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!L || !layer || !map) return;

    layer.clearLayers();
    markersRef.current.clear();

    const filtered = pins.filter((p) => {
      if (!visibleTypes.has(p.pin_type)) return false;
      if (search && !p.label.toLowerCase().includes(search.toLowerCase())) return false;
      if (mode === 'gps') return p.latitude != null && p.longitude != null;
      if (mode === 'siteplan') {
        return p.pixel_x != null && p.pixel_y != null && imgOverlayRef.current.imgEl;
      }
      return false;
    });

    filtered.forEach((p) => {
      let lat: number;
      let lng: number;
      if (mode === 'gps') {
        lat = p.latitude!;
        lng = p.longitude!;
      } else {
        const img = imgOverlayRef.current.imgEl!;
        const bounds = (img.dataset.bounds || '').split(',').map(Number);
        if (bounds.length !== 4) return;
        const [s, w, n, ee] = bounds;
        lng = w + (p.pixel_x! / img.naturalWidth) * (ee - w);
        lat = n - (p.pixel_y! / img.naturalHeight) * (n - s);
      }
      const marker = L.marker([lat, lng], { icon: createDivIcon(L, p.pin_type, p.label) });
      marker.on('click', () => setSelectedPin(p));
      marker.addTo(layer);
      markersRef.current.set(p.id, marker);
    });

    // Auto-fit GPS bounds on first render if we have pins
    if (mode === 'gps' && filtered.length > 0 && map.getZoom() < 5) {
      const group = L.featureGroup(Array.from(markersRef.current.values()));
      try { map.fitBounds(group.getBounds(), { padding: [40, 40] }); } catch { /* ignore */ }
    }
  }, [pins, visibleTypes, search, mode]);

  // ── Apply site plan overlay ──
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Remove existing overlay
    map.eachLayer((l) => {
      if ((l as unknown as { _url?: string; options?: { interactive?: boolean } }).options &&
          (l as unknown as { _image?: HTMLImageElement })._image) {
        map.removeLayer(l);
      }
    });

    if (mode === 'siteplan' && sitePlanUrl) {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight;
        // Arbitrary virtual bounds: lat [-1, 1], lng scaled by aspect
        const bounds: LatLngBoundsLiteral = [[-1, -aspect], [1, aspect]];
        img.dataset.bounds = `${-1},${-aspect},${1},${aspect}`;
        imgOverlayRef.current.imgEl = img;
        L.imageOverlay(sitePlanUrl, bounds, { opacity: 0.95 }).addTo(map);
        map.fitBounds(bounds, { padding: [20, 20] });
      };
      img.src = sitePlanUrl;
    } else {
      imgOverlayRef.current.imgEl = null;
      if (mode === 'gps') {
        // If we have geo-pinned markers, fit to them; else reset view
        const geoPins = pins.filter((p) => p.latitude != null);
        if (geoPins.length > 0 && markersRef.current.size > 0) {
          const group = L.featureGroup(Array.from(markersRef.current.values()));
          try { map.fitBounds(group.getBounds(), { padding: [40, 40] }); } catch { /* ignore */ }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sitePlanUrl]);

  // ── Save pin ──
  const savePin = useCallback(async (data: { pin_type: PinType; label: string; description: string }) => {
    if (!projectId || !pending) return;
    const cfg = PIN_CONFIG[data.pin_type];
    const row = {
      project_id: projectId,
      pin_type: data.pin_type,
      label: data.label,
      description: data.description || null,
      latitude: pending.lat ?? null,
      longitude: pending.lng ?? null,
      pixel_x: pending.px ?? null,
      pixel_y: pending.py ?? null,
      icon_color: cfg.color,
    };
    const { error } = await supabase.from('site_map_pins').insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success(`${cfg.label} pin placed`);
    setPending(null);
    // Realtime will refresh
  }, [projectId, pending]);

  // ── Delete pin ──
  const deletePin = useCallback(async (id: string) => {
    const { error } = await supabase.from('site_map_pins').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Pin removed');
    setSelectedPin(null);
  }, []);

  // ── Upload site plan ──
  const onSitePlanFile = useCallback(async (f: File | undefined) => {
    if (!f || !projectId) return;
    try {
      const ext = f.name.split('.').pop() || 'png';
      const path = `site-plans/${projectId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('attachments')
        .upload(path, f, { contentType: f.type || 'image/png', upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from('attachments')
        .createSignedUrl(path, 3600);
      if (signErr || !signed?.signedUrl) throw signErr || new Error('Signing failed');
      setSitePlanUrl(signed.signedUrl);
      setMode('siteplan');
      toast.success('Site plan loaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  }, [projectId]);

  const useCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current) mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 18);
      },
      (err) => toast.error(err.message),
      { enableHighAccuracy: true },
    );
  }, []);

  const pinCounts = useMemo(() => {
    const c: Record<PinType, number> = { equipment: 0, crew: 0, delivery: 0, safety_zone: 0, photo: 0, custom: 0 };
    pins.forEach((p) => { c[p.pin_type] = (c[p.pin_type] || 0) + 1; });
    return c;
  }, [pins]);

  return (
    <PageContainer
      title="Site Map"
      subtitle="Live operational map — pin equipment, crews, deliveries, safety zones, and photos"
      actions={
        <div style={{ display: 'flex', gap: spacing['2'] }}>
          <Btn variant={mode === 'gps' ? 'primary' : 'secondary'} onClick={() => setMode('gps')} style={{ minHeight: 56 }}>
            <Globe size={16} /><span style={{ marginLeft: 6 }}>GPS</span>
          </Btn>
          <Btn variant={mode === 'siteplan' ? 'primary' : 'secondary'} onClick={() => sitePlanUrl ? setMode('siteplan') : sitePlanInputRef.current?.click()} style={{ minHeight: 56 }}>
            <ImageIcon size={16} /><span style={{ marginLeft: 6 }}>{sitePlanUrl ? 'Site Plan' : 'Upload Site Plan'}</span>
          </Btn>
          <input ref={sitePlanInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onSitePlanFile(e.target.files?.[0])} />
          {mode === 'gps' && (
            <Btn variant="ghost" onClick={useCurrentLocation} style={{ minHeight: 56 }} aria-label="Use my location">
              <Crosshair size={16} />
            </Btn>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', gap: spacing['4'], height: 'calc(100vh - 240px)', minHeight: 500 }}>
        {/* Sidebar */}
        <Card padding={spacing['4']}>
          <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: spacing['4'], height: '100%' }}>
            <div>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={colors.textTertiary} style={{ position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search pins…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} 32px`,
                    backgroundColor: colors.surfaceInset,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.md,
                    color: colors.textPrimary,
                    fontSize: typography.fontSize.sm,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing['2'] }}>
                Place Pin
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1.5'] }}>
                {PIN_TYPES.map((t) => {
                  const cfg = PIN_CONFIG[t];
                  const selected = placingType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPlacingType(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: `${spacing['2']} ${spacing['2']}`,
                        backgroundColor: selected ? cfg.color : 'transparent',
                        color: selected ? '#fff' : colors.textSecondary,
                        border: `1px solid ${selected ? cfg.color : colors.borderSubtle}`,
                        borderRadius: borderRadius.md,
                        cursor: 'pointer',
                        fontSize: typography.fontSize.sm,
                        fontWeight: typography.fontWeight.medium,
                        textAlign: 'left',
                        transition: transitions.fast,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                      <span style={{ flex: 1 }}>{cfg.label}</span>
                      <span style={{ fontSize: typography.fontSize.xs, opacity: 0.75 }}>{pinCounts[t]}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, marginTop: spacing['2'], fontStyle: 'italic' }}>
                Click the map to place
              </div>
            </div>

            <div>
              <div style={{ fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing['2'] }}>
                Layers
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                {PIN_TYPES.map((t) => {
                  const cfg = PIN_CONFIG[t];
                  const visible = visibleTypes.has(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setVisibleTypes((prev) => {
                          const next = new Set(prev);
                          if (next.has(t)) next.delete(t); else next.add(t);
                          return next;
                        });
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: `6px ${spacing['2']}`,
                        backgroundColor: 'transparent',
                        color: visible ? colors.textPrimary : colors.textTertiary,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: typography.fontSize.xs,
                        textAlign: 'left',
                        borderRadius: borderRadius.sm,
                      }}
                    >
                      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: cfg.color }} />
                      <span style={{ flex: 1 }}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative', borderRadius: borderRadius.lg, overflow: 'hidden', border: `1px solid ${colors.borderDefault}` }}>
          <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, backgroundColor: colors.surfaceInset }} />
          {mode === 'siteplan' && !sitePlanUrl && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(20,21,24,0.8)', zIndex: 400,
            }}>
              <div style={{ textAlign: 'center' }}>
                <ImageIcon size={48} color={colors.textTertiary} />
                <div style={{ color: colors.textSecondary, marginTop: spacing['2'] }}>Upload a site plan image to enable this mode</div>
                <Btn variant="primary" onClick={() => sitePlanInputRef.current?.click()} style={{ marginTop: spacing['3'] }}>
                  <Plus size={14} /> Upload Site Plan
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Place-pin modal */}
      <Modal open={!!pending} onClose={() => setPending(null)} title="New site pin" width="500px">
        {pending && (
          <PinForm
            pending={pending}
            onSave={savePin}
            onCancel={() => setPending(null)}
          />
        )}
      </Modal>

      {/* Pin detail */}
      <Modal open={!!selectedPin} onClose={() => setSelectedPin(null)} title={selectedPin?.label || 'Pin'} width="440px">
        {selectedPin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['3'] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                padding: `4px ${spacing['2']}`,
                backgroundColor: PIN_CONFIG[selectedPin.pin_type].color,
                color: '#fff',
                borderRadius: borderRadius.sm,
                fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
              }}>
                {PIN_CONFIG[selectedPin.pin_type].emoji} {PIN_CONFIG[selectedPin.pin_type].label}
              </span>
            </div>
            {selectedPin.description && (
              <p style={{ margin: 0, fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.55 }}>
                {selectedPin.description}
              </p>
            )}
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary, fontFamily: 'monospace' }}>
              {selectedPin.latitude != null
                ? `${selectedPin.latitude.toFixed(6)}, ${selectedPin.longitude?.toFixed(6)}`
                : `x:${Math.round(selectedPin.pixel_x || 0)} y:${Math.round(selectedPin.pixel_y || 0)}`}
            </div>
            <div style={{ fontSize: typography.fontSize.xs, color: colors.textTertiary }}>
              Updated {new Date(selectedPin.updated_at).toLocaleString()}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'], marginTop: spacing['2'] }}>
              <Btn variant="danger" onClick={() => deletePin(selectedPin.id)}>
                <Trash2 size={14} /><span style={{ marginLeft: 4 }}>Remove</span>
              </Btn>
              <Btn variant="secondary" onClick={() => setSelectedPin(null)}>
                <X size={14} /><span style={{ marginLeft: 4 }}>Close</span>
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
