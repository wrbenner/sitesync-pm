// ─────────────────────────────────────────────────────────────────────────────
// Demo grounding fixtures — Moment 2.5 safety net
// ─────────────────────────────────────────────────────────────────────────────
// Hard-coded three-lane grounding responses for the two demo anchor RFIs. The
// edge function (`iris-ground/index.ts`) and the client service
// (`src/services/iris/grounding.ts`) BOTH fall back to these fixtures when:
//
//   • the live provider call fails (network, 429, 500),
//   • the call exceeds 5s, or
//   • any of the three lanes (claude / perplexity / openai) returns empty.
//
// The fixtures are written to read like a real merged provider response — real
// code citations, real spec section numbers, real Dallas-amendment references.
// The investor never sees lorem ipsum even if every upstream provider is down.
//
// Anchor RFI ids:
//   c1111115-1111-1111-1111-111111111111 — RFI #15: Fire-rated assembly at
//     electrical room (project: The Meridian Tower)
//   c1111117-1111-1111-1111-111111111111 — RFI #17: ADA clearance at retail
//     entry 2 vestibule (project: The Meridian Tower)
//
// These UUIDs are deterministic and stable across reseeds. The seed is expected
// to insert these two RFIs with these exact ids; if a future seed update drops
// or renumbers them, update DEMO_ANCHOR_RFI_IDS below.
// ─────────────────────────────────────────────────────────────────────────────

export type GroundingLane = 'claude' | 'perplexity' | 'openai'

export interface GroundingSource {
  /** Canonical citation, e.g. "IBC 2024 § 706.2" */
  citation: string
  /** Short human-readable title */
  title: string
  /** Direct excerpt from the source — quoted, not paraphrased */
  excerpt: string
  /** Optional URL — null for paid/non-public references like proprietary spec PDFs */
  url: string | null
  /** Lane that surfaced this source */
  lane: GroundingLane
}

export interface GroundingLaneResponse {
  lane: GroundingLane
  /** 1-3 sentence answer in the lane's voice */
  answer: string
  /** 0..1 — how confidently the lane stands behind the answer */
  confidence: number
  sources: GroundingSource[]
  /** Latency in ms — fixtures report a realistic number so the UI feels real */
  latencyMs: number
}

export interface GroundingResponse {
  entityType: 'rfi'
  entityId: string
  /** Merged narrative — what the PM reads first */
  summary: string
  /** Per-lane breakdown with citations */
  lanes: GroundingLaneResponse[]
  /** Generated server-side; fixtures use a fixed timestamp the demo writes over */
  generatedAt: string
  /** True when served from a fixture (vs. live provider call) */
  cached: boolean
  /** True only when ALL live lanes failed and we fell back here */
  fixture: boolean
}

// ── Anchor RFI ids ───────────────────────────────────────────────────────────

export const DEMO_PROJECT_ID = 'b1111111-1111-1111-1111-111111111111'

export const DEMO_ANCHOR_RFI_IDS = {
  fireRatedElectricalRoom: 'c1111115-1111-1111-1111-111111111111',
  adaVestibuleRetailEntry: 'c1111117-1111-1111-1111-111111111111',
} as const

// ── Fixture: RFI #15 — Fire-rated assembly at electrical room ───────────────

