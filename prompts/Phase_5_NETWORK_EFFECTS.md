# Phase 5: Network Effects + Data Moat (The $10B Play)

**Status**: Phase 5 (Network Effects + Data Moat)
**Priority**: Critical
**Effort**: 30 days
**Target**: Day 145-174

---

## OVERVIEW

Phase 5 combines five interconnected sub-phases that build the network effects and data advantages that create SiteSync's $10B defensibility. Each sub-phase feeds data into the next, creating a virtuous cycle where the platform becomes more valuable as it accumulates more projects, contractors, and historical data.

---

## PHASE 5A: CROSS-PROJECT BENCHMARKING ENGINE

### Pre-Requisites
- Phases 1-4 production data (10+ projects minimum to start)
- Budget, Schedule, RFI, Payroll data ingested

### Dependencies
```sql
CREATE TABLE anonymized_project_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  aggregation_bucket VARCHAR(50), -- Used only for statistics, project_id is null
  metric_type VARCHAR(50), -- 'cost', 'schedule', 'safety', 'rfi', 'quality'
  metric_name VARCHAR(100),
  metric_value FLOAT,
  metric_unit VARCHAR(20),
  project_type VARCHAR(50), -- 'residential', 'commercial', 'industrial', 'infrastructure'
  geographic_region VARCHAR(100),
  project_size_sf INT,
  contract_value DECIMAL(15, 2),
  project_year INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE metric_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_UUID(),
  metric_name VARCHAR(100),
  project_type VARCHAR(50),
  region VARCHAR(100),
  percentile_10 FLOAT, -- Bottom 10%
  percentile_25 FLOAT,
  percentile_50 FLOAT, -- Median
  percentile_75 FLOAT,
  percentile_90 FLOAT, -- Top 10%
  mean_value FLOAT,
  std_dev FLOAT,
  sample_size INT, -- Must be >= 10
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_anonymized_metrics_bucket ON anonymized_project_metrics(aggregation_bucket);
CREATE INDEX idx_benchmarks_project_type ON metric_benchmarks(project_type);
```

### Implementation

**File**: `src/services/benchmarking/BenchmarkingEngine.ts`

