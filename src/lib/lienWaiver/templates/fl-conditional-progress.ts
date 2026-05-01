/**
 * Florida — Conditional Waiver and Release on Progress Payment.
 *
 * Florida Statute § 713.20 governs lien waivers in Florida. The legal
 * body is a placeholder pending counsel review — Florida statutory
 * waiver language must be reproduced verbatim.
 */

import type { WaiverTemplate } from '../templateRenderer';
import { fmtAmount, fmtDate } from '../templateRenderer';

export const flConditionalProgress: WaiverTemplate = {
  id: 'fl-conditional-progress-v1',
  jurisdiction: 'FL',
  type: 'conditional_progress',
  version: '1',
  effectiveDate: '2026-04-29',
  render: (input) => `CONDITIONAL WAIVER AND RELEASE OF LIEN UPON PROGRESS PAYMENT
(Florida Statute § 713.20)

Project:               ${input.projectName}
Project address:       ${input.projectAddress}
Owner:                 ${input.payerName}
Through date:          ${fmtDate(input.periodThrough)}
Amount of payment:     ${fmtAmount(input.amount)}

[TODO_LEGAL_REVIEW] Reproduce Florida Statute § 713.20 statutory waiver
language verbatim. Florida law mandates the exact text for the waiver
to be effective; counsel must confirm the version is current and
matches the form filed of record.

The undersigned lienor, in consideration of the sum stated, hereby
conditionally waives and releases its right to claim against the bond
or lien rights to the extent of the labor, services, or materials
furnished through the date stated above, conditioned on receipt of
payment.

Claimant: ${input.subcontractorName}
By:       ${input.signerName}
Title:    ${input.signerTitle}
Date:     ${input.executionDate ? fmtDate(input.executionDate) : '________________'}
`,
};
