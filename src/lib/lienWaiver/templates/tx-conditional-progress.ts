/**
 * Texas — Conditional Waiver and Release on Progress Payment.
 *
 * Texas Property Code § 53.281 prescribes the exact form. Deviation
 * invalidates the waiver — counsel must approve the legal body.
 */

import type { WaiverTemplate } from '../templateRenderer';
import { fmtAmount, fmtDate } from '../templateRenderer';

export const txConditionalProgress: WaiverTemplate = {
  id: 'tx-conditional-progress-v1',
  jurisdiction: 'TX',
  type: 'conditional_progress',
  version: '1',
  effectiveDate: '2026-04-29',
  render: (input) => `CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT
(Texas Property Code § 53.281)

Project:               ${input.projectName}
Project address:       ${input.projectAddress}
Owner:                 ${input.payerName}
Through date:          ${fmtDate(input.periodThrough)}
Amount of payment:     ${fmtAmount(input.amount)}

[TODO_LEGAL_REVIEW] Reproduce Texas Property Code § 53.281 statutory
form text verbatim. The Code prescribes the exact wording — do NOT
paraphrase or summarize. Counsel must verify the version is current.

NOTICE: This document waives rights unconditionally and states that
you have been paid for giving up those rights. This document is
enforceable against you if you sign it, even if you have not been
paid. If you have not been paid, use a conditional release form.

Claimant: ${input.subcontractorName}
By:       ${input.signerName}
Title:    ${input.signerTitle}
Date:     ${input.executionDate ? fmtDate(input.executionDate) : '________________'}
`,
};
