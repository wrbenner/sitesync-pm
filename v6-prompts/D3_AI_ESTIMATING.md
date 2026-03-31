# D3: AI-Powered Estimating Engine

**Status:** Conceptual, zero implementation
**Unlock Value:** $500M+ market (Sage Estimating, ProEst, PlanSwift - all legacy)
**Target:** Leapfrog desktop tools with LLM-based visual takeoff

---

## 1. OVERVIEW: WHY ESTIMATING IS THE NEXT FRONTIER

Current market:
- Sage Estimating, ProEst, PlanSwift = $1-2B combined, all desktop/Windows
- All require manual takeoff (clicking rooms/dimensions in PDFs)
- No AI extraction of construction details
- Bid comparison is manual copy-paste
- RSMeans unit costs updated annually (lag)

SiteSync opportunity:
- Claude Vision reads construction drawings automatically
- Extract: room dimensions, fixture counts, material specs
- Assembly-based estimating (Divisions 01-49 CSI)
- Historical project cost ML model (learn from past bids)
- What-if analysis ("switch from drywall to plaster")
- Export to Excel, PDF, budget module

Revenue: $50-100/estimate (50 estimates/month = $2.5K/month per customer)

---

## 2. DATABASE SCHEMA

```sql
-- Construction estimates
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  estimate_name VARCHAR(200), -- "Bid #1", "Revision A"
  estimate_number VARCHAR(50) UNIQUE,
  -- Scope documents
  plan_file_ids UUID[] DEFAULT '{}', -- Links to uploaded PDFs in storage
  specification_document_id UUID REFERENCES documents(id),
  site_survey_document_id UUID REFERENCES documents(id),
  -- AI extraction results
  extracted_ai_data JSONB, -- { "rooms": [...], "fixtures": [...], "materials": [...] }
  extraction_confidence DECIMAL(4,2), -- 0.0-1.0
  -- Estimate breakdown
  total_material_cost DECIMAL(12,2),
  total_labor_cost DECIMAL(12,2),
  total_equipment_cost DECIMAL(12,2),
  total_overhead DECIMAL(12,2),
  total_profit DECIMAL(12,2),
  subtotal DECIMAL(12,2),
  sales_tax DECIMAL(12,2),
  grand_total DECIMAL(12,2),
  -- Bid strategy
  profit_margin_percent DECIMAL(5,2),
  contingency_percent DECIMAL(5,2),
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft' | 'in_review' | 'submitted' | 'awarded' | 'lost'
  won_amount DECIMAL(12,2),
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- CSI Division line items
CREATE TABLE estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  -- CSI classification
  csi_division INT, -- 1-49
  csi_title VARCHAR(200), -- "01 General Requirements"
  work_item_description VARCHAR(500),
  -- Quantity takeoff
  quantity DECIMAL(12,3),
  unit_of_measure VARCHAR(20), -- 'SF', 'LF', 'EA', etc.
  -- Unit costs
  material_unit_cost DECIMAL(10,2),
  labor_unit_cost DECIMAL(10,2),
  equipment_unit_cost DECIMAL(10,2),
  overhead_unit_cost DECIMAL(10,2),
  -- Totals
  material_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * material_unit_cost) STORED,
  labor_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * labor_unit_cost) STORED,
  equipment_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * equipment_unit_cost) STORED,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (
    COALESCE(quantity * material_unit_cost, 0) +
    COALESCE(quantity * labor_unit_cost, 0) +
    COALESCE(quantity * equipment_unit_cost, 0)
  ) STORED,
  -- Assembly reference
  assembly_id UUID REFERENCES estimate_assemblies(id),
  -- Notes
  notes TEXT,
  -- AI extraction metadata
  extracted_from_plan BOOLEAN,
  extraction_confidence DECIMAL(4,2),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Construction assemblies (pre-built line item templates)
CREATE TABLE estimate_assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_code VARCHAR(20), -- e.g., "INT-WALL-001"
  assembly_name VARCHAR(200), -- "Interior Partition Wall - Type A"
  csi_division INT,
  description TEXT,
  -- Unit cost (base)
  base_material_unit_cost DECIMAL(10,2),
  base_labor_unit_cost DECIMAL(10,2),
  base_equipment_unit_cost DECIMAL(10,2),
  -- Regional cost adjustment factor
  regional_multiplier DECIMAL(4,2) DEFAULT 1.0,
  -- Components (BOMs)
  components JSONB, -- [{ "material": "2x4 lumber", "qty": 10, "unit": "LF", "unit_cost": 1.50 }, ...]
  labor_hours_per_unit DECIMAL(6,2),
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Unit cost database (regional costs by CSI division)
CREATE TABLE unit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Location
  location_name VARCHAR(200), -- "Los Angeles County, CA"
  state_code CHAR(2),
  zip_code VARCHAR(10),
  -- CSI classification
  csi_division INT,
  work_description VARCHAR(500),
  -- Costs (per unit: SF, LF, EA, etc.)
  unit_of_measure VARCHAR(20),
  material_cost DECIMAL(10,2),
  labor_cost DECIMAL(10,2),
  equipment_cost DECIMAL(10,2),
  -- Source & date
  cost_source VARCHAR(100), -- 'RSMeans' | 'Historical' | 'User'
  effective_date DATE,
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Historical project costs (for ML model training)
CREATE TABLE historical_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  -- Estimate vs. Actual
  estimated_cost DECIMAL(12,2),
  actual_cost DECIMAL(12,2),
  variance_percent DECIMAL(6,2) GENERATED ALWAYS AS (
    ((actual_cost - estimated_cost) / estimated_cost) * 100.0
  ) STORED,
  -- Work item
  csi_division INT,
  work_description VARCHAR(500),
  -- Completed date
  completion_date DATE,
  -- Project metadata
  project_type VARCHAR(50), -- 'residential' | 'commercial' | 'industrial'
  project_location VARCHAR(200),
  project_size_sf DECIMAL(12,2),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Bid comparison (analyze competitor bids)
CREATE TABLE bid_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id),
  -- Competitor bid
  bidder_name VARCHAR(200),
  bid_amount DECIMAL(12,2),
  bid_date DATE,
  bid_document_url TEXT,
  -- Analysis
  price_variance DECIMAL(12,2) GENERATED ALWAYS AS (
    bid_amount - (SELECT grand_total FROM estimates WHERE id = estimate_id)
  ) STORED,
  variance_percent DECIMAL(6,2),
  outlier_flag BOOLEAN, -- Significantly higher/lower
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- What-if scenario analysis
CREATE TABLE estimate_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES estimates(id),
  scenario_name VARCHAR(200), -- "All wood framing vs. steel"
  description TEXT,
  -- Delta from base estimate
  delta_material_cost DECIMAL(12,2),
  delta_labor_cost DECIMAL(12,2),
  delta_total_cost DECIMAL(12,2),
  -- Results
  new_total_estimate DECIMAL(12,2),
  new_profit_margin DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. PLAN READING WITH CLAUDE VISION

File: `/src/edge-functions/estimate-plan-reader.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const client = new Anthropic();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface PlanExtractionResult {
  rooms: Array<{
    name: string;
    dimensions: string;
    area_sf: number;
    finishes: string[];
  }>;
  fixtures: Array<{
    type: string; // 'door', 'window', 'plumbing', 'electrical', 'hvac'
    quantity: number;
    size: string;
    notes: string;
  }>;
  materials: Array<{
    description: string;
    quantity: number;
    unit: string;
  }>;
  structural_elements: Array<{
    type: string; // 'wall', 'column', 'beam'
    count: number;
    material: string;
    size: string;
  }>;
  notes: string[];
}