```typescript
import { supabase } from '@/lib/supabase';
import percentile from 'percentile';

export interface ProjectMetrics {
  projectType: string;
  region: string;
  costPerSF: number;
  scheduleVariance: number; // % above/below estimate
  rfiTurnaroundDays: number;
  safetyIncidentRate: number; // per 100 workers
  changeOrderFrequency: number; // change orders per month
  contractorRetentionRate: number; // % of subs who return
}

export class BenchmarkingEngine {
  async aggregateProjectMetrics(projectId: string): Promise<void> {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('project_type, location, contract_value')
      .eq('id', projectId)
      .single();

    if (projectError || !project) return;

    // Fetch project data
    const metrics = await this.calculateProjectMetrics(projectId);

    // Save anonymized metrics
    for (const [key, value] of Object.entries(metrics)) {
      await supabase.from('anonymized_project_metrics').insert({
        project_id: projectId, // Store for audit, but treated anonymously
        metric_type: 'derived',
        metric_name: key,
        metric_value: value,
        project_type: project.project_type,
        geographic_region: project.location,
        project_year: new Date().getFullYear(),
      });
    }
  }

  private async calculateProjectMetrics(projectId: string): Promise<Record<string, number>> {
    // Cost metrics
    const costPerSF = await this.calculateCostPerSquareFoot(projectId);
    const costVariance = await this.calculateCostVariance(projectId);

    // Schedule metrics
    const scheduleVariance = await this.calculateScheduleVariance(projectId);

    // RFI metrics
    const rfiTurnaroundDays = await this.calculateRFITurnaround(projectId);

    // Safety metrics
    const safetyIncidentRate = await this.calculateSafetyRate(projectId);

    // Quality metrics
    const changeOrderFrequency = await this.calculateCOFrequency(projectId);

    return {
      costPerSF,
      costVariance,
      scheduleVariance,
      rfiTurnaroundDays,
      safetyIncidentRate,
      changeOrderFrequency,
    };
  }

  private async calculateCostPerSquareFoot(projectId: string): Promise<number> {
    const { data } = await supabase
      .from('projects')
      .select('contract_value, building_sf')
      .eq('id', projectId)
      .single();

    if (!data || !data.building_sf) return 0;
    return data.contract_value / data.building_sf;
  }

  private async calculateCostVariance(projectId: string): Promise<number> {
    const { data: budget } = await supabase
      .from('budgets')
      .select('original_estimate, current_total_cost')
      .eq('project_id', projectId)
      .single();

    if (!budget) return 0;
    return ((budget.current_total_cost - budget.original_estimate) / budget.original_estimate) * 100;
  }

  private async calculateScheduleVariance(projectId: string): Promise<number> {
    const { data: project } = await supabase
      .from('projects')
      .select('planned_end_date, current_end_date')
      .eq('id', projectId)
      .single();

    if (!project) return 0;

    const plannedDate = new Date(project.planned_end_date);
    const currentDate = new Date(project.current_end_date);
    const daysVariance = (currentDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24);

    return (daysVariance / ((plannedDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) * 100;
  }

  private async calculateRFITurnaround(projectId: string): Promise<number> {
    const { data: rfis } = await supabase
      .from('rfis')
      .select('created_at, resolved_at')
      .eq('project_id', projectId)
      .not('resolved_at', 'is', null);

    if (!rfis || rfis.length === 0) return 0;

    const turnarounds = rfis.map((rfi) => {
      const created = new Date(rfi.created_at);
      const resolved = new Date(rfi.resolved_at);
      return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    });

    return turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length;
  }

  private async calculateSafetyRate(projectId: string): Promise<number> {
    // Assume incidents table exists
    const { data: incidents } = await supabase
      .from('safety_incidents')
      .select('id')
      .eq('project_id', projectId);

    // Get worker count (from payroll)
    const { data: payroll } = await supabase
      .from('certified_payroll_reports')
      .select('certified_payroll_employees(id)')
      .eq('project_id', projectId);

    const incidentCount = incidents?.length || 0;
    const workerCount = payroll?.reduce((sum, r: any) => sum + (r.certified_payroll_employees?.length || 0), 0) || 1;

    return (incidentCount / (workerCount / 100)) || 0;
  }

  private async calculateCOFrequency(projectId: string): Promise<number> {
    const { data: project } = await supabase
      .from('projects')
      .select('start_date, current_end_date')
      .eq('id', projectId)
      .single();

    if (!project) return 0;

    const { data: changeOrders } = await supabase
      .from('change_orders')
      .select('id')
      .eq('project_id', projectId);

    const startDate = new Date(project.start_date);
    const endDate = new Date(project.current_end_date);
    const durationMonths = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    return (changeOrders?.length || 0) / durationMonths;
  }

  async calculateBenchmarks(
    projectType: string,
    region: string,
    metric: string
  ): Promise<{
    value: number;
    percentile: number;
    insight: string;
  }> {
    // Get benchmark data
    const { data: benchmarks } = await supabase
      .from('metric_benchmarks')
      .select('*')
      .eq('metric_name', metric)
      .eq('project_type', projectType)
      .eq('region', region);

    if (!benchmarks || benchmarks.length === 0) {
      return { value: 0, percentile: 50, insight: 'Insufficient data' };
    }

    const bench = benchmarks[0];

    // Get this project's value
    const { data: projectMetric } = await supabase
      .from('anonymized_project_metrics')
      .select('metric_value')
      .eq('metric_name', metric)
      .eq('project_type', projectType)
      .limit(1)
      .single();

    if (!projectMetric) {
      return { value: 0, percentile: 50, insight: 'No data for this project' };
    }

    const value = projectMetric.metric_value;

    // Calculate percentile
    let percentile = 50;
    if (value < bench.percentile_25) percentile = 15;
    else if (value < bench.percentile_50) percentile = 35;
    else if (value < bench.percentile_75) percentile = 65;
    else percentile = 85;

    const insight =
      percentile < 25
        ? `You're in the bottom 25% - ${metric} is above peers. Consider optimization.`
        : percentile < 50
        ? `You're below median - there's room to improve ${metric}.`
        : percentile < 75
        ? `You're above median - solid performance on ${metric}.`
        : `You're in the top 25% - excellent ${metric} performance!`;

    return { value, percentile, insight };
  }

  async refreshBenchmarks(): Promise<void> {
    // Aggregate metrics by project type and region
    const { data: metrics } = await supabase
      .from('anonymized_project_metrics')
      .select('metric_name, metric_value, project_type, geographic_region')
      .not('project_id', 'is', null);

    if (!metrics) return;

    // Group by (metric, project_type, region)
    const grouped: Record<string, number[]> = {};

    for (const m of metrics) {
      const key = `${m.metric_name}|${m.project_type}|${m.geographic_region}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m.metric_value);
    }

    // Calculate percentiles and save
    for (const [key, values] of Object.entries(grouped)) {
      if (values.length < 10) continue; // Min 10 samples

      const [metricName, projectType, region] = key.split('|');

      const p10 = percentile(10, values);
      const p25 = percentile(25, values);
      const p50 = percentile(50, values);
      const p75 = percentile(75, values);
      const p90 = percentile(90, values);

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
      );

      await supabase.from('metric_benchmarks').upsert({
        metric_name: metricName,
        project_type: projectType,
        region,
        percentile_10: p10,
        percentile_25: p25,
        percentile_50: p50,
        percentile_75: p75,
        percentile_90: p90,
        mean_value: mean,
        std_dev: stdDev,
        sample_size: values.length,
        last_updated: new Date().toISOString(),
      });
    }
  }
}
```

### Component: Benchmark Card

**File**: `src/components/Dashboard/BenchmarkCard.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { BenchmarkingEngine } from '@/services/benchmarking/BenchmarkingEngine';
import { Card } from '@/components/Primitives';

export const BenchmarkCard: React.FC<{
  projectType: string;
  region: string;
}> = ({ projectType, region }) => {
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const engine = new BenchmarkingEngine();

  useEffect(() => {
    loadBenchmarks();
  }, [projectType, region]);

  const loadBenchmarks = async () => {
    const metrics = [
      'costPerSF',
      'scheduleVariance',
      'rfiTurnaroundDays',
      'safetyIncidentRate',
      'changeOrderFrequency',
    ];

    const results = await Promise.all(
      metrics.map((m) => engine.calculateBenchmarks(projectType, region, m))
    );

    setBenchmarks(results);
  };

  return (
    <Card style={{ padding: '16px', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
        Benchmarks
      </h3>

      {benchmarks.map((bench, idx) => (
        <div key={idx} style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
              fontSize: '12px',
            }}
          >
            <span>Your percentile</span>
            <span style={{ fontWeight: 600, color: '#F47820' }}>
              {bench.percentile}th
            </span>
          </div>

          {/* Percentile bar */}
          <div
            style={{
              width: '100%',
              height: '4px',
              background: '#eee',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${bench.percentile}%`,
                height: '100%',
                background: '#F47820',
              }}
            />
          </div>

          <p
            style={{
              fontSize: '11px',
              color: '#666',
              margin: '6px 0 0 0',
            }}
          >
            {bench.insight}
          </p>
        </div>
      ))}
    </Card>
  );
};
```

---

## PHASE 5B: SUBCONTRACTOR REPUTATION NETWORK

### Database

```sql
CREATE TABLE contractor_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  metric_type VARCHAR(50), -- 'delivery', 'quality', 'safety', 'financial'
  score FLOAT, -- 0-100
  projects_evaluated INT,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contractor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  verified_by_gc_id UUID NOT NULL REFERENCES contractors(id),
  project_id UUID REFERENCES projects(id),
  verification_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contractor_scores ON contractor_performance_scores(contractor_id);
