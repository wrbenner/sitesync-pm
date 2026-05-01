/**
 * AIA G706 — Unconditional Waiver and Release on Progress Payment.
 *
 * Sworn AFTER receipt of payment. Riskier for the subcontractor; only
 * exchange this once the wire/check has cleared. Same legal-review
 * placeholder caveat as the conditional template.
 */

import type { WaiverTemplate } from '../templateRenderer';
import { fmtAmount, fmtDate } from '../templateRenderer';

export const aiaUnconditionalProgress: WaiverTemplate = {
  id: 'aia-g706-unconditional-progress-v1',
  jurisdiction: 'AIA',
  type: 'unconditional_progress',
  version: '1',
  effectiveDate: '2026-04-29',
  render: (input) => `UNCONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT
(AIA Document G706 — Unconditional Progress)

Project:           ${input.projectName}
Project address:   ${input.projectAddress}
Owner / Payer:     ${input.payerName}
Subcontractor:     ${input.subcontractorName}
Through date:      ${fmtDate(input.periodThrough)}
Amount received:   ${fmtAmount(input.amount)}

[TODO_LEGAL_REVIEW] Insert the AIA G706 unconditional-progress legal body
verbatim here, including the affidavit clause and the warning required
by the host state. The prose must be approved by licensed counsel
before production use.

The undersigned acknowledges RECEIPT of the payment stated above and
unconditionally waives and releases all lien rights for labor and
materials furnished on the project through the through-date stated.

Subcontractor:    ${input.subcontractorName}
By:               ${input.signerName}
Title:            ${input.signerTitle}
Date:             ${input.executionDate ? fmtDate(input.executionDate) : '________________'}
Signature:        ________________________________________
`,
};
