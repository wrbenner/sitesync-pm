# Submittals: Industry-Standard Practices in U.S. Commercial Construction

A research brief synthesizing AIA, CSI, EJCDC, NIBS/buildingSMART, AGC/ConsensusDocs, USGBC, and federal sources to inform a new submittals product. Compiled May 6, 2026.

---

## 1. Glossary of Canonical Submittal Terminology

- **Submittal** — Information the contractor furnishes to the design team to demonstrate how a portion of the Work conforms to the design intent. Per AIA A201-2017 §3.12.4, "Shop Drawings, Product Data, Samples and similar submittals are not Contract Documents."
- **Shop Drawing** — Drawings, charts, schedules, diagrams prepared by a contractor, sub, manufacturer, supplier, or distributor that "illustrate some portion of the Work."
- **Product Data** — Manufacturer-published illustrations, standard schedules, performance charts, brochures, instructions. Pre-published, not project-specific.
- **Sample** — Physical examples illustrating materials, equipment, or workmanship to establish standards by which the Work will be judged.
- **Mock-up** — Sample assembly built early to verify look, fit, and performance before full production.
- **Action vs. Informational Submittal** — Action submittals require approval before fabrication/installation (shop drawings, product data, samples). Informational submittals verify compliance after the fact (test reports, certs, qualifications).
- **Submittal Register / Log** — The master index of every submittal required by the spec, who owes it, when, status, ball-in-court.
- **Ball-in-Court (BIC)** — The party currently responsible for the next action; foundational for delay claims.
- **Deviation** — A submittal that varies from the Contract Documents; under AIA A201 §3.12.8 the contractor must specifically inform the architect "in writing" of such variations.
- **Submittal Schedule** — Required by A201 §3.10.2; coordinates submission/review dates with the construction schedule.

---

## 2. The 8–10 Standard Submittal Types

CSI/EJCDC/state DOT specs converge on roughly this canonical set:

1. **Shop Drawings** — Project-specific fabrication/erection drawings (steel, precast, MEP coordination, millwork). Action.
2. **Product Data** — Cut sheets, performance specs, manufacturer literature, MSDS/SDS. Action.
3. **Samples** — Physical material exemplars (paint chips, masonry units, fabric, finishes). Action.
4. **Mock-ups** — Field-built or off-site partial assemblies (curtainwall, exterior wall, paving). Action; usually a hold point.
5. **Test Reports & Quality Certifications** — Mill certs, ASTM compliance reports, factory test data, third-party lab reports. Informational. ASTM standards (e.g., A36 steel, C90 CMU) are referenced inside spec sections and pull through to required certs.
6. **Qualification Statements** — Installer/manufacturer/welder/applicator credentials. Informational.
7. **Closeout Submittals** — As-builts/record drawings, O&M manuals, attic stock, spare parts inventory, training records.
8. **Warranties & Guarantees** — Manufacturer and contractor warranties, special extended warranties (roofing 20yr, etc.).
9. **LEED / Sustainability Submittals** — Recycled content, regional materials, low-VOC, FSC chain-of-custody, M&V plans. Per USGBC, "any credit that is submitted for review must include complete documentation."
10. **Survey / Field Measurement Data, Coordination Drawings, Maintenance Agreements, Workmanship Bonds** — project-dependent.

---

## 3. Standard Review Codes & Ball-in-Court Conventions

### 3a. Review Codes — There Is No Single Standard, But Two Dominant Lineages

**EJCDC / CSI lineage (preferred by engineers; minimizes liability exposure)** — per Kevin O'Beirne, EJCDC:

| Code | Disposition | Effect |
|------|-------------|--------|
| A | "No Exceptions Taken" / "Furnish as Submitted" | Proceed with fabrication/installation. |
| B | "Make Corrections Noted" / "Furnish as Corrected" | Proceed; comply with marked notations. No resubmittal. |
| C | "Revise and Resubmit" | Not approved; correct and resubmit. Do not fabricate. |
| D | "Rejected" / "Not Approved" | EJCDC: "wasn't even close"; even revised it would not be approvable. |
| E | "For Reference Only" / "Reviewed for Information" | Informational submittal acknowledged; no design review performed. |
| F | "Submit Specified Item" | Submitted product varies from spec and is not acceptable. |

