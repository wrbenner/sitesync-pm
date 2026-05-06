// ── Cost-code inference ────────────────────────────────────────────────────
// Each "Work Performed" bullet gets a CSI cost code inferred from its text
// + any attached drawing pins. Returns a confidence score; the caller
// drops the code (better silent than wrong) when confidence < 0.6.
//
// This is a deterministic keyword-rule system, not an ML model. We chose
// rules because:
//   • Cost codes change per project / per CSI revision; rules are easy
//     to override per-project later.
//   • LLM-inferred codes drift across runs and break the per-cost-code
//     productivity rollups the Reports page surfaces.
//   • Latency / cost: we run this on every bullet of every daily log.
//
// CSI MasterFormat 2018 codes used here are the broadly-common ones for
// commercial construction. Add more rules as we see real bullets in the
// wild — keep them tight (require ≥ 2 keyword matches for high
// confidence) so we never tag wrong.

export interface CostCodeInference {
  cost_code: string | null;
  confidence: number;
  matched_terms: ReadonlyArray<string>;
}

interface Rule {
  code: string;
  /** Human-readable label, used in matched_terms output. */
  label: string;
  /** Words/phrases that fire this rule. Lowercase. Can be regex. */
  triggers: ReadonlyArray<string | RegExp>;
  /** A 'pinned_zone' value (drawing zone label) that boosts confidence. */
  zone_hint?: string;
}

const RULES: ReadonlyArray<Rule> = [
  {
    code: '03 30 00',
    label: 'Cast-in-Place Concrete',
    triggers: ['concrete', 'rebar', 'pour', 'slab', 'formwork', 'foundation', 'footing', 'mat slab'],
  },
  {
    code: '04 22 00',
    label: 'Concrete Unit Masonry',
    triggers: ['cmu', 'masonry', 'block wall', 'mortar'],
  },
  {
    code: '05 12 00',
    label: 'Structural Steel Framing',
    triggers: ['steel beam', 'steel column', 'erection', 'i-beam', 'w-beam', 'structural steel'],
  },
  {
    code: '06 10 00',
    label: 'Rough Carpentry',
    triggers: ['framing', 'stud wall', 'rough carpentry', 'joist', 'rafter', 'plywood sheathing'],
  },
  {
    code: '07 21 00',
    label: 'Thermal Insulation',
    triggers: ['insulation', 'fiberglass batts', 'spray foam', 'rigid insulation'],
  },
  {
    code: '07 50 00',
    label: 'Membrane Roofing',
    triggers: ['roofing', 'roof membrane', 'tpo', 'epdm', 'built-up roof'],
  },
  {
    code: '08 11 13',
    label: 'Hollow Metal Doors',
    triggers: ['door frame', 'hollow metal door', 'hm door'],
  },
  {
    code: '08 71 00',
    label: 'Door Hardware',
    triggers: ['door hardware', 'hinges', 'closers', 'panic device', 'lockset'],
  },
  {
    code: '09 21 16',
    label: 'Gypsum Board Assemblies',
    triggers: ['drywall', 'gypsum', 'gyp board', 'sheetrock', 'taping', 'mudding'],
  },
  {
    code: '09 65 00',
    label: 'Resilient Flooring',
    triggers: ['vct', 'vinyl tile', 'resilient flooring', 'lvt'],
  },
  {
    code: '09 91 00',
    label: 'Painting',
    triggers: ['paint', 'painting', 'primer', 'topcoat', 'spray paint'],
  },
  {
    code: '21 10 00',
    label: 'Fire-Suppression Sprinkler',
    triggers: ['sprinkler head', 'fire main', 'fire-suppression', 'fp piping'],
  },
  {
    code: '22 10 00',
    label: 'Plumbing Piping',
    triggers: ['plumbing', 'water line', 'sanitary', 'waste line', 'pex', 'copper line'],
  },
  {
    code: '23 31 00',
    label: 'HVAC Ducts',
    triggers: ['ductwork', 'duct install', 'sheet metal duct', 'vav', 'spiral duct'],
  },
  {
    code: '26 05 00',
    label: 'Common Work Results for Electrical',
    triggers: ['conduit', 'wire pull', 'electrical rough', 'panel install', 'gear', 'feeder', /\b(emt|rmc)\b/],
  },
  {
    code: '27 10 00',
    label: 'Structured Cabling',
    triggers: ['low voltage', 'data cabling', 'cat6', 'cat-6', 'fiber pull'],
  },
  {
    code: '31 23 00',
    label: 'Excavation and Fill',
    triggers: ['excavation', 'trenching', 'backfill', 'site dig', 'compaction'],
  },
];

const STOP_WORDS = new Set([
  'install', 'installed', 'work', 'crew', 'site', 'today', 'progress', 'continue',
  'continued', 'began', 'finished',
]);

/** Lowercase + collapse multi-space; avoid stripping punctuation that
 *  meaningfully separates phrases (slash, hyphen). */
function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function inferCostCode(
  bulletText: string,
  pinnedZone?: string,
): CostCodeInference {
  const text = normalize(bulletText);
  if (text.length < 4) return { cost_code: null, confidence: 0, matched_terms: [] };

  let best: CostCodeInference = { cost_code: null, confidence: 0, matched_terms: [] };

  for (const rule of RULES) {
    const matches: string[] = [];
    for (const t of rule.triggers) {
      if (typeof t === 'string') {
        if (text.includes(t)) matches.push(t);
      } else if (t.test(text)) {
        matches.push(t.source);
      }
    }
    if (matches.length === 0) continue;

    // Stop-word guard: if the only matches are generic terms, drop the
    // confidence floor to discourage false positives.
    const meaningful = matches.filter((m) => !STOP_WORDS.has(m));
    if (meaningful.length === 0) continue;

    // Confidence model:
    //   1 match: 0.45
    //   2 matches: 0.7
    //   3+ matches: 0.85
    //   pinned_zone hint matches rule.zone_hint: +0.1 (capped at 0.95)
    let conf = matches.length === 1 ? 0.45 : matches.length === 2 ? 0.7 : 0.85;
    if (rule.zone_hint && pinnedZone && normalize(pinnedZone).includes(normalize(rule.zone_hint))) {
      conf = Math.min(0.95, conf + 0.1);
    }

    if (conf > best.confidence) {
      best = { cost_code: rule.code, confidence: conf, matched_terms: matches };
    }
  }

  return best;
}
