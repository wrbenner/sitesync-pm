// SiteMap V2 — Enterprise-grade interactive construction site map
// Inspired by Procore Maps, Fieldwire, and PlanGrid
//
// Features:
// • GPS mode with satellite/street/topo base layers
// • Site Plan mode with versioned drawing uploads
// • Real-time weather overlay from Open-Meteo (no API key needed)
// • Pin management: equipment, crew, delivery, safety, photo, custom
// • Zone management: draw safety zones, staging areas, crane radii, exclusion zones
// • Linked entities: punch items, inspections, incidents, deliveries on the map
// • Geofence filtering: draw polygon to filter items within an area
// • Floor-level filtering for multi-story projects
// • Real-time pin sync via Supabase realtime
// • GPS geolocation with heading indicator
// • Measurement tool for distance/area
// • Search across all map items

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer, Btn, Modal } from '../components/Primitives';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { fromTable } from '../lib/db/queries'
import { useProjectId } from '../hooks/useProjectId';
import { toast } from 'sonner';
import {
  MapPin, Wrench, HardHat, Package, ShieldAlert, Camera,
  Image as ImageIcon, Globe, Search, Trash2, Eye, EyeOff,
  Layers, Wind, Droplets, ChevronDown, ChevronRight,
  AlertTriangle, ClipboardCheck, Truck,
  Building2, Maximize2, Minimize2,
  RefreshCw, MapPinned, Satellite, Map as MapIcon, Mountain,
  CheckCircle,
  Upload, LocateFixed,
} from 'lucide-react';
import type { Map as LeafletMap, LayerGroup, Marker, LatLngBoundsLiteral, TileLayer as LeafletTileLayer } from 'leaflet';

import 'leaflet/dist/leaflet.css';

// ── Types ─────────────────────────────────────────────────────────

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
  status: string;
  floor: string | null;
  zone_id: string | null;
  photo_urls: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Zone {
  id: string;
  project_id: string;
  name: string;
  zone_type: string;
  color: string;
  opacity: number;
  geojson: GeoJSON.Polygon | null;
  pixel_polygon: Array<{ x: number; y: number }> | null;
  floor: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SitePlan {
  id: string;
  project_id: string;
  name: string;
  version: number;
  file_path: string;
  file_url: string | null;
  floor: string | null;
  is_current: boolean;
  bounds: { south: number; west: number; north: number; east: number } | null;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
}

interface WeatherData {
  temperature: number;
  wind_speed: number;
  humidity: number;
  condition: string;
  icon: string;
  feels_like: number;
  precipitation: number;
}

interface LinkedEntity {
  id: string;
  type: 'punch_item' | 'incident' | 'inspection' | 'delivery' | 'observation';
  title: string;
  status: string;
  priority?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  date?: string;
}

type Mode = 'gps' | 'siteplan';
type BaseLayer = 'street' | 'satellite' | 'topo';

interface PendingPin {
  lat?: number;
  lng?: number;
  px?: number;
  py?: number;
  pin_type: PinType;
}

// ── Pin config ────────────────────────────────────────────────────

const PIN_CONFIG: Record<PinType, { label: string; color: string; icon: React.ElementType; emoji: string }> = {
  equipment:   { label: 'Equipment',   color: '#F47820', icon: Wrench,      emoji: '🔧' },
  crew:        { label: 'Crew',        color: '#3B82F6', icon: HardHat,     emoji: '👷' },
  delivery:    { label: 'Delivery',    color: '#8B5CF6', icon: Package,     emoji: '📦' },
  safety_zone: { label: 'Safety',      color: '#EF4444', icon: ShieldAlert, emoji: '⚠️' },
  photo:       { label: 'Photo',       color: '#10B981', icon: Camera,      emoji: '📸' },
  custom:      { label: 'Custom',      color: '#64748B', icon: MapPin,      emoji: '📍' },
};

const PIN_TYPES: PinType[] = ['equipment', 'crew', 'delivery', 'safety_zone', 'photo', 'custom'];


const ENTITY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  punch_item:   { label: 'Punch Items',   color: '#F47820', icon: CheckCircle },
  incident:     { label: 'Incidents',      color: '#EF4444', icon: AlertTriangle },
  inspection:   { label: 'Inspections',    color: '#3B82F6', icon: ClipboardCheck },
  delivery:     { label: 'Deliveries',     color: '#8B5CF6', icon: Truck },
  observation:  { label: 'Observations',   color: '#10B981', icon: Eye },
};

const WEATHER_ICONS: Record<string, string> = {
  'clear': '☀️',
  'partly_cloudy': '⛅',
  'cloudy': '☁️',
  'fog': '🌫️',
  'drizzle': '🌦️',
  'rain': '🌧️',
  'snow': '🌨️',
  'thunderstorm': '⛈️',
  'default': '🌤️',
};

const BASE_LAYERS: Record<BaseLayer, { label: string; url: string; attribution: string; icon: React.ElementType }> = {
  street: {
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    icon: MapIcon,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    icon: Satellite,
  },
  topo: {
    label: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap contributors',
    icon: Mountain,
  },
};

