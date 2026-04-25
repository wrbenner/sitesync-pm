import React, { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { colors, spacing, typography, borderRadius } from '../../styles/theme';

// ────────────────────────────────────────────────────────────────
// Site Map Mini — 300px map showing the latest GPS pin per crew
// from crew_gps_locations recorded in the last 15 minutes.
// ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string | undefined;
  projectLat?: number;
  projectLon?: number;
}

interface CrewPin {
  crew_id: string;
  crew_name: string | null;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

function useRecentCrewPins(projectId: string | undefined) {
  return useQuery({
    queryKey: ['crew_gps_recent', projectId],
    queryFn: async (): Promise<CrewPin[]> => {
      if (!projectId) return [];
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('crew_gps_locations')
        .select('crew_id, latitude, longitude, recorded_at, crews(name)')
        .eq('project_id', projectId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false });
      if (error) return [];
      // Keep only the most recent row per crew.
      const seen = new Set<string>();
      const pins: CrewPin[] = [];
      for (const row of (data ?? []) as Array<{ crew_id: string; latitude: number; longitude: number; recorded_at: string; crews?: { name?: string } | { name?: string }[] | null }>) {
        if (seen.has(row.crew_id)) continue;
        seen.add(row.crew_id);
        const crew = row.crews;
        const crewName = Array.isArray(crew) ? crew[0]?.name ?? null : crew?.name ?? null;
        pins.push({
          crew_id: row.crew_id,
          crew_name: crewName,
          latitude: row.latitude,
          longitude: row.longitude,
          recorded_at: row.recorded_at,
        });
      }
      return pins;
    },
    enabled: !!projectId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

function dotIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'dashboard-crew-pin',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color}40;" title="${label}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export const DashboardSiteMapMini: React.FC<Props> = ({ projectId, projectLat, projectLon }) => {
  const { data: pins = [] } = useRecentCrewPins(projectId);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fallbackCenter = useMemo<[number, number]>(() => {
    if (typeof projectLat === 'number' && typeof projectLon === 'number') return [projectLat, projectLon];
    return [39.8283, -98.5795]; // Geographic center of the US
  }, [projectLat, projectLon]);

  // Initialize the Leaflet map once the container mounts.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
    }).setView(fallbackCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center if project coordinates change.
  useEffect(() => {
    if (!mapRef.current) return;
    if (pins.length === 0) {
      mapRef.current.setView(fallbackCenter, 13);
    }
  }, [fallbackCenter, pins.length]);

  // Sync markers whenever the pins change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (pins.length === 0) return;
    const latlngs: L.LatLngExpression[] = [];
    for (const pin of pins) {
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: dotIcon(colors.statusActive, pin.crew_name ?? 'Crew'),
      })
        .addTo(map)
        .bindTooltip(pin.crew_name ?? 'Crew', { direction: 'top', offset: [0, -6] });
      markersRef.current.push(marker);
      latlngs.push([pin.latitude, pin.longitude]);
    }
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 16);
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [20, 20], maxZoom: 17 });
    }
  }, [pins]);

  return (
    <div style={{
      padding: spacing['4'],
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.xl,
      border: `1px solid ${colors.borderSubtle}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing['2'] }}>
          <MapPin size={12} color={colors.textTertiary} />
          <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Site Map
          </span>
        </div>
        <span style={{ fontSize: '10px', color: pins.length > 0 ? colors.statusActive : colors.textTertiary, fontWeight: typography.fontWeight.medium }}>
          {pins.length} crew{pins.length === 1 ? '' : 's'} on site
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          height: 300,
          width: '100%',
          borderRadius: borderRadius.lg,
          overflow: 'hidden',
          border: `1px solid ${colors.borderSubtle}`,
        }}
      />
      {pins.length === 0 && (
        <div style={{ fontSize: '10px', color: colors.textSecondary, marginTop: spacing['2'] }}>
          No crew pings in the last 15 minutes.
        </div>
      )}
    </div>
  );
};

DashboardSiteMapMini.displayName = 'DashboardSiteMapMini';
