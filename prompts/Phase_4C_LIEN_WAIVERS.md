# Phase 4C: Lien Waiver Automation

**Status**: Phase 4 (Construction Fintech)
**Priority**: High
**Effort**: 16 days
**Target**: Day 115-130

---

## Pre-Requisites

### New Dependencies
- state-abbrev or similar for state lookup
- docx 8.10+ (Word doc generation)
- pdfkit 0.12+ (PDF generation)

### Database Tables

```sql
CREATE TABLE lien_waiver_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code VARCHAR(2) NOT NULL UNIQUE,
  state_name VARCHAR(50),
  waiver_type VARCHAR(50), -- 'conditional', 'unconditional'
  form_variant VARCHAR(20), -- 'progress', 'final'
  html_template TEXT NOT NULL, -- Template with placeholders
  required_fields JSONB, -- Array of required field names
  legal_version VARCHAR(50), -- Latest version of statute/form
  effective_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lien_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  pay_app_id UUID NOT NULL REFERENCES pay_apps(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  waiver_type VARCHAR(50), -- 'conditional', 'unconditional'
  form_variant VARCHAR(20), -- 'progress', 'final'
  state_code VARCHAR(2) NOT NULL,
  claimant_name VARCHAR(255),
  claimant_address TEXT,
  property_location TEXT,
  owner_name VARCHAR(255),
  owner_address TEXT,
  amount_waived DECIMAL(15, 2),
  payment_received_date DATE,
  period_covered_start DATE,
  period_covered_end DATE,
  signature_data BYTEA,
  notary_info JSONB, -- {name, license_number, commission_expiry}
  signed_at TIMESTAMPTZ,
  notarized_at TIMESTAMPTZ,
  status VARCHAR(50), -- 'draft', 'pending_signature', 'signed', 'notarized', 'received'
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE lien_waiver_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  lien_waiver_id UUID REFERENCES lien_waivers(id),
  contractor_id UUID NOT NULL REFERENCES contractors(id),
  status VARCHAR(50), -- 'compliant', 'outstanding', 'expired', 'waived'
  required_by_date DATE,
  received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lien_waivers_project ON lien_waivers(project_id);
CREATE INDEX idx_lien_waivers_contractor ON lien_waivers(contractor_id);
CREATE INDEX idx_lien_waivers_status ON lien_waivers(status);
CREATE INDEX idx_waiver_compliance_project ON lien_waiver_compliance(project_id);
```

---

## Implementation Steps

### Step 1: Lien Waiver Manager

**File**: `src/services/documents/LienWaiverManager.ts`

