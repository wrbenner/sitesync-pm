# Phase 4D & 4E: Certified Payroll + Insurance COI Tracking

**Status**: Phase 4 (Construction Fintech)
**Priority**: High
**Effort**: 14 days
**Target**: Day 131-144

---

## PRE-REQUISITES

### New Dependencies
- ocr-space-api-wrapper for OCR on COI documents
- date-fns for date range calculations

### Database Tables

```sql
-- PHASE 4D: Certified Payroll
CREATE TABLE certified_payroll_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  week_ending_date DATE NOT NULL,
  report_number VARCHAR(50),
  davis_bacon_compliant BOOLEAN DEFAULT false,
  status VARCHAR(50), -- 'draft', 'submitted', 'approved', 'rejected'
  submitted_at TIMESTAMPTZ,
  submitted_to_agency VARCHAR(255), -- e.g., 'US DOD', 'US HHS'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, contractor_id, week_ending_date)
);

CREATE TABLE certified_payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_report_id UUID NOT NULL REFERENCES certified_payroll_reports(id) ON DELETE CASCADE,
  employee_name VARCHAR(255) NOT NULL,
  trade_classification VARCHAR(100), -- 'Carpenter', 'Electrician', 'Laborer', etc
  hourly_rate DECIMAL(10, 2),
  hours_worked FLOAT,
  gross_pay DECIMAL(15, 2),
  federal_withholding DECIMAL(10, 2),
  social_security DECIMAL(10, 2),
  medicare DECIMAL(10, 2),
  state_withholding DECIMAL(10, 2),
  prevailing_wage_met BOOLEAN,
  fringe_benefits DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prevailing_wage_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code VARCHAR(2) NOT NULL,
  county_code VARCHAR(3),
  county_name VARCHAR(100),
  project_type VARCHAR(50), -- 'building', 'highway', 'water', etc
  trade VARCHAR(100), -- 'Carpenter', 'Electrician', etc
  base_hourly_rate DECIMAL(10, 2),
  fringe_benefits DECIMAL(10, 2),
  effective_date DATE,
  expires_date DATE,
  source VARCHAR(255), -- e.g., 'California DLSR'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PHASE 4E: Insurance COI Tracking
CREATE TABLE coi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  document_url TEXT NOT NULL, -- S3/Supabase Storage path
  document_name VARCHAR(255),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coi_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coi_document_id UUID NOT NULL REFERENCES coi_documents(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  insurer_name VARCHAR(255),
  policy_number VARCHAR(100),
  certificate_holder VARCHAR(255),
  coverage_type VARCHAR(50), -- 'General Liability', 'Workers Comp', 'Umbrella', etc
  coverage_limit DECIMAL(15, 2),
  deductible DECIMAL(10, 2),
  effective_date DATE,
  expiration_date DATE,
  additional_insured BOOLEAN,
  waiver_of_subrogation BOOLEAN,
  primary_non_contributory BOOLEAN,
  certificate_number VARCHAR(100),
  extraction_confidence FLOAT, -- 0-1 (AI OCR confidence)
  extracted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coi_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  coverage_type VARCHAR(50),
  minimum_limit DECIMAL(15, 2),
  additional_insured_required BOOLEAN,
  waiver_of_subrogation_required BOOLEAN,
  primary_non_contributory_required BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coi_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  compliance_status VARCHAR(50), -- 'compliant', 'missing', 'expired', 'expired_soon'
  coverage_type VARCHAR(50),
  missing_coverage VARCHAR(255), -- JSON array of missing types
  expiration_date DATE,
  alert_sent_at TIMESTAMPTZ,
  days_until_expiry INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_payroll_project ON certified_payroll_reports(project_id);
CREATE INDEX idx_payroll_contractor ON certified_payroll_reports(contractor_id);
CREATE INDEX idx_coi_contractor ON coi_documents(contractor_id);
CREATE INDEX idx_coi_expiration ON coi_extractions(expiration_date);
CREATE INDEX idx_coi_compliance_status ON coi_compliance(compliance_status);
```

---

