// ── Site Intelligence ─────────────────────────────────────────
// Production-grade site due diligence for general contractors.
// ALL data from real public APIs — zero mock data.
// FEMA flood zones, USDA soil, OpenWeatherMap, OSM amenities, USGS elevation.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MapPin, Search, Download, Loader2, AlertTriangle, Droplets,
  Mountain, TreePine, Cloud, Thermometer,
  Shield, Sun, CheckCircle2,
  AlertCircle, Compass, Crosshair,
  School, Flame, ShieldCheck, Train, ShoppingCart,
  Fuel, Hospital, Plane, Globe, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/theme';
import {
  fetchSiteIntelligence,
  geocodeAddress,
  type SiteIntelligenceData,
  type GeocodingResult,
  type NearbyAmenity,
  type WeatherForecastDay,
} from '../../services/siteIntelligenceService';

import 'leaflet/dist/leaflet.css';

// ── Types ─────────────────────────────────────────────────────

type TabKey = 'weather' | 'flood' | 'soil' | 'environmental' | 'nearby' | 'sun';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'weather', label: 'Weather & Construction', icon: Cloud },
  { key: 'flood', label: 'Flood Zone', icon: Droplets },
  { key: 'soil', label: 'Soil & Elevation', icon: Mountain },
  { key: 'environmental', label: 'Environmental', icon: TreePine },
  { key: 'nearby', label: 'Nearby Amenities', icon: MapPin },
  { key: 'sun', label: 'Sun Exposure', icon: Sun },
];

// ── Amenity Icon Map ──────────────────────────────────────────

const AMENITY_ICON: Record<string, React.ElementType> = {
  school: School,
  hospital: Hospital,
  fire_station: Flame,
  police: ShieldCheck,
  fuel: Fuel,
  grocery: ShoppingCart,
  transit: Train,
  airport: Plane,
};

const AMENITY_COLOR: Record<string, string> = {
  school: '#3B82F6',
  hospital: '#EF4444',
  fire_station: '#F59E0B',
  police: '#8B5CF6',
  fuel: '#6B7280',
  grocery: '#10B981',
  transit: '#06B6D4',
  airport: '#6366F1',
};

// ── Shared UI Components ──────────────────────────────────────

function DataCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: colors.surfaceRaised,
      borderRadius: borderRadius.lg,
      border: `1px solid ${colors.borderSubtle}`,
      padding: spacing['5'],
      ...style,
    }}>
      {children}
    </div>
  );
}

function DataRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${spacing.sm} 0`,
      borderBottom: `1px solid ${colors.borderSubtle}`,
    }}>
      <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{label}</span>
      <span style={{
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.medium,
        color: colors.textPrimary,
        fontFamily: mono ? typography.fontFamilyMono : undefined,
        textAlign: 'right',
        maxWidth: '60%',
      }}>{value}</span>
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: spacing.xs,
      padding: `2px ${spacing.sm}`, borderRadius: borderRadius.full,
      fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.medium,
      color, backgroundColor: bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
      {label}
    </span>
  );
}

function SectionTitle({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
      {Icon && <Icon size={16} color={colors.brand400} />}
      <h3 style={{
        fontSize: typography.fontSize.title,
        fontWeight: typography.fontWeight.semibold,
        color: colors.textPrimary, margin: 0,
      }}>{children}</h3>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: spacing.xl, textAlign: 'center',
      color: colors.textTertiary, fontSize: typography.fontSize.sm,
    }}>
      <AlertCircle size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}

// ── Weather Tab ───────────────────────────────────────────────

function WeatherTab({ data }: { data: SiteIntelligenceData }) {
  if (!data.weather) return <EmptyState message="Weather data unavailable. Check your OpenWeatherMap API key." />;
  const { current, forecast, construction } = data.weather;

  const weatherIcon = (icon: string) =>
    `https://openweathermap.org/img/wn/${icon}@2x.png`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {/* Construction Assessment Banner */}
      <DataCard style={{
        background: construction.pour_day
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)'
          : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)',
        borderColor: construction.pour_day ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <div style={{
            width: 56, height: 56, borderRadius: borderRadius.xl,
            backgroundColor: construction.pour_day ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {construction.pour_day
              ? <CheckCircle2 size={28} color="#10B981" />
              : <AlertTriangle size={28} color="#EF4444" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: typography.fontSize.subtitle,
              fontWeight: typography.fontWeight.bold,
              color: construction.pour_day ? '#10B981' : '#EF4444',
              marginBottom: 2,
            }}>
              {construction.pour_day ? 'GOOD POUR DAY' : 'NO-POUR CONDITIONS'}
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
              {construction.summary}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: spacing.md, marginTop: spacing.lg }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 2 }}>Concrete</div>
            <Badge
              label={construction.pour_day ? 'GO' : 'HOLD'}
              color={construction.pour_day ? '#10B981' : '#EF4444'}
              bg={construction.pour_day ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 2 }}>Crane Ops</div>
            <Badge
              label={construction.crane_hold ? 'HOLD' : 'GO'}
              color={construction.crane_hold ? '#F59E0B' : '#10B981'}
              bg={construction.crane_hold ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 2 }}>Freeze Risk</div>
            <Badge
              label={construction.freeze_risk ? 'YES' : 'NONE'}
              color={construction.freeze_risk ? '#3B82F6' : '#10B981'}
              bg={construction.freeze_risk ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)'}
            />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, textTransform: 'uppercase', marginBottom: 2 }}>Heat Risk</div>
            <Badge
              label={construction.heat_risk ? 'YES' : 'NONE'}
              color={construction.heat_risk ? '#EF4444' : '#10B981'}
              bg={construction.heat_risk ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}
            />
          </div>
        </div>
      </DataCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
        {/* Current Conditions */}
        <DataCard>
          <SectionTitle icon={Thermometer}>Current Conditions</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
            <img src={weatherIcon(current.icon)} alt={current.conditions} width={64} height={64} style={{ margin: '-8px' }} />
            <div>
              <div style={{ fontSize: '36px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>
                {current.temperature}°F
              </div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' }}>
                {current.description} · Feels like {current.feels_like}°F
              </div>
            </div>
          </div>
          <DataRow label="Wind" value={`${current.wind_speed} mph (gusts ${current.wind_gust} mph)`} />
          <DataRow label="Humidity" value={`${current.humidity}%`} />
          <DataRow label="Visibility" value={`${(current.visibility / 1609.34).toFixed(1)} mi`} />
          <DataRow label="Cloud Cover" value={`${current.clouds}%`} />
          <DataRow label="Pressure" value={`${current.pressure} hPa`} />
        </DataCard>

        {/* 5-Day Forecast */}
        <DataCard>
          <SectionTitle icon={Cloud}>5-Day Construction Forecast</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {forecast.map((day) => {
              const isPourDay = day.temp_high > 40 && day.temp_high < 95 && day.precipitation_probability < 40 && day.wind_speed < 25;
              return (
                <div key={day.date} style={{
                  display: 'grid', gridTemplateColumns: '90px 48px 1fr 60px 60px 50px',
                  alignItems: 'center', gap: spacing.sm,
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.surfaceInset,
                  border: `1px solid ${colors.borderSubtle}`,
                }}>
                  <span style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.textPrimary }}>
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <img src={weatherIcon(day.icon)} alt="" width={32} height={32} style={{ margin: '-4px' }} />
                  <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, textTransform: 'capitalize' }}>{day.description}</span>
                  <span style={{ fontSize: typography.fontSize.sm, fontFamily: typography.fontFamilyMono, color: colors.textPrimary }}>
                    {day.temp_high}° / {day.temp_low}°
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {day.wind_speed}mph
                  </span>
                  <Badge
                    label={isPourDay ? 'POUR' : 'HOLD'}
                    color={isPourDay ? '#10B981' : '#EF4444'}
                    bg={isPourDay ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}
                  />
                </div>
              );
            })}
          </div>
        </DataCard>
      </div>
    </div>
  );
}

// ── Flood Tab ─────────────────────────────────────────────────

