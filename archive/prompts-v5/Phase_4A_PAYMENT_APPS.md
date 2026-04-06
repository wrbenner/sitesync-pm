# Phase 4A: AIA G702/G703 Payment Applications

**Status**: Phase 4 (Construction Fintech)
**Priority**: Critical
**Effort**: 18 days
**Target**: Day 83-100

---

## Pre-Requisites

### New Dependencies
- pdfkit 0.12+ (PDF generation from HTML)
- pdfjs-dist 3.11+ (PDF viewer)
- date-fns 3.0+ (date calculations)
- jspdf 2.5+ (alternative PDF library)
- signature-pad 4.1+ (digital signature capture)

### Database Tables

```sql
CREATE TABLE pay_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  pay_app_number INT NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  original_contract_amount DECIMAL(15, 2),
  net_change_orders DECIMAL(15, 2),
  contract_sum DECIMAL(15, 2),
  work_completed_this_period DECIMAL(15, 2),
  work_completed_to_date DECIMAL(15, 2),
  retainage_percent FLOAT DEFAULT 0.1, -- 10% standard
  retainage_amount DECIMAL(15, 2),
  less_previous_certificates DECIMAL(15, 2),
  payment_due DECIMAL(15, 2),
  status VARCHAR(20), -- 'draft', 'submitted', 'reviewed', 'certified', 'paid'
  submitted_at TIMESTAMPTZ,
  certified_at TIMESTAMPTZ,
  certified_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(project_id, contractor_id, pay_app_number)
);

CREATE TABLE pay_app_schedule_of_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_app_id UUID NOT NULL REFERENCES pay_apps(id) ON DELETE CASCADE,
  line_item_number INT,
  description TEXT NOT NULL,
  original_contract_amount DECIMAL(15, 2),
  approved_change_orders DECIMAL(15, 2),
  contract_amount DECIMAL(15, 2),
  percent_complete FLOAT, -- 0-1
  this_application DECIMAL(15, 2),
  percent_earned FLOAT,
  total_earned_to_date DECIMAL(15, 2),
  retainage DECIMAL(15, 2),
  balance_due DECIMAL(15, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pay_app_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_app_id UUID NOT NULL REFERENCES pay_apps(id),
  certified_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  certified_by_role VARCHAR(50), -- 'architect', 'owner_rep', 'gc'
  certified_at TIMESTAMPTZ DEFAULT now(),
  signature_data BYTEA, -- PNG image of digital signature
  notes TEXT
);

CREATE TABLE pay_app_retainage_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  retainage_amount DECIMAL(15, 2),
  release_percent FLOAT,
  released_at TIMESTAMPTZ,
  reason VARCHAR(255),
  released_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pay_apps_project ON pay_apps(project_id);
CREATE INDEX idx_pay_apps_contractor ON pay_apps(contractor_id);
CREATE INDEX idx_pay_apps_status ON pay_apps(status);
CREATE INDEX idx_schedule_of_values_payapp ON pay_app_schedule_of_values(pay_app_id);
```

---

## Implementation Steps

### Step 1: Pay App Form Component