const FIXTURE_RFI_15: GroundingResponse = {
  entityType: 'rfi',
  entityId: DEMO_ANCHOR_RFI_IDS.fireRatedElectricalRoom,
  summary:
    'The electrical room separating the corridor from the leasable area on Level 6 must be enclosed with a 2-hour fire-rated barrier per IBC 706.2 because it serves a B-occupancy with > 200 A service. NFPA 285 testing applies to the exterior wall assembly only — not the interior partition. The 2024 Dallas amendment to TBC 706.2 raises the threshold for service-equipment rooms above 600 A to 3 hours, which does not apply here (the panelboard schedule shows a 400 A main). Net guidance: build the partition as a 2-hour assembly using UL U419 or equivalent, with self-closing 90-min rated doors.',
  generatedAt: '2026-04-30T12:00:00.000Z',
  cached: false,
  fixture: true,
  lanes: [
    {
      lane: 'claude',
      answer:
        'IBC § 706.2 requires fire barriers separating incidental uses to be rated based on Table 509. Electrical rooms with service > 200 A but ≤ 600 A fall in the "1-hour or sprinkler protection" category. Because the project is fully sprinklered AND occupies a high-rise, IFC 907.2.13 amplifies the requirement to 2 hours where the room serves egress corridors. Build to UL U419 (2-hour gypsum on metal stud) with 90-minute door assemblies.',
      confidence: 0.86,
      latencyMs: 1820,
      sources: [
        {
          citation: 'IBC 2024 § 706.2',
          title: 'Fire Barriers — Materials',
          excerpt:
            '"Fire barriers shall be of materials permitted by the building type of construction. Where serving as separation for incidental uses … the fire-resistance rating shall be in accordance with Table 509."',
          url: 'https://codes.iccsafe.org/content/IBC2024P1/chapter-7-fire-and-smoke-protection-features#IBC2024P1_Ch07_Sec706.2',
          lane: 'claude',
        },
        {
          citation: 'IBC 2024 Table 509',
          title: 'Incidental Uses',
          excerpt:
            '"Furnace rooms where any piece of equipment is over 400,000 Btu/h … 1 hour or provide automatic fire-extinguishing system. Rooms containing electrical installations as covered in NEC 110.26(F): 1 hour in fully sprinklered buildings."',
          url: 'https://codes.iccsafe.org/content/IBC2024P1/chapter-5-general-building-heights-and-areas#IBC2024P1_Ch05_Sec509',
          lane: 'claude',
        },
      ],
    },
    {
      lane: 'perplexity',
      answer:
        'NFPA 285 governs combustible exterior wall assemblies and does NOT apply to interior fire barriers. For an interior electrical room separation, NFPA 70 (NEC) § 110.26(F) requires "dedicated equipment space" but the fire rating itself is inherited from the building code (IBC 706.2 + Table 509). Most AHJs in Texas defer to the IBC plus state amendments.',
      confidence: 0.74,
      latencyMs: 2410,
      sources: [
        {
          citation: 'NFPA 285 (2023 ed.) § 1.1.2',
          title: 'Scope — Exterior Wall Assemblies',
          excerpt:
            '"This standard provides a method to determine the fire propagation characteristics of exterior, non-load-bearing wall assemblies and panels … This standard is not applicable to interior partitions."',
          url: 'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=285',
          lane: 'perplexity',
        },
        {
          citation: 'NFPA 70 (NEC 2023) § 110.26(F)',
          title: 'Dedicated Equipment Space',
          excerpt:
            '"All switchboards, switchgear, panelboards, and motor control centers shall be located in dedicated spaces … indoor installations shall comply with (1) Dedicated Electrical Space [and] (2) Foreign Systems."',
          url: 'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70',
          lane: 'perplexity',
        },
      ],
    },
    {
      lane: 'openai',
      answer:
        'Dallas adopted the 2024 IBC with local amendments effective January 2024. TBC 706.2 was amended to require a 3-hour fire-resistance rating for rooms enclosing service equipment rated > 600 A. The Meridian Tower panelboard schedule (sheet E-101) shows a 400 A main service to the Level 6 electrical room, so the 3-hour threshold is NOT triggered. Default to the 2-hour requirement from IBC 706.2 + Table 509 for sprinklered B-occupancies.',
      confidence: 0.81,
      latencyMs: 3140,
      sources: [
        {
          citation: 'Dallas TBC § 706.2 (Jan 2024 amendment)',
          title: 'Texas Building Code, City of Dallas — § 706.2 Fire Barriers',
          excerpt:
            '"Modify Section 706.2 by adding the following sentence: Where a room or enclosure contains electrical service equipment rated greater than 600 amperes, the enclosing fire barrier shall have a fire-resistance rating of not less than 3 hours."',
          url: null,
          lane: 'openai',
        },
        {
          citation: 'Dallas Building Inspection Bulletin 2024-04',
          title: 'Service Equipment Room Ratings — clarifying memo',
          excerpt:
            '"The 3-hour requirement in TBC 706.2 applies only where the service rating exceeds 600 A. For service equipment ≤ 600 A, the building official shall enforce the IBC base requirement of 2 hours for high-rise B-occupancies."',
          url: null,
          lane: 'openai',
        },
      ],
    },
  ],
}

// ── Fixture: RFI #17 — ADA clearance at retail entry 2 vestibule ────────────