CREATE INDEX idx_verifications ON contractor_verifications(contractor_id);
```

### Implementation

**File**: `src/services/network/ContractorReputationNetwork.ts`

```typescript
import { supabase } from '@/lib/supabase';

export class ContractorReputationNetwork {
  async calculatePerformanceScore(
    contractorId: string,
    metricType: string
  ): Promise<number> {
    // Fetch all completed projects for this contractor
    const { data: payApps } = await supabase
      .from('pay_apps')
      .select('project_id, status')
      .eq('contractor_id', contractorId)
      .eq('status', 'paid');

    if (!payApps || payApps.length === 0) {
      return 0; // No verified projects
    }

    const projectIds = payApps.map((p) => p.project_id);

    let score = 0;

    switch (metricType) {
      case 'delivery':
        score = await this.calculateDeliveryScore(projectIds);
        break;
      case 'quality':
        score = await this.calculateQualityScore(projectIds);
        break;
      case 'safety':
        score = await this.calculateSafetyScore(projectIds);
        break;
      case 'financial':
        score = await this.calculateFinancialScore(projectIds);
        break;
    }

    // Save score
    await supabase.from('contractor_performance_scores').upsert({
      contractor_id: contractorId,
      metric_type: metricType,
      score: Math.max(0, Math.min(100, score)),
      projects_evaluated: projectIds.length,
      last_updated: new Date().toISOString(),
    });

    return score;
  }