## IMPLEMENTATION STEPS

### Step 1: Certified Payroll Manager

**File**: `src/services/compliance/CertifiedPayrollManager.ts`

```typescript
import { supabase } from '@/lib/supabase';

export interface PayrollEmployee {
  name: string;
  classification: string; // Trade type
  hoursWorked: number;
  hourlyRate: number;
  prevailingWageMet: boolean;
  fringeBenefits: number;
}

export interface CertifiedPayrollReport {
  projectId: string;
  contractorId: string;
  weekEndingDate: string;
  employees: PayrollEmployee[];
  stateName: string;
  projectType: string;
}

export class CertifiedPayrollManager {
  async createPayrollReport(data: CertifiedPayrollReport): Promise<string> {
    // Create report header
    const { data: report, error: reportError } = await supabase
      .from('certified_payroll_reports')
      .insert({
        project_id: data.projectId,
        contractor_id: data.contractorId,
        week_ending_date: data.weekEndingDate,
        davis_bacon_compliant: true, // Will verify after checking wages
        status: 'draft',
      })
      .select('id');

    if (reportError || !report) {
      throw new Error(`Failed to create payroll report: ${reportError?.message}`);
    }

    const reportId = report[0].id;

    // Add employees
    for (const emp of data.employees) {
      // Look up prevailing wage rate
      const prevailingRate = await this.getPrevailingWageRate(
        data.stateName,
        emp.classification,
        data.projectType
      );

      const isMet = emp.hourlyRate >= (prevailingRate?.baseHourlyRate || 0);

      await supabase.from('certified_payroll_employees').insert({
        payroll_report_id: reportId,
        employee_name: emp.name,
        trade_classification: emp.classification,
        hourly_rate: emp.hourlyRate,
        hours_worked: emp.hoursWorked,
        gross_pay: emp.hourlyRate * emp.hoursWorked,
        fringe_benefits: emp.fringeBenefits,
        prevailing_wage_met: isMet,
      });
    }

    // Check if all employees meet prevailing wage
    const { data: employees } = await supabase
      .from('certified_payroll_employees')
      .select('prevailing_wage_met')
      .eq('payroll_report_id', reportId);

    const allMet = employees?.every((e) => e.prevailing_wage_met);

    await supabase
      .from('certified_payroll_reports')
      .update({ davis_bacon_compliant: allMet })
      .eq('id', reportId);

    return reportId;
  }

  private async getPrevailingWageRate(
    stateName: string,
    trade: string,
    projectType: string
  ): Promise<any> {
    // For real implementation, query a live prevailing wage database
    // (e.g., SAM.gov, state DOL databases)
    // This is simplified for demonstration

    const stateMap: Record<string, string> = {
      California: 'CA',
      Texas: 'TX',
      Florida: 'FL',
      // ... etc
    };

    const { data } = await supabase
      .from('prevailing_wage_rates')
      .select('*')
      .eq('state_code', stateMap[stateName] || 'CA')
      .eq('trade', trade)
      .eq('project_type', projectType)
      .single();

    return data;
  }

  async generateWH347(reportId: string): Promise<Blob> {
    // Fetch report data
    const { data: report } = await supabase
      .from('certified_payroll_reports')
      .select('*, certified_payroll_employees(*)')
      .eq('id', reportId)
      .single();

    if (!report) {
      throw new Error('Report not found');
    }

    // Generate WH-347 form (Department of Labor form)
    const html = `
      <html>
        <head>
          <title>WH-347 Payroll</title>
          <style>
            body { font-family: Arial; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background: #f0f0f0; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>WH-347 PAYROLL</h1>
          <p>Week Ending: ${report.week_ending_date}</p>
          <p>Davis-Bacon Compliant: ${report.davis_bacon_compliant ? 'YES' : 'NO'}</p>

          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Classification</th>
                <th>Hours</th>
                <th>Hourly Rate</th>
                <th>Gross Pay</th>
                <th>Prevailing Wage Met</th>
              </tr>
            </thead>
            <tbody>
              ${report.certified_payroll_employees
                .map(
                  (emp: any) => `
                <tr>
                  <td>${emp.employee_name}</td>
                  <td>${emp.trade_classification}</td>
                  <td>${emp.hours_worked}</td>
                  <td>$${emp.hourly_rate.toFixed(2)}</td>
                  <td>$${emp.gross_pay.toFixed(2)}</td>
                  <td>${emp.prevailing_wage_met ? 'YES' : 'NO'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <p>Certification: I certify that this payroll report is true and accurate.</p>
          <p>___________________ _______________</p>
          <p>Signature             Date</p>
        </body>
      </html>
    `;

    // Convert to PDF
    const blob = new Blob([html], { type: 'text/html' });
    return blob;
  }
}
```

### Step 2: Certificate of Insurance Manager

**File**: `src/services/compliance/COIManager.ts`

```typescript
import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface COIExtractionResult {
  insurerName: string;
  policyNumber: string;
  coverageType: string;
  coverageLimit: number;
  deductible: number;
  effectiveDate: string;
  expirationDate: string;
  additionalInsured: boolean;
  waiverOfSubrogation: boolean;
  primaryNonContributory: boolean;
  confidence: number; // 0-1
}

export class COIManager {
  async uploadCOI(
    contractorId: string,
    projectId: string,
    file: File,
    userId: string
  ): Promise<string> {
    // Upload file to Supabase Storage
    const path = `coi/${projectId}/${contractorId}/${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(path, file);

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Save metadata
    const { data: coiData, error: dbError } = await supabase
      .from('coi_documents')
      .insert({
        contractor_id: contractorId,
        project_id: projectId,
        document_url: path,
        document_name: file.name,
        uploaded_by: userId,
      })
      .select('id');

    if (dbError || !coiData) {
      throw new Error(`Failed to save COI metadata: ${dbError?.message}`);
    }

    const coiDocId = coiData[0].id;

    // Extract data using Claude Vision
    await this.extractCOIData(coiDocId, file);

    return coiDocId;
  }

  private async extractCOIData(coiDocId: string, file: File): Promise<void> {
    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array) as number[]);
      const base64 = btoa(binaryString);

      // Call Claude with vision
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png', // Adjust based on file type
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Extract the following information from this Certificate of Insurance:

1. Insurer Name
2. Policy Number
3. Coverage Type (General Liability, Workers Comp, Auto, Umbrella, etc)
4. Coverage Limit
5. Deductible
6. Effective Date
7. Expiration Date
8. Additional Insured (Yes/No)
9. Waiver of Subrogation (Yes/No)
10. Primary/Non-Contributory (Yes/No)

Respond with a JSON object with these exact keys:
{
  "insurer_name": "...",
  "policy_number": "...",
  "coverage_type": "...",
  "coverage_limit": 0,
  "deductible": 0,
  "effective_date": "YYYY-MM-DD",
  "expiration_date": "YYYY-MM-DD",
  "additional_insured": boolean,
  "waiver_of_subrogation": boolean,
  "primary_non_contributory": boolean,
  "confidence": 0.95
}

If you cannot determine a field, set confidence lower. Return ONLY valid JSON.`,
              },
            ],
          },
        ],
      });

      // Parse response
      let extraction: COIExtractionResult | null = null;
      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      try {
        extraction = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('Failed to parse COI extraction:', parseError);
        return;
      }

      // Get contractor ID from COI document
      const { data: coiDoc } = await supabase
        .from('coi_documents')
        .select('contractor_id')
        .eq('id', coiDocId)
        .single();

      if (!coiDoc) return;

      // Save extraction
      const { error } = await supabase.from('coi_extractions').insert({
        coi_document_id: coiDocId,
        contractor_id: coiDoc.contractor_id,
        insurer_name: extraction.insurer_name,
        policy_number: extraction.policy_number,
        coverage_type: extraction.coverage_type,
        coverage_limit: extraction.coverage_limit,
        deductible: extraction.deductible,
        effective_date: extraction.effective_date,
        expiration_date: extraction.expiration_date,
        additional_insured: extraction.additional_insured,
        waiver_of_subrogation: extraction.waiver_of_subrogation,
        primary_non_contributory: extraction.primary_non_contributory,
        extraction_confidence: extraction.confidence,
        extracted_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Failed to save COI extraction:', error);
      }
    } catch (error) {
      console.error('COI extraction error:', error);
    }
  }

  async checkCOICompliance(
    projectId: string,
    contractorId: string
  ): Promise<{
    status: string;
    missingCoverage: string[];
    expirationDates: Record<string, string>;
  }> {
    // Get project requirements
    const { data: requirements } = await supabase
      .from('coi_requirements')
      .select('*')
      .eq('project_id', projectId);

    if (!requirements || requirements.length === 0) {
      return { status: 'compliant', missingCoverage: [], expirationDates: {} };
    }

    // Get contractor's COI extractions
    const { data: extractions } = await supabase
      .from('coi_extractions')
      .select('*')
      .eq('contractor_id', contractorId)
      .order('expiration_date', { ascending: false });

    const today = new Date();
    const missingCoverage: string[] = [];
    const expirationDates: Record<string, string> = {};

    for (const req of requirements) {
      const matching = extractions?.find(
        (e) =>
          e.coverage_type === req.coverage_type &&
          new Date(e.expiration_date) > today
      );

      if (!matching) {
        missingCoverage.push(req.coverage_type);
      } else {
        expirationDates[req.coverage_type] = matching.expiration_date;

        // Check additional insured requirement
        if (req.additional_insured_required && !matching.additional_insured) {
          missingCoverage.push(
            `${req.coverage_type} (missing Additional Insured)`
          );
        }
      }
    }

    const status =
      missingCoverage.length === 0
        ? 'compliant'
        : missingCoverage.some((m) =>
            m.includes('missing')
          )
        ? 'missing_endorsement'
        : 'missing_coverage';

    return { status, missingCoverage, expirationDates };
  }

  async alertExpiringSoon(projectId: string): Promise<void> {
    // Find all contractors with COIs expiring in 30 days
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 30);

    const { data: expiring } = await supabase
      .from('coi_extractions')
      .select('contractor_id, expiration_date, coverage_type')
      .lt('expiration_date', expiringDate.toISOString().split('T')[0]);

    // TODO: Send notifications
  }
}
```

---

## ACCEPTANCE CRITERIA

### Certified Payroll
- [ ] Create payroll report for week with all employees
- [ ] Look up prevailing wage rates by state/trade/project type
- [ ] Validate each employee's hourly rate meets prevailing wage
- [ ] Mark report as Davis-Bacon compliant if all rates met
- [ ] Generate WH-347 PDF matching federal form exactly
- [ ] Submit report to contracting agency (API integration)
- [ ] Track submission status and agency responses

### Insurance COI Tracking
- [ ] Upload COI PDF document
- [ ] Extract policy details using Claude Vision with OCR
- [ ] Save insurer name, policy number, coverage limits, dates
- [ ] Identify additional insured, waiver, and primary requirements
- [ ] Check compliance vs. project requirements
- [ ] Alert if COI missing, expired, or expiring within 30 days
- [ ] Flag missing endorsements (Additional Insured, etc)
- [ ] Support multiple coverage types (GL, WC, Auto, Umbrella)
- [ ] Dashboard shows compliance status per contractor

---

## COMPLIANCE NOTES

- Prevailing wage databases: SAM.gov, state DOL websites (requires API integration)
- Davis-Bacon applies to federally funded projects (>$2k)
- WH-347 is official DOL form, must match format exactly
- COI typically required: GL ($1-2M), WC (statutory), Umbrella ($1M+)
- COI must list "owner/GC/architect as additional insured"
- Most COIs expire annually, alerts must fire 30-60 days before

---

## FUTURE ENHANCEMENTS

1. Live prevailing wage rate sync from SAM.gov API
2. Automated payroll integration with ADP/Workday/OnPay
3. eSignature on WH-347 forms
4. Bulk COI requirements import from contract
5. Compliance scorecard per contractor (payroll + insurance)
