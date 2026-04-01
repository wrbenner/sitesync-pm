# Construction Domain Knowledge

The engine reads this to understand how construction actually works. Every feature must reflect these real workflows.

## How a General Contractor Runs a Project

A GC manages the overall project: hiring subcontractors, coordinating trades, managing the schedule, controlling the budget, and communicating with the owner. The superintendent runs the field. The project manager runs the office. The CFO runs the money. SiteSync must serve all three simultaneously.

### The Superintendent's Day (6:00 AM to 4:00 PM)

6:00 AM: Arrives on site. Checks weather, reviews today's schedule, confirms which subs are showing up.
6:30 AM: Walks the site. Takes photos of progress, notes issues (water intrusion, incomplete work, safety hazards).
7:00 AM: Morning huddle with foremen. Discusses the day's priorities, any coordination issues between trades.
7:30 AM onward: Manages the field. Answers questions from subs, coordinates deliveries, resolves conflicts between trades working in the same area.
Throughout: Creates punch items when work fails inspection, logs daily activities (labor counts, equipment, weather, visitors, incidents), takes progress photos.
3:00 PM: Reviews tomorrow's schedule, confirms material deliveries, updates daily log.
4:00 PM: Submits daily log, sends key photos to PM, flags any delays or issues.

Everything must be doable on an iPhone with gloves on. Under 90 seconds per interaction.

### The Project Manager's Day

Morning: Reviews RFI status (which are overdue?), checks submittal log (which approvals are pending?), reviews budget vs. actual.
Throughout: Drafts and routes RFIs, reviews submittals from subs, processes change order requests, updates the schedule, communicates with architects and engineers, prepares pay applications.
Weekly: Schedule update meeting, cost review, owner meeting prep.
Monthly: Pay application to owner, budget reforecast, schedule look-ahead.

The PM needs total visibility and zero friction. Every workflow (RFI, submittal, change order, pay app) must be start-to-finish with no manual handoffs.

### The CFO's Quarter

Monthly: Reviews project-level P&L, processes pay applications, tracks retainage, manages cash flow.
Quarterly: Portfolio financial review, bank covenant compliance, bonding capacity review.
Annually: Budget cycle, insurance renewal, audit preparation.

The CFO needs numbers they trust without calling the PM. Real-time committed cost, projected final cost, cash flow, retainage, and WIP (work in progress) reports.

## Core Construction Workflows

### RFI (Request for Information) Workflow

1. Field identifies a conflict, ambiguity, or missing detail in the drawings
2. Super or PM creates the RFI with description, reference drawing, location, and urgency
3. RFI is routed to the architect or engineer of record
4. Design team reviews and responds (often with a sketch or specification reference)
5. Response is reviewed by PM and distributed to affected subcontractors
6. If the response has cost or schedule impact, a change order is created
7. RFI is closed and linked to affected drawings, submittals, and change orders

Critical metrics: Days open, response time, overdue count, cost impact, distribution to affected trades.
Critical features: Auto-draft response with AI, link to drawings, bulk create from clash reports, email reply for design team.

### Submittal Workflow

1. Subcontractor prepares a submittal package (shop drawings, product data, samples, calculations)
2. GC reviews for compliance with specs and contract requirements
3. GC forwards to architect for approval
4. Architect reviews and marks: Approved, Approved as Noted, Revise and Resubmit, Rejected
5. If "Revise and Resubmit": sub revises and the cycle repeats (track revision count)
6. Approved submittals are distributed to the field and logged against the spec section
7. Material procurement begins only after submittal approval

Critical metrics: Approval rate, resubmission rate, days in review, spec sections covered.
Critical features: Spec section linking, revision tracking, ball-in-court indicator, procurement date impact.

### Change Order Workflow

1. A change condition is identified (owner request, design change, unforeseen condition, RFI response)
2. Potential Change Order (PCO) is created with description, rough cost, schedule impact
3. Subcontractor pricing is requested and received
4. GC assembles full change order request with markup
5. Owner reviews, negotiates, approves or rejects
6. Approved change order updates the contract value, budget, and schedule
7. Work proceeds, costs are tracked against the change order

Types: Owner-directed, contractor-initiated, design-error, unforeseen condition.
Critical: Tracking pending vs. approved, impact on committed cost and projected final cost, linking back to the originating RFI or field condition.

### Daily Log Workflow

1. Superintendent logs: weather (conditions, temperature, wind), manpower by trade (company, headcount, hours), equipment on site, materials received, visitors, safety observations, incidents
2. Narrative: what happened today, what was accomplished, any delays, any issues
3. Photos attached with location tags
4. Log is submitted, time-stamped, and becomes part of the permanent project record
5. Logs are legally discoverable: used in claims, disputes, delay analysis, insurance proceedings