function FloodTab({ data }: { data: SiteIntelligenceData }) {
  if (!data.flood) return <EmptyState message="Flood zone data unavailable. FEMA NFHL service may be temporarily down." />;
  const f = data.flood;

  const riskConfig: Record<string, { color: string; bg: string }> = {
    High: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
    Moderate: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    Low: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    Minimal: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  };

  const rc = riskConfig[f.risk_level] || riskConfig.Minimal;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
      <DataCard>
        <SectionTitle icon={Droplets}>FEMA Flood Zone Determination</SectionTitle>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.lg,
          padding: spacing.lg, borderRadius: borderRadius.lg,
          backgroundColor: rc.bg, border: `1px solid ${rc.color}22`,
          marginBottom: spacing.md,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: borderRadius.xl,
            backgroundColor: `${rc.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: rc.color }}>
              {f.zone}
            </span>
          </div>
          <div>
            <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.bold, color: rc.color }}>
              {f.risk_level} Risk
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.5, marginTop: 2 }}>
              {f.description}
            </div>
          </div>
        </div>
        <DataRow label="FEMA Flood Zone" value={<Badge label={`Zone ${f.zone}`} color={rc.color} bg={rc.bg} />} />
        <DataRow label="Special Flood Hazard Area" value={
          <Badge label={f.is_sfha ? 'Yes — SFHA' : 'No'} color={f.is_sfha ? '#EF4444' : '#10B981'} bg={f.is_sfha ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'} />
        } />
        <DataRow label="Base Flood Elevation" value={f.base_flood_elevation ? `${f.base_flood_elevation} ft` : 'N/A'} mono />
        <DataRow label="Flood Insurance" value={
          <Badge
            label={f.insurance_required ? 'Required' : 'Not Required'}
            color={f.insurance_required ? '#EF4444' : '#10B981'}
            bg={f.insurance_required ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'}
          />
        } />
      </DataCard>

      <DataCard>
        <SectionTitle icon={Shield}>Construction Impact Assessment</SectionTitle>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.7 }}>
          {f.risk_level === 'High' || f.risk_level === 'Moderate' ? (
            <>
              <p style={{ margin: `0 0 ${spacing.md}` }}>
                <strong style={{ color: '#EF4444' }}>Action Required:</strong> This site is in a FEMA-designated flood hazard area. The following applies to construction:
              </p>
              <ul style={{ margin: 0, paddingLeft: spacing.lg }}>
                <li>Flood insurance is mandatory for federally-backed mortgages</li>
                <li>New construction must meet or exceed the Base Flood Elevation (BFE)</li>
                <li>Foundation design must comply with local floodplain ordinance</li>
                <li>Fill placement may require a CLOMR/LOMR from FEMA</li>
                <li>Temporary construction dewatering plan required</li>
                <li>Review local drainage requirements with civil engineer</li>
              </ul>
            </>
          ) : (
            <>
              <p style={{ margin: `0 0 ${spacing.md}` }}>
                <strong style={{ color: '#10B981' }}>Low Flood Risk:</strong> This site has minimal flood exposure per FEMA NFHL data.
              </p>
              <ul style={{ margin: 0, paddingLeft: spacing.lg }}>
                <li>No mandatory flood insurance requirement</li>
                <li>Standard foundation design appropriate</li>
                <li>Still recommend reviewing local stormwater management requirements</li>
                <li>Verify detention/retention requirements with jurisdiction</li>
                <li>Consider climate change projections for long-term risk</li>
              </ul>
            </>
          )}
        </div>
        <div style={{
          marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 4 }}>
            DATA SOURCE
          </div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            FEMA National Flood Hazard Layer (NFHL) · Real-time ArcGIS REST API query
          </div>
        </div>
      </DataCard>
    </div>
  );
}

// ── Soil & Elevation Tab ──────────────────────────────────────

function SoilTab({ data }: { data: SiteIntelligenceData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
      <DataCard>
        <SectionTitle icon={Mountain}>USDA Soil Classification</SectionTitle>
        {data.soil ? (
          <>
            <DataRow label="Map Unit" value={data.soil.map_unit_symbol} mono />
            <DataRow label="Soil Name" value={data.soil.map_unit_name} />
            <DataRow label="Drainage Class" value={data.soil.drainage_class || 'Not classified'} />
            <DataRow label="Hydrologic Group" value={
              data.soil.hydrologic_group ? (
                <Badge
                  label={`Group ${data.soil.hydrologic_group}`}
                  color={
                    data.soil.hydrologic_group === 'A' ? '#10B981'
                      : data.soil.hydrologic_group === 'B' ? '#3B82F6'
                        : data.soil.hydrologic_group === 'C' ? '#F59E0B'
                          : '#EF4444'
                  }
                  bg={
                    data.soil.hydrologic_group === 'A' ? 'rgba(16,185,129,0.12)'
                      : data.soil.hydrologic_group === 'B' ? 'rgba(59,130,246,0.12)'
                        : data.soil.hydrologic_group === 'C' ? 'rgba(245,158,11,0.12)'
                          : 'rgba(239,68,68,0.12)'
                  }
                />
              ) : 'Unknown'
            } />
            <DataRow label="Taxonomic Order" value={data.soil.taxonomic_order || 'N/A'} />
            <DataRow label="Taxonomic Subgroup" value={data.soil.taxonomic_subgroup || 'N/A'} />

            <div style={{
              marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md,
              backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
            }}>
              <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 4 }}>
                CONSTRUCTION NOTES
              </div>
              <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                {data.soil.hydrologic_group === 'C' || data.soil.hydrologic_group === 'D'
                  ? 'High runoff potential soil — detention/retention design critical. May require underdrains, lime stabilization, or moisture conditioning. Recommend geotechnical investigation for foundation design.'
                  : data.soil.hydrologic_group === 'A' || data.soil.hydrologic_group === 'B'
                    ? 'Good drainage characteristics. Standard foundation systems likely appropriate. Verify bearing capacity with geotechnical report.'
                    : 'Soil classification available — recommend geotechnical investigation for site-specific bearing capacity, compaction requirements, and foundation recommendations.'}
              </div>
            </div>
          </>
        ) : (
          <EmptyState message="USDA soil data unavailable for this location. The NRCS Soil Data Access service may not cover this area." />
        )}
      </DataCard>

      <DataCard>
        <SectionTitle icon={Compass}>Site Elevation</SectionTitle>
        {data.elevation ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing.lg,
              padding: spacing.lg, borderRadius: borderRadius.lg,
              backgroundColor: 'rgba(59,130,246,0.06)',
              border: '1px solid rgba(59,130,246,0.12)',
              marginBottom: spacing.md,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: borderRadius.xl,
                backgroundColor: 'rgba(59,130,246,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mountain size={28} color="#3B82F6" />
              </div>
              <div>
                <div style={{ fontSize: '32px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>
                  {data.elevation.elevation_ft.toLocaleString()} ft
                </div>
                <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>
                  Above Mean Sea Level
                </div>
              </div>
            </div>
            <DataRow label="Elevation" value={`${data.elevation.elevation_ft.toLocaleString()} ft MSL`} mono />
            <DataRow label="Meters" value={`${Math.round(data.elevation.elevation_ft * 0.3048)} m`} mono />
            <DataRow label="Source" value={data.elevation.source} />
          </>
        ) : (
          <EmptyState message="USGS elevation data unavailable." />
        )}

        <div style={{
          marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 4 }}>
            DATA SOURCES
          </div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>
            Soil: USDA NRCS Soil Data Access (SSURGO) · Elevation: USGS National Map
          </div>
        </div>
      </DataCard>
    </div>
  );
}

// ── Environmental Tab ─────────────────────────────────────────

function EnvironmentalTab({ data }: { data: SiteIntelligenceData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
      <DataCard>
        <SectionTitle icon={TreePine}>EPA-Regulated Facilities Nearby</SectionTitle>
        {data.epa_facilities.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {data.epa_facilities.map((f, i) => (
              <div key={i} style={{
                padding: spacing.md, borderRadius: borderRadius.md,
                backgroundColor: colors.surfaceInset,
                border: `1px solid ${colors.borderSubtle}`,
              }}>
                <div style={{
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
                  color: colors.textPrimary, marginBottom: 2,
                }}>{f.name}</div>
                {f.street && (
                  <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {f.street}, {f.city} {f.state}
                  </div>
                )}
                {f.registry_id && (
                  <div style={{ fontSize: typography.fontSize.caption, fontFamily: typography.fontFamilyMono, color: colors.textTertiary, marginTop: 2 }}>
                    ID: {f.registry_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: spacing.lg, textAlign: 'center', borderRadius: borderRadius.md,
            backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)',
          }}>
            <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: '#10B981' }}>
              No EPA-Regulated Facilities Found
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: 4 }}>
              No CERCLA, RCRA, or TRI facilities identified within 3 miles
            </div>
          </div>
        )}
      </DataCard>

      <DataCard>
        <SectionTitle icon={Shield}>Environmental Due Diligence Checklist</SectionTitle>
        <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.7 }}>
          <p style={{ margin: `0 0 ${spacing.md}` }}>
            Based on the EPA facility scan, the following due diligence steps are recommended:
          </p>
          {[
            { done: true, label: 'EPA facility radius search (3 mi) — completed' },
            { done: false, label: 'Phase I Environmental Site Assessment (ESA) — recommended' },
            { done: false, label: 'Historical aerial photography review' },
            { done: false, label: 'Sanborn fire insurance map review' },
            { done: false, label: 'State environmental database search (TCEQ, etc.)' },
            { done: false, label: 'Local underground storage tank (UST) registry check' },
            { done: false, label: 'Wetlands delineation (if applicable)' },
            { done: false, label: 'Endangered species habitat assessment' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              padding: `${spacing.xs} 0`,
            }}>
              {item.done
                ? <CheckCircle2 size={14} color="#10B981" />
                : <div style={{ width: 14, height: 14, borderRadius: borderRadius.sm, border: `1.5px solid ${colors.borderDefault}` }} />}
              <span style={{ color: item.done ? '#10B981' : colors.textSecondary }}>{item.label}</span>
            </div>
          ))}
        </div>
      </DataCard>
    </div>
  );
}

// ── Nearby Amenities Tab ──────────────────────────────────────

function NearbyTab({ data }: { data: SiteIntelligenceData }) {
  if (data.nearby.length === 0) return <EmptyState message="No nearby amenity data available. The Overpass API may be temporarily unavailable." />;

  // Group by category
  const groups = new Map<string, NearbyAmenity[]>();
  for (const a of data.nearby) {
    const cat = a.category;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(a);
  }

  return (
    <DataCard>
      <SectionTitle icon={MapPin}>Proximity Analysis (OpenStreetMap Data)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.md, marginTop: spacing.md }}>
        {data.nearby.map((a, i) => {
          const Icon = AMENITY_ICON[a.category] || MapPin;
          const aColor = AMENITY_COLOR[a.category] || colors.brand400;
          return (
            <div key={i} style={{
              padding: spacing.md, borderRadius: borderRadius.lg,
              backgroundColor: colors.surfaceInset,
              border: `1px solid ${colors.borderSubtle}`,
              display: 'flex', alignItems: 'center', gap: spacing.md,
              transition: 'border-color 0.15s',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: borderRadius.lg,
                backgroundColor: `${aColor}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={20} color={aColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium,
                  color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{a.name}</div>
                <div style={{ display: 'flex', gap: spacing.md, marginTop: 2 }}>
                  <span style={{ fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, color: aColor }}>
                    {a.distance_mi < 0.2 ? `${a.distance_ft} ft` : `${a.distance_mi} mi`}
                  </span>
                  <span style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
                    {a.distance_mi < 0.3
                      ? `${Math.round(a.distance_ft / 260)} min walk`
                      : `~${Math.max(1, Math.round(a.distance_mi * 2.5))} min drive`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
      }}>
        <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>
          DATA SOURCE: OpenStreetMap via Overpass API · Distances calculated using Haversine formula
        </div>
      </div>
    </DataCard>
  );
}

