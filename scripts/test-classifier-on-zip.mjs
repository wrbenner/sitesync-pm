#!/usr/bin/env node
// Run the auto-classifier (route + discipline) against every filename
// listed in a file (one path per line). Mirrors the regexes in
// src/lib/pdfClassifier.ts and src/pages/drawings/index.tsx so we can
// see exactly how a real upload set would route.
//
// Usage:
//   unzip -Z1 path/to/set.zip | grep '\.pdf$' | node scripts/test-classifier-on-zip.mjs
//   node scripts/test-classifier-on-zip.mjs /tmp/paths.txt

import fs from 'node:fs';
import path from 'node:path';

// ─── Mirrored from src/lib/pdfClassifier.ts ─────────────────────────────
function normalizeFilename(name) {
  return name.toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const SPEC_PATTERNS = [
  /\bspec book\b/, /\bspecifications?\b/, /\bspec(s)?\s+sheet\b/,
  /^specs?\b/, /\bspecs?\b.*\b(index|list|pages?)\b/,
  /^\d{6}\b/, // CSI MasterFormat 6-digit section numbers
];
const COVER_PATTERNS = [
  /\b(front|rear|back)\s*covers?\b/, /\bcover\s*sheet\b/, /\btitle\s*sheet\b/,
  /\bcovers?\b/, /\bproject\s*data\b/, /\bproject\s*info(?:rmation)?\b/,
  /\bcode\s*(summary|analysis|review)\b/, /\bgeneral\s*(info|information|notes)\b/,
  /\b[gt]\s*[-\s]?\s*0*0*1\b/, /\b[gt]\s*[-\s]?\s*0*0*0\b/,
];
function classifyPdfByFilename(name, fullPath) {
  if (fullPath && /\/specifications?\//i.test(fullPath)) return 'spec';
  const n = normalizeFilename(name);
  if (SPEC_PATTERNS.some(r => r.test(n))) return 'spec';
  if (COVER_PATTERNS.some(r => r.test(n))) return 'cover';
  return 'drawing';
}

// ─── Mirrored from src/pages/drawings/index.tsx ─────────────────────────
function inferDisciplineFromFilename(name) {
  const normalized = name.toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-/\\.]+/g, ' ')
    .replace(/\s+/g, ' ');
  const wordPatterns = [
    { re: /\b(covers?|title\s*sheet|cover\s*sheets?|project\s*data|code\s*(summary|analysis)|general\s*(notes|info))\b/, discipline: 'cover' },
    { re: /\b(hazmat|hazardous\s*materials?|asbestos|lead\s*paint|environmental|swppp|erosion\s*control)\b/, discipline: 'hazmat' },
    { re: /\b(demo(lition)?|existing\s*conditions)\b/, discipline: 'demolition' },
    { re: /\b(survey|topo(graphic)?|alta)\b/, discipline: 'survey' },
    { re: /\b(geotechnical|geotech|soils?\s*report)\b/, discipline: 'geotechnical' },
    { re: /\b(civil)\b/, discipline: 'civil' },
    { re: /\b(landscape)\b/, discipline: 'landscape' },
    { re: /\b(structural|structure|struct)\b/, discipline: 'structural' },
    { re: /\b(architectural|architecture|arch)\b/, discipline: 'architectural' },
    { re: /\b(interior(\s+design)?)\b/, discipline: 'interior' },
    { re: /\b(id)\b/, discipline: 'interior' },
    { re: /\b(fire\s*protection|fire\s*alarm|fp)\b/, discipline: 'fire_protection' },
    { re: /\b(plumbing|plumb)\b/, discipline: 'plumbing' },
    { re: /\b(mechanical|mech|hvac)\b/, discipline: 'mechanical' },
    { re: /\b(electrical|elec)\b/, discipline: 'electrical' },
    { re: /\b(telecommunications?|telecom|low\s*voltage|lv|technology|tele\b)\b/, discipline: 'telecommunications' },
    { re: /\b(food\s*service|kitchen\s*equipment|cafeteria)\b/, discipline: 'food_service' },
    { re: /\blaundry\b/, discipline: 'laundry' },
    { re: /\b(vertical\s*transportation|elevators?|escalators?|conveyance)\b/, discipline: 'vertical_transportation' },
  ];
  for (const { re, discipline } of wordPatterns) if (re.test(normalized)) return discipline;
  const prefixMap = { G:'cover', H:'hazmat', V:'survey', B:'geotechnical', C:'civil', L:'landscape', S:'structural', A:'architectural', I:'interior', Q:'interior', F:'fire_protection', P:'plumbing', M:'mechanical', E:'electrical', T:'telecommunications' };
  const m = name.match(/^([A-Z]{1,2})-?\d/i);
  if (m) {
    const prefix = m[1].toUpperCase();
    if (prefix === 'CS') return 'cover';
    if (prefix === 'ID') return 'interior';
    if (prefix === 'PF') return 'plumbing';
    if (prefix === 'FA') return 'fire_protection';
    if (prefix === 'LV') return 'telecommunications';
    return prefixMap[prefix[0]] ?? null;
  }
  return null;
}

// ─── Driver ────────────────────────────────────────────────────────────
const input = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : fs.readFileSync(0, 'utf8');
const lines = input.split('\n').map(s => s.trim()).filter(Boolean);

const results = lines.map(p => {
  const name = path.basename(p);
  const inSpecsFolder = /\/Specifications\//i.test(p);
  return {
    path: p, name, inSpecsFolder,
    route: classifyPdfByFilename(name, p),
    discipline: inferDisciplineFromFilename(name),
  };
});

// ─── Report ────────────────────────────────────────────────────────────
const drawings = results.filter(r => !r.inSpecsFolder);
const specs = results.filter(r => r.inSpecsFolder);

console.log(`\nTotal PDFs: ${results.length}  (drawings: ${drawings.length}, specs: ${specs.length})\n`);

console.log('─── Top-level (drawings) ──────────────────────────────────────');
for (const r of drawings) {
  const ok = r.route !== 'drawing' || r.discipline !== null;
  const status = ok ? 'OK ' : 'FAIL';
  console.log(`${status}  route=${r.route.padEnd(8)} discipline=${String(r.discipline).padEnd(20)} ${r.name}`);
}

const specMisroute = specs.filter(r => r.route !== 'spec');
const drawingsBad = drawings.filter(r => r.route === 'drawing' && r.discipline === null);

console.log(`\n─── Specifications/ folder (${specs.length} files) ──────────────`);
console.log(`  routed as 'spec':    ${specs.filter(r => r.route === 'spec').length}`);
console.log(`  routed as 'cover':   ${specs.filter(r => r.route === 'cover').length}`);
console.log(`  routed as 'drawing': ${specMisroute.length}  ← MISROUTED if >0`);
if (specMisroute.length > 0 && specMisroute.length <= 8) {
  console.log('  examples:');
  for (const r of specMisroute.slice(0, 8)) console.log(`    - ${r.name}`);
} else if (specMisroute.length > 8) {
  console.log(`  first 5: ${specMisroute.slice(0, 5).map(r => r.name).join(', ')}…`);
}

console.log(`\n─── Discipline coverage on drawings ───────────────────────────`);
console.log(`  classified: ${drawings.length - drawingsBad.length}/${drawings.length}`);
if (drawingsBad.length) {
  console.log('  unclassified (discipline === null):');
  for (const r of drawingsBad) console.log(`    - ${r.name}`);
}

console.log('');
process.exit(drawingsBad.length || specMisroute.length ? 1 : 0);
