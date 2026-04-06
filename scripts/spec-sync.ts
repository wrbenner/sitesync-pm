#!/usr/bin/env npx ts-node
/**
 * scripts/spec-sync.ts — Bidirectional Spec Sync
 *
 * Run after every successful build cycle.
 * Updates SPEC.md quality table to reflect actual current state.
 * The spec reads the codebase, the codebase reads the spec.
 *
 * Usage:
 *   npx ts-node scripts/spec-sync.ts
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

interface QualitySnapshot {
  coverage: number;
  tsErrors: number;
  bundleSizeKB: number;
  anyCount: number;
  mockCount: number;
  a11yViolations: number;
}

async function captureQualitySnapshot(): Promise<QualitySnapshot> {
  console.log('Capturing quality snapshot...\n');

  // TypeScript errors
  let tsErrors = 0;
  try {
    const tsOutput = execSync('npx tsc --noEmit 2>&1 || true', { encoding: 'utf-8' });
    tsErrors = (tsOutput.match(/error TS/g) || []).length;
  } catch {
    tsErrors = -1; // Could not check
  }
  console.log(`  TypeScript errors: ${tsErrors}`);

  // Test coverage
  let coverage = 0;
  try {
    execSync('npx vitest run --coverage --reporter=json 2>/dev/null', { encoding: 'utf-8' });
    if (existsSync('coverage/coverage-summary.json')) {
      const coverageData = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf-8'));
      coverage = coverageData.total?.lines?.pct ?? 0;
    }
  } catch {
    // Coverage collection failed, use 0
  }
  console.log(`  Test coverage: ${coverage}%`);

  // Bundle size
  let bundleSizeKB = 0;
  try {
    execSync('npx vite build 2>/dev/null', { stdio: 'pipe' });
    const sizeOutput = execSync('du -sk dist/assets/*.js 2>/dev/null || echo "0"', { encoding: 'utf-8' });
    bundleSizeKB = sizeOutput.split('\n')
      .reduce((sum, line) => sum + parseInt(line.split('\t')[0] || '0', 10), 0);
  } catch {
    bundleSizeKB = -1;
  }
  console.log(`  Bundle size: ${bundleSizeKB}KB`);

  // as any count
  let anyCount = 0;
  try {
    const anyOutput = execSync('grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | wc -l', { encoding: 'utf-8' });
    anyCount = parseInt(anyOutput.trim(), 10) || 0;
  } catch {
    anyCount = -1;
  }
  console.log(`  as any casts: ${anyCount}`);

  // Mock data count
  let mockCount = 0;
  try {
    const mockOutput = execSync('grep -rn "mock\\|fake\\|placeholder\\|Lorem\\|dummy" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v spec | grep -v mockData | grep -v "immune-ok" | wc -l', { encoding: 'utf-8' });
    mockCount = parseInt(mockOutput.trim(), 10) || 0;
  } catch {
    mockCount = -1;
  }
  console.log(`  Mock data references: ${mockCount}`);

  return {
    coverage,
    tsErrors,
    bundleSizeKB,
    anyCount,
    mockCount,
    a11yViolations: 0, // Updated by playwright a11y tests
  };
}

function trendArrow(current: number, floor: number, lowerIsBetter: boolean): string {
  if (lowerIsBetter) {
    if (current < floor) return '↑'; // Improving (going down)
    if (current > floor) return '↓'; // Regressing
    return '→';
  } else {
    if (current > floor) return '↑'; // Improving (going up)
    if (current < floor) return '↓'; // Regressing
    return '→';
  }
}

function updateSpecQualityTable(snapshot: QualitySnapshot): void {
  if (!existsSync('SPEC.md')) {
    console.error('SPEC.md not found');
    return;
  }

  let spec = readFileSync('SPEC.md', 'utf-8');

  // Read floors for trend calculation
  let floors = { coveragePercent: 43.2, bundleSizeKB: 287, tsErrors: 0, anyCount: 12, mockCount: 7, a11yViolations: 4 };
  if (existsSync('.quality-floor.json')) {
    try {
      floors = JSON.parse(readFileSync('.quality-floor.json', 'utf-8'));
    } catch { /* use defaults */ }
  }

  // Update quality table rows
  const replacements: Array<[RegExp, string]> = [
    [
      /\| Test coverage \| >70% \| [\d.]+% \| [→↑↓✓] \|/,
      `| Test coverage | >70% | ${snapshot.coverage.toFixed(1)}% | ${snapshot.coverage >= 70 ? '✓' : trendArrow(snapshot.coverage, floors.coveragePercent, false)} |`,
    ],
    [
      /\| Bundle size \(initial JS\) \| <300KB \| \d+KB \| [→↑↓✓] \|/,
      `| Bundle size (initial JS) | <300KB | ${snapshot.bundleSizeKB}KB | ${trendArrow(snapshot.bundleSizeKB, floors.bundleSizeKB, true)} |`,
    ],
    [
      /\| `as any` casts \| 0 \| \d+ \| [→↑↓✓] \|/,
      `| \`as any\` casts | 0 | ${snapshot.anyCount} | ${snapshot.anyCount === 0 ? '✓' : trendArrow(snapshot.anyCount, floors.anyCount, true)} |`,
    ],
    [
      /\| Mock data in production \| 0 \| \d+ \| [→↑↓✓] \|/,
      `| Mock data in production | 0 | ${snapshot.mockCount} | ${snapshot.mockCount === 0 ? '✓' : trendArrow(snapshot.mockCount, floors.mockCount, true)} |`,
    ],
    [
      /\| TypeScript errors \| 0 \| \d+ \| [→↑↓✓] \|/,
      `| TypeScript errors | 0 | ${snapshot.tsErrors} | ${snapshot.tsErrors === 0 ? '✓' : '↓'} |`,
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    spec = spec.replace(pattern, replacement);
  }

  // Update last evolved date
  const today = new Date().toISOString().split('T')[0];
  spec = spec.replace(/<!-- LAST-EVOLVED: .* -->/, `<!-- LAST-EVOLVED: ${today} -->`);

  writeFileSync('SPEC.md', spec);
  console.log('\nSPEC.md quality table updated.');
}