**AIA / common-architect lineage** — many firms still use the words "Approved" / "Approved as Noted." The legal community (and EJCDC) urges avoiding "Approved" because A201 §4.2.7 explicitly limits the architect's review to "conformance with the information given and the design concept."

**Practical reality:** firms run 3-, 4-, 5-, and 6-code stamps. Procore, Newforma, and SubmittalLink default to roughly the EJCDC six. Federal UFGS uses "Approving Authority"-style codes.

### 3b. Architect Liability — The "Design Intent Only" Limitation

A201 §4.2.7 (and §3.12.4) draws a hard fence: the architect reviews "for the limited purpose of checking for conformance with information given and the design concept expressed." Approval of a submittal does NOT relieve the contractor of responsibility for dimensions, quantities, fabrication processes, means, methods, or coordination. Stamps that say "Approved" without disclaimers expose the design professional to liability that A201 was specifically drafted to allocate to the contractor.

### 3c. Ball-in-Court Conventions

- **Architect review duration** — A201 §4.2.7 says action will be taken with "such reasonable promptness as to cause no delay" while allowing "sufficient time…to permit adequate review."
- **Industry default** — 10–14 calendar days, frequently codified as "10 working days."
- **A/E review with engineer hand-off** averages ~12 days longer than architect-only.
- **Contractor responsibility** — A201 §3.10.2 requires the contractor to issue a submittal schedule reviewed by the architect; failure to follow it can sever delay-claim entitlement.
- **Resubmittal counter** — Most specs cap resubmittals at 2 before extra review is back-charged.

---

## 4. Spec-to-Log Automation: Why This Is the Killer Feature

CSI's **SectionFormat** organizes every spec section in three Parts:
- Part 1 — General (1.01 Summary, 1.02 References, 1.03 Definitions, **1.04 Submittals or Action Submittals, 1.05 Informational Submittals / Quality Assurance**)
- Part 2 — Products
- Part 3 — Execution

The required submittals for a section are explicitly enumerated under that "Submittals" header in Part 1. Because every spec writer follows SectionFormat, submittal requirements can be deterministically extracted per CSI section: locate the "Submittals" header in Part 1, parse the bullets, and emit log rows tagged by section number. Autodesk's AutoSpecs already does this — "AutoSpecs' powerful AI identifies action submittals, project data, closeout, QA/QC submittals." Procore offers Submittal Builder with similar functionality. The killer 10x is going further: link each line item back to the exact PDF page, auto-suggest type from text patterns, and pre-populate the responsible sub from the bid package.

The 50 CSI MasterFormat divisions (Div 00 Procurement → Div 49 Electrical Power Generation Equipment) provide the universal taxonomy, and Div 01 33 00 Submittal Procedures sets procedural rules for every project.

---

## 5. BIM / COBie Tie-Ins

**COBie (Construction-Operations Building information exchange)** is part of NBIMS-US V3, the U.S. National BIM Standard.

Per WBDG/NIBS, COBie's role is to "organize electronic submittals approved during design and construction and deliver a consolidated electronic O&M manual with little or no additional effort."

The COBie spreadsheet (or IFC export) carries:
- **Type** sheet — Manufacturer, model, warranty terms (matches product-data submittals)
- **Component** sheet — Serial, install date, location (matches as-built / commissioning)
- **Document** sheet — Links to O&M PDFs, warranties, test reports (closeout submittals)
- **Job, Resource, Spare, Attribute** sheets — Maintenance jobs, parts, spare stock

Integration play: every approved submittal artifact (PDF, drawing, cert) carries metadata that auto-populates the matching COBie row. At closeout the COBie deliverable is generated, not assembled.

---

## 6. Federal / Public-Works Specifics

- **UFGS 01 33 00 Submittal Procedures** — DoD/NAVFAC/USACE. Different code conventions and "Approving Authority" hierarchy.
- **GSA submittals** — GSA P-100 facility standards reference standard CSI §01 33 00 with GSA-specific overlays.
- **AIA G612-2017 Owner's Instructions to the Architect** — Part A captures owner's direction on the construction contract including submittal-review handling expectations; Part B is bidding.
- **AIA G716-2004 RFI** — "Neither the request nor the response received provides authorization for work that increases the cost or time of the project." Submittals and RFIs are tightly coupled — RFIs frequently arise out of submittal review.
- **Davis-Bacon WH-347 Certified Payroll** — Weekly, within 7 days of regular payment date; original-ink Statement of Compliance signature required. Recurring compliance submittal on every federally-assisted project.
- **DBE/MBE/WBE Participation Reports** — Recurring monthly compliance submittals on most federally-funded work.
- **LEED / Sustainability** — USGBC LEED Online: 25 business days first review, two rounds available, two-year deadline post substantial completion.

