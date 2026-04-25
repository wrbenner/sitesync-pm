// ── Site Intelligence Types ──────────────────────────────────
// Construction site analysis, location intelligence, and
// environmental/geotechnical data for pre-construction due diligence.

// ── Flood Zone ───────────────────────────────────────────────

export type FloodZoneCode =
  | 'A'
  | 'AE'
  | 'AH'
  | 'AO'
  | 'AR'
  | 'A99'
  | 'VE'
  | 'V'
  | 'X'
  | 'D'

export type FloodRiskLevel = 'high' | 'moderate' | 'low' | 'minimal'

export interface FloodZoneData {
  zone_code: FloodZoneCode
  flood_risk_level: FloodRiskLevel
  base_flood_elevation: number | null
  floodway: boolean
  panel_number: string | null
  effective_date: string | null
  insurance_required: boolean
  special_flood_hazard_area: boolean
}

// ── Zoning ───────────────────────────────────────────────────

export interface ZoningSetbacks {
  front: number
  rear: number
  left_side: number
  right_side: number
}

export interface ZoningInfo {
  designation: string
  description: string
  allowed_uses: string[]
  conditional_uses: string[]
  max_height_ft: number | null
  max_lot_coverage_pct: number | null
  min_setbacks: ZoningSetbacks
  max_far: number | null
  min_parking_spaces: number | null
  overlay_districts: string[]
}

// ── Soil ─────────────────────────────────────────────────────

export type DrainageClass =
  | 'well'
  | 'moderately_well'
  | 'somewhat_poorly'
  | 'poorly'

export type HydrologicGroup = 'A' | 'B' | 'C' | 'D'

export type ShrinkSwellPotential = 'low' | 'moderate' | 'high'

export interface SoilData {
  soil_type: string
  soil_series: string
  drainage_class: DrainageClass
  hydrologic_group: HydrologicGroup
  bearing_capacity_psf: number | null
  frost_depth_inches: number | null
  shrink_swell_potential: ShrinkSwellPotential
  bedrock_depth_ft: number | null
  permeability: string
}

// ── Environmental ────────────────────────────────────────────

export interface EnvironmentalData {
  phase1_completed: boolean
  phase2_completed: boolean
  brownfield_status: string | null
  wetlands_present: boolean
  wetland_acreage: number | null
  endangered_species: string[]
  contamination_history: string | null
  remediation_status: string | null
  epa_id: string | null
  cerclis_status: string | null
  rcra_status: string | null
  ust_count: number
  air_quality_index: number | null
}

// ── Topography ───────────────────────────────────────────────

export type GradingDifficulty = 'easy' | 'moderate' | 'difficult' | 'extreme'

export interface TopographyData {
  min_elevation_ft: number
  max_elevation_ft: number
  avg_slope_pct: number
  slope_direction: string
  cut_fill_estimate_cy: number | null
  grading_difficulty: GradingDifficulty
  terrain_type: string
}

// ── Utilities ────────────────────────────────────────────────

export type UtilityType =
  | 'water'
  | 'sewer'
  | 'electric'
  | 'gas'
  | 'telecom'
  | 'fiber'
  | 'stormwater'

export interface UtilityAccess {
  utility_type: UtilityType
  provider: string
  distance_to_connection_ft: number | null
  capacity_available: boolean
  connection_fee_estimate: number | null
  is_available: boolean
  notes: string | null
}

// ── Traffic ──────────────────────────────────────────────────

export type LevelOfService = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

export interface TrafficData {
  avg_daily_traffic: number | null
  peak_hour_volume: number | null
  level_of_service: LevelOfService
  nearest_highway: string | null
  highway_distance_mi: number | null
  access_points: number
  traffic_study_required: boolean
}

// ── Permit History ───────────────────────────────────────────

export interface PermitHistory {
  permit_type: string
  permit_number: string
  issue_date: string
  status: string
  description: string | null
  contractor: string | null
  valuation: number | null
}

// ── Sun Exposure ─────────────────────────────────────────────

export interface SunExposure {
  summer_solstice_hours: number
  winter_solstice_hours: number
  annual_avg_hours: number
  optimal_solar_orientation: string | null
  shadow_analysis_notes: string | null
}

// ── Nearby Amenities ─────────────────────────────────────────

export type AmenityType =
  | 'school'
  | 'hospital'
  | 'fire_station'
  | 'police'
  | 'transit'
  | 'grocery'
  | 'park'
  | 'airport'

export interface NearbyAmenities {
  type: AmenityType
  name: string
  distance_mi: number
  drive_time_min: number | null
}

// ── Climate ──────────────────────────────────────────────────

export interface ClimateData {
  avg_annual_temp_f: number
  avg_annual_precip_in: number
  freeze_thaw_cycles: number
  wind_speed_avg_mph: number
  prevailing_wind_direction: string
  seismic_zone: string
  design_wind_speed_mph: number
  snow_load_psf: number
  frost_line_depth_in: number
}

// ── Site Profile ─────────────────────────────────────────────

export interface SiteProfile {
  id: string
  project_id: string
  address: string
  lat: number
  lng: number
  parcel_id: string | null
  acreage: number | null
  zoning_designation: string | null
  zoning_description: string | null
  jurisdiction: string | null
  county: string | null
  state: string | null
}

// ── Site Intelligence Report ─────────────────────────────────

export interface SiteIntelligenceReport {
  id: string
  project_id: string
  site_profile: SiteProfile
  flood_data: FloodZoneData | null
  zoning: ZoningInfo | null
  soil: SoilData | null
  environmental: EnvironmentalData | null
  topography: TopographyData | null
  utilities: UtilityAccess[]
  traffic: TrafficData | null
  permit_history: PermitHistory[]
  sun_exposure: SunExposure | null
  nearby: NearbyAmenities[]
  climate: ClimateData | null
  satellite_imagery_url: string | null
  aerial_imagery_date: string | null
  created_at: string
  updated_at: string
}

// ── Map Layer ────────────────────────────────────────────────

export type MapLayerType =
  | 'satellite'
  | 'flood'
  | 'zoning'
  | 'soil'
  | 'topo'
  | 'environmental'
  | 'utilities'
  | 'traffic'
  | 'parcel'

export interface MapLayer {
  id: string
  name: string
  type: MapLayerType
  visible: boolean
  opacity: number
  source_url: string | null
}
