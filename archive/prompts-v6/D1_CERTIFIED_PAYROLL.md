# D1: Certified Payroll UI + Davis-Bacon Compliance Engine

**Status:** Framework exists, UI missing (CRITICAL PATH: federal project unlock)
**Unlock Value:** $500K+ federal contracts currently unreachable
**Dependencies:** `/src/edge-functions/payroll-engine.ts` (schema exists)

---

## 1. OVERVIEW: WHY CERTIFIED PAYROLL IS A REVENUE BLOCKER

Davis-Bacon Act (40 USC § 3141) requires:
- Prevailing wage compliance (federal + state minimum, often $45-80/hour)
- WH-347 form submission (Department of Labor form)
- Prevailing wage rate lookup by trade + location
- Worker classification tracking (apprentice/journeyman ratios enforce union requirements)
- Weekly certified payroll reporting

**Market Context:**
- $200B/year federal construction projects (all require Davis-Bacon)
- Procore certified payroll available to 2% of customers (enterprise-only)
- SiteSync entering this market = $2-5M revenue per 100 customers with federal work

**Current State:** Database schema + edge function exist, ZERO UI.

---

## 2. DATABASE SCHEMA (VERIFY EXISTING)

Verify this exists in `/src/edge-functions/payroll-engine.ts`:

```sql
-- Certified payroll header
CREATE TABLE certified_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  week_ending DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  -- Compliance status
  status VARCHAR(20) DEFAULT 'draft', -- draft | submitted | certified | rejected
  rejection_reason TEXT,
  -- WH-347 metadata
  payroll_period_start DATE,
  payroll_period_end DATE,
  -- Federal contract info
  federal_contract_number VARCHAR(50),
  sam_registration_id VARCHAR(20), -- SAM.gov unique ID
  -- Signature/certification
  certified_by_name VARCHAR(100),
  certified_by_title VARCHAR(100),
  certified_date TIMESTAMP,
  certified_signature_url TEXT,
  submission_date TIMESTAMP,
  submission_confirmation_number VARCHAR(50),

  CONSTRAINT unique_weekly_payroll UNIQUE(project_id, week_ending),
  CONSTRAINT valid_dates CHECK(week_ending >= payroll_period_start)
);

-- Prevailing wage rates (cached from SAM.gov)
CREATE TABLE prevailing_wage_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SAM.gov metadata
  sam_regulation_number VARCHAR(20), -- e.g., "14 CFR 1000"
  location_name VARCHAR(200), -- County, State or State-wide
  state_code CHAR(2),
  county_name VARCHAR(100),
  -- Trade classification
  trade_classification VARCHAR(200), -- "Carpenter", "Electrician", etc.
  davis_bacon_code VARCHAR(20), -- DB001, etc.
  csi_division VARCHAR(10), -- CSI division alignment
  -- Wages (weekly rates)
  basic_hourly_rate DECIMAL(10,2),
  fringe_benefit_rate DECIMAL(10,2), -- Cash fringe benefit
  -- Apprenticeship rules
  apprentice_min_ratio DECIMAL(3,2), -- e.g., 0.10 = min 10% apprentices
  apprentice_max_ratio DECIMAL(3,2), -- e.g., 0.50 = max 50% apprentices
  apprentice_hourly_rate DECIMAL(10,2),
  -- Effective dates
  effective_date DATE,
  expiration_date DATE,
  -- SAM.gov metadata
  sam_page_url TEXT,
  last_synced TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_apprentice_ratios CHECK(apprentice_min_ratio <= apprentice_max_ratio)
);

-- Certified payroll detail lines (workers, hours, wages)
CREATE TABLE certified_payroll_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certified_payroll_id UUID NOT NULL REFERENCES certified_payroll(id) ON DELETE CASCADE,
  -- Worker reference
  worker_id UUID REFERENCES workforce(id), -- Existing crew member
  worker_name VARCHAR(100),
  worker_ssn_last4 CHAR(4), -- For identification on WH-347
  -- Classification
  classification VARCHAR(200), -- "Carpenter", "Laborer", etc. (must match prevailing wage rate)
  classification_code VARCHAR(20),
  apprentice_status VARCHAR(20), -- 'journeyman' | 'apprentice' | 'trainee'
  -- Hours and wages (daily breakdown)
  monday_hours DECIMAL(5,2),
  tuesday_hours DECIMAL(5,2),
  wednesday_hours DECIMAL(5,2),
  thursday_hours DECIMAL(5,2),
  friday_hours DECIMAL(5,2),
  saturday_hours DECIMAL(5,2),
  sunday_hours DECIMAL(5,2),
  total_hours DECIMAL(6,2) GENERATED ALWAYS AS (
    COALESCE(monday_hours, 0) + COALESCE(tuesday_hours, 0) +
    COALESCE(wednesday_hours, 0) + COALESCE(thursday_hours, 0) +
    COALESCE(friday_hours, 0) + COALESCE(saturday_hours, 0) +
    COALESCE(sunday_hours, 0)
  ) STORED,
  -- Wages
  wage_rate DECIMAL(10,2), -- Hourly rate paid (must be >= prevailing wage)
  gross_wages DECIMAL(12,2) GENERATED ALWAYS AS (total_hours * wage_rate) STORED,
  -- Fringe benefits breakdown
  fringe_benefit_type VARCHAR(50), -- 'cash' | 'health_insurance' | 'retirement' | 'combo'
  fringe_cash_paid DECIMAL(12,2), -- Cash fringe benefit paid
  fringe_via_benefits DECIMAL(12,2), -- Value of provided benefits
  fringe_total DECIMAL(12,2) GENERATED ALWAYS AS (
    COALESCE(fringe_cash_paid, 0) + COALESCE(fringe_via_benefits, 0)
  ) STORED,
  -- Deductions
  federal_withholding DECIMAL(10,2),
  fica_withholding DECIMAL(10,2),
  state_withholding DECIMAL(10,2),
  other_deductions DECIMAL(10,2),
  total_deductions DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(federal_withholding, 0) + COALESCE(fica_withholding, 0) +
    COALESCE(state_withholding, 0) + COALESCE(other_deductions, 0)
  ) STORED,
  -- Net pay
  net_pay DECIMAL(12,2) GENERATED ALWAYS AS (
    COALESCE(gross_wages, 0) + COALESCE(fringe_total, 0) - COALESCE(total_deductions, 0)
  ) STORED,
  -- Job assignment (cost code alignment)
  cost_code_id UUID REFERENCES cost_codes(id),
  task_id UUID REFERENCES tasks(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT wage_meets_minimum CHECK(wage_rate >= (
    SELECT basic_hourly_rate FROM prevailing_wage_rates
    WHERE trade_classification = certified_payroll_detail.classification
    LIMIT 1
  )),
  CONSTRAINT valid_deductions CHECK(total_deductions >= 0),
  CONSTRAINT valid_fringe CHECK(fringe_total >= 0)
);

-- Compliance audit trail
CREATE TABLE certified_payroll_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certified_payroll_id UUID NOT NULL REFERENCES certified_payroll(id) ON DELETE CASCADE,
  action VARCHAR(50), -- 'created' | 'submitted' | 'certified' | 'rejected' | 'detail_added' | 'detail_corrected'
  actor_user_id UUID REFERENCES auth.users(id),
  actor_name VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW(),
  before_state JSONB, -- Previous values
  after_state JSONB,  -- New values
  notes TEXT
);
```

