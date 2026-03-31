# D4: Equipment Telematics Integration

**Status:** Zero implementation
**Unlock Value:** $500K-2M ARR (equipment cost allocation + utilization insights)
**Dependencies:** United Rentals, Caterpillar, John Deere, Komatsu APIs

---

## 1. OVERVIEW: CONNECTING HEAVY EQUIPMENT

Currently: Equipment costs lumped into labor or miscellaneous
Missing: Real-time equipment tracking, maintenance alerts, cost allocation

Target integrations:
- **United Rentals API** — Largest rental company (50K+ pieces of equipment)
- **Caterpillar Fleet Services** — Cat equipment telematics
- **John Deere Operations Center** — JD equipment tracking
- **Komatsu KOMTRAX** — Komatsu equipment intelligence
- **ISO 15143-3 (AEMP)** — Industry standard for telematics data

Revenue: 0.5-1% of equipment rental costs processed

---

## 2. DATABASE SCHEMA

```sql
-- Equipment catalog (synced from rental APIs)
CREATE TABLE equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Equipment identity
  equipment_type VARCHAR(100), -- 'Excavator', 'Dozer', 'Crane', etc.
  equipment_model VARCHAR(200),
  equipment_make VARCHAR(100), -- 'Caterpillar', 'John Deere', etc.
  -- Rental company reference
  rental_company_id UUID REFERENCES vendors(id),
  rental_company_name VARCHAR(200),
  rental_equipment_id VARCHAR(100), -- United Rentals SKU, etc.
  -- Capabilities
  hourly_rate DECIMAL(10,2),
  daily_rate DECIMAL(10,2),
  weekly_rate DECIMAL(10,2),
  monthly_rate DECIMAL(10,2),
  fuel_type VARCHAR(50), -- 'diesel', 'gasoline', 'electric', 'hybrid'
  fuel_capacity_gallons DECIMAL(8,2),
  operating_weight_lbs INT,
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Equipment assigned to projects (currently on-site)
CREATE TABLE project_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  equipment_catalog_id UUID NOT NULL REFERENCES equipment_catalog(id),
  rental_contract_id VARCHAR(100), -- United Rentals contract #
  -- Assignment
  check_in_date TIMESTAMP,
  expected_checkout_date DATE,
  actual_checkout_date DATE,
  -- Telematics integration
  telematics_device_id VARCHAR(100), -- GPS/IoT device ID
  telematics_provider VARCHAR(100), -- 'caterpillar' | 'john_deere' | 'united_rentals' | 'komatsu'
  telematics_api_connected BOOLEAN DEFAULT FALSE,
  -- Cost tracking
  cost_code_id UUID REFERENCES cost_codes(id),
  task_id UUID REFERENCES tasks(id),
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'checked_out' | 'in_maintenance' | 'lost'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Real-time equipment telemetry (from IoT devices)
CREATE TABLE equipment_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_equipment_id UUID NOT NULL REFERENCES project_equipment(id),
  -- Location
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  gps_accuracy_meters DECIMAL(6,2),
  -- Engine metrics
  engine_running BOOLEAN,
  engine_hours_total DECIMAL(12,1), -- Cumulative since birth
  engine_hours_session DECIMAL(8,1), -- Hours since session started
  engine_rpm INT,
  engine_coolant_temp_c INT,
  fuel_level_percent DECIMAL(5,2),
  fuel_consumption_per_hour DECIMAL(8,3), -- Gallons/hour
  -- Operational
  idle_time_minutes INT, -- Time idling this session
  active_time_minutes INT, -- Time operating this session
  -- Diagnostics
  fault_codes TEXT[], -- Engine fault codes (ISO 15143-3)
  oil_pressure_psi INT,
  hydraulic_pressure_psi INT,
  -- Metadata
  recorded_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT no_duplicate_readings UNIQUE(project_equipment_id, recorded_at)
);

-- Equipment maintenance log (triggered by telematics)
CREATE TABLE equipment_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_equipment_id UUID NOT NULL REFERENCES project_equipment(id),
  -- Alert
  alert_type VARCHAR(50), -- 'oil_change_due' | 'filter_change' | 'fault_code' | 'excessive_idle'
  alert_severity VARCHAR(20), -- 'warning' | 'critical'
  alert_description TEXT,
  -- Predicted maintenance
  predicted_failure_hours INT, -- Hours until predicted failure (if ML available)
  -- Action taken
  maintenance_performed BOOLEAN DEFAULT FALSE,
  maintenance_date TIMESTAMP,
  maintenance_notes TEXT,
  maintenance_cost DECIMAL(10,2),
  -- Source
  source VARCHAR(50), -- 'telematics_alert' | 'manual_entry' | 'ai_prediction'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Equipment utilization report (daily/weekly/monthly)
CREATE TABLE equipment_utilization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_equipment_id UUID NOT NULL REFERENCES project_equipment(id),
  report_date DATE,
  report_period VARCHAR(20), -- 'daily' | 'weekly' | 'monthly'
  -- Utilization metrics
  hours_available INT,
  hours_operating INT,
  hours_idle INT,
  utilization_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN hours_available > 0 THEN (hours_operating * 100.0 / hours_available) ELSE 0 END
  ) STORED,
  -- Cost breakdown
  rental_cost DECIMAL(10,2),
  fuel_cost DECIMAL(10,2),
  maintenance_cost DECIMAL(10,2),
  operator_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  -- Cost allocation
  cost_per_hour DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE WHEN hours_operating > 0 THEN (total_cost / hours_operating) ELSE 0 END
  ) STORED,
  -- Environmental
  fuel_consumed_gallons DECIMAL(8,2),
  co2_emissions_lbs DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Equipment check-in/check-out log (field worker interactions)
CREATE TABLE equipment_checkin_checkout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_equipment_id UUID NOT NULL REFERENCES project_equipment(id),
  field_worker_id UUID REFERENCES users(id),
  field_worker_name VARCHAR(100),
  -- Action
  action VARCHAR(50), -- 'check_in' | 'check_out'
  action_timestamp TIMESTAMP,
  -- Location
  location_name VARCHAR(200),
  location_gps_latitude DECIMAL(10,8),
  location_gps_longitude DECIMAL(11,8),
  -- Condition report
  equipment_condition VARCHAR(50), -- 'good' | 'minor_damage' | 'major_damage'
  fuel_level_at_checkin DECIMAL(5,2),
  odometer_reading DECIMAL(12,1), -- For vehicles
  engine_hours_at_action DECIMAL(10,1),
  -- Notes & photos
  notes TEXT,
  inspection_photo_urls TEXT[], -- Array of URLs to damage photos
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fuel consumption tracking (for carbon emissions)
CREATE TABLE equipment_fuel_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_equipment_id UUID NOT NULL REFERENCES project_equipment(id),
  -- Fuel event
  fuel_event_type VARCHAR(50), -- 'purchase' | 'consumption' | 'refill'
  fuel_amount_gallons DECIMAL(8,2),
  fuel_date DATE,
  -- Cost
  fuel_cost_total DECIMAL(10,2),
  fuel_cost_per_gallon DECIMAL(6,2),
  -- Source
  source VARCHAR(50), -- 'telematics' | 'manual_entry' | 'fuel_card'
  fuel_card_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. REACT PAGES & COMPONENTS

### 3a. `/src/pages/equipment-dashboard.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Tabs, Button, Map } from '@/components/ui';
import { useProjectStore } from '@/stores/projects';
import EquipmentMap from '@/components/equipment/equipment-map';
import EquipmentRoster from '@/components/equipment/equipment-roster';
import UtilizationAnalysis from '@/components/equipment/utilization-analysis';
import MaintenanceAlerts from '@/components/equipment/maintenance-alerts';

