/**
 * California — Conditional Waiver and Release on Progress Payment.
 *
 * Mandated form per California Civil Code § 8132. The statute reproduces
 * the exact form text that MUST be used; deviation invalidates the
 * waiver. Legal prose is a placeholder pending counsel review.
 */

import type { WaiverTemplate } from '../templateRenderer';
import { fmtAmount, fmtDate } from '../templateRenderer';

export const caConditionalProgress: WaiverTemplate = {
  id: 'ca-conditional-progress-v1',
  jurisdiction: 'CA',
  type: 'conditional_progress',
  version: '1',
  effectiveDate: '2026-04-29',
  render: (input) => `CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT
(California Civil Code § 8132)

NOTICE: This document waives the claimant's lien, stop payment notice,
and payment bond rights effective on receipt of payment. A person should
not rely on this document unless satisfied that the claimant has received
payment.

Project:               ${input.projectName}
Project address:       ${input.projectAddress}
Owner:                 ${input.payerName}
Through date:          ${fmtDate(input.periodThrough)}
Amount of payment:     ${fmtAmount(input.amount)}

[TODO_LEGAL_REVIEW] Reproduce California Civil Code § 8132 statutory
form text verbatim — DO NOT paraphrase. The Code requires the form's
exact wording for the waiver to be valid.

Claimant: ${input.subcontractorName}
By:       ${input.signerName}
Title:    ${input.signerTitle}
Date:     ${input.executionDate ? fmtDate(input.executionDate) : '________________'}
`,
};