function updateQualityFloor(snapshot: QualitySnapshot): void {
  if (!existsSync('.quality-floor.json')) return;

  const floor = JSON.parse(readFileSync('.quality-floor.json', 'utf-8'));
  let improved = false;

  // Ratchet: only update if metrics improved
  if (snapshot.bundleSizeKB > 0 && snapshot.bundleSizeKB < floor.bundleSizeKB) {
    floor.bundleSizeKB = snapshot.bundleSizeKB;
    improved = true;
  }
  if (snapshot.coverage > floor.coveragePercent) {
    floor.coveragePercent = snapshot.coverage;
    improved = true;
  }
  if (snapshot.anyCount >= 0 && snapshot.anyCount < floor.anyCount) {
    floor.anyCount = snapshot.anyCount;
    improved = true;
  }
  if (snapshot.mockCount >= 0 && snapshot.mockCount < floor.mockCount) {
    floor.mockCount = snapshot.mockCount;
    improved = true;
  }
  if (snapshot.tsErrors >= 0 && snapshot.tsErrors < floor.tsErrors) {
    floor.tsErrors = snapshot.tsErrors;
    improved = true;
  }

  if (improved) {
    floor.lastUpdated = new Date().toISOString();
    floor.updatedBy = 'spec-sync.ts';
    writeFileSync('.quality-floor.json', JSON.stringify(floor, null, 2) + '\n');
    console.log('Quality floor updated (metrics improved).');
  }
}

// ─── Main ───

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  SPEC SYNC: Bidirectional Genome Sync ║');
  console.log('╚══════════════════════════════════════╝\n');

  const snapshot = await captureQualitySnapshot();
  updateSpecQualityTable(snapshot);
  updateQualityFloor(snapshot);

  console.log('\nSpec sync complete. The genome reflects the organism.');
}

main().catch(console.error);

export { captureQualitySnapshot, updateSpecQualityTable };