/**
 * Extract construction details from architectural plans (PDF)
 */
export async function extractPlanDetails(
  planFileUrl: string,
  projectContext: string
): Promise<PlanExtractionResult> {
  // Download PDF from Supabase Storage
  const { data: pdfBuffer } = await supabase.storage
    .from('construction-plans')
    .download(planFileUrl);

  // Convert PDF to base64
  const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

  // Call Claude Vision API
  const response = await client.messages.create({
    model: 'claude-opus-4-1',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an expert construction estimator analyzing architectural construction drawings.

CONTEXT: ${projectContext}

Please extract and provide the following information from these construction plans:

1. **Rooms/Spaces**: For each room, identify:
   - Room name/type
   - Dimensions (length x width)
   - Calculated area in square feet
   - Finish specifications (flooring, wall, ceiling)

2. **Fixtures & Equipment**:
   - Doors (count by type: interior, exterior, pocket, etc.)
   - Windows (count by size)
   - Plumbing fixtures (toilets, sinks, showers, etc.)
   - Electrical outlets, switches, fixtures
   - HVAC equipment/vents

3. **Materials Visible**:
   - Wall construction (framing, insulation)
   - Roofing material
   - Foundation/flooring material
   - Exterior cladding/siding

4. **Structural Elements**:
   - Walls (load-bearing vs. non-load-bearing)
   - Columns (size and material)
   - Beams (size and span)
   - Foundation type

5. **Notes**:
   - Any special specifications noted
   - Accessibility requirements
   - Code compliance notes

Return your analysis as a JSON object matching this structure:
{
  "rooms": [
    {
      "name": "Master Bedroom",
      "dimensions": "16' x 14'",
      "area_sf": 224,
      "finishes": ["hardwood flooring", "gypsum drywall", "acoustic ceiling"]
    }
  ],
  "fixtures": [
    {
      "type": "door",
      "quantity": 1,
      "size": "36\" exterior wood door",
      "notes": "solid core with hardware"
    }
  ],
  "materials": [...],
  "structural_elements": [...],
  "notes": [...]
}`,
          },
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          },
        ],
      },
    ],
  });

  // Parse JSON from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude Vision');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from Claude response');
  }

  const extractedData = JSON.parse(jsonMatch[0]) as PlanExtractionResult;
  return extractedData;
}

/**
 * Convert extracted plan details to estimate line items
 */
export async function generateLineItemsFromPlan(
  estimateId: string,
  extractedData: PlanExtractionResult,
  projectLocation: string
) {
  // Get unit costs for project location
  const { data: unitCosts } = await supabase
    .from('unit_costs')
    .select('*')
    .eq('location_name', projectLocation);

  const lineItems = [];

  // Convert rooms to drywall/flooring/ceiling line items
  for (const room of extractedData.rooms) {
    const ceilingArea = room.area_sf;
    const wallArea = room.area_sf * 1.2; // Rough estimate: walls ~ 1.2x floor area

    if (room.finishes.includes('gypsum drywall')) {
      const drywall = unitCosts?.find(
        (uc) => uc.csi_division === 9 && uc.work_description.includes('drywall')
      );

      lineItems.push({
        estimate_id: estimateId,
        csi_division: 9,
        csi_title: '09 Finishes',
        work_item_description: `Gypsum drywall - ${room.name}`,
        quantity: wallArea,
        unit_of_measure: 'SF',
        material_unit_cost: drywall?.material_cost || 0.65,
        labor_unit_cost: drywall?.labor_cost || 0.75,
      });
    }

    if (room.finishes.includes('hardwood flooring')) {
      const flooring = unitCosts?.find(
        (uc) => uc.csi_division === 9 && uc.work_description.includes('hardwood')
      );

      lineItems.push({
        estimate_id: estimateId,
        csi_division: 9,
        csi_title: '09 Finishes',
        work_item_description: `Hardwood flooring - ${room.name}`,
        quantity: room.area_sf,
        unit_of_measure: 'SF',
        material_unit_cost: flooring?.material_cost || 3.50,
        labor_unit_cost: flooring?.labor_cost || 2.00,
      });
    }
  }

  // Convert fixtures to line items
  for (const fixture of extractedData.fixtures) {
    if (fixture.type === 'door') {
      const doorCost = unitCosts?.find(
        (uc) => uc.csi_division === 8 && uc.work_description.includes('door')
      );

      lineItems.push({
        estimate_id: estimateId,
        csi_division: 8,
        csi_title: '08 Openings',
        work_item_description: `${fixture.size} - ${fixture.notes}`,
        quantity: fixture.quantity,
        unit_of_measure: 'EA',
        material_unit_cost: doorCost?.material_cost || 250,
        labor_unit_cost: doorCost?.labor_cost || 75,
      });
    }

    if (fixture.type === 'window') {
      const windowCost = unitCosts?.find(
        (uc) => uc.csi_division === 8 && uc.work_description.includes('window')
      );

      lineItems.push({
        estimate_id: estimateId,
        csi_division: 8,
        csi_title: '08 Openings',
        work_item_description: `${fixture.size} - ${fixture.notes}`,
        quantity: fixture.quantity,
        unit_of_measure: 'EA',
        material_unit_cost: windowCost?.material_cost || 150,
        labor_unit_cost: windowCost?.labor_cost || 50,
      });
    }
  }

  // Upsert line items to database
  const { error } = await supabase
    .from('estimate_line_items')
    .upsert(lineItems);

  if (error) throw error;

  return lineItems;
}
```

---

## 4. REACT PAGES & COMPONENTS

### 4a. `/src/pages/estimating.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Tabs, Button } from '@/components/ui';
import { useProjectStore } from '@/stores/projects';
import EstimateList from '@/components/estimating/estimate-list';
import EstimateBuilder from '@/components/estimating/estimate-builder';
import PlanUpload from '@/components/estimating/plan-upload';
import EstimateDetail from '@/components/estimating/estimate-detail';
import BidComparison from '@/components/estimating/bid-comparison';

export default function EstimatingPage() {
  const { activeProject } = useProjectStore();
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'new' | 'detail'>('list');

  const { data: estimates } = useQuery({
    queryKey: ['estimates', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/estimates`);
      return response.json();
    },
    enabled: !!activeProject?.id,
  });

  if (!activeProject) return <div>Select a project</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Estimating Engine</h1>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <Tabs.List>
          <Tabs.Trigger value="list">My Estimates</Tabs.Trigger>
          <Tabs.Trigger value="new">New Estimate</Tabs.Trigger>
          {selectedEstimateId && <Tabs.Trigger value="detail">View Detail</Tabs.Trigger>}
        </Tabs.List>

        <Tabs.Content value="list">
          <EstimateList
            estimates={estimates}
            onSelect={(id) => {
              setSelectedEstimateId(id);
              setViewMode('detail');
            }}
          />
        </Tabs.Content>

        <Tabs.Content value="new">
          <Card className="p-6 space-y-6">
            <h2 className="text-2xl font-bold">Create New Estimate</h2>
            <PlanUpload projectId={activeProject.id} />
          </Card>
        </Tabs.Content>

        {selectedEstimateId && (
          <Tabs.Content value="detail">
            <EstimateDetail estimateId={selectedEstimateId} projectId={activeProject.id} />
          </Tabs.Content>
        )}
      </Tabs>
    </div>
  );
}
```

### 4b. `/src/components/estimating/plan-upload.tsx`

```typescript
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, Button, Input, Alert, Spinner } from '@/components/ui';

interface PlanUploadProps {
  projectId: string;
}

export default function PlanUpload({ projectId }: PlanUploadProps) {
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('plan', file);
      formData.append('project_id', projectId);

      const response = await fetch('/api/v1/estimates/upload-plan', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      setExtractedData(data.extracted_data);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPlanFile(file);
    }
  };

  const handleUpload = () => {
    if (planFile) {
      uploadMutation.mutate(planFile);
    }
  };

  if (extractedData) {
    return (
      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Plan Analysis Complete</h3>

        <Alert variant="success">
          Claude Vision successfully extracted details from your construction plans.
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2">Rooms Detected</h4>
            <ul className="space-y-1 text-sm">
              {extractedData.rooms?.slice(0, 5).map((room: any, idx: number) => (
                <li key={idx}>
                  {room.name}: {room.area_sf} SF
                </li>
              ))}
              {extractedData.rooms?.length > 5 && (
                <li className="text-gray-600">+ {extractedData.rooms.length - 5} more</li>
              )}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Fixtures Detected</h4>
            <ul className="space-y-1 text-sm">
              {extractedData.fixtures?.slice(0, 5).map((fix: any, idx: number) => (
                <li key={idx}>
                  {fix.type}: {fix.quantity}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            window.location.href = `/estimates/new?extracted_data=${btoa(JSON.stringify(extractedData))}`;
          }}
        >
          Create Estimate from Plan Analysis
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Upload Construction Plans</h3>

      <p className="text-gray-600">
        Upload PDF construction drawings. Claude Vision will automatically extract room dimensions,
        fixture counts, and material specifications.
      </p>

      <div className="border-2 border-dashed rounded-lg p-8 text-center">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
          className="hidden"
          id="plan-upload"
        />
        <label htmlFor="plan-upload" className="cursor-pointer">
          <div className="text-gray-600">
            {planFile ? (
              <div>
                <div className="font-semibold">{planFile.name}</div>
                <div className="text-sm mt-1">Ready to upload</div>
              </div>
            ) : (
              <div>
                <div className="text-lg font-semibold mb-2">Click to upload or drag and drop</div>
                <div className="text-sm">PDF files (max 50MB)</div>
              </div>
            )}
          </div>
        </label>
      </div>

      <Button
        onClick={handleUpload}
        disabled={!planFile || uploadMutation.isPending}
        variant="primary"
        className="w-full"
      >
        {uploadMutation.isPending ? (
          <>
            <Spinner className="mr-2" />
            Analyzing Plans with Claude Vision...
          </>
        ) : (
          'Upload & Analyze'
        )}
      </Button>
    </Card>
  );
}
```

### 4c. `/src/components/estimating/estimate-detail.tsx`

```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Table, Input, Badge } from '@/components/ui';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface EstimateDetailProps {
  estimateId: string;
  projectId: string;
}

export default function EstimateDetail({ estimateId, projectId }: EstimateDetailProps) {
  const [profitMargin, setProfitMargin] = useState(15);

  const { data: estimate } = useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/estimates/${estimateId}`);
      return response.json();
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ['estimate-line-items', estimateId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/estimates/${estimateId}/line-items`);
      return response.json();
    },
  });

  const exportToPDF = () => {
    if (!estimate) return;

    const pdf = new jsPDF();
    pdf.text(`Estimate: ${estimate.estimate_name}`, 10, 10);
    pdf.text(`Project: ${estimate.project_name}`, 10, 20);

    (pdf as any).autoTable({
      head: [['Description', 'Qty', 'Unit Cost', 'Total']],
      body: lineItems?.map((li: any) => [
        li.work_item_description,
        `${li.quantity} ${li.unit_of_measure}`,
        `$${(li.material_unit_cost + li.labor_unit_cost).toFixed(2)}`,
        `$${li.line_total.toFixed(2)}`,
      ]),
      startY: 30,
    });

    pdf.text(`Subtotal: $${estimate.subtotal.toFixed(2)}`, 10, (pdf as any).lastAutoTable.finalY + 10);
    pdf.text(`Total: $${estimate.grand_total.toFixed(2)}`, 10, (pdf as any).lastAutoTable.finalY + 20);

    pdf.save(`estimate-${estimate.estimate_number}.pdf`);
  };

  if (!estimate) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">{estimate.estimate_name}</h2>
            <p className="text-gray-600">Estimate #{estimate.estimate_number}</p>
          </div>
          <Badge variant="default">{estimate.status}</Badge>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div>
            <div className="text-sm text-gray-600">Material Cost</div>
            <div className="text-2xl font-bold">${(estimate.total_material_cost / 1000).toFixed(0)}K</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Labor Cost</div>
            <div className="text-2xl font-bold">${(estimate.total_labor_cost / 1000).toFixed(0)}K</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Subtotal</div>
            <div className="text-2xl font-bold">${(estimate.subtotal / 1000).toFixed(0)}K</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Grand Total</div>
            <div className="text-2xl font-bold text-blue-600">${(estimate.grand_total / 1000).toFixed(0)}K</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={exportToPDF} variant="primary">
            Export to PDF
          </Button>
          <Button variant="outline">Share Bid</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Line Items by CSI Division</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-2 text-left">CSI Division</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Material</th>
                <th className="px-4 py-2 text-right">Labor</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems?.map((li: any) => (
                <tr key={li.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{li.csi_division}</td>
                  <td className="px-4 py-2">{li.work_item_description}</td>
                  <td className="px-4 py-2 text-right">{li.quantity.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    ${li.material_total.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    ${li.labor_total.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-bold">
                    ${li.line_total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

---

## 5. API ENDPOINTS

File: `/src/edge-functions/api/estimating.ts`

```typescript
// POST /api/v1/estimates/upload-plan
export async function uploadConstructionPlan(req: Request) {
  const formData = await req.formData();
  const projectId = formData.get('project_id') as string;
  const planFile = formData.get('plan') as File;

  // Upload to Supabase Storage
  const { data: uploadData } = await supabase.storage
    .from('construction-plans')
    .upload(`${projectId}/${planFile.name}`, planFile);

  // Extract plan details using Claude Vision
  const extractedData = await extractPlanDetails(uploadData.path, `Project: ${projectId}`);

  // Create estimate
  const { data: estimate } = await supabase
    .from('estimates')
    .insert({
      project_id: projectId,
      estimate_name: `Plan Analysis - ${new Date().toLocaleDateString()}`,
      extracted_ai_data: extractedData,
      extraction_confidence: 0.85,
    })
    .select()
    .single();

  // Generate line items from extracted data
  const lineItems = await generateLineItemsFromPlan(estimate.id, extractedData, projectId);

  return new Response(
    JSON.stringify({
      estimate_id: estimate.id,
      extracted_data: extractedData,
      line_items_count: lineItems.length,
    }),
    { status: 201 }
  );
}

// GET /api/v1/estimates/:estimateId
export async function getEstimate(req: Request) {
  const estimateId = new URL(req.url).pathname.split('/')[3];

  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', estimateId)
    .single();

  if (error) throw error;

  return new Response(JSON.stringify(data), { status: 200 });
}

// GET /api/v1/estimates/:estimateId/line-items
export async function getEstimateLineItems(req: Request) {
  const estimateId = new URL(req.url).pathname.split('/')[3];

  const { data, error } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', estimateId)
    .order('csi_division', { ascending: true });

  if (error) throw error;

  return new Response(JSON.stringify(data), { status: 200 });
}
```

---

## 6. VERIFICATION SCRIPT

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/sessions/wonderful-practical-brahmagupta/mnt/sitesync-pm"

echo "=== D3: AI Estimating Verification ==="

# 1. Check database schema
echo "1. Verifying database schema..."
TABLES=("estimates" "estimate_line_items" "unit_costs" "estimate_assemblies")

for table in "${TABLES[@]}"; do
  if grep -r "$table" "$PROJECT_ROOT/src" --include="*.sql"; then
    echo "   ✓ $table schema exists"
  else
    echo "   ✗ MISSING: $table"
  fi
done

# 2. Check React components
echo "2. Checking React components..."
[ -f "$PROJECT_ROOT/src/pages/estimating.tsx" ] && echo "   ✓ estimating.tsx" || echo "   ✗ MISSING: estimating.tsx"
[ -f "$PROJECT_ROOT/src/components/estimating/plan-upload.tsx" ] && echo "   ✓ plan-upload.tsx" || echo "   ✗ MISSING: plan-upload.tsx"

# 3. Check Claude Vision integration
echo "3. Checking Claude Vision integration..."
grep -r "claude-opus" "$PROJECT_ROOT/src/edge-functions" --include="*.ts" && echo "   ✓ Claude Vision configured" || echo "   ⚠ Claude Vision needs setup"

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 7. INTEGRATION CHECKLIST

- [ ] Database schema for estimates & line items
- [ ] Claude Vision plan reading (PDF extraction)
- [ ] Room/fixture/material detection
- [ ] CSI Division classification
- [ ] Unit cost database (by location)
- [ ] Assembly-based estimating templates
- [ ] Historical cost data collection
- [ ] What-if scenario analysis
- [ ] Bid comparison logic
- [ ] PDF export with detailed breakdown
- [ ] Excel export for subcontractor distribution
- [ ] Regional cost multiplier application
- [ ] Profit margin/contingency controls
- [ ] Estimate status workflow (draft → submitted → awarded)

---

## 8. SUCCESS METRICS

- Plan reading accuracy: > 95% (vs. manual takeoff)
- Estimate generation time: < 15 minutes (vs. 2-4 hours manual)
- Bid adoption rate: > 40% of estimates quoted
- Average estimate value: $100K-500K
- Revenue per estimate: $50-100