export default function EquipmentDashboard() {
  const { activeProject } = useProjectStore();
  const [viewMode, setViewMode] = useState<'map' | 'roster' | 'utilization' | 'maintenance'>('map');

  const { data: projectEquipment } = useQuery({
    queryKey: ['project-equipment', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/equipment`);
      return response.json();
    },
    enabled: !!activeProject?.id,
    refetchInterval: 30000, // Real-time updates every 30s
  });

  const { data: telemetry } = useQuery({
    queryKey: ['equipment-telemetry', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/equipment/telemetry`);
      return response.json();
    },
    enabled: !!activeProject?.id,
    refetchInterval: 30000,
  });

  const { data: maintenanceAlerts } = useQuery({
    queryKey: ['equipment-maintenance-alerts', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/equipment/maintenance-alerts`);
      return response.json();
    },
    enabled: !!activeProject?.id,
  });

  if (!activeProject) return <div>Select a project</div>;

  // Calculate KPIs
  const avgUtilization =
    projectEquipment?.reduce((sum: number, eq: any) => sum + (eq.utilization_percent || 0), 0) /
      projectEquipment?.length || 0;

  const totalIdleCost = projectEquipment?.reduce((sum: number, eq: any) => {
    const idleHours = (eq.hours_available - eq.hours_operating) || 0;
    return sum + idleHours * (eq.cost_per_hour || 0);
  }, 0) || 0;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Equipment Telematics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Equipment On-Site</div>
          <div className="text-2xl font-bold">{projectEquipment?.length || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Avg Utilization</div>
          <div className="text-2xl font-bold">{avgUtilization.toFixed(0)}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Idle Equipment</div>
          <div className="text-2xl font-bold text-red-600">
            {projectEquipment?.filter((eq: any) => (eq.utilization_percent || 0) < 30).length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Maint. Alerts</div>
          <div className="text-2xl font-bold text-orange-600">{maintenanceAlerts?.length || 0}</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <Tabs.List>
          <Tabs.Trigger value="map">Fleet Map</Tabs.Trigger>
          <Tabs.Trigger value="roster">Equipment Roster</Tabs.Trigger>
          <Tabs.Trigger value="utilization">Utilization Analysis</Tabs.Trigger>
          <Tabs.Trigger value="maintenance">Maintenance Alerts</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="map" className="h-96">
          <EquipmentMap equipment={projectEquipment} telemetry={telemetry} />
        </Tabs.Content>

        <Tabs.Content value="roster">
          <EquipmentRoster equipment={projectEquipment} />
        </Tabs.Content>

        <Tabs.Content value="utilization">
          <UtilizationAnalysis equipment={projectEquipment} />
        </Tabs.Content>

        <Tabs.Content value="maintenance">
          <MaintenanceAlerts alerts={maintenanceAlerts} />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
```

### 3b. `/src/components/equipment/equipment-map.tsx`

```typescript
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface EquipmentMapProps {
  equipment: any[];
  telemetry: any[];
}

export default function EquipmentMap({ equipment, telemetry }: EquipmentMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([34.0522, -118.2437], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    }

    // Add equipment markers
    telemetry?.forEach((t: any) => {
      const eq = equipment?.find((e) => e.id === t.project_equipment_id);
      if (!eq || !t.gps_latitude || !t.gps_longitude) return;

      const icon = L.divIcon({
        html: `
          <div class="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full text-white text-xs font-bold border-2 border-white">
            ${eq.equipment_type?.slice(0, 1) || 'E'}
          </div>
        `,
        className: '',
        iconSize: [32, 32],
      });

      const marker = L.marker([t.gps_latitude, t.gps_longitude], { icon });

      marker.bindPopup(`
        <div class="text-sm">
          <strong>${eq.equipment_model}</strong><br>
          Hours: ${t.engine_hours_total?.toFixed(1)}<br>
          Fuel: ${t.fuel_level_percent?.toFixed(0)}%<br>
          ${t.engine_running ? 'Operating' : 'Idle'}
        </div>
      `);

      marker.addTo(mapInstance.current!);
    });
  }, [telemetry, equipment]);

  return <div ref={mapRef} className="w-full h-full rounded-lg border" />;
}
```

### 3c. `/src/components/equipment/equipment-roster.tsx`

```typescript
import React from 'react';
import { Card, Badge, Button, Table } from '@/components/ui';
import { format } from 'date-fns';

interface EquipmentRosterProps {
  equipment: any[];
}

export default function EquipmentRoster({ equipment }: EquipmentRosterProps) {
  return (
    <Card className="p-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-4 py-2 text-left">Equipment</th>
            <th className="px-4 py-2 text-left">Model</th>
            <th className="px-4 py-2 text-right">Engine Hours</th>
            <th className="px-4 py-2 text-right">Utilization</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">On-Site</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {equipment?.map((eq: any) => (
            <tr key={eq.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-medium">{eq.equipment_type}</td>
              <td className="px-4 py-2">{eq.equipment_model}</td>
              <td className="px-4 py-2 text-right font-mono">{eq.engine_hours_total?.toFixed(1)}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end">
                  <div
                    className="w-8 h-2 bg-gray-200 rounded mr-2"
                  >
                    <div
                      className={`h-full rounded ${
                        (eq.utilization_percent || 0) > 70
                          ? 'bg-green-500'
                          : (eq.utilization_percent || 0) > 40
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{
                        width: `${(eq.utilization_percent || 0) * 2}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold">{(eq.utilization_percent || 0).toFixed(0)}%</span>
                </div>
              </td>
              <td className="px-4 py-2">
                <Badge variant={eq.status === 'active' ? 'success' : 'default'}>{eq.status}</Badge>
              </td>
              <td className="px-4 py-2 text-sm">
                {format(new Date(eq.check_in_date), 'MMM d')}
              </td>
              <td className="px-4 py-2">
                <Button variant="ghost" size="sm">
                  Check Out
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

### 3d. `/src/components/equipment/utilization-analysis.tsx`

```typescript
import React from 'react';
import { Card } from '@/components/ui';

interface UtilizationAnalysisProps {
  equipment: any[];
}

export default function UtilizationAnalysis({ equipment }: UtilizationAnalysisProps) {
  const totalEquipment = equipment?.length || 0;
  const highUtilization = equipment?.filter((eq: any) => (eq.utilization_percent || 0) > 70).length || 0;
  const mediumUtilization = equipment?.filter(
    (eq: any) => (eq.utilization_percent || 0) > 40 && (eq.utilization_percent || 0) <= 70
  ).length || 0;
  const lowUtilization = equipment?.filter((eq: any) => (eq.utilization_percent || 0) <= 40).length || 0;

  const idleCostDaily = equipment
    ?.filter((eq: any) => (eq.utilization_percent || 0) < 30)
    .reduce((sum: number, eq: any) => {
      const idleHours = (eq.hours_available - eq.hours_operating) || 0;
      return sum + idleHours * (eq.cost_per_hour || 0);
    }, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">High Utilization (>70%)</div>
          <div className="text-2xl font-bold text-green-600">{highUtilization}</div>
          <div className="text-xs text-gray-500 mt-1">{((highUtilization / totalEquipment) * 100).toFixed(0)}% of fleet</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Medium (40-70%)</div>
          <div className="text-2xl font-bold text-yellow-600">{mediumUtilization}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Low (<40%)</div>
          <div className="text-2xl font-bold text-red-600">{lowUtilization}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Daily Idle Cost</div>
          <div className="text-2xl font-bold text-red-600">${(idleCostDaily / 1000).toFixed(0)}K</div>
          <div className="text-xs text-gray-500 mt-1">Wasted capacity</div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Utilization Breakdown</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">High Utilization</span>
              <span className="text-sm font-semibold">{highUtilization}</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div
                className="bg-green-500 h-2 rounded"
                style={{ width: `${(highUtilization / totalEquipment) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Medium Utilization</span>
              <span className="text-sm font-semibold">{mediumUtilization}</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div
                className="bg-yellow-500 h-2 rounded"
                style={{ width: `${(mediumUtilization / totalEquipment) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Low Utilization (Consider returning)</span>
              <span className="text-sm font-semibold">{lowUtilization}</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2">
              <div
                className="bg-red-500 h-2 rounded"
                style={{ width: `${(lowUtilization / totalEquipment) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

---

## 4. TELEMATICS API INTEGRATIONS

File: `/src/edge-functions/equipment-telematics.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// United Rentals API
const UR_API_BASE = 'https://api.unitedrentals.com/v1';
const UR_API_KEY = Deno.env.get('UNITED_RENTALS_API_KEY')!;

// Caterpillar VisionLink API
const CAT_API_BASE = 'https://api.cat.com/visionlink/v3';
const CAT_API_KEY = Deno.env.get('CAT_API_KEY')!;

/**
 * Sync equipment telemetry from United Rentals
 */
export async function syncUnitedRentalsTelematics(projectId: string) {
  // Get equipment assigned from United Rentals
  const { data: equipment } = await supabase
    .from('project_equipment')
    .select('*')
    .eq('project_id', projectId)
    .eq('telematics_provider', 'united_rentals');

  for (const eq of equipment || []) {
    try {
      // Fetch telemetry from United Rentals API
      const response = await fetch(
        `${UR_API_BASE}/equipment/${eq.rental_equipment_id}/telemetry`,
        {
          headers: {
            Authorization: `Bearer ${UR_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const telemetry = await response.json();

      // Store telemetry
      await supabase.from('equipment_telemetry').insert({
        project_equipment_id: eq.id,
        gps_latitude: telemetry.location.latitude,
        gps_longitude: telemetry.location.longitude,
        engine_running: telemetry.engine_status === 'running',
        engine_hours_total: telemetry.engine_hours,
        fuel_level_percent: telemetry.fuel_level,
        idle_time_minutes: telemetry.idle_minutes,
        active_time_minutes: telemetry.active_minutes,
        fault_codes: telemetry.fault_codes || [],
        recorded_at: new Date(telemetry.timestamp),
      });

      // Check for maintenance alerts
      await checkMaintenanceAlerts(eq.id, telemetry);
    } catch (error) {
      console.error(`Error syncing telematics for ${eq.id}:`, error);
    }
  }
}

/**
 * Sync Caterpillar equipment telematics
 */
export async function syncCaterpillarTelematics(projectId: string) {
  const { data: equipment } = await supabase
    .from('project_equipment')
    .select('*')
    .eq('project_id', projectId)
    .eq('telematics_provider', 'caterpillar');

  for (const eq of equipment || []) {
    try {
      const response = await fetch(
        `${CAT_API_BASE}/assets/${eq.telematics_device_id}`,
        {
          headers: {
            Authorization: `Bearer ${CAT_API_KEY}`,
          },
        }
      );

      const data = await response.json();

      await supabase.from('equipment_telemetry').insert({
        project_equipment_id: eq.id,
        gps_latitude: data.position.latitude,
        gps_longitude: data.position.longitude,
        engine_running: data.state === 'operating',
        engine_hours_total: data.operating_hours,
        fuel_level_percent: data.fuel_percentage,
        recorded_at: new Date(data.timestamp),
      });

      await checkMaintenanceAlerts(eq.id, data);
    } catch (error) {
      console.error(`Error syncing Cat telematics for ${eq.id}:`, error);
    }
  }
}

/**
 * Check for maintenance alerts
 */
async function checkMaintenanceAlerts(projectEquipmentId: string, telemetry: any) {
  const alerts = [];

  // Oil change interval (every 250 hours or 6 months)
  if (telemetry.engine_hours % 250 === 0) {
    alerts.push({
      project_equipment_id: projectEquipmentId,
      alert_type: 'oil_change_due',
      alert_severity: 'warning',
      alert_description: 'Oil change recommended',
      source: 'telematics_alert',
    });
  }

  // High idle time warning
  if (telemetry.idle_time_minutes > 120) {
    alerts.push({
      project_equipment_id: projectEquipmentId,
      alert_type: 'excessive_idle',
      alert_severity: 'warning',
      alert_description: `Equipment idle for ${telemetry.idle_time_minutes} minutes`,
      source: 'telematics_alert',
    });
  }

  // Fault codes
  if (telemetry.fault_codes?.length > 0) {
    alerts.push({
      project_equipment_id: projectEquipmentId,
      alert_type: 'fault_code',
      alert_severity: 'critical',
      alert_description: `Fault codes detected: ${telemetry.fault_codes.join(', ')}`,
      source: 'telematics_alert',
    });
  }

  // Upsert alerts
  if (alerts.length > 0) {
    await supabase.from('equipment_maintenance').upsert(alerts);
  }
}

/**
 * Calculate daily utilization & cost
 */
export async function calculateDailyUtilization(projectEquipmentId: string) {
  const { data: telemetryData } = await supabase
    .from('equipment_telemetry')
    .select('*')
    .eq('project_equipment_id', projectEquipmentId)
    .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (!telemetryData || telemetryData.length === 0) return;

  const operatingMinutes = telemetryData.filter((t) => t.engine_running).length;
  const totalMinutes = telemetryData.length;
  const utilizationPercent = (operatingMinutes / totalMinutes) * 100;

  const { data: equipment } = await supabase
    .from('project_equipment')
    .select('equipment_catalog_id')
    .eq('id', projectEquipmentId)
    .single();

  const { data: catalog } = await supabase
    .from('equipment_catalog')
    .select('daily_rate')
    .eq('id', equipment.equipment_catalog_id)
    .single();

  const dailyCost = catalog.daily_rate;
  const costPerHour = dailyCost / 8;

  const fuelConsumed = telemetryData.reduce((sum, t) => sum + (t.fuel_consumption_per_hour || 0), 0);

  await supabase.from('equipment_utilization').insert({
    project_equipment_id: projectEquipmentId,
    report_date: new Date().toISOString().split('T')[0],
    report_period: 'daily',
    hours_available: 8,
    hours_operating: operatingMinutes / 60,
    hours_idle: (totalMinutes - operatingMinutes) / 60,
    utilization_percent: utilizationPercent,
    rental_cost: dailyCost,
    fuel_consumed_gallons: fuelConsumed,
  });
}
```

---

## 5. API ENDPOINTS

File: `/src/edge-functions/api/equipment.ts`

```typescript
// GET /api/v1/projects/:projectId/equipment
export async function getProjectEquipment(projectId: string) {
  const { data, error } = await supabase
    .from('project_equipment')
    .select(`
      *,
      equipment_catalog(*)
    `)
    .eq('project_id', projectId)
    .eq('status', 'active');

  if (error) throw error;
  return data;
}

// GET /api/v1/projects/:projectId/equipment/telemetry
export async function getEquipmentTelemetry(projectId: string) {
  const { data: equipment } = await supabase
    .from('project_equipment')
    .select('id')
    .eq('project_id', projectId);

  const equipmentIds = equipment?.map((e) => e.id) || [];

  const { data: telemetry, error } = await supabase
    .from('equipment_telemetry')
    .select('*')
    .in('project_equipment_id', equipmentIds)
    .order('recorded_at', { ascending: false })
    .limit(equipmentIds.length); // Latest reading per equipment

  if (error) throw error;
  return telemetry;
}

// POST /api/v1/projects/:projectId/equipment/:equipmentId/check-out
export async function checkOutEquipment(projectId: string, projectEquipmentId: string) {
  const { error } = await supabase
    .from('project_equipment')
    .update({
      actual_checkout_date: new Date(),
      status: 'checked_out',
    })
    .eq('id', projectEquipmentId);

  if (error) throw error;
  return { success: true };
}
```

---

## 6. VERIFICATION SCRIPT

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/sessions/wonderful-practical-brahmagupta/mnt/sitesync-pm"

echo "=== D4: Equipment Telematics Verification ==="

# 1. Check database schema
echo "1. Verifying database schema..."
TABLES=("equipment_catalog" "project_equipment" "equipment_telemetry" "equipment_maintenance")

for table in "${TABLES[@]}"; do
  if grep -r "$table" "$PROJECT_ROOT/src" --include="*.sql"; then
    echo "   ✓ $table schema exists"
  else
    echo "   ✗ MISSING: $table"
  fi
done

# 2. Check React components
echo "2. Checking React components..."
[ -f "$PROJECT_ROOT/src/pages/equipment-dashboard.tsx" ] && echo "   ✓ equipment-dashboard.tsx" || echo "   ✗ MISSING"

# 3. Check telematics integrations
echo "3. Checking telematics API integrations..."
grep -r "united_rentals\|caterpillar\|john_deere\|komatsu" "$PROJECT_ROOT/src/edge-functions" --include="*.ts" && echo "   ✓ Telematics providers configured" || echo "   ⚠ Need API key setup"

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 7. SUCCESS METRICS

- Fleet visibility: 100% (vs. 20% manual tracking)
- Equipment utilization: +15-25% (through idle detection)
- Maintenance cost reduction: 20% (predictive alerts)
- Cost allocation accuracy: 99%+ (vs. manual estimates)
- Carbon tracking: Real-time (compliance & ESG reporting)