// ── Sun Exposure Tab ──────────────────────────────────────────

function SunTab({ data }: { data: SiteIntelligenceData }) {
  if (!data.sun) return <EmptyState message="Sun exposure data unavailable." />;
  const s = data.sun;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.lg }}>
      <DataCard>
        <SectionTitle icon={Sun}>Daylight Analysis</SectionTitle>
        <div style={{
          display: 'flex', alignItems: 'center', gap: spacing.lg,
          padding: spacing.lg, borderRadius: borderRadius.lg,
          backgroundColor: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.12)',
          marginBottom: spacing.md,
        }}>
          <Sun size={36} color="#F59E0B" />
          <div>
            <div style={{ fontSize: '28px', fontWeight: typography.fontWeight.bold, color: colors.textPrimary, lineHeight: 1 }}>
              {s.day_length_hours} hrs
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary }}>Today's daylight</div>
          </div>
        </div>
        <DataRow label="Sunrise" value={s.sunrise} />
        <DataRow label="Sunset" value={s.sunset} />
        <DataRow label="Summer Solstice" value={`${s.summer_solstice_hours} hrs`} />
        <DataRow label="Winter Solstice" value={`${s.winter_solstice_hours} hrs`} />
        <DataRow label="Annual Average" value={`${s.annual_avg_hours} hrs`} />
      </DataCard>

      <DataCard>
        <SectionTitle icon={Compass}>Solar Orientation</SectionTitle>
        <DataRow label="Optimal Building Orientation" value={s.optimal_orientation} />
        <div style={{
          marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md,
          backgroundColor: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.12)',
        }}>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
            For optimal passive solar gain, orient the building's long axis east-west with primary glazing facing {s.optimal_orientation.toLowerCase()}.
            Consider overhangs on south and west facades for summer shading.
            Winter solstice provides {s.winter_solstice_hours} hours of usable daylight — plan exterior work schedules accordingly.
          </div>
        </div>
        <div style={{
          marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.md,
          backgroundColor: colors.surfaceInset, border: `1px solid ${colors.borderSubtle}`,
        }}>
          <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary, marginBottom: 4 }}>
            CONSTRUCTION SCHEDULING NOTE
          </div>
          <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
            Shortest workday: {s.winter_solstice_hours} hrs (Dec 21). Longest: {s.summer_solstice_hours} hrs (Jun 21).
            Plan interior finish work for winter months when daylight hours are limited.
            Exterior concrete and masonry work best scheduled during longer daylight periods.
          </div>
        </div>
      </DataCard>
    </div>
  );
}

