# COI Ingestion + AM Best Validation Spec

**Date:** 2026-05-04
**Status:** Spec ready. Build alongside Sub Portal v0 (Q3 2026; Aug-Sept). Live by Oct 2026.
**Companion:** `SUB_PORTAL_V0_SPEC` (this lives inside Tab 3), `BUGATTI_LAUNCH_ROADMAP` Program 3.5 (where this is named the differentiator wedge)
**Format reference:** `IRIS_CITATIONS_SPEC` — feature spec with technical depth.

---

## TL;DR

Subs upload Certificate of Insurance (COI) PDFs in the Sub Portal. SiteSync **automatically**:

1. Parses the ACORD 25 form (OCR via AWS Textract or Anthropic vision)
2. Validates the carrier rating against AM Best Business Connect API
3. Detects required endorsements (additional-insured, waiver-of-subrogation, primary-and-non-contributory)
4. Tracks expiration dates and auto-requests renewal 30 days out
5. Displays validation status to GC in real-time

Procore charges $10K/year for "Insurance Tracking" as an add-on. **We do this for free as part of the Sub Portal.** This is a major wedge differentiator — first-call talking point with prospect's CFO.

This spec covers: the ACORD 25 parsing, AM Best integration, endorsement detection, expiration tracking, and the GC-facing review UX.

---

## Why This Matters (the wedge math)

GCs require subs to prove insurance via a Certificate of Insurance (COI). Today's process:

1. Sub emails GC a PDF
2. GC's office manager prints it
3. Office manager manually transcribes details into a spreadsheet
4. Office manager calls AM Best to verify carrier (rare; usually skipped)
5. PDF gets filed in a folder
6. 360 days later: someone notices it's expiring; emails sub
7. Sub sends new PDF; cycle repeats

This is **80% of office-manager time** at typical GCs. Procore charges $10K/year for partial automation. NetVendor / TrackingApp / SubBase / COIBoss charge subs themselves $50-200/year per COI.

**SiteSync does this work for free for both sides.** GC's office manager goes from spending 4 hr/week to 1 hr/week. Sub gets a single dashboard across all GCs. **Compelling enough for both audiences that subs will refer their next GC to SiteSync.**

---

## ACORD 25 Form (Standard Format)

The Certificate of Insurance follows ACORD 25 standard format — most US carriers use it.

Key fields we need to parse:

```
INSURED              [Sub's company name + address]
PRODUCER (Agent)     [Insurance agent name + contact]
INSURER A...F        [Carriers + their NAIC codes]
COVERAGE TYPE        General Liability, Auto, Workers Comp, Umbrella
LIMITS               $1M each occurrence, $2M aggregate, etc.
EFFECTIVE DATE       Policy start
EXPIRATION DATE      Policy end
CERTIFICATE HOLDER   [GC's name + address]
ENDORSEMENTS         Additional Insured, Waiver of Subrogation, Primary
```

ACORD 25 has 30+ fields; we need to parse 12 reliably + flag anomalies.

---

## Technical Pipeline

```
PDF upload (sub)
    │
    ▼
┌─────────────────────────────┐
│  AWS Textract              │  
│  (or Anthropic vision)     │
│  - OCR text                 │
│  - Form-field detection     │
│  - Table parsing            │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  ACORD 25 Field Mapper     │
│  - Maps Textract output     │
│  - to structured COI schema │
│  - Confidence score per     │
│    field                    │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  AM Best API                │
│  - Lookup carrier(s)        │
│  - Verify rating (A++, A+,  │
│    A, A-, B++, etc.)        │
│  - Verify NAIC code         │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Endorsement Detection      │
│  - LLM-based: looks for     │
│    "additional insured,"    │
│    "waiver of subrogation"  │
│  - Returns confidence       │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Validation Decision        │
│  - Auto-approve if:         │
│    - Rating A or higher     │
│    - All required           │
│      endorsements present   │
│    - No expired dates       │
│  - Flag if: any concern     │
│  - Reject if: missing       │
│    required field           │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  GC Notification +          │
│  Audit Chain Row             │
└─────────────────────────────┘
```

---

## OCR Stack: AWS Textract or Anthropic Vision

### Comparison

| Provider | Pros | Cons | Recommendation |
|---|---|---|---|
| **AWS Textract** | Best for forms (ACORD is structured); confidence scores per field; mature | Doesn't reason about content; needs post-process LLM for endorsement detection | **Primary.** Use for structured fields. |
| **Anthropic Vision** | Native vision; can understand "additional insured language"; simpler integration | Higher cost per page; may hallucinate field values | **Secondary.** Use for endorsement detection (the unstructured pieces). |

**Hybrid approach:**
1. Textract extracts structured form fields (insurer, dates, limits) → high confidence
2. Anthropic Vision reads the policy details + endorsement section → semantic understanding
3. Combine both with rules