```typescript
import { supabase } from '@/lib/supabase';

export interface LienWaiverData {
  projectId: string;
  payAppId: string;
  contractorId: string;
  stateCode: string;
  waiverType: 'conditional' | 'unconditional';
  formVariant: 'progress' | 'final';
  claimantName: string;
  claimantAddress: string;
  propertyLocation: string;
  ownerName: string;
  ownerAddress: string;
  amountWaived: number;
  paymentReceivedDate: string;
  periodCoveredStart: string;
  periodCoveredEnd: string;
}

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// State-specific templates (simplified examples)
const STATE_TEMPLATES: Record<string, Record<string, string>> = {
  CA: {
    conditional:
      'The undersigned declares under penalty of perjury under the laws of the State of California...',
    unconditional:
      'The undersigned hereby waives and releases any right to file a lien...',
  },
  TX: {
    conditional:
      'CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT...',
    unconditional:
      'UNCONDITIONAL WAIVER AND RELEASE ON FINAL PAYMENT...',
  },
  FL: {
    conditional:
      'Upon receipt and clearance of the following check or payment in the amount of $...',
    unconditional:
      'The undersigned waives and releases any and all lien rights...',
  },
  // ... continue for other major states
};

export class LienWaiverManager {
  async createLienWaiver(data: LienWaiverData): Promise<string> {
    // Get template for state
    const { data: template, error: templateError } = await supabase
      .from('lien_waiver_templates')
      .select('html_template')
      .eq('state_code', data.stateCode)
      .eq('waiver_type', data.waiverType)
      .single();

    if (templateError) {
      throw new Error(
        `No lien waiver template found for ${data.stateCode} (${data.waiverType})`
      );
    }

    // Generate HTML from template
    const html = this.populateTemplate(template.html_template, data);

    // Save to database
    const { data: waiverData, error } = await supabase
      .from('lien_waivers')
      .insert({
        project_id: data.projectId,
        pay_app_id: data.payAppId,
        contractor_id: data.contractorId,
        waiver_type: data.waiverType,
        form_variant: data.formVariant,
        state_code: data.stateCode,
        claimant_name: data.claimantName,
        claimant_address: data.claimantAddress,
        property_location: data.propertyLocation,
        owner_name: data.ownerName,
        owner_address: data.ownerAddress,
        amount_waived: data.amountWaived,
        payment_received_date: data.paymentReceivedDate,
        period_covered_start: data.periodCoveredStart,
        period_covered_end: data.periodCoveredEnd,
        status: 'draft',
      })
      .select('id');

    if (error || !waiverData) {
      throw new Error(`Failed to create lien waiver: ${error?.message}`);
    }

    return waiverData[0].id;
  }

  private populateTemplate(template: string, data: LienWaiverData): string {
    let html = template;

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{{claimantName}}': data.claimantName,
      '{{claimantAddress}}': data.claimantAddress,
      '{{propertyLocation}}': data.propertyLocation,
      '{{ownerName}}': data.ownerName,
      '{{ownerAddress}}': data.ownerAddress,
      '{{amountWaived}}': `$${data.amountWaived.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      '{{paymentReceivedDate}}': new Date(data.paymentReceivedDate).toLocaleDateString(),
      '{{periodCoveredStart}}': new Date(data.periodCoveredStart).toLocaleDateString(),
      '{{periodCoveredEnd}}': new Date(data.periodCoveredEnd).toLocaleDateString(),
      '{{formType}}':
        data.waiverType === 'conditional'
          ? `CONDITIONAL WAIVER AND RELEASE ON ${data.formVariant === 'progress' ? 'PROGRESS' : 'FINAL'} PAYMENT`
          : `UNCONDITIONAL WAIVER AND RELEASE ON ${data.formVariant === 'progress' ? 'PROGRESS' : 'FINAL'} PAYMENT`,
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replace(new RegExp(placeholder, 'g'), value);
    }

    return html;
  }

  async saveLienWaiverPDF(
    waiverID: string,
    pdfUrl: string
  ): Promise<void> {
    const { error } = await supabase
      .from('lien_waivers')
      .update({ pdf_url: pdfUrl })
      .eq('id', waiverID);

    if (error) {
      throw new Error(`Failed to save PDF URL: ${error.message}`);
    }
  }

  async signWaiver(
    waiverId: string,
    signatureData: Uint8Array
  ): Promise<void> {
    const { error } = await supabase
      .from('lien_waivers')
      .update({
        signature_data: signatureData,
        signed_at: new Date().toISOString(),
        status: 'signed',
      })
      .eq('id', waiverId);

    if (error) {
      throw new Error(`Failed to sign waiver: ${error.message}`);
    }
  }

  async notarizeWaiver(
    waiverId: string,
    notaryInfo: {
      name: string;
      licenseNumber: string;
      commissionExpiry: string;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('lien_waivers')
      .update({
        notary_info: notaryInfo,
        notarized_at: new Date().toISOString(),
        status: 'notarized',
      })
      .eq('id', waiverId);

    if (error) {
      throw new Error(`Failed to notarize waiver: ${error.message}`);
    }
  }

  async getLienWaiverStatus(
    projectId: string,
    contractorId: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('lien_waiver_compliance')
      .select('*')
      .eq('project_id', projectId)
      .eq('contractor_id', contractorId);

    if (error) {
      return [];
    }

    return data || [];
  }

  async trackWaiverCompliance(
    projectId: string,
    contractorId: string,
    requiredByDate: Date
  ): Promise<void> {
    const { error } = await supabase
      .from('lien_waiver_compliance')
      .insert({
        project_id: projectId,
        contractor_id: contractorId,
        status: 'outstanding',
        required_by_date: requiredByDate.toISOString().split('T')[0],
      });

    if (error) {
      throw new Error(`Failed to track waiver compliance: ${error.message}`);
    }
  }

  async markWaiverReceived(complianceId: string): Promise<void> {
    const { error } = await supabase
      .from('lien_waiver_compliance')
      .update({
        status: 'received',
        received_date: new Date().toISOString().split('T')[0],
      })
      .eq('id', complianceId);

    if (error) {
      throw new Error(`Failed to mark waiver received: ${error.message}`);
    }
  }
}
```

### Step 2: Lien Waiver Form Component

**File**: `src/components/Financials/LienWaiverForm.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { LienWaiverManager, US_STATES } from '@/services/documents/LienWaiverManager';
import { Btn, Card } from '@/components/Primitives';
import SignaturePad from 'signature_pad';

interface LienWaiverFormProps {
  payAppId: string;
  projectId: string;
  contractorId: string;
  amount: number;
  onComplete?: () => void;
}