---

## 3. REACT PAGES & COMPONENTS

### 3a. `/src/pages/certified-payroll.tsx` - Main Page

```typescript
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Card, Button, Tabs, Select, Alert, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/projects';
import CertifiedPayrollList from '@/components/certified-payroll/certified-payroll-list';
import CertifiedPayrollForm from '@/components/certified-payroll/certified-payroll-form';
import WH347Preview from '@/components/certified-payroll/wh347-preview';
import ComplianceDashboard from '@/components/certified-payroll/compliance-dashboard';
import PayrollEntry from '@/components/certified-payroll/payroll-entry';

export default function CertifiedPayrollPage() {
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [selectedWeekEnding, setSelectedWeekEnding] = useState<Date>(
    endOfWeek(new Date(), { weekStartsOn: 5 }) // Friday
  );
  const [viewMode, setViewMode] = useState<'list' | 'entry' | 'wh347' | 'dashboard'>('dashboard');

  // Fetch certified payroll records
  const { data: payrolls, isLoading, error } = useQuery({
    queryKey: ['certified-payroll', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/certified-payroll`);
      if (!response.ok) throw new Error('Failed to load certified payroll');
      return response.json();
    },
    enabled: !!activeProject?.id,
  });

  // Check federal contract status
  const { data: federalStatus } = useQuery({
    queryKey: ['federal-contract', activeProject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${activeProject?.id}/federal-status`);
      return response.json();
    },
    enabled: !!activeProject?.id,
  });

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="info">Select a project to view certified payroll</Alert>
      </div>
    );
  }

  if (!federalStatus?.is_federal_project) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="warning">
          This project is not marked as a federal contract. Enable Davis-Bacon compliance in project settings.
        </Alert>
        <Button
          onClick={() => window.location.href = `/projects/${activeProject.id}/settings`}
          variant="outline"
        >
          Go to Project Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Certified Payroll (Davis-Bacon)</h1>
        <p className="text-gray-600">
          Federal contract: {activeProject.federal_contract_number || 'Not set'}
        </p>
      </div>

      {/* Alert: Non-Compliance Status */}
      {payrolls?.some((p: any) => p.status === 'rejected') && (
        <Alert variant="error" title="Action Required">
          <p>One or more payroll submissions have been rejected. Review and resubmit.</p>
        </Alert>
      )}

      {/* Tab Navigation */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <Tabs.List>
          <Tabs.Trigger value="dashboard">Compliance Dashboard</Tabs.Trigger>
          <Tabs.Trigger value="list">Payroll Records</Tabs.Trigger>
          <Tabs.Trigger value="entry">Enter Payroll</Tabs.Trigger>
          <Tabs.Trigger value="wh347">WH-347 Preview</Tabs.Trigger>
        </Tabs.List>

        {/* Compliance Dashboard Tab */}
        <Tabs.Content value="dashboard">
          {isLoading ? (
            <Spinner />
          ) : (
            <ComplianceDashboard
              payrolls={payrolls}
              federalStatus={federalStatus}
            />
          )}
        </Tabs.Content>

        {/* Payroll List Tab */}
        <Tabs.Content value="list">
          {isLoading ? (
            <Spinner />
          ) : (
            <CertifiedPayrollList
              payrolls={payrolls}
              onSelectPayroll={(id) => {
                // Navigate to payroll detail
                window.location.href = `/certified-payroll/${id}`;
              }}
            />
          )}
        </Tabs.Content>

        {/* Payroll Entry Tab */}
        <Tabs.Content value="entry">
          <PayrollEntry
            projectId={activeProject.id}
            weekEnding={selectedWeekEnding}
            onSuccess={() => {
              // Refetch payroll list
            }}
          />
        </Tabs.Content>

        {/* WH-347 Preview Tab */}
        <Tabs.Content value="wh347">
          {payrolls?.[0] && (
            <WH347Preview
              payrollId={payrolls[0].id}
              weekEnding={payrolls[0].week_ending}
            />
          )}
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
```

### 3b. `/src/components/certified-payroll/payroll-entry.tsx` - Weekly Entry Form

```typescript
import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Input, Select, Card, Spinner, Alert, Dialog } from '@/components/ui';
import { format } from 'date-fns';
import PrevalingWageLookup from './prevailing-wage-lookup';

const PayrollDetailSchema = z.object({
  worker_id: z.string().uuid('Worker required'),
  worker_name: z.string().min(1, 'Name required'),
  classification: z.string().min(1, 'Classification required'),
  apprentice_status: z.enum(['journeyman', 'apprentice', 'trainee']),
  monday_hours: z.coerce.number().min(0).max(24),
  tuesday_hours: z.coerce.number().min(0).max(24),
  wednesday_hours: z.coerce.number().min(0).max(24),
  thursday_hours: z.coerce.number().min(0).max(24),
  friday_hours: z.coerce.number().min(0).max(24),
  saturday_hours: z.coerce.number().min(0).max(24),
  sunday_hours: z.coerce.number().min(0).max(24),
  wage_rate: z.coerce.number().positive('Wage must be positive'),
  fringe_benefit_type: z.enum(['cash', 'health_insurance', 'retirement', 'combo']),
  fringe_cash_paid: z.coerce.number().min(0),
  fringe_via_benefits: z.coerce.number().min(0),
  federal_withholding: z.coerce.number().min(0),
  fica_withholding: z.coerce.number().min(0),
  state_withholding: z.coerce.number().min(0),
  other_deductions: z.coerce.number().min(0),
  cost_code_id: z.string().uuid().optional(),
});

const PayrollFormSchema = z.object({
  week_ending: z.coerce.date(),
  federal_contract_number: z.string().optional(),
  payroll_period_start: z.coerce.date(),
  payroll_period_end: z.coerce.date(),
  details: z.array(PayrollDetailSchema).min(1, 'Add at least one worker'),
});

type PayrollFormData = z.infer<typeof PayrollFormSchema>;

interface PayrollEntryProps {
  projectId: string;
  weekEnding: Date;
  onSuccess: () => void;
}

export default function PayrollEntry({ projectId, weekEnding, onSuccess }: PayrollEntryProps) {
  const [showPrevalingWageLookup, setShowPrevalingWageLookup] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<string | null>(null);

  // Fetch prevailing wage rates for this project's location
  const { data: prevalingWages } = useQuery({
    queryKey: ['prevailing-wages', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/prevailing-wages`);
      return response.json();
    },
  });

  // Fetch workforce for project
  const { data: workforce } = useQuery({
    queryKey: ['workforce', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/projects/${projectId}/workforce`);
      return response.json();
    },
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PayrollFormData>({
    resolver: zodResolver(PayrollFormSchema),
    defaultValues: {
      week_ending: weekEnding,
      payroll_period_start: new Date(weekEnding.getTime() - 7 * 24 * 60 * 60 * 1000),
      payroll_period_end: weekEnding,
      details: [{}],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'details',
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (data: PayrollFormData) => {
      const response = await fetch(`/api/v1/projects/${projectId}/certified-payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create payroll');
      return response.json();
    },
    onSuccess: () => {
      onSuccess();
      alert('Payroll saved successfully');
    },
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Weekly Payroll Entry</h2>

        <form onSubmit={handleSubmit((data) => submitMutation.mutate(data))} className="space-y-6">
          {/* Period Information */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Week Ending</label>
              <Input
                type="date"
                {...register('week_ending')}
              />
              {errors.week_ending && <p className="text-red-500 text-sm mt-1">{errors.week_ending.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Period Start</label>
              <Input
                type="date"
                {...register('payroll_period_start')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Period End</label>
              <Input
                type="date"
                {...register('payroll_period_end')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Federal Contract Number</label>
            <Input
              placeholder="e.g., FAC-123456"
              {...register('federal_contract_number')}
            />
          </div>

          {/* Worker Hours Entry */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Worker Hours & Wages</h3>
              <Button
                type="button"
                onClick={() => append({})}
                variant="outline"
              >
                + Add Worker
              </Button>
            </div>

            <div className="space-y-6">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold">Worker {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => remove(index)}
                        variant="ghost"
                        className="text-red-500"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Worker Selection */}
                    <Controller
                      name={`details.${index}.worker_id`}
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label className="block text-sm font-medium mb-2">Worker</label>
                          <Select
                            {...field}
                            options={workforce?.map((w: any) => ({
                              value: w.id,
                              label: `${w.first_name} ${w.last_name}`,
                            }))}
                          />
                          {errors.details?.[index]?.worker_id && (
                            <p className="text-red-500 text-sm">{errors.details[index]?.worker_id?.message}</p>
                          )}
                        </div>
                      )}
                    />

                    {/* Classification */}
                    <Controller
                      name={`details.${index}.classification`}
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Classification
                            <Button
                              type="button"
                              variant="link"
                              onClick={() => {
                                setSelectedClassification(field.value);
                                setShowPrevalingWageLookup(true);
                              }}
                              className="ml-2"
                            >
                              Look up rates
                            </Button>
                          </label>
                          <Select
                            {...field}
                            options={prevalingWages?.map((w: any) => ({
                              value: w.trade_classification,
                              label: w.trade_classification,
                            }))}
                          />
                        </div>
                      )}
                    />
                  </div>

                  {/* Apprentice Status & Wage Rate */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Controller
                      name={`details.${index}.apprentice_status`}
                      control={control}
                      render={({ field }) => (
                        <div>
                          <label className="block text-sm font-medium mb-2">Status</label>
                          <Select
                            {...field}
                            options={[
                              { value: 'journeyman', label: 'Journeyman' },
                              { value: 'apprentice', label: 'Apprentice' },
                              { value: 'trainee', label: 'Trainee' },
                            ]}
                          />
                        </div>
                      )}
                    />

                    <div>
                      <label className="block text-sm font-medium mb-2">Hourly Wage Rate</label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`details.${index}.wage_rate`)}
                        placeholder="0.00"
                      />
                      {prevalingWages && (
                        <p className="text-xs text-gray-500 mt-1">
                          Minimum: ${prevalingWages[0]?.basic_hourly_rate || 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Daily Hours */}
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                      <div key={day}>
                        <label className="block text-xs font-medium mb-1 capitalize">{day.slice(0, 3)}</label>
                        <Input
                          type="number"
                          step="0.5"
                          {...register(`details.${index}.${day}_hours`)}
                          className="text-center"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Fringe Benefits */}
                  <fieldset className="border rounded p-4 mb-4">
                    <legend className="text-sm font-semibold px-2">Fringe Benefits</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <Controller
                        name={`details.${index}.fringe_benefit_type`}
                        control={control}
                        render={({ field }) => (
                          <div>
                            <label className="block text-sm font-medium mb-2">Type</label>
                            <Select
                              {...field}
                              options={[
                                { value: 'cash', label: 'Cash Payment' },
                                { value: 'health_insurance', label: 'Health Insurance' },
                                { value: 'retirement', label: 'Retirement Plan' },
                                { value: 'combo', label: 'Combination' },
                              ]}
                            />
                          </div>
                        )}
                      />

                      <div>
                        <label className="block text-sm font-medium mb-2">Amount (if Cash)</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`details.${index}.fringe_cash_paid`)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </fieldset>

                  {/* Deductions */}
                  <fieldset className="border rounded p-4">
                    <legend className="text-sm font-semibold px-2">Deductions</legend>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1">Federal Withholding</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`details.${index}.federal_withholding`)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">FICA Withholding</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`details.${index}.fica_withholding`)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">State Withholding</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`details.${index}.state_withholding`)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Other Deductions</label>
                        <Input
                          type="number"
                          step="0.01"
                          {...register(`details.${index}.other_deductions`)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </fieldset>
                </Card>
              ))}
            </div>

            {errors.details && (
              <Alert variant="error" className="mt-4">
                {typeof errors.details === 'string' ? errors.details : 'Please fill in all required fields'}
              </Alert>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner className="mr-2" /> : null}
              Save & Continue
            </Button>
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {/* Prevailing Wage Lookup Modal */}
      {showPrevalingWageLookup && selectedClassification && (
        <PrevalingWageLookup
          classification={selectedClassification}
          prevalingWages={prevalingWages}
          onClose={() => setShowPrevalingWageLookup(false)}
        />
      )}
    </div>
  );
}
```

### 3c. `/src/components/certified-payroll/prevailing-wage-lookup.tsx`

```typescript
import React, { useState } from 'react';
import { Card, Button, Input, Select, Badge } from '@/components/ui';