### Implementation

```typescript
// supabase/functions/coi-ingest/index.ts

export async function ingestCoi(pdfUrl: string, subId: string, gcId: string) {
  // 1. Textract for structured extraction
  const textractResult = await textract.analyzeDocument({
    Document: { Bytes: await fetchPdfBytes(pdfUrl) },
    FeatureTypes: ['FORMS', 'TABLES']
  })
  
  const structuredFields = mapTextractToCoi(textractResult)
  
  // 2. Anthropic Vision for endorsement detection
  const endorsementResult = await callIris({
    type: 'vision',
    image: pdfUrl,
    prompt: ENDORSEMENT_DETECTION_PROMPT,
    max_tokens: 500
  })
  
  // 3. AM Best validation (parallel)
  const validations = await Promise.all(
    structuredFields.insurers.map(insurer =>
      amBestApi.lookupCarrier({ name: insurer.name, naic: insurer.naic })
    )
  )
  
  // 4. Decision
  const result = {
    autoApproved: false,
    flags: [],
    rejections: []
  }
  
  // - All carriers must have AM Best rating A or higher
  for (const validation of validations) {
    if (!validation.rating || validation.rating < AM_BEST_A_RATING) {
      result.flags.push(`Carrier ${validation.name} has rating ${validation.rating || 'unknown'}`)
    }
  }
  
  // - Required endorsements (per GC's requirements; default: AI + WoS + P&NC)
  const requiredEndorsements = await getGcRequiredEndorsements(gcId)
  for (const endorsement of requiredEndorsements) {
    if (!endorsementResult.has(endorsement.name)) {
      result.flags.push(`Missing endorsement: ${endorsement.name}`)
    }
  }
  
  // - Expiration check
  const daysUntilExpiry = differenceInDays(structuredFields.expirationDate, new Date())
  if (daysUntilExpiry < 0) {
    result.rejections.push('Policy already expired')
  } else if (daysUntilExpiry < 30) {
    result.flags.push(`Expires in ${daysUntilExpiry} days`)
  }
  
  // - Decision
  result.autoApproved = result.flags.length === 0 && result.rejections.length === 0
  
  // 5. Save + notify
  await saveCoi(subId, gcId, structuredFields, validations, endorsementResult, result)
  await notifyGc(gcId, subId, result)
  
  return result
}
```

---

## AM Best Business Connect Integration

AM Best is the dominant US carrier-rating agency. Their Business Connect API:

- ~$5K-$15K/year subscription
- Returns: carrier name, NAIC code, current rating (A++, A+, A, A-, B++, B+, B, B-, etc.), rating effective date, financial size category
- Cache responses for 24 hours (carriers don't change ratings daily)

### Recommended ratings

GCs typically require: **A or higher** (a major signal of carrier financial health). Below A: GC may accept B++ for smaller projects but typically rejects.

### Default required endorsements

For commercial GCs typically:
- **Additional Insured** — sub's policy covers GC for liability arising from sub's work
- **Waiver of Subrogation** — sub's carrier waives right to sue GC if injury claim
- **Primary and Non-Contributory** — sub's policy pays before GC's policy

### GC-customizable requirements

A GC can configure their COI requirements:
- Minimum rating (default A)
- Required endorsements (default 3 above)
- Minimum policy limits ($1M / $2M typical for general liability)
- Specific carriers to accept/reject
- Project-specific overrides

Stored in `gc_coi_requirements` table (per organization, per project).

---

## Endorsement Detection (the Anthropic vision prompt)

```typescript
const ENDORSEMENT_DETECTION_PROMPT = `
You are examining a Certificate of Insurance (ACORD 25 form). 
Identify which endorsements are present in this certificate.

Look for these specific endorsements:
1. ADDITIONAL INSURED — Look for language like "additional insured," 
   "AI," "named additional insured," in the Description of Operations section 
   or attached endorsements.
2. WAIVER OF SUBROGATION — Look for "waiver of subrogation," "WoS," 
   or "right of recovery waived against."
3. PRIMARY AND NON-CONTRIBUTORY — Look for "primary," 
   "non-contributory," or "P&NC."

For each endorsement, return:
- present: true or false
- confidence: 0.0 to 1.0
- evidence_text: the exact text that supports your conclusion (max 200 chars)

If you can't find evidence, mark as present: false.

Respond in this format:
{
  "additional_insured": { "present": true, "confidence": 0.95, "evidence_text": "..." },
  "waiver_of_subrogation": { "present": false, "confidence": 0.99, "evidence_text": null },
  "primary_and_non_contributory": { "present": true, "confidence": 0.88, "evidence_text": "..." }
}
`
```

If confidence < 0.7 for any endorsement: flag for human review (don't auto-approve OR auto-reject; surface to GC's office manager).

---

## GC-Facing Dashboard

When a sub uploads a COI, the GC's office manager sees:

```
┌──────────────────────────────────────────────────────────┐
│  COI Update — [Sub Name]                                  │
│                                                            │
│  [Auto-Approved ✓]                                         │
│                                                            │
│  Carrier: Travelers (NAIC: 25658)                          │
│  AM Best Rating: A++                                       │
│  Limits: $2M each occurrence, $4M aggregate                 │
│  Effective: 2026-04-01 — 2027-04-01                        │
│  Expires: 2027-04-01                                        │
│                                                            │
│  Endorsements:                                             │
│  ✓ Additional Insured (95% confidence)                    │
│  ✓ Waiver of Subrogation (100%)                           │
│  ✓ Primary & Non-Contributory (88%)                       │
│                                                            │
│  [View PDF]  [Manual Override]                             │
└──────────────────────────────────────────────────────────┘
```

If auto-approved: GC office manager sees this notification but takes no action. The COI is recorded as valid; sub can do work.

If flagged: 
```
┌──────────────────────────────────────────────────────────┐
│  COI Update — [Sub Name]                                  │
│                                                            │
│  [⚠️ Needs Review]                                         │
│                                                            │
│  Carrier: Acme Insurance (NAIC: 99999)                     │
│  AM Best Rating: B (below A threshold)                    │
│  Endorsements:                                             │
│  ✓ Additional Insured                                      │
│  ⚠️ Waiver of Subrogation: NOT FOUND (confidence 99%)     │
│  ✓ Primary & Non-Contributory                              │
│                                                            │
│  [Approve Anyway]   [Reject]   [Request Update from Sub]   │
└──────────────────────────────────────────────────────────┘
```

GC's office manager makes the call. Decision logged in audit chain.

---

## Expiration Tracking + Auto-Renewal

For each active COI, the system tracks expiration:

- **30 days before expiry:** auto-email sub: "Your COI on [Project] expires in 30 days. Please upload renewed COI."
- **14 days before expiry:** auto-email + push notification: "10 days left."
- **3 days before expiry:** escalate to GC: "Sub's COI expires Friday. Status: not yet renewed."
- **At expiration:** flag sub as "needs valid COI" in GC dashboard. Sub can't submit new pay-apps until updated.

Auto-renewal email template:

```
Subject: Your COI for [GC Name]'s [Project Name] expires [date]

Hi [Sub Name],

Your Certificate of Insurance for the project at [Address] is set to expire 
on [date]. To continue work, please upload your renewed COI:

[Upload Renewed COI →]

This takes 30 seconds. SiteSync auto-validates against AM Best.

— SiteSync (on behalf of [GC Name])
```

Sub clicks link → in Sub Portal → upload → validation.

---

## Performance Budget

- Textract → AM Best → Anthropic vision → decision: < 30 seconds total
- For typical 10-page COI PDF: < 15 seconds
- For complex COI with 20+ pages of endorsements: < 45 seconds

If timeout: surface "still processing" to user; complete within 5 minutes.

---

## What Walker Does With This Spec

1. Confirm AM Best API budget ($5K-$15K/year)
2. Identify pilot subs to test with (Brad's pilot's top 5 subs)
3. Confirm GC's COI requirements format with Brad

---

## What Claude Code Does

- Build the COI upload form in Sub Portal (~2 days)
- Build the Textract integration (~3 days)
- Build the AM Best API client (~2 days)
- Build the endorsement detection prompt + integration (~3 days)
- Build the validation decision engine (~3 days)
- Build the GC-facing review dashboard (~3 days)
- Build the expiration tracking + auto-renewal (~2 days)

Total: ~18 days through Aug-Sept 2026.

---

## Risk Register Additions

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| COI-1 | Textract accuracy on edge-case ACORD 25 layouts | Medium | Medium | Manual override path; learning loop tracks errors |
| COI-2 | AM Best API outage | Low | Medium | Cache 24-hour responses; degrade gracefully |
| COI-3 | Endorsement detection false positive (says present when missing) | Medium | High (legal) | Confidence threshold; flag low-confidence for human review |
| COI-4 | Carrier rating downgraded mid-policy (insurer enters runoff) | Low | Medium | Periodic re-validation (quarterly); alert if changed |
| COI-5 | Sub uploads non-ACORD format (custom certificate) | Medium | Low | Manual review fallback |
| COI-6 | Performance budget exceeded under load | Low-Medium | Low | Async processing + user notification |

---

## What this spec deliberately does NOT cover

- Sub portal architecture (covered by `SUB_PORTAL_V0_SPEC`)
- Multi-GC view of COIs (covered by `SUB_PORTAL_V1_SPEC`)
- Bonding documents (similar workflow; year 2)
- Custom GC requirements UI (covered by Sub Portal v1)
- COI integration with SAM.gov / federal validation (year 2+)