**File**: `src/components/Financials/PayAppForm.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Btn, Card, MetricBox } from '@/components/Primitives';
import { addDays, format } from 'date-fns';

interface PayAppFormProps {
  projectId: string;
  contractorId: string;
  onSaved?: (payAppId: string) => void;
}

export const PayAppForm: React.FC<PayAppFormProps> = ({
  projectId,
  contractorId,
  onSaved,
}) => {
  const [payApp, setPayApp] = useState({
    payAppNumber: 1,
    periodStartDate: new Date(),
    periodEndDate: addDays(new Date(), 30),
    originalContractAmount: 0,
    netChangeOrders: 0,
    workCompletedThisPeriod: 0,
    workCompletedToDate: 0,
    retainagePercent: 0.1,
    lessPreviousCertificates: 0,
  });

  const [scheduleOfValues, setScheduleOfValues] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Calculate derived values
  const contractSum = payApp.originalContractAmount + payApp.netChangeOrders;
  const retainageAmount = payApp.workCompletedThisPeriod * payApp.retainagePercent;
  const paymentDue =
    payApp.workCompletedThisPeriod - retainageAmount - payApp.lessPreviousCertificates;

  const handleInputChange = (field: string, value: any) => {
    setPayApp((prev) => ({ ...prev, [field]: value }));
  };

  const handleScheduleOfValuesChange = (index: number, field: string, value: any) => {
    const updated = [...scheduleOfValues];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleOfValues(updated);

    // Recalculate totals
    const totalThisApp = updated.reduce(
      (sum, row) => sum + (row.thisApplication || 0),
      0
    );
    handleInputChange('workCompletedThisPeriod', totalThisApp);
  };

  const addScheduleOfValuesRow = () => {
    setScheduleOfValues([
      ...scheduleOfValues,
      {
        lineItemNumber: scheduleOfValues.length + 1,
        description: '',
        originalContractAmount: 0,
        approvedChangeOrders: 0,
        contractAmount: 0,
        percentComplete: 0,
        thisApplication: 0,
      },
    ]);
  };

  const savePayApp = async () => {
    setSaving(true);
    try {
      // Save main pay app
      const { data: payAppData, error: payAppError } = await supabase
        .from('pay_apps')
        .insert({
          project_id: projectId,
          contractor_id: contractorId,
          pay_app_number: payApp.payAppNumber,
          period_start_date: format(payApp.periodStartDate, 'yyyy-MM-dd'),
          period_end_date: format(payApp.periodEndDate, 'yyyy-MM-dd'),
          original_contract_amount: payApp.originalContractAmount,
          net_change_orders: payApp.netChangeOrders,
          contract_sum: contractSum,
          work_completed_this_period: payApp.workCompletedThisPeriod,
          work_completed_to_date: payApp.workCompletedToDate,
          retainage_percent: payApp.retainagePercent,
          retainage_amount: retainageAmount,
          less_previous_certificates: payApp.lessPreviousCertificates,
          payment_due: paymentDue,
          status: 'draft',
        })
        .select('id');

      if (payAppError || !payAppData) {
        throw payAppError;
      }

      const payAppId = payAppData[0].id;

      // Save schedule of values
      for (const row of scheduleOfValues) {
        await supabase.from('pay_app_schedule_of_values').insert({
          pay_app_id: payAppId,
          line_item_number: row.lineItemNumber,
          description: row.description,
          original_contract_amount: row.originalContractAmount,
          approved_change_orders: row.approvedChangeOrders,
          contract_amount: row.contractAmount,
          percent_complete: row.percentComplete,
          this_application: row.thisApplication,
        });
      }

      onSaved?.(payAppId);
    } catch (error) {
      console.error('Failed to save pay app:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '20px' }}>
        AIA G702 Application for Payment
      </h1>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '30px' }}>
        <MetricBox label="Contract Sum" value={`$${contractSum.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} />
        <MetricBox
          label="Work This Period"
          value={`$${payApp.workCompletedThisPeriod.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        />
        <MetricBox
          label="Retainage (10%)"
          value={`$${retainageAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
        />
        <MetricBox label="Payment Due" value={`$${paymentDue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} style={{ color: '#4EC896' }} />
      </div>

      {/* Main form */}
      <Card style={{ marginBottom: '20px', padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>
          Payment Period
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Pay App Number
            </label>
            <input
              type="number"
              value={payApp.payAppNumber}
              onChange={(e) => handleInputChange('payAppNumber', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Period Start
            </label>
            <input
              type="date"
              value={format(payApp.periodStartDate, 'yyyy-MM-dd')}
              onChange={(e) => handleInputChange('periodStartDate', new Date(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Period End
            </label>
            <input
              type="date"
              value={format(payApp.periodEndDate, 'yyyy-MM-dd')}
              onChange={(e) => handleInputChange('periodEndDate', new Date(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Original Contract Amount
            </label>
            <input
              type="number"
              value={payApp.originalContractAmount}
              onChange={(e) => handleInputChange('originalContractAmount', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Net Change Orders
            </label>
            <input
              type="number"
              value={payApp.netChangeOrders}
              onChange={(e) => handleInputChange('netChangeOrders', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              Retainage Percent
            </label>
            <select
              value={payApp.retainagePercent}
              onChange={(e) => handleInputChange('retainagePercent', Number(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              <option value={0.05}>5%</option>
              <option value={0.1}>10%</option>
              <option value={0.15}>15%</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Schedule of values */}
      <Card style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>
            Schedule of Values (AIA G703)
          </h2>
          <Btn label="Add Line Item" onClick={addScheduleOfValuesRow} />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f7f8fa', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600 }}>
                  Description
                </th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                  Contract Amt
                </th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                  % Complete
                </th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                  This Application
                </th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                  To Date
                </th>
              </tr>
            </thead>
            <tbody>
              {scheduleOfValues.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) =>
                        handleScheduleOfValuesChange(idx, 'description', e.target.value)
                      }
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '12px',
                      }}
                      placeholder="Line item description"
                    />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <input
                      type="number"
                      value={row.contractAmount || ''}
                      onChange={(e) =>
                        handleScheduleOfValuesChange(idx, 'contractAmount', Number(e.target.value))
                      }
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '12px',
                        textAlign: 'right',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round((row.percentComplete || 0) * 100)}
                      onChange={(e) =>
                        handleScheduleOfValuesChange(idx, 'percentComplete', Number(e.target.value) / 100)
                      }
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '12px',
                        textAlign: 'right',
                      }}
                    />
                    %
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <input
                      type="number"
                      value={row.thisApplication || ''}
                      onChange={(e) =>
                        handleScheduleOfValuesChange(idx, 'thisApplication', Number(e.target.value))
                      }
                      style={{
                        width: '100%',
                        padding: '4px',
                        border: '1px solid #ddd',
                        borderRadius: '2px',
                        fontSize: '12px',
                        textAlign: 'right',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    {((row.thisApplication || 0) + payApp.workCompletedToDate).toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Btn
          label="Save Draft"
          onClick={savePayApp}
          disabled={saving}
          style={{ background: '#F47820' }}
        />
        <Btn label="Preview PDF" onClick={() => console.log('Generate preview')} />
        <Btn label="Submit for Review" onClick={() => console.log('Submit pay app')} />
      </div>
    </div>
  );
};
```

### Step 2: PDF Generation

**File**: `src/services/documents/PayAppPDF.ts`

```typescript
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export interface PayAppData {
  projectName: string;
  projectNumber: string;
  contractorName: string;
  payAppNumber: number;
  periodStartDate: string;
  periodEndDate: string;
  originalContractAmount: number;
  netChangeOrders: number;
  contractSum: number;
  workCompletedThisPeriod: number;
  workCompletedToDate: number;
  retainagePercent: number;
  retainageAmount: number;
  lessPreviousCertificates: number;
  paymentDue: number;
  scheduleOfValues: Array<{
    description: string;
    contractAmount: number;
    percentComplete: number;
    thisApplication: number;
    totalToDate: number;
  }>;
}

export async function generatePayAppPDF(data: PayAppData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'letter');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let yPos = 10;

  // Header
  doc.setFontSize(16);
  doc.text('APPLICATION AND CERTIFICATE FOR PAYMENT', pageWidth / 2, yPos, {
    align: 'center',
  });
  doc.setFontSize(12);
  yPos += 8;
  doc.text('AIA Form G702', pageWidth / 2, yPos, { align: 'center' });

  yPos += 12;

  // Project info
  doc.setFontSize(10);
  doc.text(`Project: ${data.projectName}`, 10, yPos);
  yPos += 6;
  doc.text(`Project Number: ${data.projectNumber}`, 10, yPos);
  yPos += 6;
  doc.text(`Contractor: ${data.contractorName}`, 10, yPos);
  yPos += 6;
  doc.text(
    `Application No. ${data.payAppNumber} for Period: ${data.periodStartDate} to ${data.periodEndDate}`,
    10,
    yPos
  );

  yPos += 14;

  // Summary box
  doc.setDrawColor(0);
  doc.rect(10, yPos - 6, pageWidth - 20, 50);

  doc.setFontSize(9);
  doc.text('SUMMARY', 12, yPos);

  yPos += 6;
  const summaryLines = [
    [
      'Original Contract Sum:',
      `$${data.originalContractAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
    [
      'Net Change Orders:',
      `$${data.netChangeOrders.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
    [
      'Contract Sum as Adjusted:',
      `$${data.contractSum.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
    [
      'Total Work Completed to Date:',
      `$${data.workCompletedToDate.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
    [
      'Retainage (${data.retainagePercent * 100}%):',
      `$${data.retainageAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
    [
      'Less Previous Certificates:',
      `$${data.lessPreviousCertificates.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
    [
      'Payment Now Due:',
      `$${data.paymentDue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    ],
  ];

  for (const [label, value] of summaryLines) {
    doc.text(label, 12, yPos);
    doc.text(value, pageWidth - 20, yPos, { align: 'right' });
    yPos += 6;
  }

  yPos += 8;

  // Schedule of values table
  doc.setFontSize(10);
  doc.text('SCHEDULE OF VALUES', 10, yPos);

  yPos += 6;

  const tableData = data.scheduleOfValues.map((row) => [
    row.description,
    `$${row.contractAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    `${(row.percentComplete * 100).toFixed(0)}%`,
    `$${row.thisApplication.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
    `$${row.totalToDate.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
  ]);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Description', 'Contract Amount', '% Complete', 'This Application', 'To Date']],
    body: tableData,
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  // Convert to blob
  return doc.output('blob');
}
```

---

## Acceptance Criteria

- [ ] Create pay app with contract amount, change orders, retainage
- [ ] Schedule of Values auto-calculates totals and earned amounts
- [ ] Payment due calculates as: work this period - retainage - previous certs
- [ ] Save draft pay app to database with all line items
- [ ] Generate AIA G702 PDF matching official format exactly
- [ ] Save certification data (user, date, signature) with pay app
- [ ] Calculate retainage based on selected percent (5/10/15%)
- [ ] Display payment summary with four key metrics
- [ ] Support multiple contractors per project (separate pay apps)
- [ ] Submit status flows: draft > submitted > reviewed > certified > paid

---

## Compliance Notes

- AIA G702 is industry standard form (published by American Institute of Architects)
- Contract amount and change orders must equal contract sum
- Retainage is typically 10% (must match contract requirements)
- Payment calculations are legally binding and must match construction loan requirements
- PDF must be printable and match original AIA form layout

---

## Future Enhancements

1. Integration with accounting software (QuickBooks, Sage)
2. Automated email workflow (submit, review, certify, pay notifications)
3. Mobile e-signature integration
4. Payment processing (ACH, wire transfer)
5. Retainage tracking and release automation