  private async calculateDeliveryScore(projectIds: string[]): Promise<number> {
    // Score based on schedule adherence
    const { data } = await supabase
      .from('projects')
      .select('planned_end_date, current_end_date')
      .in('id', projectIds);

    if (!data || data.length === 0) return 0;

    const onTimeCount = data.filter((p) => {
      const planned = new Date(p.planned_end_date);
      const current = new Date(p.current_end_date);
      return current <= planned;
    }).length;

    return (onTimeCount / data.length) * 100;
  }

  private async calculateQualityScore(projectIds: string[]): Promise<number> {
    // Score based on punch list items and change orders
    const { data: punchList } = await supabase
      .from('punch_list_items')
      .select('id')
      .in('project_id', projectIds)
      .eq('status', 'open');

    const { data: changeOrders } = await supabase
      .from('change_orders')
      .select('id')
      .in('project_id', projectIds);

    if (!projectIds || projectIds.length === 0) return 0;

    const defectRatio = (punchList?.length || 0) / projectIds.length;
    const coRatio = (changeOrders?.length || 0) / projectIds.length;

    // Fewer punch items and COs = higher score
    return Math.max(0, 100 - defectRatio * 5 - coRatio * 10);
  }

  private async calculateSafetyScore(projectIds: string[]): Promise<number> {
    // Score based on safety incidents
    const { data: incidents } = await supabase
      .from('safety_incidents')
      .select('severity')
      .in('project_id', projectIds);

    if (!incidents) return 100;

    let penaltyPoints = 0;
    incidents.forEach((i) => {
      if (i.severity === 'critical') penaltyPoints += 20;
      else if (i.severity === 'high') penaltyPoints += 10;
      else if (i.severity === 'medium') penaltyPoints += 5;
    });

    return Math.max(0, 100 - penaltyPoints);
  }

  private async calculateFinancialScore(projectIds: string[]): Promise<number> {
    // Score based on payment accuracy and lien waivers
    const { data: payApps } = await supabase
      .from('pay_apps')
      .select('id')
      .in('project_id', projectIds);

    const { data: waivers } = await supabase
      .from('lien_waivers')
      .select('id')
      .in('pay_app_id', payApps?.map((p) => p.id) || []);

    const waiverRatio = waivers ? waivers.length / (payApps?.length || 1) : 0;

    // Higher waiver ratio = better financial compliance
    return Math.min(100, waiverRatio * 100);
  }

  async getContractorReputation(contractorId: string): Promise<{
    overallScore: number;
    delivery: number;
    quality: number;
    safety: number;
    financial: number;
    projectedCount: number;
    verifiedCount: number;
  }> {
    const { data: scores } = await supabase
      .from('contractor_performance_scores')
      .select('metric_type, score, projects_evaluated')
      .eq('contractor_id', contractorId);

    const { data: verifications } = await supabase
      .from('contractor_verifications')
      .select('id')
      .eq('contractor_id', contractorId);

    const scoreMap: Record<string, number> = {};
    let totalScore = 0;
    let count = 0;

    scores?.forEach((s) => {
      scoreMap[s.metric_type] = s.score;
      totalScore += s.score;
      count += 1;
    });

    return {
      overallScore: count > 0 ? totalScore / count : 0,
      delivery: scoreMap['delivery'] || 0,
      quality: scoreMap['quality'] || 0,
      safety: scoreMap['safety'] || 0,
      financial: scoreMap['financial'] || 0,
      projectedCount: 0, // Number of projects this contractor is currently active on
      verifiedCount: verifications?.length || 0,
    };
  }

