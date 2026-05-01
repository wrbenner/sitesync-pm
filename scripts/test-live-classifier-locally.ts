// Run the live classify-drawing logic locally on real PDF pages.
//
// Mirrors supabase/functions/classify-drawing/index.ts bit-for-bit:
//  • Same model: gemini-2.5-pro
//  • Same right-edge-strip crop (right 20% of the page)
//  • Same 3 focused prompts (sheet/title/discipline + revision + scale)
//  • Same parallel-fetch fan-out
//
// Output is plain text — sheet number, title, scale, revision per page —
// so you can eyeball it against what you know the values are.
//
// Usage:
//   GEMINI_API_KEY=... node --experimental-strip-types \
//     scripts/test-live-classifier-locally.ts <pdf> [--pages 1,3,5] [--first 3]
//
// Examples:
//   GEMINI_API_KEY=$KEY node --experimental-strip-types scripts/test-live-classifier-locally.ts \
//     "/tmp/procore-test/06 Mechanical.pdf" --pages 1,2,5
//
//   GEMINI_API_KEY=$KEY node --experimental-strip-types scripts/test-live-classifier-locally.ts \
//     "/tmp/procore-test/03 Architecture.pdf" --first 3

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

// ── Auto-load .env / .env.local so you don't have to prefix the API
// keys on the command line every run. Reads project-root files only;
// shell rc files are intentionally not touched.
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue; // existing env wins
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}
const projectRoot = new URL('..', import.meta.url).pathname;
loadEnvFile(join(projectRoot, '.env.local'));
loadEnvFile(join(projectRoot, '.env'));

// ── Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const pdfPath = args[0];
if (!pdfPath || !existsSync(pdfPath)) {
  console.error('Usage: node --experimental-strip-types scripts/test-live-classifier-locally.ts <pdf> [--pages N,N,...] [--first N]');
  process.exit(2);
}

let pages: number[] = [];
const pagesIdx = args.indexOf('--pages');
const firstIdx = args.indexOf('--first');
if (pagesIdx >= 0 && args[pagesIdx + 1]) {
  pages = args[pagesIdx + 1].split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite);
} else if (firstIdx >= 0 && args[firstIdx + 1]) {
  const n = parseInt(args[firstIdx + 1], 10);
  pages = Array.from({ length: n }, (_, i) => i + 1);
} else {
  pages = [1, 2, 3]; // default sample
}