Critical: The daily log must be legally defensible. Time stamps, weather data from external API, crew counts verified, incident details complete. This is not a nice-to-have. This is evidence.

### Pay Application (AIA Billing) Workflow

1. Subcontractor submits a pencil draw (draft pay app) with percent complete per schedule of values line item
2. PM reviews percent complete against actual field progress
3. PM adjusts percentages, calculates stored materials, applies retainage (usually 10%)
4. PM assembles the GC's pay application to the owner (AIA G702/G703 format)
5. Owner and architect review and approve
6. Payment is issued, retainage is tracked
7. At substantial completion, retainage is released (often 50% at substantial, 50% at final)

AIA G702: Application and Certificate for Payment (summary sheet)
AIA G703: Continuation Sheet (line-item detail by schedule of values)

Critical: Retainage tracking, stored materials, percent complete validation, previous application amounts, current payment due calculation.

### Lien Waiver Workflow

1. Before or upon payment, the GC collects lien waivers from each subcontractor and supplier
2. Four types: Conditional Waiver on Progress Payment, Unconditional Waiver on Progress Payment, Conditional Waiver on Final Payment, Unconditional Waiver on Final Payment
3. Conditional waivers are provided before payment clears; unconditional after payment clears
4. The GC must collect waivers from every sub and their suppliers before paying the owner's draw
5. Missing lien waivers can delay payment, create legal exposure, and complicate project closeout

Critical: Auto-generate waivers from pay app approvals, track status per sub per payment period, flag missing waivers, export for legal compliance.

### Schedule Management

1. Baseline schedule is established at project start (Critical Path Method, CPM)
2. Monthly updates compare actual progress to baseline
3. Float analysis shows which activities can slip without delaying the project
4. Critical path identification shows which activities cannot slip at all
5. Look-ahead schedule (3-week or 6-week) is the working schedule used daily in the field
6. When delays occur: Time Impact Analysis (TIA) quantifies the impact on the completion date

Critical: Baseline vs. actual comparison, critical path highlighting, earned value (planned vs. actual), look-ahead generation, weather delay tracking, automatic float calculation.

## Financial Concepts the Engine Must Understand

### Job Costing by CSI Division

The Construction Specifications Institute (CSI) MasterFormat organizes work into 50 divisions. The most common for commercial projects:

Division 01: General Requirements (general conditions, temporary facilities)
Division 02: Existing Conditions (demolition, site clearing)
Division 03: Concrete
Division 04: Masonry
Division 05: Metals (structural steel)
Division 06: Wood, Plastics, Composites (framing, finish carpentry)
Division 07: Thermal and Moisture Protection (roofing, waterproofing, insulation)
Division 08: Openings (doors, windows, hardware)
Division 09: Finishes (drywall, paint, flooring, tile, acoustical ceilings)
Division 10: Specialties (signage, toilet accessories)
Division 14: Conveying Equipment (elevators)
Division 21: Fire Suppression
Division 22: Plumbing
Division 23: HVAC
Division 26: Electrical
Division 31: Earthwork
Division 32: Exterior Improvements (paving, landscaping)
Division 33: Utilities

### Key Financial Metrics

Original Contract Value: The starting contract amount
Approved Change Orders: Sum of all approved COs
Revised Contract Value: Original + Approved COs
Pending Change Orders: COs submitted but not yet approved
Committed Cost: Subcontracts + purchase orders (what you owe)
Cost to Complete: Estimated remaining cost
Projected Final Cost: Committed + Cost to Complete
Over/Under: Revised Contract Value minus Projected Final Cost
Retainage Held: Typically 10% withheld from each payment until substantial completion
Retainage Receivable: Retainage the owner holds from the GC
Work in Progress (WIP): Revenue earned minus billings (over-billed or under-billed)

### Cash Flow

A GC's cash flow is driven by:
1. Billings to the owner (monthly pay apps)
2. Payments received (typically 30 days after billing)
3. Payments to subcontractors (typically 30 days after GC receives payment)
4. Retainage held (10% withheld, released at completion)
5. Front-loading vs. back-loading of the schedule of values

13-week cash flow forecast: The standard for construction CFOs. Projects 13 weeks out from committed costs, approved pay apps, pending change orders, and known upcoming payments.

## Safety

OSHA recordable incident rate, near-miss tracking, toolbox talks, JSA/JHA (Job Safety Analysis / Job Hazard Analysis), safety observation tracking, incident investigation with root cause analysis, EMR (Experience Modification Rate) tracking per subcontractor.

## Closeout

Punch list completion tracking, O&M manual collection, as-built drawing collection, warranty documentation, final lien waivers, final retainage release, certificate of substantial completion, certificate of occupancy tracking.