---

## 7. AGC / ConsensusDocs Notes

ConsensusDocs (drafted with AGC and 40+ org coalition) treat submittals slightly differently than AIA: "owner provided information is now not necessarily considered contract documents," shrinking the contractor's pre-bid examination scope. ConsensusDocs has the constructor and design professional sharing submittal review more collaboratively than AIA's allocate-to-contractor model.

---

## 8. Recommendations: MUST Honor vs. Room to Innovate

### MUST Honor

1. **CSI SectionFormat & MasterFormat Div 00–49 numbering.** Every PM, sub, and architect indexes mentally by 6-digit CSI codes. Logs must filter and group by section.
2. **A201 §3.12 contractor representations workflow.** When a contractor submits, capture that they have "reviewed and approved them, determined and verified materials," etc. — a check-box with legal teeth.
3. **A201 §4.2.7 design-intent-only architect language** in every reviewer-stamp PDF export. Don't ship a stamp that says "Approved" without the disclaimer block.
4. **At least the EJCDC 6-code review disposition set** (NET / Make Corrections Noted / Revise & Resubmit / Rejected / For Reference Only / Submit Specified Item), with per-firm customization. Don't force "Approved."
5. **A201 §3.12.8 deviation flagging** — distinct affirmative "specifically in writing" deviation flag, not a free-text comment.
6. **Submittal Schedule** as a first-class object distinct from the log (A201 §3.10.2). Tie required-by dates to the construction schedule.
7. **Ball-in-court clock with default 10-working-day SLA**, configurable per contract. Capture handoff timestamps; produce delay-claim-ready audit logs.
8. **Stamp PDF generation** with reviewer name, license #, firm seal placeholder, date, disposition — flatten-able and printable.
9. **Resubmittal versioning** — rev numbers are sacred (Rev 0 / Rev 1 / Rev A / Rev B). Architect needs to compare sequential revs side-by-side.
10. **Closeout & COBie pipe.** Every approved O&M / warranty / cert artifact must be exportable into a COBie-compatible structure at turnover.
11. **UFGS / federal mode** — switchable codeset, WH-347 weekly recurrence, DBE/MBE monthly recurrence, GSA P-100 references.

### Room to Innovate (10x leverage)

1. **Spec-to-log auto-extraction with deep-link backrefs.** Parse Part 1 §1.04/1.05 of every section; emit log rows that link to the exact spec PDF page+highlight.
2. **Type prediction + sub assignment.** ML classifies "shop drawing vs product data vs cert" and auto-assigns the responsible sub from the buyout matrix.
3. **Automated coordination conflict surfacing.** When two submittals on the same system land in the same week, flag for coordination.
4. **RFI ↔ Submittal stitching.** When a submittal review generates an RFI (AIA G716), the two are linked permanently and the SLA clock pauses correctly per A201.
5. **Voice/text-driven mobile review** for architects in the field; stamp on iPad with disclaimer block automatically appended.
6. **Schedule-impact projection.** Real-time "if this submittal slips 5 more days, here's what trade gets pushed" — pulls from P6/MS-Project tie-in.
7. **COBie auto-generation at closeout** — every submittal is metadata-tagged so the COBie deliverable is one click.
8. **LEED submittal mode** — credit-tagged submittals roll up into LEED Online v4.1 docs.
9. **Auto-withdraw stale resubmittals** (per ADR-007 in this codebase).
10. **Reviewer copilot** that pre-checks the submittal against Part 1 §1.04 line items so the architect spends time on judgment, not checklist.

---

## 9. Citations & Primary Sources

