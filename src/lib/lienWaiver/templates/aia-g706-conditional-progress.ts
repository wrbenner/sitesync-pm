/**
 * AIA G706 — Conditional Waiver and Release on Progress Payment.
 *
 * The default fallback when no jurisdictional template matches. The legal
 * prose is a placeholder pending review by counsel — see
 * PLATINUM_FINANCIAL.md for the explicit deferral and intended workflow.
 */

import type { WaiverTemplate } from '../templateRenderer';
import { fmtAmount, fmtDate } from '../templateRenderer';

export const aiaConditionalProgress: WaiverTemplate = {
  id: 'aia-g706-conditional-progress-v1',
  jurisdiction: 'AIA',
  type: 'conditional_progress',
  version: '1',
  effectiveDate: '2026-04-29',
  render: (input) => `CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT
(AIA Document G706 — Conditional Progress)

Project:           ${input.projectName}
Project address:   ${input.projectAddress}
Owner / Payer:     ${input.payerName}
Subcontractor:     ${input.subcontractorName}
Through date:      ${fmtDate(input.periodThrough)}
Amount of payment: ${fmtAmount(input.amount)}

[TODO_LEGAL_REVIEW] Insert the AIA G706 conditional-progress legal body
verbatim here. The prose must be approved by licensed counsel before
production use. Do NOT ship this document to a third party with this
placeholder in place.

I, the undersigned, on behalf of ${input.subcontractorName}, conditionally
waive and release the lien rights described above upon RECEIPT of the
payment in the amount stated, for labor and materials furnished through
the through-date stated above.

Subcontractor:    ${input.subcontractorName}
By:               ${input.signerName}
Title:            ${input.signerTitle}
Date:             ${input.executionDate ? fmtDate(input.executionDate) : '________________'}
Signature:        ________________________________________
`,
};