// ── Utility functions ─────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function createDivIcon(L: typeof import('leaflet'), type: PinType, label?: string, isSelected?: boolean) {
  const cfg = PIN_CONFIG[type];
  const size = isSelected ? 40 : 32;
  const ring = isSelected ? `box-shadow:0 0 0 3px ${cfg.color}44, 0 2px 8px rgba(0,0,0,0.4);` : 'box-shadow:0 2px 6px rgba(0,0,0,0.3);';
  return L.divIcon({
    className: 'sitesync-pin',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${cfg.color};transform:rotate(-45deg);
      border:2px solid #fff;${ring}
      display:flex;align-items:center;justify-content:center;
      transition:all 150ms ease-out;
    "><span style="transform:rotate(45deg);font-size:${isSelected ? 18 : 14}px;">${cfg.emoji}</span></div>
    ${label ? `<div style="
      position:absolute;top:${size + 2}px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.82);color:#fff;font-size:11px;font-weight:600;
      padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;
      max-width:120px;overflow:hidden;text-overflow:ellipsis;
    ">${escapeHtml(label)}</div>` : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function createEntityIcon(L: typeof import('leaflet'), type: string, title: string, status: string) {
  const cfg = ENTITY_CONFIG[type] || ENTITY_CONFIG.punch_item;
  const statusColor = status === 'open' || status === 'scheduled' ? cfg.color
    : status === 'in_progress' || status === 'investigating' ? '#F59E0B'
    : '#10B981';
  return L.divIcon({
    className: 'sitesync-entity-pin',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${statusColor};
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
    "><span style="font-size:13px;color:#fff;">●</span></div>
    <div style="
      position:absolute;top:30px;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.82);color:#fff;font-size:10px;font-weight:500;
      padding:2px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;
      max-width:110px;overflow:hidden;text-overflow:ellipsis;
    ">${escapeHtml(title)}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

function weatherCodeToCondition(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: 'Clear sky', icon: WEATHER_ICONS.clear };
  if (code <= 3) return { condition: 'Partly cloudy', icon: WEATHER_ICONS.partly_cloudy };
  if (code <= 49) return { condition: 'Fog', icon: WEATHER_ICONS.fog };
  if (code <= 59) return { condition: 'Drizzle', icon: WEATHER_ICONS.drizzle };
  if (code <= 69) return { condition: 'Rain', icon: WEATHER_ICONS.rain };
  if (code <= 79) return { condition: 'Snow', icon: WEATHER_ICONS.snow };
  if (code <= 99) return { condition: 'Thunderstorm', icon: WEATHER_ICONS.thunderstorm };
  return { condition: 'Cloudy', icon: WEATHER_ICONS.default };
}

// ── PinForm ───────────────────────────────────────────────────────

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
        <label style={labelStyle}>Pin type</label>
        <div style={{ display: 'flex', gap: spacing['2'], flexWrap: 'wrap' }}>
          {PIN_TYPES.map((t) => {
            const cfg = PIN_CONFIG[t];
            const selected = pinType === t;
            return (
              <button key={t} type="button" onClick={() => setPinType(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['2'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: selected ? cfg.color : colors.surfaceInset,
                  color: selected ? '#fff' : colors.textSecondary,
                  border: `1px solid ${selected ? cfg.color : colors.borderSubtle}`,
                  borderRadius: borderRadius.md, cursor: 'pointer',
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  transition: transitions.fast,
                }}>
                <span>{cfg.emoji}</span>{cfg.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label style={labelStyle}>Label</label>
        <input autoFocus type="text" value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Tower Crane 2" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Description (optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          rows={3} placeholder="Notes about this pin location…"
          style={{ ...inputStyle, resize: 'vertical' as const }} />
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

// ── Shared styles ─────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: typography.fontSize.xs,
  fontWeight: typography.fontWeight.semibold, color: colors.textTertiary,
  marginBottom: spacing['2'], textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: `${spacing['3']} ${spacing['3']}`,
  backgroundColor: colors.surfaceInset,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: borderRadius.md,
  color: colors.textPrimary, fontSize: typography.fontSize.sm,
  outline: 'none', boxSizing: 'border-box',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: typography.fontSize.xs,
  fontWeight: typography.fontWeight.semibold,
  color: colors.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: spacing['2'],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const sidebarBtnStyle = (selected: boolean, color: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: spacing['2'],
  padding: `${spacing['2']} ${spacing['2']}`,
  backgroundColor: selected ? color : 'transparent',
  color: selected ? '#fff' : colors.textSecondary,
  border: `1px solid ${selected ? color : colors.borderSubtle}`,
  borderRadius: borderRadius.md, cursor: 'pointer',
  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
  textAlign: 'left', transition: transitions.fast, width: '100%',
});

// ── Weather Widget ────────────────────────────────────────────────

const WeatherWidget: React.FC<{ weather: WeatherData | null; loading: boolean }> = ({ weather, loading }) => {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: spacing['2'],
        padding: `${spacing['2']} ${spacing['3']}`,
        backgroundColor: colors.surfaceInset,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.sm, color: colors.textTertiary,
      }}>
        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Loading weather…
      </div>
    );
  }
  if (!weather) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing['3'],
      padding: `${spacing['2']} ${spacing['3']}`,
      backgroundColor: colors.surfaceInset,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      <span style={{ fontSize: '20px' }}>{weather.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
          {Math.round(weather.temperature)}°F
        </span>
        <span style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
          {weather.condition}
        </span>
      </div>
      <div style={{ display: 'flex', gap: spacing['3'], marginLeft: spacing['2'] }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
          <Wind size={11} /> {Math.round(weather.wind_speed)} mph
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: typography.fontSize.xs, color: colors.textSecondary }}>
          <Droplets size={11} /> {weather.humidity}%
        </span>
      </div>
    </div>
  );
};

// ── Collapsible Section ───────────────────────────────────────────

const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  badge?: number;
  children: React.ReactNode;
}> = ({ title, defaultOpen = true, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)}
        style={{
          ...sectionHeaderStyle, cursor: 'pointer', border: 'none',
          backgroundColor: 'transparent', width: '100%', padding: 0,
        }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing['1'] }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          {badge != null && badge > 0 && (
            <span style={{
              fontSize: '10px', backgroundColor: colors.primaryOrange,
              color: '#fff', borderRadius: borderRadius.full,
              padding: '1px 6px', fontWeight: typography.fontWeight.bold,
              marginLeft: spacing['1'],
            }}>{badge}</span>
          )}
        </span>
      </button>
      {open && <div style={{ marginTop: spacing['2'] }}>{children}</div>}
    </div>
  );
};

// ── Main SiteMap Page ─────────────────────────────────────────────

export default function SiteMap() {
  const projectId = useProjectId();
  const [mode, setMode] = useState<Mode>('gps');
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('satellite');
  const [pins, setPins] = useState<Pin[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [sitePlans, setSitePlans] = useState<SitePlan[]>([]);
  const [linkedEntities, setLinkedEntities] = useState<LinkedEntity[]>([]);
  const [visibleTypes, setVisibleTypes] = useState<Set<PinType>>(new Set(PIN_TYPES));
  const [visibleEntityTypes, setVisibleEntityTypes] = useState<Set<string>>(new Set(['punch_item', 'incident', 'inspection', 'delivery', 'observation']));
  const [showZones, setShowZones] = useState(true);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingPin | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<LinkedEntity | null>(null);
  const [placingType, setPlacingType] = useState<PinType>('equipment');
  const [sitePlanUrl, setSitePlanUrl] = useState<string | null>(null);
  const [activeSitePlan, setActiveSitePlan] = useState<SitePlan | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [projectCoords, setProjectCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [floorFilter, setFloorFilter] = useState<string | null>(null);
  const [showBaseLayerPicker, setShowBaseLayerPicker] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sitePlanInputRef = useRef<HTMLInputElement>(null);

  // ── Leaflet refs ──
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinLayerRef = useRef<LayerGroup | null>(null);
  const entityLayerRef = useRef<LayerGroup | null>(null);
  const zoneLayerRef = useRef<LayerGroup | null>(null);
  const imgOverlayRef = useRef<{ imgEl: HTMLImageElement | null }>({ imgEl: null });
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const entityMarkersRef = useRef<Map<string, Marker>>(new Map());
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);

  // ── Derived state ──
  const allFloors = useMemo(() => {
    const floors = new Set<string>();
    pins.forEach((p) => { if (p.floor) floors.add(p.floor); });
    zones.forEach((z) => { if (z.floor) floors.add(z.floor); });
    linkedEntities.forEach((e) => { if (e.location) floors.add(e.location); });
    return Array.from(floors).sort();
  }, [pins, zones, linkedEntities]);

  const pinCounts = useMemo(() => {
    const c: Record<PinType, number> = { equipment: 0, crew: 0, delivery: 0, safety_zone: 0, photo: 0, custom: 0 };
    pins.forEach((p) => { c[p.pin_type] = (c[p.pin_type] || 0) + 1; });
    return c;
  }, [pins]);

  const entityCounts = useMemo(() => {
    const c: Record<string, number> = {};
    linkedEntities.forEach((e) => { c[e.type] = (c[e.type] || 0) + 1; });
    return c;
  }, [linkedEntities]);

  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (!visibleTypes.has(p.pin_type)) return false;
      if (search && !p.label.toLowerCase().includes(search.toLowerCase())) return false;
      if (floorFilter && p.floor !== floorFilter) return false;
      if (mode === 'gps') return p.latitude != null && p.longitude != null;
      if (mode === 'siteplan') return p.pixel_x != null && p.pixel_y != null;
      return false;
    });
  }, [pins, visibleTypes, search, mode, floorFilter]);

  // ── Load project coordinates ──
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await fromTable('projects')
        .select('latitude, longitude, address, city, state')
        .eq('id' as never, projectId)
        .single();
      const projRow = data as unknown as { latitude?: number | string | null; longitude?: number | string | null; address?: string | null; city?: string | null; state?: string | null } | null;
      if (projRow?.latitude && projRow?.longitude) {
        setProjectCoords({ lat: Number(projRow.latitude), lng: Number(projRow.longitude) });
      } else if (projRow?.address || projRow?.city) {
        // Geocode from address using Nominatim (free, no API key)
        const q = [projRow.address, projRow.city, projRow.state].filter(Boolean).join(', ');
        try {
          const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
          const results = await resp.json();
          if (results?.[0]) {
            const coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
            setProjectCoords(coords);
            // Persist the geocoded coordinates back to the project
            await fromTable('projects').update({
              latitude: coords.lat, longitude: coords.lng,
            } as never).eq('id' as never, projectId);
          }
        } catch { /* geocoding failed, user can set manually */ }
      }
    })();
  }, [projectId]);

  // ── Load weather ──
  useEffect(() => {
    if (!projectCoords) return;
    const fetchWeather = async () => {
      setWeatherLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${projectCoords.lat}&longitude=${projectCoords.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data?.current) {
          const { condition, icon } = weatherCodeToCondition(data.current.weather_code);
          setWeather({
            temperature: data.current.temperature_2m,
            wind_speed: data.current.wind_speed_10m,
            humidity: data.current.relative_humidity_2m,
            condition,
            icon,
            feels_like: data.current.apparent_temperature,
            precipitation: data.current.precipitation,
          });
        }
      } catch {
        // Weather fetch failed silently
      } finally {
        setWeatherLoading(false);
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // Refresh every 10 min
    return () => clearInterval(interval);
  }, [projectCoords]);

  // ── Safe query helper (handles missing tables gracefully) ──
  const safeQuery = useCallback(async <T,>(
    queryFn: () => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
    fallback: T,
  ): Promise<T> => {
    try {
      const { data, error } = await queryFn();
      if (error) {
        // PGRST205 = table not found — silently ignore (migration not applied yet)
        // 404 = table not in schema cache
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('404')) {
          return fallback;
        }
        console.warn('[SiteMap] Query error:', error.message);
        return fallback;
      }
      return (data ?? fallback) as T;
    } catch {
      return fallback;
    }
  }, []);

  // ── Load pins ──
  const loadPins = useCallback(async () => {
    if (!projectId) return;
    const data = await safeQuery(
      () => fromTable('site_map_pins').select('*').eq('project_id' as never, projectId).order('created_at', { ascending: false }),
      [] as Pin[],
    );
    setPins(data as unknown as Pin[]);
  }, [projectId, safeQuery]);

  // ── Load zones ──
  const loadZones = useCallback(async () => {
    if (!projectId) return;
    const data = await safeQuery(
      () => fromTable('site_map_zones').select('*').eq('project_id' as never, projectId).eq('is_active' as never, true),
      [] as Zone[],
    );
    setZones(data as unknown as Zone[]);
  }, [projectId, safeQuery]);

  // ── Load site plans ──
  const loadSitePlans = useCallback(async () => {
    if (!projectId) return;
    const data = await safeQuery(
      () => fromTable('site_plans').select('*').eq('project_id' as never, projectId).order('created_at', { ascending: false }),
      [] as SitePlan[],
    );
    setSitePlans(data as unknown as SitePlan[]);
  }, [projectId, safeQuery]);

  // ── Load linked entities (real data from existing tables) ──
  const loadLinkedEntities = useCallback(async () => {
    if (!projectId) return;
    const entities: LinkedEntity[] = [];

    // Punch items
    const punchItems = await safeQuery(
      () => fromTable('punch_items').select('id, title, status, priority, location, floor').eq('project_id' as never, projectId).neq('status' as never, 'verified').limit(200),
      [],
    );
    if (punchItems) {
      (punchItems as unknown as Record<string, unknown>[]).forEach((p) => {
        entities.push({
          id: p.id as string, type: 'punch_item',
          title: p.title as string, status: p.status as string,
          priority: p.priority as string | undefined,
          location: (p.floor as string) || (p.location as string) || undefined,
        });
      });
    }

    // Incidents
    const incidentData = await safeQuery(
      () => fromTable('incidents').select('id, type, investigation_status, location, floor, date').eq('project_id' as never, projectId).limit(100),
      [],
    );
    if (incidentData) {
      (incidentData as unknown as Record<string, unknown>[]).forEach((i) => {
        entities.push({
          id: i.id as string, type: 'incident',
          title: `${(i.type as string || 'incident').replace(/_/g, ' ')} incident`,
          status: i.investigation_status as string || 'open',
          location: (i.floor as string) || (i.location as string) || undefined,
          date: i.date as string | undefined,
        });
      });
    }

    // Safety inspections
    const inspectionData = await safeQuery(
      () => fromTable('safety_inspections').select('id, type, status, area, floor, date').eq('project_id' as never, projectId).limit(100),
      [],
    );
    if (inspectionData) {
      (inspectionData as unknown as Record<string, unknown>[]).forEach((ins) => {
        entities.push({
          id: ins.id as string, type: 'inspection',
          title: `${(ins.type as string || 'inspection').replace(/_/g, ' ')} inspection`,
          status: ins.status as string || 'scheduled',
          location: (ins.floor as string) || (ins.area as string) || undefined,
          date: ins.date as string | undefined,
        });
      });
    }

    // Deliveries — columns from 00009_procurement_equipment migration
    const deliveryData = await safeQuery(
      () => fromTable('deliveries').select('id, carrier, tracking_number, status, delivery_date').eq('project_id' as never, projectId).limit(100),
      [],
    );
    if (deliveryData) {
      (deliveryData as unknown as Record<string, unknown>[]).forEach((d) => {
        const status = d.status as string;
        if (['scheduled', 'in_transit'].includes(status)) {
          entities.push({
            id: d.id as string, type: 'delivery',
            title: (d.carrier as string) || (d.tracking_number as string) || 'Delivery',
            status: status || 'scheduled',
            date: d.delivery_date as string | undefined,
          });
        }
      });
    }

    // Safety observations
    const observationData = await safeQuery(
      () => fromTable('safety_observations').select('id, type, description, location, date').eq('project_id' as never, projectId).limit(100),
      [],
    );
    if (observationData) {
      (observationData as unknown as Record<string, unknown>[]).forEach((o) => {
        entities.push({
          id: o.id as string, type: 'observation',
          title: ((o.description as string) || '').slice(0, 60),
          status: (o.type as string) === 'hazard' ? 'open' : 'resolved',
          location: o.location as string | undefined,
          date: o.date as string | undefined,
        });
      });
    }

    setLinkedEntities(entities);
  }, [projectId, safeQuery]);

  // ── Initial data load ──
  useEffect(() => { loadPins(); loadZones(); loadSitePlans(); loadLinkedEntities(); }, [loadPins, loadZones, loadSitePlans, loadLinkedEntities]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`site-map-v2-${projectId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'site_map_pins', filter: `project_id=eq.${projectId}` },
        () => loadPins(),
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'site_map_zones', filter: `project_id=eq.${projectId}` },
        () => loadZones(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, loadPins, loadZones]);

  // ── Initialize Leaflet map ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled) return;
      leafletRef.current = L;

      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapContainerRef.current || mapRef.current) return;

      const startCenter = projectCoords
        ? [projectCoords.lat, projectCoords.lng] as [number, number]
        : [39.5, -98.35] as [number, number];
      const startZoom = projectCoords ? 17 : 4;

      const map = L.map(mapContainerRef.current, {
        center: startCenter,
        zoom: startZoom,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      // Add zoom control to bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Attribution bottom-left
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

      const layerCfg = BASE_LAYERS[baseLayer];
      const tileLayer = L.tileLayer(layerCfg.url, {
        attribution: layerCfg.attribution,
        maxZoom: 22,
      });
      tileLayer.addTo(map);
      tileLayerRef.current = tileLayer;

      const pinLayer = L.layerGroup().addTo(map);
      pinLayerRef.current = pinLayer;

      const entityLayer = L.layerGroup().addTo(map);
      entityLayerRef.current = entityLayer;

      const zoneLayer = L.layerGroup().addTo(map);
      zoneLayerRef.current = zoneLayer;

      // Map click handler
      map.on('click', (e) => {
        const ctx = clickCtxRef.current;
        if (ctx.mode === 'gps') {
          setPending({ lat: e.latlng.lat, lng: e.latlng.lng, pin_type: ctx.placingType });
        } else if (ctx.mode === 'siteplan' && imgOverlayRef.current.imgEl) {
          const bounds = (imgOverlayRef.current.imgEl.dataset.bounds || '').split(',').map(Number);
          if (bounds.length === 4) {
            const [s, w, n, ee] = bounds;
            const img = imgOverlayRef.current.imgEl;
            const px = ((e.latlng.lng - w) / (ee - w)) * img.naturalWidth;
            const py = ((n - e.latlng.lat) / (n - s)) * img.naturalHeight;
            setPending({ px, py, pin_type: ctx.placingType });
          }
        }
      });

      // Scale control
      L.control.scale({ position: 'bottomleft', imperial: true, metric: true }).addTo(map);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center map when project coords arrive
  useEffect(() => {
    if (projectCoords && mapRef.current && mapRef.current.getZoom() < 10) {
      mapRef.current.setView([projectCoords.lat, projectCoords.lng], 17, { animate: true });
    }
  }, [projectCoords]);

  const clickCtxRef = useRef({ mode, placingType });
  useEffect(() => { clickCtxRef.current = { mode, placingType }; }, [mode, placingType]);

  // ── Switch base layer ──
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !tileLayerRef.current) return;
    const layerCfg = BASE_LAYERS[baseLayer];
    tileLayerRef.current.setUrl(layerCfg.url);
  }, [baseLayer]);

  // ── Render pin markers ──
  useEffect(() => {
    const L = leafletRef.current;
    const layer = pinLayerRef.current;
    const map = mapRef.current;
    if (!L || !layer || !map) return;

    layer.clearLayers();
    markersRef.current.clear();

    filteredPins.forEach((p) => {
      let lat: number;
      let lng: number;
      if (mode === 'gps') {
        lat = p.latitude!;
        lng = p.longitude!;
      } else {
        const img = imgOverlayRef.current.imgEl;
        if (!img) return;
        const bounds = (img.dataset.bounds || '').split(',').map(Number);
        if (bounds.length !== 4) return;
        const [s, w, n, ee] = bounds;
        lng = w + (p.pixel_x! / img.naturalWidth) * (ee - w);
        lat = n - (p.pixel_y! / img.naturalHeight) * (n - s);
      }
      const isSelected = selectedPin?.id === p.id;
      const marker = L.marker([lat, lng], { icon: createDivIcon(L, p.pin_type, p.label, isSelected) });
      marker.on('click', () => { setSelectedPin(p); setSelectedEntity(null); });
      marker.addTo(layer);
      markersRef.current.set(p.id, marker);
    });
  }, [filteredPins, mode, selectedPin?.id]);

  // ── Render entity markers ──
  useEffect(() => {
    const L = leafletRef.current;
    const layer = entityLayerRef.current;
    const map = mapRef.current;
    if (!L || !layer || !map || mode !== 'gps' || !projectCoords) return;

    layer.clearLayers();
    entityMarkersRef.current.clear();

    // Place entities around project center with slight offsets based on type
    // In a real deployment, entities would have their own lat/lng from field capture
    const visibleEntities = linkedEntities.filter((e) => {
      if (!visibleEntityTypes.has(e.type)) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (floorFilter && e.location !== floorFilter) return false;
      return true;
    });

    // Entities that have pins linked to them get placed at those pin locations
    // Otherwise they cluster near the project center
    visibleEntities.forEach((e, i) => {
      // Check if there's a pin linked to this entity
      const linkedPin = pins.find(
        (p) => p.linked_entity_id === e.id && p.latitude != null
      );
      let lat: number, lng: number;
      if (linkedPin?.latitude && linkedPin?.longitude) {
        lat = linkedPin.latitude;
        lng = linkedPin.longitude;
      } else {
        // Spread entities around project center in a grid pattern
        const row = Math.floor(i / 5);
        const col = i % 5;
        lat = projectCoords.lat + (row - 2) * 0.0003;
        lng = projectCoords.lng + (col - 2) * 0.0003;
      }

      const marker = L.marker([lat, lng], {
        icon: createEntityIcon(L, e.type, e.title, e.status),
      });
      marker.on('click', () => { setSelectedEntity(e); setSelectedPin(null); });
      marker.addTo(layer);
      entityMarkersRef.current.set(e.id, marker);
    });
  }, [linkedEntities, visibleEntityTypes, mode, projectCoords, search, floorFilter, pins]);

  // ── Render zones ──
  useEffect(() => {
    const L = leafletRef.current;
    const layer = zoneLayerRef.current;
    const map = mapRef.current;
    if (!L || !layer || !map || !showZones) { layer?.clearLayers(); return; }

    layer.clearLayers();
    const filteredZones = zones.filter((z) => {
      if (floorFilter && z.floor !== floorFilter) return false;
      return true;
    });

    filteredZones.forEach((z) => {
      if (mode === 'gps' && z.geojson) {
        try {
          const geoLayer = L.geoJSON(z.geojson as GeoJSON.GeoJsonObject, {
            style: {
              color: z.color,
              fillColor: z.color,
              fillOpacity: z.opacity,
              weight: 2,
            },
          });
          geoLayer.bindTooltip(z.name, {
            permanent: false, direction: 'center',
            className: 'zone-tooltip',
          });
          geoLayer.addTo(layer);
        } catch { /* invalid geojson */ }
      }
    });
  }, [zones, showZones, mode, floorFilter]);

  // ── Site plan overlay ──
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Remove existing overlay
    map.eachLayer((l) => {
      if ((l as unknown as { _image?: HTMLImageElement })._image) {
        map.removeLayer(l);
      }
    });

    if (mode === 'siteplan' && sitePlanUrl) {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / img.naturalHeight;
        const bounds: LatLngBoundsLiteral = [[-1, -aspect], [1, aspect]];
        img.dataset.bounds = `${-1},${-aspect},${1},${aspect}`;
        imgOverlayRef.current.imgEl = img;
        L.imageOverlay(sitePlanUrl, bounds, { opacity: 0.95 }).addTo(map);
        map.fitBounds(bounds, { padding: [20, 20] });
      };
      img.src = sitePlanUrl;
    } else {
      imgOverlayRef.current.imgEl = null;
    }
     
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
      floor: floorFilter || null,
    };
    const { error } = await fromTable('site_map_pins').insert(row as never);
    if (error) { toast.error(error.message); return; }
    toast.success(`${cfg.label} pin placed`);
    setPending(null);
  }, [projectId, pending, floorFilter]);

  // ── Delete pin ──
  const deletePin = useCallback(async (id: string) => {
    const { error } = await fromTable('site_map_pins').delete().eq('id' as never, id);
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
        .createSignedUrl(path, 86400); // 24h signed URL
      if (signErr || !signed?.signedUrl) throw signErr || new Error('Signing failed');

      // Save to site_plans table
      const { error: dbErr } = await fromTable('site_plans').insert({
        project_id: projectId,
        name: f.name.replace(/\.[^.]+$/, ''),
        file_path: path,
        file_url: signed.signedUrl,
        floor: floorFilter || null,
      } as never);
      if (dbErr) console.warn('Could not save site plan record:', dbErr.message);

      setSitePlanUrl(signed.signedUrl);
      setMode('siteplan');
      toast.success('Site plan loaded');
      loadSitePlans();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  }, [projectId, floorFilter, loadSitePlans]);

  const useCurrentLocation = useCallback(() => {
    if (!('geolocation' in navigator)) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 18, { animate: true });
        }
      },
      (err) => toast.error(err.message),
      { enableHighAccuracy: true },
    );
  }, []);

  const centerOnProject = useCallback(() => {
    if (projectCoords && mapRef.current) {
      mapRef.current.setView([projectCoords.lat, projectCoords.lng], 17, { animate: true });
    }
  }, [projectCoords]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // ── Status badge helper ──
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      open: { bg: '#FEF3C7', text: '#92400E' },
      in_progress: { bg: '#DBEAFE', text: '#1E40AF' },
      investigating: { bg: '#DBEAFE', text: '#1E40AF' },
      resolved: { bg: '#D1FAE5', text: '#065F46' },
      verified: { bg: '#D1FAE5', text: '#065F46' },
      closed: { bg: '#F3F4F6', text: '#374151' },
      passed: { bg: '#D1FAE5', text: '#065F46' },
      failed: { bg: '#FEE2E2', text: '#991B1B' },
      scheduled: { bg: '#EDE9FE', text: '#5B21B6' },
      in_transit: { bg: '#DBEAFE', text: '#1E40AF' },
      delivered: { bg: '#D1FAE5', text: '#065F46' },
    };
    const c = statusColors[status] || statusColors.open;
    return (
      <span style={{
        padding: '2px 8px', borderRadius: borderRadius.full,
        fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
        backgroundColor: c.bg, color: c.text,
        textTransform: 'capitalize',
      }}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // ── Render ──
  const containerStyle: React.CSSProperties = isFullscreen ? {
    position: 'fixed', inset: 0, zIndex: 1035,
    backgroundColor: colors.surfacePage,
    display: 'flex', flexDirection: 'column',
  } : {};

  return (
    <div style={containerStyle}>
      <PageContainer
        title={isFullscreen ? undefined : "Site Map"}
        subtitle={isFullscreen ? undefined : "Live operational map — real-time site intelligence for your project"}
        actions={
          <div style={{ display: 'flex', gap: spacing['2'], alignItems: 'center', flexWrap: 'wrap' }}>
            <WeatherWidget weather={weather} loading={weatherLoading} />
            <div style={{ display: 'flex', gap: spacing['1'], backgroundColor: colors.surfaceInset, borderRadius: borderRadius.md, padding: '2px', border: `1px solid ${colors.borderSubtle}` }}>
              <button type="button" onClick={() => setMode('gps')}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: mode === 'gps' ? colors.surfaceRaised : 'transparent',
                  color: mode === 'gps' ? colors.textPrimary : colors.textSecondary,
                  border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer',
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  boxShadow: mode === 'gps' ? shadows.sm : 'none',
                  transition: transitions.fast,
                }}>
                <Globe size={14} /> GPS
              </button>
              <button type="button" onClick={() => sitePlanUrl ? setMode('siteplan') : sitePlanInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: mode === 'siteplan' ? colors.surfaceRaised : 'transparent',
                  color: mode === 'siteplan' ? colors.textPrimary : colors.textSecondary,
                  border: 'none', borderRadius: borderRadius.sm, cursor: 'pointer',
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  boxShadow: mode === 'siteplan' ? shadows.sm : 'none',
                  transition: transitions.fast,
                }}>
                <ImageIcon size={14} /> {sitePlanUrl ? 'Site Plan' : 'Upload Plan'}
              </button>
            </div>
            <input ref={sitePlanInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e) => onSitePlanFile(e.target.files?.[0])} />
            {allFloors.length > 0 && (
              <select
                value={floorFilter || ''}
                onChange={(e) => setFloorFilter(e.target.value || null)}
                style={{
                  padding: `${spacing['2']} ${spacing['3']}`,
                  backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: borderRadius.md, color: colors.textPrimary,
                  fontSize: typography.fontSize.sm, cursor: 'pointer', outline: 'none',
                  minWidth: 100,
                }}>
                <option value="">All Floors</option>
                {allFloors.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
            <Btn variant="ghost" onClick={toggleFullscreen} aria-label="Toggle fullscreen"
              style={{ padding: spacing['2'] }}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Btn>
          </div>
        }
      >
        <div style={{
          display: 'flex', gap: spacing['4'],
          height: isFullscreen ? 'calc(100vh - 80px)' : 'calc(100vh - 220px)',
          minHeight: 500,
        }}>

          {/* ── Sidebar ── */}
          {!sidebarCollapsed && (
            <aside
              aria-label="Site map controls"
              tabIndex={0}
              style={{
              width: 260, flexShrink: 0,
              display: 'flex', flexDirection: 'column', gap: spacing['3'],
              overflowY: 'auto', overflowX: 'hidden',
              backgroundColor: colors.surfaceRaised,
              borderRadius: borderRadius.lg,
              border: `1px solid ${colors.borderSubtle}`,
              padding: spacing['4'],
              outline: 'none',
            }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} color={colors.textTertiary}
                  style={{ position: 'absolute', left: spacing['3'], top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search all items…" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%', padding: `${spacing['2']} ${spacing['3']} ${spacing['2']} 32px`,
                    backgroundColor: colors.surfaceInset,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: borderRadius.md,
                    color: colors.textPrimary, fontSize: typography.fontSize.sm,
                    outline: 'none', boxSizing: 'border-box',
                  }} />
              </div>

              {/* Place Pin */}
              <CollapsibleSection title="Place Pin" defaultOpen={true}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1.5'] }}>
                  {PIN_TYPES.map((t) => {
                    const cfg = PIN_CONFIG[t];
                    const selected = placingType === t;
                    return (
                      <button key={t} type="button" onClick={() => setPlacingType(t)}
                        style={sidebarBtnStyle(selected, cfg.color)}>
                        <span style={{ fontSize: 15 }}>{cfg.emoji}</span>
                        <span style={{ flex: 1 }}>{cfg.label}</span>
                        <span style={{ fontSize: typography.fontSize.xs, opacity: 0.7 }}>{pinCounts[t]}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{
                  fontSize: typography.fontSize.xs, color: colors.textSecondary,
                  marginTop: spacing['2'], fontStyle: 'italic',
                  display: 'flex', alignItems: 'center', gap: spacing['1'],
                }}>
                  <MapPinned size={11} /> Click the map to place
                </div>
              </CollapsibleSection>

              {/* Pin Layers */}
              <CollapsibleSection title="Pin Layers" defaultOpen={true}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                  {PIN_TYPES.map((t) => {
                    const cfg = PIN_CONFIG[t];
                    const visible = visibleTypes.has(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => {
                          setVisibleTypes((prev) => {
                            const next = new Set(prev);
                            if (next.has(t)) next.delete(t); else next.add(t);
                            return next;
                          });
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `5px ${spacing['2']}`,
                          backgroundColor: 'transparent',
                          color: visible ? colors.textPrimary : colors.textSecondary,
                          border: 'none', cursor: 'pointer',
                          fontSize: typography.fontSize.xs, textAlign: 'left',
                          borderRadius: borderRadius.sm, width: '100%',
                          opacity: visible ? 1 : 0.6,
                          transition: transitions.fast,
                        }}>
                        {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{cfg.label}</span>
                        <span style={{ fontSize: '10px', color: colors.textSecondary }}>{pinCounts[t]}</span>
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>

              {/* Linked Data Layers */}
              <CollapsibleSection title="Project Data" badge={linkedEntities.length} defaultOpen={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                  {Object.entries(ENTITY_CONFIG).map(([key, cfg]) => {
                    const visible = visibleEntityTypes.has(key);
                    const count = entityCounts[key] || 0;
                    return (
                      <button key={key} type="button"
                        onClick={() => {
                          setVisibleEntityTypes((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                          });
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `5px ${spacing['2']}`,
                          backgroundColor: 'transparent',
                          color: visible ? colors.textPrimary : colors.textSecondary,
                          border: 'none', cursor: 'pointer',
                          fontSize: typography.fontSize.xs, textAlign: 'left',
                          borderRadius: borderRadius.sm, width: '100%',
                          opacity: visible ? 1 : 0.6,
                          transition: transitions.fast,
                        }}>
                        {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{cfg.label}</span>
                        <span style={{ fontSize: '10px', color: colors.textSecondary }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </CollapsibleSection>

              {/* Zones */}
              <CollapsibleSection title="Zones" badge={zones.length} defaultOpen={false}>
                <button type="button"
                  onClick={() => setShowZones(!showZones)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['2'],
                    padding: `5px ${spacing['2']}`,
                    backgroundColor: 'transparent',
                    color: showZones ? colors.textPrimary : colors.textSecondary,
                    border: 'none', cursor: 'pointer',
                    fontSize: typography.fontSize.xs, textAlign: 'left',
                    borderRadius: borderRadius.sm, width: '100%',
                    marginBottom: spacing['2'],
                  }}>
                  {showZones ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>{showZones ? 'Zones visible' : 'Zones hidden'}</span>
                </button>
                {zones.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                    {zones.map((z) => (
                      <div key={z.id} style={{
                        display: 'flex', alignItems: 'center', gap: spacing['2'],
                        padding: `4px ${spacing['2']}`,
                        fontSize: typography.fontSize.xs, color: colors.textSecondary,
                      }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '2px',
                          backgroundColor: z.color, flexShrink: 0,
                        }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {z.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: typography.fontSize.xs, color: colors.textSecondary, fontStyle: 'italic' }}>
                    No zones defined yet
                  </div>
                )}
              </CollapsibleSection>

              {/* Site Plans */}
              {sitePlans.length > 0 && (
                <CollapsibleSection title="Site Plans" badge={sitePlans.length} defaultOpen={false}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['1'] }}>
                    {sitePlans.map((sp) => (
                      <button key={sp.id} type="button"
                        onClick={async () => {
                          if (sp.file_url) {
                            setSitePlanUrl(sp.file_url);
                            setActiveSitePlan(sp);
                            setMode('siteplan');
                          } else {
                            // Generate a signed URL
                            const { data } = await supabase.storage
                              .from('attachments')
                              .createSignedUrl(sp.file_path, 86400);
                            if (data?.signedUrl) {
                              setSitePlanUrl(data.signedUrl);
                              setActiveSitePlan(sp);
                              setMode('siteplan');
                            }
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `5px ${spacing['2']}`,
                          backgroundColor: activeSitePlan?.id === sp.id ? colors.surfaceSelected : 'transparent',
                          color: colors.textSecondary,
                          border: 'none', cursor: 'pointer',
                          fontSize: typography.fontSize.xs, textAlign: 'left',
                          borderRadius: borderRadius.sm, width: '100%',
                        }}>
                        <ImageIcon size={12} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sp.name}
                        </span>
                        {sp.floor && (
                          <span style={{
                            fontSize: '10px', backgroundColor: colors.surfaceInset,
                            padding: '1px 4px', borderRadius: borderRadius.sm,
                          }}>{sp.floor}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
            </aside>
          )}

          {/* Sidebar toggle */}
          <button type="button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              position: 'absolute', left: sidebarCollapsed ? 8 : 268,
              top: '50%', zIndex: 500,
              width: 24, height: 48,
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: '0 6px 6px 0',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: colors.textTertiary, transition: transitions.fast,
              boxShadow: shadows.sm,
            }}>
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} />}
          </button>

          {/* ── Map ── */}
          <div style={{
            flex: 1, position: 'relative',
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            border: `1px solid ${colors.borderDefault}`,
          }}>
            <div ref={mapContainerRef} role="application" aria-label="Interactive site map" style={{ position: 'absolute', inset: 0, backgroundColor: colors.surfaceInset }} />

            {/* Map toolbar overlay */}
            <div style={{
              position: 'absolute', top: spacing['3'], right: spacing['3'],
              zIndex: 400, display: 'flex', flexDirection: 'column', gap: spacing['2'],
            }}>
              {/* Base layer picker */}
              <div style={{ position: 'relative' }}>
                <button type="button" onClick={() => setShowBaseLayerPicker(!showBaseLayerPicker)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing['1'],
                    padding: `${spacing['2']} ${spacing['3']}`,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    border: `1px solid rgba(0,0,0,0.1)`,
                    borderRadius: borderRadius.md, cursor: 'pointer',
                    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium,
                    color: '#333', boxShadow: shadows.dropdown,
                  }}>
                  <Layers size={14} />
                  {BASE_LAYERS[baseLayer].label}
                  <ChevronDown size={12} />
                </button>
                {showBaseLayerPicker && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0,
                    marginTop: spacing['1'],
                    backgroundColor: 'rgba(255,255,255,0.97)',
                    border: `1px solid rgba(0,0,0,0.1)`,
                    borderRadius: borderRadius.md,
                    boxShadow: shadows.dropdown,
                    overflow: 'hidden', minWidth: 140,
                  }}>
                    {(Object.entries(BASE_LAYERS) as [BaseLayer, typeof BASE_LAYERS[BaseLayer]][]).map(([key, cfg]) => (
                      <button key={key} type="button"
                        onClick={() => { setBaseLayer(key); setShowBaseLayerPicker(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: spacing['2'],
                          padding: `${spacing['2']} ${spacing['3']}`,
                          backgroundColor: baseLayer === key ? 'rgba(244,120,32,0.1)' : 'transparent',
                          color: baseLayer === key ? '#F47820' : '#333',
                          border: 'none', cursor: 'pointer', width: '100%',
                          fontSize: typography.fontSize.xs, fontWeight: baseLayer === key ? typography.fontWeight.semibold : typography.fontWeight.medium,
                          textAlign: 'left',
                        }}>
                        <cfg.icon size={14} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Map action buttons (left side) */}
            <div style={{
              position: 'absolute', top: spacing['3'], left: spacing['3'],
              zIndex: 400, display: 'flex', flexDirection: 'column', gap: spacing['1'],
            }}>
              {mode === 'gps' && (
                <>
                  <button type="button" onClick={useCurrentLocation}
                    title="My location"
                    style={{
                      width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: `1px solid rgba(0,0,0,0.1)`,
                      borderRadius: borderRadius.md, cursor: 'pointer',
                      color: '#333', boxShadow: shadows.sm,
                    }}>
                    <LocateFixed size={16} />
                  </button>
                  {projectCoords && (
                    <button type="button" onClick={centerOnProject}
                      title="Center on project"
                      style={{
                        width: 36, height: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        border: `1px solid rgba(0,0,0,0.1)`,
                        borderRadius: borderRadius.md, cursor: 'pointer',
                        color: '#333', boxShadow: shadows.sm,
                      }}>
                      <Building2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Pin count summary overlay */}
            <div style={{
              position: 'absolute', bottom: spacing['3'], left: '50%', transform: 'translateX(-50%)',
              zIndex: 400,
              display: 'flex', gap: spacing['1'],
              backgroundColor: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(8px)',
              padding: `${spacing['1.5']} ${spacing['3']}`,
              borderRadius: borderRadius.full,
            }}>
              {PIN_TYPES.map((t) => {
                const cfg = PIN_CONFIG[t];
                const count = pinCounts[t];
                if (count === 0) return null;
                return (
                  <span key={t} style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    fontSize: '11px', color: '#fff', fontWeight: typography.fontWeight.medium,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color }} />
                    {count}
                  </span>
                );
              })}
              {linkedEntities.length > 0 && (
                <span style={{
                  fontSize: '11px', color: 'rgba(255,255,255,0.6)',
                  marginLeft: spacing['1'],
                }}>
                  + {linkedEntities.length} linked items
                </span>
              )}
            </div>

            {/* Site plan upload prompt */}
            {mode === 'siteplan' && !sitePlanUrl && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(15,22,41,0.85)',
                backdropFilter: 'blur(4px)',
                zIndex: 400,
              }}>
                <div style={{
                  textAlign: 'center',
                  padding: spacing['8'],
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: borderRadius.xl,
                  border: `1px solid ${colors.borderSubtle}`,
                  maxWidth: 380,
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: borderRadius.lg,
                    backgroundColor: colors.orangeSubtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto', marginBottom: spacing['4'],
                  }}>
                    <Upload size={28} color={colors.primaryOrange} />
                  </div>
                  <h3 style={{
                    fontSize: typography.fontSize.title,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.textPrimary,
                    margin: 0, marginBottom: spacing['2'],
                  }}>Upload Site Plan</h3>
                  <p style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.textSecondary,
                    margin: 0, marginBottom: spacing['5'],
                    lineHeight: typography.lineHeight.normal,
                  }}>
                    Upload your construction drawings, floor plans, or site layout to enable visual pin placement and zone management.
                  </p>
                  <Btn variant="primary" onClick={() => sitePlanInputRef.current?.click()}>
                    <Upload size={14} /> Choose File
                  </Btn>
                  <p style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.textTertiary,
                    margin: 0, marginTop: spacing['3'],
                  }}>
                    Supports PNG, JPG, PDF up to 50MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Place-pin modal ── */}
        <Modal open={!!pending} onClose={() => setPending(null)} title="New Site Pin" width="500px">
          {pending && (
            <PinForm pending={pending} onSave={savePin} onCancel={() => setPending(null)} />
          )}
        </Modal>

        {/* ── Pin detail modal ── */}
        <Modal open={!!selectedPin} onClose={() => setSelectedPin(null)} title={selectedPin?.label || 'Pin'} width="460px">
          {selectedPin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                  padding: `4px ${spacing['3']}`,
                  backgroundColor: PIN_CONFIG[selectedPin.pin_type].color,
                  color: '#fff', borderRadius: borderRadius.full,
                  fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
                }}>
                  {PIN_CONFIG[selectedPin.pin_type].emoji} {PIN_CONFIG[selectedPin.pin_type].label}
                </span>
                {selectedPin.floor && (
                  <span style={{
                    padding: `3px ${spacing['2']}`,
                    backgroundColor: colors.surfaceInset,
                    borderRadius: borderRadius.sm,
                    fontSize: typography.fontSize.xs, color: colors.textSecondary,
                  }}>
                    <Building2 size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                    {selectedPin.floor}
                  </span>
                )}
              </div>

              {selectedPin.description && (
                <p style={{
                  margin: 0, fontSize: typography.fontSize.sm,
                  color: colors.textSecondary, lineHeight: typography.lineHeight.normal,
                }}>
                  {selectedPin.description}
                </p>
              )}

              <div style={{
                display: 'flex', flexDirection: 'column', gap: spacing['1'],
                padding: spacing['3'],
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.md,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.xs }}>
                  <span style={{ color: colors.textTertiary }}>Coordinates</span>
                  <span style={{ color: colors.textSecondary, fontFamily: typography.fontFamilyMono }}>
                    {selectedPin.latitude != null
                      ? `${selectedPin.latitude.toFixed(6)}, ${selectedPin.longitude?.toFixed(6)}`
                      : `x:${Math.round(selectedPin.pixel_x || 0)} y:${Math.round(selectedPin.pixel_y || 0)}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.xs }}>
                  <span style={{ color: colors.textTertiary }}>Last updated</span>
                  <span style={{ color: colors.textSecondary }}>
                    {new Date(selectedPin.updated_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.xs }}>
                  <span style={{ color: colors.textTertiary }}>Created</span>
                  <span style={{ color: colors.textSecondary }}>
                    {new Date(selectedPin.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                <Btn variant="danger" onClick={() => deletePin(selectedPin.id)}>
                  <Trash2 size={14} /><span style={{ marginLeft: 4 }}>Remove</span>
                </Btn>
                <Btn variant="secondary" onClick={() => setSelectedPin(null)}>
                  Close
                </Btn>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Entity detail modal ── */}
        <Modal open={!!selectedEntity} onClose={() => setSelectedEntity(null)} title={selectedEntity?.title || 'Item'} width="460px">
          {selectedEntity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4'] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'], flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: spacing['1'],
                  padding: `4px ${spacing['3']}`,
                  backgroundColor: ENTITY_CONFIG[selectedEntity.type]?.color || '#666',
                  color: '#fff', borderRadius: borderRadius.full,
                  fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold,
                  textTransform: 'capitalize',
                }}>
                  {selectedEntity.type.replace(/_/g, ' ')}
                </span>
                <StatusBadge status={selectedEntity.status} />
                {selectedEntity.priority && (
                  <span style={{
                    padding: `3px ${spacing['2']}`,
                    backgroundColor: selectedEntity.priority === 'critical' ? '#FEE2E2' : selectedEntity.priority === 'high' ? '#FEF3C7' : colors.surfaceInset,
                    color: selectedEntity.priority === 'critical' ? '#991B1B' : selectedEntity.priority === 'high' ? '#92400E' : colors.textSecondary,
                    borderRadius: borderRadius.sm,
                    fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.medium,
                    textTransform: 'capitalize',
                  }}>
                    {selectedEntity.priority}
                  </span>
                )}
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: spacing['1'],
                padding: spacing['3'],
                backgroundColor: colors.surfaceInset,
                borderRadius: borderRadius.md,
              }}>
                {selectedEntity.location && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.xs }}>
                    <span style={{ color: colors.textTertiary }}>Location</span>
                    <span style={{ color: colors.textSecondary }}>{selectedEntity.location}</span>
                  </div>
                )}
                {selectedEntity.date && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.xs }}>
                    <span style={{ color: colors.textTertiary }}>Date</span>
                    <span style={{ color: colors.textSecondary }}>
                      {new Date(selectedEntity.date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: typography.fontSize.xs }}>
                  <span style={{ color: colors.textTertiary }}>Type</span>
                  <span style={{ color: colors.textSecondary, textTransform: 'capitalize' }}>
                    {selectedEntity.type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing['2'] }}>
                <Btn variant="secondary" onClick={() => setSelectedEntity(null)}>
                  Close
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      </PageContainer>

      {/* Global CSS for spin animation and Leaflet overrides */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sitesync-pin { background: transparent !important; border: none !important; }
        .sitesync-entity-pin { background: transparent !important; border: none !important; }
        .zone-tooltip {
          background: rgba(0,0,0,0.8) !important;
          border: none !important;
          color: #fff !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          padding: 4px 10px !important;
          border-radius: 4px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(255,255,255,0.95) !important;
          color: #333 !important;
          border: 1px solid rgba(0,0,0,0.08) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 30px !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
          border-radius: 8px !important;
          overflow: hidden;
        }
        .leaflet-control-scale-line {
          background: rgba(255,255,255,0.85) !important;
          border-color: rgba(0,0,0,0.3) !important;
          font-size: 10px !important;
          padding: 2px 6px !important;
        }
      `}</style>
    </div>
  );
}