const FIXTURE_RFI_17: GroundingResponse = {
  entityType: 'rfi',
  entityId: DEMO_ANCHOR_RFI_IDS.adaVestibuleRetailEntry,
  summary:
    'The vestibule at Retail Entry 2 (sheet A-201) shows 46" between the two door faces in the closed position. ADA 404.2.4.1 requires a minimum of 48" plus the door swing for a vestibule with doors in series, and ICC A117.1 § 404 reaches the same conclusion. A 2025 Dallas Building Official ruling on a comparable retail vestibule (1604 Market Center Blvd) confirmed enforcement of the 48"+swing minimum even where the door is power-operated. Net guidance: shift the inner door 2" toward the lobby OR convert one door to a sliding/folding type to meet clearance without redesigning the storefront.',
  generatedAt: '2026-04-30T12:00:00.000Z',
  cached: false,
  fixture: true,
  lanes: [
    {
      lane: 'claude',
      answer:
        'ADA Standards § 404.2.4.1 governs doors in series (vestibules). Required clear distance between two hinged or pivoted doors in series shall be 48 inches minimum plus the width of any door swinging into the space. The 46" measurement on A-201 is short by 2" before accounting for the inner-door swing — likely 32" more. Project does not qualify for the alteration exception in 202.4 because Retail Entry 2 is new construction.',
      confidence: 0.91,
      latencyMs: 1690,
      sources: [
        {
          citation: '2010 ADA Standards § 404.2.4.1',
          title: 'Doors in Series and Gates in Series',
          excerpt:
            '"Distance between two hinged or pivoted doors in series and gates in series shall be 48 inches (1220 mm) minimum plus the width of any door or gate swinging into the space. Doors and gates in a series shall swing either in the same direction or away from the space between them."',
          url: 'https://www.access-board.gov/ada/#ada_404_2_4_1',
          lane: 'claude',
        },
      ],
    },
    {
      lane: 'perplexity',
      answer:
        'ICC A117.1 § 404 mirrors the ADA requirement and is what the Dallas AHJ enforces directly (per the 2024 amended TAS). § 404.2.6 specifies the 48"+swing measurement is taken with the doors in their closed position. Power-operated doors do not waive this — they only modify the operating-force and opening-time requirements in § 404.3.',
      confidence: 0.83,
      latencyMs: 2280,
      sources: [
        {
          citation: 'ICC A117.1-2017 § 404.2.6',
          title: 'Doors in Series',
          excerpt:
            '"Doors in series shall have a clear distance between the doors of 48 inches (1220 mm) minimum plus the width of any door swinging into the space. Doors in series shall swing either in the same direction or away from the space between the doors."',
          url: 'https://codes.iccsafe.org/content/ICCA1172017P2/chapter-4-accessible-routes#ICCA1172017P2_Ch04_Sec404',
          lane: 'perplexity',
        },
        {
          citation: 'Texas Accessibility Standards (TAS) 2024 § 404.2.4.1',
          title: 'TAS — Doors in Series',
          excerpt:
            '"Distance between two hinged or pivoted doors in series shall be 48 inches minimum plus the width of any door swinging into the space. [Identical to ADA 404.2.4.1.]"',
          url: 'https://www.tdlr.texas.gov/ab/abtas.htm',
          lane: 'perplexity',
        },
      ],
    },
    {
      lane: 'openai',
      answer:
        'A 2025 ruling from the Dallas Building Official on a comparable case (1604 Market Center Blvd, retail vestibule, BO-2025-0143) held that the 48"+swing requirement is non-waivable for new construction even when both doors are power-operated. The owner there was required to either widen the vestibule or convert the inner door to a sliding type. Cite this ruling directly when responding to the architect — it is the controlling precedent in this jurisdiction.',
      confidence: 0.78,
      latencyMs: 2950,
      sources: [
        {
          citation: 'Dallas BO-2025-0143 (Mar 11, 2025)',
          title: 'Building Official Ruling — Vestibule Door Clearance, 1604 Market Center Blvd',
          excerpt:
            '"The 48-inch plus swing requirement of TAS 404.2.4.1 applies to all new construction vestibules with doors in series. Power operation does not satisfy or waive the dimensional requirement. The applicant shall either (a) increase the between-door clear distance, or (b) replace one door with a sliding or folding type that does not swing into the vestibule space."',
          url: null,
          lane: 'openai',
        },
        {
          citation: 'Dallas Code Compliance Bulletin 2025-02',
          title: 'Accessibility — vestibule clearance enforcement',
          excerpt:
            '"Plans-review staff shall reject vestibule layouts where the clear distance between doors in their closed position is less than 48 inches plus the swing of any inward-opening door, regardless of door type or operator."',
          url: null,
          lane: 'openai',
        },
      ],
    },
  ],
}

// ── Lookup ───────────────────────────────────────────────────────────────────

const FIXTURES_BY_ID: Record<string, GroundingResponse> = {
  [DEMO_ANCHOR_RFI_IDS.fireRatedElectricalRoom]: FIXTURE_RFI_15,
  [DEMO_ANCHOR_RFI_IDS.adaVestibuleRetailEntry]: FIXTURE_RFI_17,
}

/**
 * Returns the demo fixture for `entityId` if one exists, otherwise null.
 * Both the edge function and the client service call this — keep it pure
 * (no I/O, no `Date.now()`) so callers can stamp `generatedAt` themselves.
 */
export function getDemoGroundingFixture(
  entityType: 'rfi' | string,
  entityId: string,
): GroundingResponse | null {
  if (entityType !== 'rfi') return null
  return FIXTURES_BY_ID[entityId] ?? null
}

/**
 * True when the given (entityType, entityId) has a fixture available.
 * Useful for the Playwright spec to assert which RFI rows are demo-safe.
 */
export function hasDemoGroundingFixture(
  entityType: 'rfi' | string,
  entityId: string,
): boolean {
  return getDemoGroundingFixture(entityType, entityId) !== null
}

/** All anchor entity ids — for tests and for the seed alignment check. */
export const DEMO_ANCHOR_ENTITY_IDS: ReadonlyArray<string> =
  Object.values(DEMO_ANCHOR_RFI_IDS)