// API keys — same env vars the edge function uses. Plural is preferred so
// the 4 parallel calls round-robin across 4 keys (matches production
// behavior; quota shared per-key, so 4 keys ≈ 4× headroom).
const keyList = (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
if (keyList.length === 0) {
  console.error('No Gemini key found.');
  console.error('');
  console.error('Add this line to .env.local in the project root, then re-run:');
  console.error('  GEMINI_API_KEYS=k1,k2,k3,k4');
  console.error('');
  console.error('Your keys are in the Supabase dashboard:');
  console.error('  Project → Settings → Edge Functions → Secrets → GEMINI_API_KEYS');
  console.error('(Supabase only shows them at create-time. If you can\'t see the values,');
  console.error('check 1Password or wherever you originally saved them.)');
  process.exit(2);
}
const MODEL = process.env.GEMINI_MODEL_NAME ?? 'gemini-2.5-pro';

// ── Prompts — copied verbatim from supabase/functions/classify-drawing ─
const PROMPT_TITLEBLOCK = `
You are reading the title block of a construction drawing. Extract ONLY what is visibly printed.

Return JSON:
{
  "sheet_number": "string | null — the sheet code in the SHEET NUMBER box (e.g. 'A1.0', 'P3B.3', 'ID-3.15'). If the page has no printed sheet number (poster cover), null.",
  "drawing_title": "string — the drawing title printed below the sheet number (e.g. 'SITE PLAN'). For poster covers, the rotated package name (e.g. 'INTERIORS') or main heading. Never a rendering caption.",
  "discipline": "One of: 'architectural','structural','mechanical','electrical','plumbing','fire_protection','civil','landscape','interior','mep','cover','unclassified'."
}

DISCIPLINE RULES (apply in order):
1. If sheet_number starts with CS, G, T0, or is null, discipline = 'cover'.
2. If page is an index/sheet-list/project-summary/general-notes page → 'cover'.
3. Poster-style covers (rendering + project name, no dimensioned drawing) → 'cover'.
4. Otherwise derive from sheet prefix: A→architectural, S→structural, M→mechanical, E→electrical, P→plumbing, PF→fire_protection, C→civil, L→landscape, I/ID→interior, MEP→mep, R→architectural.
5. No prefix rule matches → 'unclassified'.

RULES:
- sheet_number = text in the SHEET NUMBER box. NOT the project number (21115), NOT unit labels (B2, A1), NOT detail callouts (06/ID4.0).
- drawing_title = title-block text. Never a rendering caption.
- Return null if you can't read. Never guess.
`;

const PROMPT_REVISION = `
Find the REVISIONS table in the title block. It has rows with a number (often in triangle △) and a date.

Count the rows that have DATES. The count equals the revision.

Example: "△1 04/30/2024", "△2 07/29/2024", "△3 11/15/2024" → revision = "3".

If the table uses letters (REV A, REV B), return the highest letter.

Return JSON: { "revision": "string | null" }

Null ONLY if the REVISIONS table is completely empty or absent. Don't guess from filename. Don't return a date.
`;

const PROMPT_SCALE = `
Find the MAIN drawing scale on this construction sheet.

Scan for ANY of these patterns:
1. Under a viewport title: "BUILDING B - THIRD FLOOR PLAN / SCALE: 1/8" = 1'-0""
2. Under a detail callout: "01 DETAIL / SCALE: 3" = 1'-0""
3. "SCALE: NONE" / "NOT TO SCALE" / "N.T.S." → return 'NTS'
4. On site plans: "1 inch = 50 ft." or "1" = 40'-0""
5. On vicinity maps: "NTS" label directly under the map

Return JSON:
{
  "scale_text": "string | null — EXACT scale text as printed. For 'NOT TO SCALE' / 'SCALE: NONE' / 'NTS' / 'NONE' return 'NTS'. Otherwise return the literal text. Null only if no scale of any kind is printed.",
  "scale_ratio": "number | null — the numeric ratio. Architectural: 1/16\"=1'-0\" → 192, 3/32\"=1'-0\" → 128, 1/8\"=1'-0\" → 96, 3/16\"=1'-0\" → 64, 1/4\"=1'-0\" → 48, 3/8\"=1'-0\" → 32, 1/2\"=1'-0\" → 24, 3/4\"=1'-0\" → 16, 1\"=1'-0\" → 12, 1-1/2\"=1'-0\" → 8, 3\"=1'-0\" → 4. Engineering: 1\"=10' → 120, 1\"=20' → 240, 1\"=30' → 360, 1\"=40' → 480, 1\"=50' → 600, 1\"=60' → 720, 1\"=100' → 1200. For NTS → null."
}

DO NOT guess from drawing type. If no scale text appears, null.
`;

// ── Helpers ─────────────────────────────────────────────────────────────
function stripCodeFence(text: string): string {
  const t = text.trim();
  if (t.startsWith('```')) {
    const parts = t.split('```');
    if (parts.length >= 3) return parts[1].replace(/^json\s*/i, '').trim();
    return parts[parts.length - 1].trim();
  }
  return t;
}
function extractJson(text: string): Record<string, unknown> {
  const stripped = stripCodeFence(text);
  try { return JSON.parse(stripped); } catch {}
  const m = stripped.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Gemini did not return JSON');
  return JSON.parse(m[0]);
}

async function callGemini(
  apiKey: string,
  prompt: string,
  imageBase64: string,
): Promise<Record<string, unknown>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini returned empty response');
  return extractJson(text);
}