  async searchContractors(filters: {
    trade: string;
    location: string;
    minScore: number;
    availability: boolean;
  }): Promise<any[]> {
    // Search contractors with high reputation scores
    const { data: contractors } = await supabase
      .from('contractors')
      .select('*, contractor_performance_scores(*)')
      .eq('primary_trade', filters.trade)
      .contains('service_areas', [filters.location]);

    if (!contractors) return [];

    return contractors
      .filter((c) => {
        const avgScore =
          c.contractor_performance_scores?.reduce((s: number, p: any) => s + p.score, 0) /
          (c.contractor_performance_scores?.length || 1) || 0;
        return avgScore >= filters.minScore;
      })
      .sort((a, b) => {
        const scoreA =
          a.contractor_performance_scores?.reduce((s: number, p: any) => s + p.score, 0) /
          (a.contractor_performance_scores?.length || 1) || 0;
        const scoreB =
          b.contractor_performance_scores?.reduce((s: number, p: any) => s + p.score, 0) /
          (b.contractor_performance_scores?.length || 1) || 0;
        return scoreB - scoreA;
      });
  }
}
```

---

## PHASE 5C: MATERIAL PRICE INTELLIGENCE

```sql
CREATE TABLE material_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type VARCHAR(100), -- 'Steel', 'Lumber', 'Concrete', etc
  material_grade VARCHAR(50),
  unit VARCHAR(20), -- 'ton', 'board foot', 'cubic yard', etc
  price_per_unit DECIMAL(10, 2),
  supplier VARCHAR(255),
  supplier_region VARCHAR(100),
  price_date DATE,
  project_id UUID REFERENCES projects(id), -- source
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE material_price_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type VARCHAR(100),
  region VARCHAR(100),
  price_30day_ago DECIMAL(10, 2),
  price_current DECIMAL(10, 2),
  price_trend_percent FLOAT, -- % change
  forecast_30day DECIMAL(10, 2),
  forecast_confidence FLOAT, -- 0-1
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_history_material ON material_price_history(material_type, price_date);
CREATE INDEX idx_price_trends_material ON material_price_trends(material_type, region);
```

### Implementation Sketch

```typescript
export class MaterialPriceIntelligence {
  async trackMaterialPrice(
    materialType: string,
    grade: string,
    price: number,
    unit: string,
    supplier: string,
    region: string,
    projectId: string
  ): Promise<void> {
    // Save price point
    await supabase.from('material_price_history').insert({
      material_type: materialType,
      material_grade: grade,
      unit,
      price_per_unit: price,
      supplier,
      supplier_region: region,
      price_date: new Date().toISOString().split('T')[0],
      project_id: projectId,
    });

    // Update trend analysis
    await this.updatePriceTrends(materialType, region);
  }

  private async updatePriceTrends(material: string, region: string): Promise<void> {
    // Fetch last 30 days of prices
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: prices } = await supabase
      .from('material_price_history')
      .select('price_per_unit, price_date')
      .eq('material_type', material)
      .eq('supplier_region', region)
      .gte('price_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (!prices || prices.length < 3) return; // Minimum data points

    const sorted = prices.sort((a, b) =>
      new Date(a.price_date).getTime() - new Date(b.price_date).getTime()
    );

    const oldPrice = sorted[0].price_per_unit;
    const currentPrice = sorted[sorted.length - 1].price_per_unit;
    const trendPercent = ((currentPrice - oldPrice) / oldPrice) * 100;

    // Simple forecast (linear extrapolation)
    const forecast = currentPrice * (1 + trendPercent / 100);

    await supabase.from('material_price_trends').upsert({
      material_type: material,
      region,
      price_30day_ago: oldPrice,
      price_current: currentPrice,
      price_trend_percent: trendPercent,
      forecast_30day: forecast,
      forecast_confidence: Math.min(1, prices.length / 10), // More data = more confidence
      last_updated: new Date().toISOString(),
    });
  }