export const LienWaiverForm: React.FC<LienWaiverFormProps> = ({
  payAppId,
  projectId,
  contractorId,
  amount,
  onComplete,
}) => {
  const [form, setForm] = useState({
    stateCode: 'CA',
    waiverType: 'conditional' as const,
    formVariant: 'progress' as const,
    claimantName: '',
    claimantAddress: '',
    propertyLocation: '',
    ownerName: '',
    ownerAddress: '',
    paymentReceivedDate: new Date().toISOString().split('T')[0],
    periodCoveredStart: '',
    periodCoveredEnd: '',
  });

  const [preview, setPreview] = useState<string>('');
  const [step, setStep] = useState<'form' | 'signature' | 'preview'>('form');
  const [signaturePad, setSignaturePad] = useState<any>(null);
  const manager = new LienWaiverManager();

  const handleInputChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const generatePreview = async () => {
    // Generate HTML preview
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
        <h1>${form.waiverType.toUpperCase()} WAIVER AND RELEASE</h1>
        <h2>State of ${US_STATES.find((s) => s.code === form.stateCode)?.name}</h2>

        <p><strong>FROM:</strong> ${form.claimantName}</p>
        <p>${form.claimantAddress}</p>

        <p><strong>TO:</strong> ${form.ownerName}</p>
        <p>${form.ownerAddress}</p>

        <p><strong>PROPERTY:</strong> ${form.propertyLocation}</p>

        <p><strong>AMOUNT:</strong> $${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>

        <p><strong>FOR WORK/MATERIALS:</strong> From ${form.periodCoveredStart} to ${form.periodCoveredEnd}</p>

        ${form.waiverType === 'conditional'
          ? `<p>Upon receipt and clearance of the above-referenced payment, the undersigned waives any right to file a lien.</p>`
          : `<p>The undersigned has received payment and unconditionally waives any right to file a lien for work/materials provided.</p>`
        }
      </div>
    `;

    setPreview(html);
    setStep('signature');
  };

  const handleSignature = () => {
    setStep('preview');
  };

  const saveWaiver = async () => {
    try {
      const waiverId = await manager.createLienWaiver({
        projectId,
        payAppId,
        contractorId,
        stateCode: form.stateCode,
        waiverType: form.waiverType,
        formVariant: form.formVariant,
        claimantName: form.claimantName,
        claimantAddress: form.claimantAddress,
        propertyLocation: form.propertyLocation,
        ownerName: form.ownerName,
        ownerAddress: form.ownerAddress,
        amountWaived: amount,
        paymentReceivedDate: form.paymentReceivedDate,
        periodCoveredStart: form.periodCoveredStart,
        periodCoveredEnd: form.periodCoveredEnd,
      });

      // TODO: Generate PDF and upload to Supabase Storage
      // const pdfBlob = await generatePDF(form);
      // const pdfUrl = await uploadPDF(pdfBlob, waiverId);
      // await manager.saveLienWaiverPDF(waiverId, pdfUrl);

      onComplete?.();
    } catch (error) {
      console.error('Failed to save waiver:', error);
    }
  };

  if (step === 'form') {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '20px' }}>
          Lien Waiver for Pay App #{payAppId}
        </h1>

        <Card style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
              State
            </label>
            <select
              value={form.stateCode}
              onChange={(e) => handleInputChange('stateCode', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            >
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '16px',
            }}
          >
            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Waiver Type
              </label>
              <select
                value={form.waiverType}
                onChange={(e) =>
                  handleInputChange('waiverType', e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              >
                <option value="conditional">Conditional</option>
                <option value="unconditional">Unconditional</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                Form Variant
              </label>
              <select
                value={form.formVariant}
                onChange={(e) =>
                  handleInputChange('formVariant', e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              >
                <option value="progress">Progress Payment</option>
                <option value="final">Final Payment</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 500,
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Claimant Name
            </label>
            <input
              type="text"
              value={form.claimantName}
              onChange={(e) =>
                handleInputChange('claimantName', e.target.value)
              }
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
              }}
            />
          </div>

          {/* ... more form fields (claimantAddress, ownerName, ownerAddress, dates) ... */}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Btn label="Preview" onClick={generatePreview} style={{ background: '#F47820' }} />
            <Btn label="Cancel" onClick={() => {}} />
          </div>
        </Card>
      </div>
    );
  }

  return <div>Step 2 and 3 signature/preview components...</div>;
};
```

---

## Acceptance Criteria

- [ ] Select state from dropdown (all 50 states + DC)
- [ ] Choose conditional or unconditional waiver type
- [ ] Choose progress or final payment variant
- [ ] Form auto-populates with contractor and owner details
- [ ] Generated HTML preview shows correct state-specific language
- [ ] Digital signature capture with signature-pad library
- [ ] Optional notary information (name, license, commission date)
- [ ] Save to database with timestamp of signature
- [ ] Generate PDF matching state legal requirements exactly
- [ ] Track waiver compliance per contractor per project
- [ ] Alert if waiver received vs outstanding
- [ ] Expire old waivers (typically after 4-6 years per state)

---

## State-Specific Compliance Notes

Each state has specific requirements:
- **California**: Requires specific statutory language (Civil Code 8132-8140)
- **Texas**: Property Code Section 53.032
- **Florida**: Statute 713.115
- **New York**: Lien Law Section 3-a
- All states require: amount, period covered, signature, date

---

## Future Enhancements

1. Bulk waiver generation for all subs on a pay app
2. eSignature integration (DocuSign, HelloSign)
3. Notary marketplace integration
4. Automated email with waiver to contractor
5. Compliance dashboard (waivers by contractor, project, date)