- AIA A201-2017 General Conditions §3.12, §4.2.7 — https://learn.aiacontracts.com/articles/a201-section-3-12-shop-drawings-product-data-and-samples/ ; https://www.wisconsin.edu/procurement/download/construction_contracts/A201-2017---220617.pdf ; https://learn.aiacontracts.com/articles/6538728-construction-contracting-basics-submittals/
- AIA G612-2017 Owner's Instructions to the Architect — https://help.aiacontracts.com/hc/en-us/articles/1500009321901-Instructions-G612-2017-Owner-s-Instructions-to-the-Architect
- AIA G716-2004 RFI — https://help.aiacontracts.com/hc/en-us/articles/1500009444782-Summary-G716-2004-Request-for-Information-RFI
- EJCDC O'Beirne series — Part 1 https://ejcdc.org/shop-drawings-and-submittalspart-1-definition-purpose-and-necessityby-kevin-obeirne-pe/ ; Part 2 https://www.csiresources.org/blogs/kevin-obeirne-pe-fcsi-ccs-ccca-cdt1/2021/01/21/shop-drawings-and-submittals-types-of-submittals ; Part 3 https://ejcdc.org/shop-drawings-and-submittals-part-3-liability-associated-with-submittal-reviews-by-kevin-obeirne/ ; Part 4 https://ejcdc.org/shop-drawings-and-submittals-part-4-submittal-review-stamps-by-kevin-obeirne-pe/ ; Part 5 https://ejcdc.org/shop-drawings-and-submittals-part-5-deviations-from-contract-requirements-by-kevin-obeirne-pe/
- CSI MasterFormat & §01 33 00 — https://www.procore.com/library/csi-masterformat ; https://hba.com/preambles/US/2018/Section%2001%2033%2000_Submittal%20Procedures_2016.pdf ; https://www.cuanschutz.edu/docs/librariesprovider260/design-and-construction/guidelines-and-standards/division-01/013300---submittal-procedures.pdf?sfvrsn=bf9eb8b9_2 ; https://www.untsystem.edu/offices/strategic-infrastructure/documents/contract-documents/013300-submittalprocedures.pdf ; https://www.calstate.edu/csu-system/doing-business-with-the-csu/capital-planning-design-construction/Documents/01_33_00_Submittal_Procedures.doc
- Federal UFGS 01 33 00 — https://www.wbdg.org/FFC/DOD/UFGS/UFGS%2001%2033%2000.pdf ; https://www.saj.usace.army.mil/portals/44/docs/engineering/masterguidespecs/013300.pdf
- AGC ConsensusDocs Guidebook — https://www.consensusdocs.org/wp-content/uploads/2019/07/All-Associations-Guidebook-July-2019.pdf ; https://www.consensusdocs.org/wp-content/uploads/2023/08/ConsensusDocs-All-Association-Guidebook-Aug-30-2023.pdf
- COBie / NBIMS-US V3 — https://nibs.org/nbims/v3/cobie ; https://www.wbdg.org/bim/cobie ; https://nibs.org/wp-content/uploads/2025/04/NBIMS-US_V3_4.2_COBie.pdf
- USGBC LEED — https://www.greenexamacademy.com/the-leed-submittal-process-and-appeals/ ; https://certificationwiki.gbci.org/images/7/70/LEED_Certification_Manual_2024_Edition.pdf ; https://support.usgbc.org/hc/en-us/articles/4404512648979-Documenting-certification-compliance ; https://support.usgbc.org/hc/en-us/articles/40645132563091-Timeline-management-in-LEED-Online
- DOL Davis-Bacon WH-347 — https://www.dol.gov/agencies/whd/forms/wh347
- Industry commentary — https://www.frantzward.com/submittals-shop-drawings-and-rfis-oh-my/ ; https://www.allensworthlaw.com/legal-updates/submittal-considerations-for-design-professionals/ ; https://buildsync.ai/resources/no-exceptions-taken-vs-approved-explained ; https://www.submittallink.com/post/what-is-a-construction-submittal ; https://content.ampp.org/coatingspro/article/21/6/28/72782/Construction-Submittals-Why-Who-What-When-and-How ; https://www.knowify.com/blog/submittal-schedules/ ; https://www.lexology.com/library/detail.aspx?g=1ed4c705-2c78-42c3-8298-88634b6d6e0b
- Spec-to-log automation tools — https://construction.autodesk.com/tools/autospecs-construction-submittal-log/ ; https://support.procore.com/products/online/user-guide/project-level/specifications/tutorials/generate-submittal-log