  async getProcurementRecommendation(
    materialType: string,
    region: string
  ): Promise<string> {
    const { data: trend } = await supabase
      .from('material_price_trends')
      .select('price_trend_percent, forecast_30day')
      .eq('material_type', materialType)
      .eq('region', region)
      .single();

    if (!trend) return 'Insufficient data for recommendation';

    if (trend.price_trend_percent > 5) {
      return `${materialType} prices trending up ${trend.price_trend_percent.toFixed(1)}%. Consider locking in prices before Q2 quotes if procurement is 4+ weeks out.`;
    } else if (trend.price_trend_percent < -5) {
      return `${materialType} prices declining. You may benefit from shorter lead times to capture lower rates.`;
    } else {
      return `${materialType} prices stable. Standard ordering practices recommended.`;
    }
  }
}
```

---

## PHASE 5D: PUBLIC API V1 (STRIPE-QUALITY)

### API Design

```typescript
// GET /api/v1/projects
// Returns paginated list of user's projects
{
  "data": [
    {
      "id": "proj_123",
      "name": "Downtown Tower",
      "status": "active",
      "created_at": "2026-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}

// POST /api/v1/projects/:id/pay-apps
// Create new pay app
{
  "contractor_id": "cont_456",
  "period_start_date": "2026-03-01",
  "period_end_date": "2026-03-31",
  "work_completed_to_date": 150000
}

// GET /api/v1/benchmarks/:project_id
// Get project benchmarks
{
  "cost_per_sf": {
    "value": 245,
    "percentile": 73,
    "insight": "above median"
  },
  "schedule_variance": {
    "value": -2.3,
    "percentile": 82
  }
}

// POST /api/v1/contractors/:id/reputation
// Get contractor reputation
{
  "overall_score": 87,
  "delivery": 90,
  "quality": 85,
  "safety": 88,
  "financial": 82,
  "projects_completed": 23
}

// Webhooks: project.updated, pay_app.created, payment.completed
```

### Implementation Sketch

**File**: `src/pages/api/v1/[...params].ts`

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const [version, resource, id, action] = req.query.params as string[];

  if (version !== 'v1') {
    return res.status(400).json({ error: 'Invalid API version' });
  }

  // Extract API key from header
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // Verify API key and get user
  const { data: apiKeyData, error: keyError } = await supabase
    .from('api_keys')
    .select('user_id, rate_limit')
    .eq('key_hash', hashAPIKey(apiKey))
    .single();

  if (keyError || !apiKeyData) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Check rate limit
  const { data: usage } = await supabase
    .from('api_usage')
    .select('call_count')
    .eq('api_key_id', apiKeyData.id)
    .gte('date', new Date().toISOString().split('T')[0]);

  if (usage && usage[0].call_count >= apiKeyData.rate_limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Route requests
  switch (req.method) {
    case 'GET':
      if (resource === 'projects') {
        return handleGetProjects(req, res, apiKeyData.user_id);
      } else if (resource === 'contractors') {
        return handleGetContractors(req, res);
      } else if (resource === 'benchmarks') {
        return handleGetBenchmarks(req, res, id);
      }
      break;

    case 'POST':
      if (resource === 'pay-apps') {
        return handleCreatePayApp(req, res, apiKeyData.user_id);
      } else if (action === 'reputation') {
        return handleGetReputation(req, res, id);
      }
      break;
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}

async function handleGetProjects(req: NextApiRequest, res: NextApiResponse, userId: string) {
  const page = (req.query.page as string) || '1';
  const perPage = Math.min(100, parseInt(req.query.per_page as string) || 20);

  const { data, count, error } = await supabase
    .from('projects')
    .select('id, name, status, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range((parseInt(page) - 1) * perPage, parseInt(page) * perPage - 1);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    data,
    pagination: {
      page: parseInt(page),
      per_page: perPage,
      total: count,
    },
  });
}

// ... More endpoint handlers ...

function hashAPIKey(key: string): string {
  // Use SHA-256 to hash the key before checking database
  return require('crypto').createHash('sha256').update(key).digest('hex');
}
```

---

## PHASE 5E: INTEGRATION MARKETPLACE

### Database

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  slug VARCHAR(100) UNIQUE,
  description TEXT,
  category VARCHAR(50), -- 'accounting', 'design', 'erp', 'signature', etc
  icon_url TEXT,
  oauth_client_id VARCHAR(255),
  oauth_redirect_uri TEXT,
  api_base_url TEXT,
  status VARCHAR(50), -- 'available', 'beta', 'deprecated'
  documentation_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE integration_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  integration_id UUID NOT NULL REFERENCES integrations(id),
  oauth_token TEXT ENCRYPTED, -- Use pgcrypto
  oauth_refresh_token TEXT ENCRYPTED,
  token_expires_at TIMESTAMPTZ,
  installation_config JSONB, -- Integration-specific settings
  installed_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  UNIQUE(user_id, integration_id)
);

CREATE TABLE integration_data_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES integration_installations(id),
  sync_type VARCHAR(50), -- 'projects', 'budgets', 'invoices', etc
  status VARCHAR(50), -- 'pending', 'syncing', 'completed', 'failed'
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  error_message TEXT,
  records_synced INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_integrations_category ON integrations(category);
CREATE INDEX idx_installations_user ON integration_installations(user_id);
```

---

## ACCEPTANCE CRITERIA

### Phase 5A: Benchmarking
- [ ] Aggregate metrics from 10+ projects per calculation
- [ ] Minimum 10 samples before publishing benchmark
- [ ] Calculate percentiles (10, 25, 50, 75, 90)
- [ ] Show user "your percentile" with actionable insights
- [ ] Refresh benchmarks weekly with new project data
- [ ] Segment by project type and region

### Phase 5B: Reputation Network
- [ ] Calculate delivery score based on schedule adherence
- [ ] Calculate quality score from punch list and COs
- [ ] Calculate safety score from incident severity
- [ ] Calculate financial score from waiver compliance
- [ ] Search contractors by trade, location, min score
- [ ] Show verified project count vs completed projects

### Phase 5C: Material Price Intelligence
- [ ] Track material prices from all project invoices
- [ ] Calculate 30-day trends and forecasts
- [ ] Show procurement recommendations (lock in vs wait)
- [ ] Regional price comparisons
- [ ] Quarterly trend reports

### Phase 5D: Public API
- [ ] OAuth 2.0 + API key authentication
- [ ] Versioned REST endpoints (/v1/)
- [ ] Rate limiting with tiered plans
- [ ] Idempotent POST requests (idempotency key)
- [ ] Comprehensive API docs (Swagger/OpenAPI)
- [ ] Webhook delivery for events
- [ ] SDKs for TypeScript, Python (auto-generated)

### Phase 5E: Integration Marketplace
- [ ] Pre-built integrations for Procore, Autodesk, QuickBooks
- [ ] OAuth flow for third-party integrations
- [ ] Automatic data sync (configurable intervals)
- [ ] Integration status dashboard per installation
- [ ] Sync error logging and alerting
- [ ] Revenue share model for partners

---

## NETWORK EFFECTS & DEFENSIBILITY

This phase creates a $10B valuation through:

1. **Data Moat**: Every project, contractor, and material price strengthens benchmarks
2. **Switching Costs**: Contractors can't export their reputation scores; GCs stick to SiteSync
3. **Network Effects**: More contractors = better bench marking = more GCs adopt
4. **API Lock-in**: Customers build products on top of SiteSync API
5. **Marketplace Leverage**: Control the integrations ecosystem

**Defensible because**:
- Requires 18+ months of aggregated data to match (high barrier)
- Contractor reputation is proprietary (can't be exported)
- Integration ecosystem benefit increases usage, strengthens moat
- Data compounds; each project makes platform more valuable
