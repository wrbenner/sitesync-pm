/**
 * Parse a construction drawing scale ratio string into a numerical
 * "real inches per paper inch" multiplier.
 *
 * Supported formats:
 *   - Architectural: 1/4"=1'-0", 1/8"=1'-0", 3/16"=1'-0", etc.
 *   - Engineering: 1"=10', 1"=20', 1"=50', etc.
 *   - Unitless ratio: 1:100, 1:50
 *   - Metric: 1:100 (treated as unitless)
 */
export interface ScaleParseResult {
  realPerPaper: number; // multiply paper inches by this to get real inches
  label: string;
}

export function parseScaleRatio(input: string | null | undefined): ScaleParseResult | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Architectural: "1/4\"=1'-0\"" or "1/4 in = 1 ft"
  const archMatch = raw.match(/(\d+(?:\.\d+)?|\d+\/\d+)\s*["']?\s*=?\s*(\d+)\s*(?:'|ft|feet)(?:\s*-\s*(\d+)\s*(?:"|in)?)?/i);
  if (archMatch) {
    const paperIn = parseFractional(archMatch[1]);
    const realFt = parseFloat(archMatch[2]);
    const realIn = archMatch[3] ? parseFloat(archMatch[3]) : 0;
    const realInches = realFt * 12 + realIn;
    if (paperIn > 0 && realInches > 0) {
      return { realPerPaper: realInches / paperIn, label: raw };
    }
  }

  // Engineering: "1\"=20'" or "1\" = 20 ft"
  const engMatch = raw.match(/(\d+(?:\.\d+)?)\s*["']?\s*=?\s*(\d+(?:\.\d+)?)\s*(?:'|ft|feet)/i);
  if (engMatch) {
    const paperIn = parseFloat(engMatch[1]);
    const realFt = parseFloat(engMatch[2]);
    if (paperIn > 0 && realFt > 0) {
      return { realPerPaper: (realFt * 12) / paperIn, label: raw };
    }
  }

  // Ratio: "1:100"
  const ratioMatch = raw.match(/^(\d+)\s*:\s*(\d+)$/);
  if (ratioMatch) {
    const a = parseFloat(ratioMatch[1]);
    const b = parseFloat(ratioMatch[2]);
    if (a > 0 && b > 0) {
      return { realPerPaper: b / a, label: raw };
    }
  }

  return null;
}

function parseFractional(s: string): number {
  if (s.includes('/')) {
    const [num, den] = s.split('/').map(parseFloat);
    if (den > 0) return num / den;
  }
  return parseFloat(s);
}

/**
 * Parse user calibration input. Accepts:
 *   "12"        → 12 inches
 *   "144"       → 144 inches
 *   "10'"       → 120 inches
 *   "10 ft"     → 120 inches
 *   "10'-6\""   → 126 inches
 *   "10' 6"     → 126 inches
 *   "12.5"      → 12.5 inches
 *   "2.5m"      → 98.425 inches (metric)
 *   "30cm"      → 11.811 inches
 * Returns null if the string can't be parsed as a positive distance.
 */
export function parseCalibrationInput(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const meters = s.match(/^(\d+(?:\.\d+)?)\s*m(?:eter|tr)?s?$/);
  if (meters) return parseFloat(meters[1]) * 39.3701;
  const cm = s.match(/^(\d+(?:\.\d+)?)\s*cm$/);
  if (cm) return parseFloat(cm[1]) * 0.393701;
  const mm = s.match(/^(\d+(?:\.\d+)?)\s*mm$/);
  if (mm) return parseFloat(mm[1]) * 0.0393701;
  const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*[-\s]?\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inch|inches)?$/);
  if (ftIn) {
    const ft = parseFloat(ftIn[1]);
    const inch = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    const total = ft * 12 + inch;
    return total > 0 ? total : null;
  }
  const inOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?$/);
  if (inOnly) {
    const v = parseFloat(inOnly[1]);
    return v > 0 ? v : null;
  }
  return null;
}

/**
 * Format inches as feet-and-inches string ("12'-6\"") with rounding
 * appropriate for construction dimensioning.
 */
export function formatFeetInches(inches: number): string {
  if (!isFinite(inches) || inches <= 0) return '0"';
  const totalInches = Math.abs(inches);
  const ft = Math.floor(totalInches / 12);
  const inRemainder = totalInches - ft * 12;
  const roundedIn = Math.round(inRemainder * 2) / 2;
  if (ft === 0) return `${roundedIn}"`;
  if (roundedIn === 0) return `${ft}'-0"`;
  if (roundedIn === 12) return `${ft + 1}'-0"`;
  return `${ft}'-${roundedIn}"`;
}