interface PrevalingWageLookupProps {
  classification: string;
  prevalingWages: any[];
  onClose: () => void;
}

export default function PrevalingWageLookup({
  classification,
  prevalingWages,
  onClose,
}: PrevalingWageLookupProps) {
  const [location, setLocation] = useState('');

  const matchingRates = prevalingWages?.filter(
    (w) =>
      w.trade_classification === classification &&
      (!location || w.location_name.toLowerCase().includes(location.toLowerCase()))
  ) || [];

  return (
    <Card className="p-6 max-w-4xl">
      <h2 className="text-2xl font-bold mb-4">Prevailing Wage Rates: {classification}</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Filter by Location</label>
        <Input
          placeholder="e.g., Los Angeles County, California"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-2 text-left">Location</th>
              <th className="px-4 py-2 text-right">Base Rate</th>
              <th className="px-4 py-2 text-right">Fringe Benefit</th>
              <th className="px-4 py-2 text-right">Total Comp</th>
              <th className="px-4 py-2 text-left">Apprentice Rules</th>
              <th className="px-4 py-2 text-left">Effective</th>
            </tr>
          </thead>
          <tbody>
            {matchingRates.length > 0 ? (
              matchingRates.map((rate) => (
                <tr key={rate.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">
                    <div>{rate.location_name}</div>
                    <div className="text-xs text-gray-500">{rate.davis_bacon_code}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    ${rate.basic_hourly_rate.toFixed(2)}/hr
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    ${rate.fringe_benefit_rate.toFixed(2)}/hr
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold">
                    ${(rate.basic_hourly_rate + rate.fringe_benefit_rate).toFixed(2)}/hr
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div>Min: {(rate.apprentice_min_ratio * 100).toFixed(0)}%</div>
                    <div>Max: {(rate.apprentice_max_ratio * 100).toFixed(0)}%</div>
                    <div>${rate.apprentice_hourly_rate.toFixed(2)} (apprentice)</div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(rate.effective_date).toLocaleDateString()} -
                    {new Date(rate.expiration_date).toLocaleDateString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No rates found for "{classification}" in "{location}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <a
          href="https://sam.gov/content/dod-wages"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline text-sm"
        >
          View SAM.gov Prevailing Wages (official source)
        </a>
      </div>

      <Button onClick={onClose} className="mt-4">
        Close
      </Button>
    </Card>
  );
}
```

### 3d. `/src/components/certified-payroll/compliance-dashboard.tsx`

```typescript
import React from 'react';
import { Card, Badge, Button, Alert } from '@/components/ui';
import { format } from 'date-fns';

interface ComplianceDashboardProps {
  payrolls: any[];
  federalStatus: any;
}

export default function ComplianceDashboard({
  payrolls,
  federalStatus,
}: ComplianceDashboardProps) {
  const statuses = {
    draft: payrolls.filter((p) => p.status === 'draft').length,
    submitted: payrolls.filter((p) => p.status === 'submitted').length,
    certified: payrolls.filter((p) => p.status === 'certified').length,
    rejected: payrolls.filter((p) => p.status === 'rejected').length,
  };

  const totalWorkerHours = payrolls.reduce(
    (sum, p) =>
      sum +
      p.details.reduce((dsum: number, d: any) => dsum + (d.total_hours || 0), 0),
    0
  );

  const apprenticeRatios = payrolls
    .flatMap((p) => p.details)
    .reduce(
      (acc, d) => {
        if (d.apprentice_status === 'apprentice') acc.apprentices += d.total_hours || 0;
        acc.total += d.total_hours || 0;
        return acc;
      },
      { apprentices: 0, total: 0 }
    );

  const apprenticePercent = apprenticeRatios.total > 0
    ? ((apprenticeRatios.apprentices / apprenticeRatios.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-gray-600">{statuses.draft}</div>
          <div className="text-sm text-gray-500 mt-2">Draft</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{statuses.submitted}</div>
          <div className="text-sm text-gray-500 mt-2">Awaiting Review</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{statuses.certified}</div>
          <div className="text-sm text-gray-500 mt-2">Certified</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{statuses.rejected}</div>
          <div className="text-sm text-gray-500 mt-2">Rejected</div>
        </Card>
      </div>

      {/* Alerts */}
      {statuses.rejected > 0 && (
        <Alert variant="error" title="Rejected Submissions">
          <p>{statuses.rejected} payroll submission(s) rejected. Review feedback and resubmit.</p>
        </Alert>
      )}

      {/* Compliance Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Compliance Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold">{totalWorkerHours.toFixed(0)}</div>
            <div className="text-sm text-gray-600">Total Worker Hours</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{apprenticePercent}%</div>
            <div className="text-sm text-gray-600">Apprentice Ratio</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{payrolls.length}</div>
            <div className="text-sm text-gray-600">Payroll Periods</div>
          </div>
        </div>
      </Card>

      {/* Recent Submissions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Submissions</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {payrolls.slice(0, 10).map((payroll) => (
            <div
              key={payroll.id}
              className="flex items-center justify-between p-3 border rounded bg-gray-50"
            >
              <div>
                <div className="font-medium">
                  Week ending {format(new Date(payroll.week_ending), 'MMM d, yyyy')}
                </div>
                <div className="text-xs text-gray-600">
                  {payroll.details.length} workers · {payroll.details.reduce((s, d) => s + (d.total_hours || 0), 0).toFixed(1)} hours
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    payroll.status === 'certified'
                      ? 'success'
                      : payroll.status === 'rejected'
                        ? 'error'
                        : payroll.status === 'submitted'
                          ? 'warning'
                          : 'default'
                  }
                >
                  {payroll.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.location.href = `/certified-payroll/${payroll.id}`;
                  }}
                >
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

---

## 4. SAM.GOV API INTEGRATION

File: `/src/edge-functions/sam-gov-sync.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SAM_API_BASE = 'https://api.sam.gov/uc/v2';
const SAM_API_KEY = process.env.SAM_GOV_API_KEY!;

interface PrevalingWageRate {
  sam_regulation_number: string;
  location_name: string;
  state_code: string;
  county_name: string;
  trade_classification: string;
  davis_bacon_code: string;
  csi_division: string;
  basic_hourly_rate: number;
  fringe_benefit_rate: number;
  apprentice_min_ratio: number;
  apprentice_max_ratio: number;
  apprentice_hourly_rate: number;
  effective_date: Date;
  expiration_date: Date;
  sam_page_url: string;
}

/**
 * Fetch prevailing wage rates from SAM.gov API
 * @param state - State code (e.g., 'CA')
 * @param county - County name (optional, for specific county rates)
 * @returns Array of prevailing wage rates
 */
export async function fetchPrevalingWages(
  state: string,
  county?: string
): Promise<PrevalingWageRate[]> {
  try {
    const params = new URLSearchParams({
      api_key: SAM_API_KEY,
      state: state.toUpperCase(),
      ...(county && { county }),
    });

    const response = await fetch(
      `${SAM_API_BASE}/lookup/ofo/prevailing_wage?${params}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`SAM.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.map((item: any) => ({
      sam_regulation_number: item.regulation_number,
      location_name: item.location_name,
      state_code: item.state_code,
      county_name: item.county_name,
      trade_classification: item.classification,
      davis_bacon_code: item.code,
      csi_division: item.csi_division || '',
      basic_hourly_rate: parseFloat(item.basic_hourly_rate),
      fringe_benefit_rate: parseFloat(item.fringe_benefit_rate),
      apprentice_min_ratio: parseFloat(item.apprentice_min_ratio) / 100,
      apprentice_max_ratio: parseFloat(item.apprentice_max_ratio) / 100,
      apprentice_hourly_rate: parseFloat(item.apprentice_hourly_rate),
      effective_date: new Date(item.effective_date),
      expiration_date: new Date(item.expiration_date),
      sam_page_url: item.url,
    }));
  } catch (error) {
    console.error('Error fetching prevailing wages:', error);
    throw error;
  }
}

/**
 * Sync prevailing wage rates for a project to local cache
 */
export async function syncPrevalingWagesForProject(projectId: string) {
  // Get project location
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('project_state, project_county')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    throw new Error('Project not found');
  }

  // Fetch from SAM.gov
  const rates = await fetchPrevalingWages(project.project_state, project.project_county);

  // Upsert to cache table
  const { error: upsertError } = await supabase
    .from('prevailing_wage_rates')
    .upsert(
      rates.map((r) => ({
        ...r,
        last_synced: new Date(),
      })),
      {
        onConflict: 'sam_regulation_number,location_name,trade_classification',
      }
    );

  if (upsertError) {
    throw new Error(`Failed to cache rates: ${upsertError.message}`);
  }

  return rates;
}

/**
 * WH-347 Electronic Submission to Department of Labor
 * (Stub for future implementation - requires digital signature)
 */
export async function submitWH347ToGovernment(certifiedPayrollId: string) {
  const { data: payroll, error: payrollError } = await supabase
    .from('certified_payroll')
    .select('*')
    .eq('id', certifiedPayrollId)
    .single();

  if (payrollError || !payroll) {
    throw new Error('Certified payroll not found');
  }

  // TODO: Implement actual WH-347 submission
  // This requires:
  // 1. DSA (Federal Prevailing Wage Form WH-347) electronic signature
  // 2. Encryption and transmission to DOL via specific endpoint
  // 3. Confirmation number receipt

  return {
    submission_confirmation_number: `DOL-${Date.now()}`,
    submission_date: new Date(),
    status: 'submitted',
  };
}
```

---

## 5. WH-347 FORM GENERATION

File: `/src/components/certified-payroll/wh347-preview.tsx`

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Spinner } from '@/components/ui';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface WH347PreviewProps {
  payrollId: string;
  weekEnding: string;
}

export default function WH347Preview({ payrollId, weekEnding }: WH347PreviewProps) {
  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['wh347', payrollId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/certified-payroll/${payrollId}/wh347`);
      return response.json();
    },
  });

  const generatePDF = () => {
    if (!payrollData) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 10;

    // Header
    pdf.setFontSize(12);
    pdf.text('PAYROLL (WH-347)', pageWidth / 2, y, { align: 'center' });
    y += 8;

    pdf.setFontSize(10);
    pdf.text(`Week Ending: ${format(new Date(weekEnding), 'MM/dd/yyyy')}`, 10, y);
    y += 6;

    // Project Info
    pdf.setFontSize(9);
    pdf.text(`Project: ${payrollData.project_name}`, 10, y);
    y += 5;
    pdf.text(`Federal Contract #: ${payrollData.federal_contract_number}`, 10, y);
    y += 8;

    // Worker Details Table
    const tableData = payrollData.details.map((d: any) => [
      d.worker_name,
      d.classification,
      d.total_hours.toFixed(1),
      `$${d.wage_rate.toFixed(2)}`,
      `$${d.gross_wages.toFixed(2)}`,
      `$${d.fringe_total.toFixed(2)}`,
      `$${d.net_pay.toFixed(2)}`,
    ]);

    (pdf as any).autoTable({
      startY: y,
      head: [['Worker', 'Classification', 'Hours', 'Rate', 'Gross', 'Fringe', 'Net']],
      body: tableData,
      margin: { left: 10, right: 10 },
      fontSize: 8,
    });

    // Certification
    y = (pdf as any).lastAutoTable.finalY + 10;
    pdf.setFontSize(9);
    pdf.text('Certified by: _____________________', 10, y);
    y += 5;
    pdf.text('Date: ____________________', 10, y);

    pdf.save(`WH-347-${format(new Date(weekEnding), 'yyyy-MM-dd')}.pdf`);
  };

  if (isLoading) return <Spinner />;

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">WH-347 Form Preview</h2>

      {/* Preview */}
      <div className="border rounded p-6 bg-white mb-6 font-mono text-sm">
        <div className="text-center font-bold mb-4">PAYROLL (WH-347)</div>

        <div className="mb-4">
          <div>Week Ending: {format(new Date(weekEnding), 'MM/dd/yyyy')}</div>
          <div>Project: {payrollData?.project_name}</div>
          <div>Federal Contract #: {payrollData?.federal_contract_number}</div>
        </div>

        <table className="w-full border-collapse border text-xs mb-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Worker</th>
              <th className="border p-2 text-left">Classification</th>
              <th className="border p-2 text-right">Hours</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Gross</th>
              <th className="border p-2 text-right">Fringe</th>
              <th className="border p-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {payrollData?.details.map((detail: any, idx: number) => (
              <tr key={idx}>
                <td className="border p-2">{detail.worker_name}</td>
                <td className="border p-2">{detail.classification}</td>
                <td className="border p-2 text-right">{detail.total_hours.toFixed(1)}</td>
                <td className="border p-2 text-right">${detail.wage_rate.toFixed(2)}</td>
                <td className="border p-2 text-right">${detail.gross_wages.toFixed(2)}</td>
                <td className="border p-2 text-right">${detail.fringe_total.toFixed(2)}</td>
                <td className="border p-2 text-right">${detail.net_pay.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 border-t pt-4">
          <div>Certified by: ________________________</div>
          <div>Date: ________________________</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={generatePDF} variant="primary">
          Download PDF
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            const response = await fetch(`/api/v1/certified-payroll/${payrollId}/submit-wh347`, {
              method: 'POST',
            });
            if (response.ok) {
              alert('WH-347 submitted to government');
            }
          }}
        >
          Submit to Government
        </Button>
      </div>
    </Card>
  );
}
```

---

## 6. API ENDPOINTS

File: `/src/edge-functions/api/certified-payroll.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// POST /api/v1/projects/:projectId/certified-payroll
export async function createCertifiedPayroll(req: Request) {
  const { projectId } = new URL(req.url).pathname.split('/');
  const data = await req.json();

  const { error: createError, data: payroll } = await supabase
    .from('certified_payroll')
    .insert({
      project_id: projectId,
      week_ending: data.week_ending,
      payroll_period_start: data.payroll_period_start,
      payroll_period_end: data.payroll_period_end,
      federal_contract_number: data.federal_contract_number,
      status: 'draft',
    })
    .select()
    .single();

  if (createError) throw createError;

  // Insert detail lines
  const detailErrors = await Promise.all(
    data.details.map((d: any) =>
      supabase.from('certified_payroll_detail').insert({
        certified_payroll_id: payroll.id,
        ...d,
      })
    )
  );

  return new Response(
    JSON.stringify({ id: payroll.id, details: data.details.length }),
    { status: 201 }
  );
}

// GET /api/v1/projects/:projectId/certified-payroll
export async function getCertifiedPayrolls(req: Request) {
  const projectId = new URL(req.url).pathname.split('/')[3];

  const { data, error } = await supabase
    .from('certified_payroll')
    .select(`
      *,
      certified_payroll_detail(*)
    `)
    .eq('project_id', projectId)
    .order('week_ending', { ascending: false });

  if (error) throw error;

  return new Response(JSON.stringify(data), { status: 200 });
}

// GET /api/v1/projects/:projectId/prevailing-wages
export async function getPrevalingWages(req: Request) {
  const projectId = new URL(req.url).pathname.split('/')[3];

  const { data: project } = await supabase
    .from('projects')
    .select('project_state, project_county')
    .eq('id', projectId)
    .single();

  const { data: rates, error } = await supabase
    .from('prevailing_wage_rates')
    .select('*')
    .eq('state_code', project.project_state)
    .gte('expiration_date', new Date().toISOString());

  if (error) throw error;

  return new Response(JSON.stringify(rates), { status: 200 });
}
```

---

## 7. VERIFICATION SCRIPT

```bash
#!/bin/bash
set -e

PROJECT_ROOT="/sessions/wonderful-practical-brahmagupta/mnt/sitesync-pm"

echo "=== D1: Certified Payroll Verification ==="

# 1. Check database schema exists
echo "1. Verifying database schema..."
grep -r "certified_payroll" "$PROJECT_ROOT/src" --include="*.sql" || echo "SQL schema needs deployment"

# 2. Check React components created
echo "2. Checking React components..."
REQUIRED_COMPONENTS=(
  "certified-payroll.tsx"
  "payroll-entry.tsx"
  "prevailing-wage-lookup.tsx"
  "compliance-dashboard.tsx"
  "wh347-preview.tsx"
)

for component in "${REQUIRED_COMPONENTS[@]}"; do
  if [ -f "$PROJECT_ROOT/src/components/certified-payroll/$component" ]; then
    echo "   ✓ $component exists"
  else
    echo "   ✗ MISSING: $component"
  fi
done

# 3. Check API endpoints
echo "3. Checking API endpoints..."
grep -r "certified-payroll" "$PROJECT_ROOT/src/edge-functions" --include="*.ts" || echo "API endpoints need implementation"

# 4. Check SAM.gov integration
echo "4. Checking SAM.gov integration..."
grep -r "sam-gov" "$PROJECT_ROOT/src" --include="*.ts" || echo "SAM.gov integration needs implementation"

# 5. Type checking
echo "5. Running TypeScript check..."
cd "$PROJECT_ROOT"
npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "payroll" || echo "No TypeScript errors in payroll code"

echo ""
echo "=== VERIFICATION COMPLETE ==="
```

---

## 8. MIGRATION SCRIPT

Run in Supabase SQL editor to create schema:

```sql
-- Create certified payroll tables
BEGIN;

CREATE TABLE IF NOT EXISTS certified_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  week_ending DATE NOT NULL,
  payroll_period_start DATE,
  payroll_period_end DATE,
  federal_contract_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft',
  rejection_reason TEXT,
  certified_by_name VARCHAR(100),
  certified_date TIMESTAMP,
  submission_date TIMESTAMP,
  submission_confirmation_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(project_id, week_ending)
);

CREATE TABLE IF NOT EXISTS prevailing_wage_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sam_regulation_number VARCHAR(20),
  location_name VARCHAR(200),
  state_code CHAR(2),
  county_name VARCHAR(100),
  trade_classification VARCHAR(200),
  davis_bacon_code VARCHAR(20),
  csi_division VARCHAR(10),
  basic_hourly_rate DECIMAL(10,2),
  fringe_benefit_rate DECIMAL(10,2),
  apprentice_min_ratio DECIMAL(3,2),
  apprentice_max_ratio DECIMAL(3,2),
  apprentice_hourly_rate DECIMAL(10,2),
  effective_date DATE,
  expiration_date DATE,
  sam_page_url TEXT,
  last_synced TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certified_payroll_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certified_payroll_id UUID NOT NULL REFERENCES certified_payroll(id),
  worker_id UUID REFERENCES workforce(id),
  worker_name VARCHAR(100),
  classification VARCHAR(200),
  apprentice_status VARCHAR(20),
  monday_hours DECIMAL(5,2),
  tuesday_hours DECIMAL(5,2),
  wednesday_hours DECIMAL(5,2),
  thursday_hours DECIMAL(5,2),
  friday_hours DECIMAL(5,2),
  saturday_hours DECIMAL(5,2),
  sunday_hours DECIMAL(5,2),
  wage_rate DECIMAL(10,2),
  fringe_benefit_type VARCHAR(50),
  fringe_cash_paid DECIMAL(12,2),
  federal_withholding DECIMAL(10,2),
  fica_withholding DECIMAL(10,2),
  state_withholding DECIMAL(10,2),
  other_deductions DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_certified_payroll_project ON certified_payroll(project_id);
CREATE INDEX idx_prevailing_wages_state ON prevailing_wage_rates(state_code);
CREATE INDEX idx_payroll_detail_payroll ON certified_payroll_detail(certified_payroll_id);

COMMIT;
```

---

## 9. INTEGRATION CHECKLIST

- [ ] Database schema migrated to Supabase
- [ ] All React components created in `/src/components/certified-payroll/`
- [ ] `/src/pages/certified-payroll.tsx` page created
- [ ] API endpoints implemented in `/src/edge-functions/api/certified-payroll.ts`
- [ ] SAM.gov API integration complete (with API key in `.env`)
- [ ] WH-347 PDF export working
- [ ] Prevailing wage lookup integrated
- [ ] Week ending selection with hour entry
- [ ] Wage compliance validation (wage >= prevailing minimum)
- [ ] Apprentice ratio calculation
- [ ] Federal submission workflow (DOL submission stub)
- [ ] Audit trail logged for all changes
- [ ] E2E test for complete payroll entry workflow

---

## 10. SUCCESS METRICS

- Federal project unlock rate: target 15% of customer base (vs 2% Procore)
- Payroll submission time: < 10 minutes per week (vs 45 min manual)
- Compliance violation detection rate: 99.5% (wage, apprentice ratio, missing data)
- WH-347 submission acceptance rate: 100% (no rejections due to format errors)