function renderPdfPage(pdfPath: string, pageNum: number, outDir: string): { fullPath: string; stripPath: string } {
  // 200 DPI matches the upload pipeline's render setting closely enough.
  const stem = join(outDir, `p${pageNum}`);
  execFileSync('pdftoppm', [
    '-r', '200',
    '-f', String(pageNum),
    '-l', String(pageNum),
    '-png',
    pdfPath,
    stem,
  ]);
  // pdftoppm pads the page number with leading zeros based on total page count.
  // Find the actual file (one match expected).
  const files = execFileSync('sh', ['-c', `ls "${stem}"-*.png 2>/dev/null || true`], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
  if (files.length === 0) throw new Error(`pdftoppm produced no output for page ${pageNum}`);
  const fullPath = files[0];
  // Crop right 20% — same region as rightEdgeStripRegion() in the live code.
  const stripPath = join(outDir, `p${pageNum}-strip.png`);
  execFileSync('magick', [fullPath, '-crop', '20%x100%+80%+0', '+repage', stripPath]);
  return { fullPath, stripPath };
}

function readBase64(path: string): string {
  return readFileSync(path).toString('base64');
}

function pickKey(i: number): string {
  return keyList[i % keyList.length];
}

// ── Main ────────────────────────────────────────────────────────────────
const tmpDir = mkdtempSync(join(tmpdir(), 'classify-test-'));

console.log(`\n${'═'.repeat(72)}`);
console.log(`  ${basename(pdfPath)}`);
console.log(`  pages: ${pages.join(', ')}    model: ${MODEL}`);
console.log(`  Gemini keys loaded: ${keyList.length} (round-robin across calls — 4 = ideal)`);
if (keyList.length < 4) {
  console.log(`  ⚠ tip: 4 keys lets all 3 calls per page run on different quotas.`);
}
console.log('═'.repeat(72));

let runIdx = 0;

for (const pageNum of pages) {
  process.stdout.write(`\n  → Page ${pageNum}... `);
  let stripB64: string, fullB64: string;
  try {
    const { fullPath, stripPath } = renderPdfPage(pdfPath, pageNum, tmpDir);
    fullB64 = readBase64(fullPath);
    stripB64 = readBase64(stripPath);
  } catch (err) {
    console.log(`render failed: ${(err as Error).message}`);
    continue;
  }
  process.stdout.write('rendered, calling Gemini... ');

  const t0 = Date.now();
  const [titleblock, revision, scale] = await Promise.allSettled([
    callGemini(pickKey(runIdx++), PROMPT_TITLEBLOCK, stripB64),
    callGemini(pickKey(runIdx++), PROMPT_REVISION, stripB64),
    callGemini(pickKey(runIdx++), PROMPT_SCALE, fullB64),
  ]);
  const ms = Date.now() - t0;

  console.log(`${ms}ms`);
  console.log('  ' + '─'.repeat(60));

  const get = <T>(r: PromiseSettledResult<Record<string, unknown>>, key: string): T | string =>
    r.status === 'fulfilled' ? (r.value[key] as T) ?? '(null)' : `(error: ${r.reason?.message ?? r.reason})`;

  const fmt = (v: unknown) => v === null || v === undefined || v === '' ? '(null)' : String(v);

  console.log(`  Sheet number : ${fmt(get(titleblock, 'sheet_number'))}`);
  console.log(`  Title        : ${fmt(get(titleblock, 'drawing_title'))}`);
  console.log(`  Discipline   : ${fmt(get(titleblock, 'discipline'))}`);
  console.log(`  Scale        : ${fmt(get(scale, 'scale_text'))}` +
    (typeof get(scale, 'scale_ratio') === 'number' ? `   (ratio: ${get(scale, 'scale_ratio')})` : ''));
  console.log(`  Revision     : ${fmt(get(revision, 'revision'))}`);
}

console.log(`\n${'═'.repeat(72)}`);
console.log(`  Done. Compare each row against what you know the values are.`);
console.log(`  Temp images: ${tmpDir}  (delete with: rm -rf "${tmpDir}")`);
console.log('═'.repeat(72));

// Best-effort cleanup — comment this out if you want to inspect the rendered PNGs.
try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
