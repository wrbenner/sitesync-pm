// Per-PDF tester. Runs real PDFs through the auto-classification pipeline
// and prints what each stage saw vs. what it extracted.
//
// Stages exercised:
//   1. classifyPdfByFilename           — drawing / spec / cover routing
//   2. inferDisciplineFromFilename     — discipline tag from the name
//   3. pdftotext (poppler)             — extract first 4 pages of text
//   4. looksLikeCoverText              — should we even try to parse cover?
//   5. parseCoverMetadata              — project name / address / consultants / code / area
//
// Usage (Node 23+, with poppler `pdftotext` installed):
//
//   node --experimental-strip-types scripts/test-classifier-on-pdfs.ts \
//     "/path/to/01 Civil.pdf" "/path/to/05 Structure.pdf" ...
//
// Or pipe a list:
//   ls /path/to/Set/*.pdf | xargs -d '\n' node --experimental-strip-types scripts/test-classifier-on-pdfs.ts

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  classifyPdfByFilename,
  inferDisciplineFromFilename,
  extractRevisionFromFilename,
  extractRevisionFromText,
  extractScaleText,
  looksLikeCoverText,
  parseCoverMetadata,
} from '../src/lib/pdfClassifier.ts';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node --experimental-strip-types scripts/test-classifier-on-pdfs.ts <pdf> [pdf ...]');
  process.exit(2);
}

function extractText(pdfPath: string, firstPage: number, lastPage: number): string {
  try {
    const out = execFileSync(
      'pdftotext',
      ['-layout', '-f', String(firstPage), '-l', String(lastPage), pdfPath, '-'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    return out;
  } catch (err) {
    return `[pdftotext failed: ${(err as Error).message}]`;
  }
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

let pass = 0, partial = 0, fail = 0;

for (const rawPath of args) {
  const pdfPath = resolve(rawPath);
  if (!existsSync(pdfPath)) {
    console.log(`\n✗ MISSING  ${rawPath}\n`);
    fail++;
    continue;
  }
  const name = basename(pdfPath);
  const size = statSync(pdfPath).size;

  console.log(`\n${'═'.repeat(78)}`);
  console.log(`  ${name}  (${fmtBytes(size)})`);
  console.log('═'.repeat(78));

  // ── Stage 1+2: filename-only routing ─────────────────────────────────
  const route = classifyPdfByFilename(name, pdfPath);
  const discipline = inferDisciplineFromFilename(name);
  const filenameRev = extractRevisionFromFilename(name);
  console.log(`  filename route       : ${route}`);
  console.log(`  filename discipline  : ${discipline ?? '(none)'}`);
  console.log(`  filename revision    : ${filenameRev ?? '(none — upload defaults to 1)'}`);

  // ── Stage 3: pull first 4 pages of text ──────────────────────────────
  const text = extractText(pdfPath, 1, 4);
  const textLen = text.length;
  const firstFew = text.replace(/\s+/g, ' ').trim().slice(0, 140);
  console.log(`  text extracted       : ${textLen} chars`);
  console.log(`  text preview         : ${firstFew}${textLen > 140 ? '…' : ''}`);

  // ── Stage 4a: text-based revision + scale extraction ────────────────
  const textRev = extractRevisionFromText(text);
  const scale = extractScaleText(text);
  console.log(`  text revision        : ${textRev ?? '(none)'}`);
  console.log(`  text scale           : ${scale ? `"${scale.text}" → ratio=${scale.ratio ?? 'NTS'}` : '(none)'}`);

  // ── Stage 4: cover-likeness check ────────────────────────────────────
  const isCover = looksLikeCoverText(text);
  console.log(`  looksLikeCoverText   : ${isCover}`);

  // ── Stage 5: cover-metadata parse ────────────────────────────────────
  const meta = parseCoverMetadata(text);
  const got: Record<string, string | number | undefined> = {
    projectName: meta.projectName,
    address: meta.address,
    buildingAreaSqft: meta.buildingAreaSqft,
    numFloors: meta.numFloors,
    occupancy: meta.occupancyClassification,
    constructionType: meta.constructionType,
    codeEdition: meta.codeEdition,
  };
  console.log(`  parseCoverMetadata   : confidence=${meta.confidence.toFixed(2)}`);
  for (const [k, v] of Object.entries(got)) {
    if (v !== undefined && v !== null && v !== '') {
      console.log(`    ${k.padEnd(18)} : ${v}`);
    }
  }
  const consultantKeys = Object.keys(meta.consultants);
  if (consultantKeys.length) {
    console.log(`    consultants:`);
    for (const k of consultantKeys) {
      console.log(`      ${k.padEnd(22)} : ${meta.consultants[k]}`);
    }
  }

  // ── Verdict for this file ────────────────────────────────────────────
  const verdict: string[] = [];
  if (route === 'drawing' && discipline === null) verdict.push('discipline=null');
  if (textLen < 50) verdict.push('almost no text extracted (likely image-only PDF)');
  if (isCover && consultantKeys.length === 0 && !meta.address) verdict.push('looks like cover but extracted nothing');

  if (verdict.length === 0) {
    console.log(`  → OK`);
    pass++;
  } else {
    console.log(`  → ISSUES: ${verdict.join('; ')}`);
    if (route === 'drawing' && discipline === null) fail++; else partial++;
  }
}

console.log(`\n${'═'.repeat(78)}`);
console.log(`  Summary: ${pass} ok, ${partial} partial, ${fail} fail (of ${args.length})`);
console.log('═'.repeat(78));
process.exit(fail > 0 ? 1 : 0);
