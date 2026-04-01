# Industry Reference Data

The engine reads this for accurate construction industry data, formulas, and standards.

## CSI MasterFormat Divisions (Most Common in Commercial)

01 General Requirements
02 Existing Conditions
03 Concrete
04 Masonry
05 Metals
06 Wood, Plastics, Composites
07 Thermal and Moisture Protection
08 Openings
09 Finishes
10 Specialties
11 Equipment
12 Furnishings
13 Special Construction
14 Conveying Equipment
21 Fire Suppression
22 Plumbing
23 HVAC
26 Electrical
27 Communications
28 Electronic Safety and Security
31 Earthwork
32 Exterior Improvements
33 Utilities

## AIA Document Types

A101: Standard Form of Agreement Between Owner and Contractor (Stipulated Sum)
A201: General Conditions of the Contract for Construction
G701: Change Order
G702: Application and Certificate for Payment
G703: Continuation Sheet (Schedule of Values detail)
G704: Certificate of Substantial Completion
G706: Contractor's Affidavit of Payment of Debts and Claims
G706A: Contractor's Affidavit of Release of Liens
G707: Consent of Surety to Final Payment
G710: Architect's Supplemental Instructions

## Financial Formulas

### Pay Application Calculation
Current Payment Due = (Scheduled Value × Percent Complete This Period) + Stored Materials - Retainage
Retainage = Total Completed to Date × Retainage Rate (typically 10%)
Total Earned to Date = Scheduled Value × Total Percent Complete
Balance to Finish = Scheduled Value - Total Earned to Date

### Change Order Impact
Revised Contract Value = Original Contract + Sum of Approved Change Orders
Pending Exposure = Sum of Pending Change Orders (not yet approved)
Total Potential Contract = Revised Contract + Pending Exposure

### Job Cost Metrics
Committed Cost = Sum of all subcontracts + purchase orders
Invoiced to Date = Sum of all approved invoices from subs
Cost to Complete = Committed Cost - Invoiced to Date + Estimated Remaining
Projected Final Cost = Invoiced to Date + Cost to Complete
Variance = Revised Budget - Projected Final Cost (positive = under budget)

### Earned Value Metrics
Budgeted Cost of Work Scheduled (BCWS / Planned Value): What you planned to spend by now
Budgeted Cost of Work Performed (BCWP / Earned Value): Value of work actually completed
Actual Cost of Work Performed (ACWP / Actual Cost): What you actually spent
Schedule Performance Index (SPI) = BCWP / BCWS (1.0 = on schedule, <1.0 = behind)
Cost Performance Index (CPI) = BCWP / ACWP (1.0 = on budget, <1.0 = over budget)
Estimate at Completion (EAC) = Budget / CPI

### Cash Flow Projection
Week N Inflow = Approved Pay App Amount × Collection Probability × Timing Factor
Week N Outflow = Sub Invoices Due + Material Payments + Payroll + Equipment + Insurance
Net Cash Position = Prior Balance + Inflows - Outflows
13-Week Projection: Repeat for weeks 1-13, chart cumulative position

### Retainage
Standard retainage: 10% of each progress payment
At Substantial Completion: Release 50% of retainage (varies by contract)
At Final Completion: Release remaining 50%
Retainage Receivable = Sum of retainage held by owner from GC
Retainage Payable = Sum of retainage held by GC from subs

## Key Performance Indicators (KPIs)

### Schedule KPIs
Schedule Variance (days): Planned completion minus projected completion
Activities completed on time: Percentage of activities finished by baseline date
Critical path length: Number of days on the longest path
Float consumed: Percentage of total float used
Look-ahead accuracy: Percentage of 3-week look-ahead activities completed as planned

### Financial KPIs
Budget variance by division: Over/under per CSI division
Change order rate: CO value as percentage of original contract
Billing efficiency: Days from work completion to pay app submission
Collection speed: Days from pay app submission to payment received
Retainage as percentage of total contract value

### Quality KPIs
Punch items per unit/area: Density of quality issues
First-time pass rate: Percentage of inspections that pass on first attempt
Rework cost: Cost of work that had to be redone
Submittal approval rate: Percentage approved without revision

### Safety KPIs
OSHA Recordable Incident Rate (RIR): (Number of recordable incidents × 200,000) / Total hours worked
Lost Time Incident Rate (LTIR): (Lost time incidents × 200,000) / Total hours worked
Near-miss reporting rate: Near-misses reported per week
Toolbox talks completed: Percentage of scheduled safety talks held
EMR (Experience Modification Rate): Insurance metric, 1.0 is average, lower is better

### RFI KPIs
Average response time (days)
Overdue percentage
RFIs per $1M of contract value (industry average: 5-15)
Cost impact rate: Percentage of RFIs resulting in change orders
Resolution rate: Closed RFIs as percentage of total

### Submittal KPIs
On-time submission rate
Approval cycle time (days)
Resubmission rate (lower is better, indicates quality of initial submission)
Spec coverage: Percentage of required spec sections with submitted and approved submittals

## Lien Waiver Types

### Progress Payment
Conditional Waiver on Progress Payment: Waives rights only for a specific amount, effective only upon receipt of payment
Unconditional Waiver on Progress Payment: Waives rights for a specific amount, effective immediately (used after payment clears)

### Final Payment
Conditional Waiver on Final Payment: Waives all rights, effective only upon receipt of final payment
Unconditional Waiver on Final Payment: Waives all rights, effective immediately (used after final payment clears)

### Workflow
1. Sub submits conditional waiver with pay app
2. GC pays sub
3. Sub submits unconditional waiver confirming payment received
4. GC includes unconditional waivers from all subs with pay app to owner
5. Repeat monthly until final payment

## Standard Project Phases

Preconstruction: Bidding, estimating, buyout, permitting, submittal preparation
Mobilization: Site setup, temporary facilities, utility connections
Construction: Foundation, structure, envelope, MEP rough-in, finishes
Commissioning: System testing, balancing, training
Closeout: Punch list, O&M manuals, as-builts, warranties, final payments, lien waivers
Warranty: Typically 1 year from substantial completion

## Common Project Types (by SiteSync target market)

Commercial Office: $10M-$500M, 12-36 months, heavy MEP coordination
Mixed-Use: $20M-$1B, 18-48 months, complex phasing and occupancy
Healthcare: $50M-$2B, 24-60 months, strict regulatory compliance
Education: $10M-$200M, 12-24 months, tight summer construction windows
Multifamily Residential: $15M-$500M, 18-36 months, repetitive floor plans
Industrial/Warehouse: $5M-$100M, 6-18 months, fast-track delivery
Data Center: $50M-$2B, 12-24 months, MEP-intensive, high commissioning requirements