// ── Export Report ──────────────────────────────────────────────

function exportReport(data: SiteIntelligenceData) {
  const addr = data.address;
  const lines: string[] = [
    `SITE INTELLIGENCE REPORT`,
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    `${'═'.repeat(60)}`,
    ``,
    `ADDRESS: ${addr.display_name}`,
    `COORDINATES: ${addr.lat.toFixed(6)}, ${addr.lng.toFixed(6)}`,
    ``,
  ];

  if (data.elevation) {
    lines.push(`ELEVATION: ${data.elevation.elevation_ft.toLocaleString()} ft MSL`);
    lines.push(``);
  }

  if (data.flood) {
    lines.push(`── FLOOD ZONE ──────────────────────────────────────`);
    lines.push(`Zone: ${data.flood.zone} (${data.flood.risk_level} Risk)`);
    lines.push(`SFHA: ${data.flood.is_sfha ? 'Yes' : 'No'}`);
    lines.push(`Insurance Required: ${data.flood.insurance_required ? 'Yes' : 'No'}`);
    if (data.flood.base_flood_elevation) lines.push(`BFE: ${data.flood.base_flood_elevation} ft`);
    lines.push(`Source: FEMA NFHL`);
    lines.push(``);
  }

  if (data.soil) {
    lines.push(`── SOIL ────────────────────────────────────────────`);
    lines.push(`Soil: ${data.soil.map_unit_name} (${data.soil.map_unit_symbol})`);
    lines.push(`Drainage: ${data.soil.drainage_class}`);
    lines.push(`Hydrologic Group: ${data.soil.hydrologic_group}`);
    lines.push(`Source: USDA NRCS SSURGO`);
    lines.push(``);
  }

  if (data.weather) {
    lines.push(`── WEATHER ─────────────────────────────────────────`);
    lines.push(`Current: ${data.weather.current.temperature}°F, ${data.weather.current.conditions}`);
    lines.push(`Wind: ${data.weather.current.wind_speed} mph`);
    lines.push(`Pour Day: ${data.weather.construction.pour_day ? 'YES' : 'NO'}`);
    lines.push(`Assessment: ${data.weather.construction.summary}`);
    lines.push(``);
  }

  if (data.nearby.length > 0) {
    lines.push(`── NEARBY AMENITIES ────────────────────────────────`);
    for (const a of data.nearby) {
      lines.push(`  ${a.name} (${a.category}) — ${a.distance_mi} mi`);
    }
    lines.push(``);
  }

  if (data.epa_facilities.length > 0) {
    lines.push(`── EPA FACILITIES (3 mi radius) ────────────────────`);
    for (const f of data.epa_facilities) {
      lines.push(`  ${f.name} — ${f.street}, ${f.city} ${f.state}`);
    }
  } else {
    lines.push(`── EPA FACILITIES ──────────────────────────────────`);
    lines.push(`  No regulated facilities within 3 miles`);
  }

  lines.push(``);
  lines.push(`${'═'.repeat(60)}`);
  lines.push(`Report generated by SiteSync PM · All data from public APIs`);
  lines.push(`FEMA NFHL · USDA NRCS · OpenWeatherMap · OpenStreetMap · USGS · EPA`);

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `site-report-${addr.lat.toFixed(4)}-${addr.lng.toFixed(4)}-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────

const SiteIntelligencePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SiteIntelligenceData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('weather');
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Address Search with Debounced Autocomplete ──────────────

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await geocodeAddress(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 400);
  }, []);

  const handleSearch = useCallback(async (address?: string) => {
    const query = address || searchQuery;
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    try {
      const result = await fetchSiteIntelligence(query);
      if (!result) {
        setError('Could not find that address. Try a more specific address including city and state.');
        return;
      }
      setData(result);
      setActiveTab('weather');
    } catch (err) {
      setError('An error occurred while fetching site data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleSuggestionClick = useCallback((result: GeocodingResult) => {
    setSearchQuery(result.display_name);
    setShowSuggestions(false);
    handleSearch(result.display_name);
  }, [handleSearch]);

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Initialize & Update Leaflet Map ─────────────────────────
  // The map container div is conditionally rendered (only when data exists),
  // so we must init the map when data arrives, not on component mount.

  useEffect(() => {
    if (!data || !mapContainerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled) return;

      // Fix default marker icon issue
      delete (L.Icon.Default.prototype as typeof L.Icon.Default.prototype & { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Initialize map if not yet created
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current!, {
          center: [39.8283, -98.5795],
          zoom: 4,
          zoomControl: false,
        });

        // Satellite tiles (Esri World Imagery — free, no key needed)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Esri, Maxar, Earthstar Geographics',
          maxZoom: 19,
        }).addTo(map);

        // Labels overlay
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          opacity: 0.7,
        }).addTo(map);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          opacity: 0.8,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      const { lat, lng } = data.address;

      // Clear previous markers
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
      }
      markersLayerRef.current = L.layerGroup().addTo(map);

      // Custom orange pin icon for the site
      const siteIcon = L.divIcon({
        className: 'sitesync-site-pin',
        html: `<div style="
          width:36px;height:36px;border-radius:50% 50% 50% 0;
          background:#F47820;transform:rotate(-45deg);
          border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        "><span style="transform:rotate(45deg);font-size:16px;">📍</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
      });

      L.marker([lat, lng], { icon: siteIcon })
        .addTo(markersLayerRef.current)
        .bindPopup(`<strong>Site Location</strong><br>${data.address.display_name}`);

      // Add nearby amenities as smaller markers
      for (const amenity of data.nearby.slice(0, 8)) {
        const color = AMENITY_COLOR[amenity.category] || '#6B7280';
        const amenityIcon = L.divIcon({
          className: 'sitesync-amenity-pin',
          html: `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${color};border:2px solid #fff;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:10px;color:#fff;font-weight:bold;
          ">${amenity.category[0].toUpperCase()}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([amenity.lat, amenity.lng], { icon: amenityIcon })
          .addTo(markersLayerRef.current)
          .bindPopup(`<strong>${amenity.name}</strong><br>${amenity.category} · ${amenity.distance_mi} mi`);
      }

      // Fly to location
      map.flyTo([lat, lng], 15, { duration: 1.5 });

      // Force Leaflet to recalculate container size (critical after conditional render)
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    })();

    return () => { cancelled = true; };
  }, [data]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // ── Tab Content ─────────────────────────────────────────────

  const tabContent = useMemo(() => {
    if (!data) return null;
    switch (activeTab) {
      case 'weather': return <WeatherTab data={data} />;
      case 'flood': return <FloodTab data={data} />;
      case 'soil': return <SoilTab data={data} />;
      case 'environmental': return <EnvironmentalTab data={data} />;
      case 'nearby': return <NearbyTab data={data} />;
      case 'sun': return <SunTab data={data} />;
    }
  }, [activeTab, data]);

  // ── Risk Summary ────────────────────────────────────────────

  const riskIndicators = useMemo(() => {
    if (!data) return [];
    const items: { label: string; level: 'low' | 'medium' | 'high'; icon: React.ElementType; detail: string }[] = [];

    if (data.flood) {
      const floodLevel = data.flood.risk_level === 'High' ? 'high' : data.flood.risk_level === 'Moderate' ? 'medium' : 'low';
      items.push({ label: 'Flood Risk', level: floodLevel, icon: Droplets, detail: `Zone ${data.flood.zone}` });
    }

    if (data.soil) {
      const soilLevel = data.soil.hydrologic_group === 'D' ? 'high' : data.soil.hydrologic_group === 'C' ? 'medium' : 'low';
      items.push({ label: 'Soil Drainage', level: soilLevel, icon: Mountain, detail: `Group ${data.soil.hydrologic_group}` });
    }

    if (data.weather) {
      const weatherLevel = data.weather.construction.pour_day ? 'low' : 'high';
      items.push({ label: 'Weather', level: weatherLevel, icon: Cloud, detail: data.weather.construction.pour_day ? 'Good conditions' : 'Adverse' });
    }

    const envLevel = data.epa_facilities.length > 3 ? 'high' : data.epa_facilities.length > 0 ? 'medium' : 'low';
    items.push({ label: 'Environmental', level: envLevel, icon: TreePine, detail: `${data.epa_facilities.length} EPA facilities nearby` });

    return items;
  }, [data]);

  const riskColor = { low: '#10B981', medium: '#F59E0B', high: '#EF4444' };
  const riskBg = { low: 'rgba(16,185,129,0.12)', medium: 'rgba(245,158,11,0.12)', high: 'rgba(239,68,68,0.12)' };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{
      padding: spacing['5'], height: '100%',
      display: 'flex', flexDirection: 'column', gap: spacing.lg,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{
            fontSize: typography.fontSize.large,
            fontWeight: typography.fontWeight.bold,
            color: colors.textPrimary, margin: 0,
          }}>
            Site Intelligence
          </h1>
          <p style={{
            fontSize: typography.fontSize.sm, color: colors.textSecondary,
            margin: `${spacing.xs} 0 0`,
          }}>
            Real-time site analysis from FEMA, USDA, NOAA, EPA, and USGS
          </p>
        </div>
        {data && (
          <button
            onClick={() => exportReport(data)}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.lg}`, borderRadius: borderRadius.lg,
              backgroundColor: colors.primaryOrange, color: colors.white,
              border: 'none', cursor: 'pointer', fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            <Download size={14} />
            Export Report
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative' }} ref={suggestionsRef}>
        <div style={{
          display: 'flex', gap: spacing.sm,
          backgroundColor: colors.surfaceRaised,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.borderSubtle}`,
          padding: spacing.xs,
          boxShadow: shadows.card,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: spacing.sm,
            flex: 1, padding: `0 ${spacing.md}`,
          }}>
            <Search size={18} color={colors.textTertiary} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter a job site address — e.g. 1200 Construction Ave, Austin, TX 78701"
              style={{
                flex: 1, border: 'none', outline: 'none',
                backgroundColor: 'transparent',
                fontSize: typography.fontSize.body,
                color: colors.textPrimary,
                fontFamily: typography.fontFamily,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <X size={14} color={colors.textTertiary} />
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !searchQuery.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.xl}`,
              borderRadius: borderRadius.md,
              backgroundColor: loading ? colors.surfaceInset : colors.primaryOrange,
              color: colors.white, border: 'none', cursor: loading ? 'default' : 'pointer',
              fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold,
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Crosshair size={14} />}
            {loading ? 'Analyzing...' : 'Analyze Site'}
          </button>
        </div>

        {/* Autocomplete Suggestions */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                marginTop: spacing.xs,
                backgroundColor: colors.surfaceRaised,
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.borderSubtle}`,
                boxShadow: shadows.dropdown,
                zIndex: 50, overflow: 'hidden',
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing.md,
                    width: '100%', padding: `${spacing.md} ${spacing.lg}`,
                    border: 'none', borderBottom: `1px solid ${colors.borderSubtle}`,
                    backgroundColor: 'transparent', cursor: 'pointer',
                    textAlign: 'left', fontSize: typography.fontSize.sm,
                    color: colors.textPrimary, transition: 'background-color 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.surfaceHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <MapPin size={14} color={colors.brand400} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.display_name}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          padding: spacing.lg, borderRadius: borderRadius.lg,
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: spacing.md,
        }}>
          <AlertTriangle size={18} color="#EF4444" />
          <span style={{ fontSize: typography.fontSize.sm, color: '#EF4444' }}>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: spacing['16'],
          gap: spacing.lg,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: `3px solid ${colors.borderSubtle}`,
            borderTopColor: colors.brand400,
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary }}>
              Analyzing Site
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textTertiary, marginTop: 4 }}>
              Querying FEMA, USDA, NOAA, EPA, USGS, and OpenStreetMap...
            </div>
          </div>
        </div>
      )}

      {/* Empty State — Before First Search */}
      {!data && !loading && !error && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: spacing['16'], gap: spacing.lg,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            backgroundColor: colors.orangeSubtle,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Globe size={36} color={colors.brand400} />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <div style={{ fontSize: typography.fontSize.medium, fontWeight: typography.fontWeight.bold, color: colors.textPrimary }}>
              Enter a Job Site Address
            </div>
            <div style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 1.6 }}>
              Get instant due diligence data: FEMA flood zones, USDA soil classification, real-time weather with concrete pour assessment, nearby amenities, EPA environmental data, and elevation — all from authoritative government sources.
            </div>
          </div>
        </div>
      )}

      {/* Main Content — After Search */}
      {data && !loading && (
        <>
          {/* Map + Summary Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: spacing.lg, minHeight: 420 }}>
            {/* Map */}
            <div
              ref={mapContainerRef}
              style={{
                borderRadius: borderRadius.lg,
                overflow: 'hidden',
                border: `1px solid ${colors.borderSubtle}`,
                minHeight: 420,
                backgroundColor: '#1a2332',
              }}
            />

            {/* Right Panel — Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
              {/* Site Summary Card */}
              <DataCard>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: borderRadius.lg,
                    backgroundColor: colors.orangeSubtle,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MapPin size={18} color={colors.brand400} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: typography.fontSize.title, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, margin: 0 }}>
                      Site Summary
                    </h2>
                    <p style={{
                      fontSize: typography.fontSize.caption, color: colors.textTertiary, margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {data.address.display_name}
                    </p>
                  </div>
                </div>
                <DataRow label="Latitude" value={data.address.lat.toFixed(6)} mono />
                <DataRow label="Longitude" value={data.address.lng.toFixed(6)} mono />
                {data.elevation && (
                  <DataRow label="Elevation" value={`${data.elevation.elevation_ft.toLocaleString()} ft MSL`} mono />
                )}
                {data.address.address.county && (
                  <DataRow label="County" value={data.address.address.county} />
                )}
                {data.address.address.state && (
                  <DataRow label="State" value={data.address.address.state} />
                )}
              </DataCard>

              {/* Risk Indicators */}
              <DataCard>
                <div style={{ fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm }}>
                  Risk Assessment
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {riskIndicators.map((r) => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                        <r.icon size={14} color={riskColor[r.level]} />
                        <span style={{ fontSize: typography.fontSize.sm, color: colors.textSecondary }}>{r.label}</span>
                      </div>
                      <Badge label={r.detail} color={riskColor[r.level]} bg={riskBg[r.level]} />
                    </div>
                  ))}
                </div>
              </DataCard>

              {/* Quick Stats */}
              <DataCard>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                  {[
                    { label: 'Flood Zone', value: data.flood?.zone || '—', color: data.flood?.risk_level === 'High' ? '#EF4444' : '#10B981' },
                    { label: 'Soil Group', value: data.soil?.hydrologic_group || '—', color: '#3B82F6' },
                    { label: 'Temp', value: data.weather ? `${data.weather.current.temperature}°F` : '—', color: '#F59E0B' },
                    { label: 'Wind', value: data.weather ? `${data.weather.current.wind_speed} mph` : '—', color: '#8B5CF6' },
                  ].map((s) => (
                    <div key={s.label} style={{
                      padding: spacing.sm, borderRadius: borderRadius.md,
                      backgroundColor: colors.surfaceInset, textAlign: 'center',
                    }}>
                      <div style={{ fontSize: typography.fontSize.medium, fontWeight: typography.fontWeight.bold, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: typography.fontSize.caption, color: colors.textTertiary }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </DataCard>

              {/* Data freshness */}
              <div style={{
                fontSize: typography.fontSize.caption, color: colors.textTertiary,
                textAlign: 'center', padding: `${spacing.xs} 0`,
              }}>
                Data fetched {new Date(data.fetched_at).toLocaleTimeString()} · All sources live
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div style={{
            display: 'flex', gap: 2,
            borderBottom: `2px solid ${colors.borderSubtle}`,
            overflowX: 'auto',
          }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing.xs,
                    padding: `${spacing.sm} ${spacing.lg}`,
                    backgroundColor: 'transparent',
                    color: isActive ? colors.brand400 : colors.textSecondary,
                    borderBottom: `2px solid ${isActive ? colors.brand400 : 'transparent'}`,
                    border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
                    borderBottomColor: isActive ? colors.brand400 : 'transparent',
                    cursor: 'pointer', fontSize: typography.fontSize.sm,
                    fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
                    whiteSpace: 'nowrap', transition: 'all 0.15s ease',
                    marginBottom: -2,
                  }}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ paddingBottom: spacing.xl }}
          >
            {tabContent}
          </motion.div>
        </>
      )}

      {/* Global spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default SiteIntelligencePage;
