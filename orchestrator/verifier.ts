/**
 * orchestrator/verifier.ts — Spec Sync + LEARNINGS.md Updates
 *
 * The Verifier runs after all other agents complete.
 * It updates SPEC.md checkboxes, appends to LEARNINGS.md,
 * and makes the final merge readiness decision.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

export interface VerificationResult {
  gene: string;
  criteriaChecked: string[];
  criteriaStillUnchecked: string[];
  learningsAdded: string[];
  qualityGatesPassed: boolean;
  mergeReady: boolean;
  reason: string;
}

/**
 * Run all quality gates and return pass/fail status.
 */
export function runQualityGates(): { passed: boolean; output: string } {
  try {
    const output = execSync('bash scripts/immune-gate.sh 2>&1', {
      encoding: 'utf-8',
      timeout: 300000, // 5 minute timeout
    });
    return { passed: true, output };
  } catch (err) {
    return {
      passed: false,
      output: (err as { stdout?: string; stderr?: string }).stdout || (err as Error).message,
    };
  }
}

/**
 * Update SPEC.md to check off completed criteria.
 */
export function updateSpecCheckboxes(gene: string, completedCriteria: string[]): void {
  if (!existsSync('SPEC.md')) return;

  let spec = readFileSync('SPEC.md', 'utf-8');

  for (const criterion of completedCriteria) {
    // Escape special regex characters in the criterion text
    const escaped = criterion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const uncheckedPattern = new RegExp(`- \\[ \\] ${escaped}`);
    spec = spec.replace(uncheckedPattern, `- [x] ${criterion}`);
  }

  // Update genome metadata
  const now = new Date().toISOString().split('T')[0];
  spec = spec.replace(/<!-- LAST-EVOLVED: .* -->/, `<!-- LAST-EVOLVED: ${now} -->`);

  // Recalculate completion percentage
  const totalCriteria = (spec.match(/- \[[ x]\]/g) || []).length;
  const checkedCriteria = (spec.match(/- \[x\]/g) || []).length;
  const completionPct = totalCriteria > 0 ? Math.round((checkedCriteria / totalCriteria) * 100) : 0;
  spec = spec.replace(/<!-- COMPLETION: \d+% -->/, `<!-- COMPLETION: ${completionPct}% -->`);

  // Auto-increment genome version
  const versionMatch = spec.match(/<!-- GENOME-VERSION: (\d+) -->/);
  if (versionMatch) {
    const newVersion = parseInt(versionMatch[1], 10) + 1;
    spec = spec.replace(/<!-- GENOME-VERSION: \d+ -->/, `<!-- GENOME-VERSION: ${newVersion} -->`);
  }

  writeFileSync('SPEC.md', spec);
}

/**
 * Append learnings discovered during this cycle to LEARNINGS.md.
 */
export function appendLearnings(learnings: string[]): void {
  if (learnings.length === 0) return;

  const date = new Date().toISOString().split('T')[0];
  const entries = learnings.map(l =>
    `\n<!-- Added ${date} | Source: verifier agent -->\n- ${l}`
  ).join('\n');

  if (existsSync('LEARNINGS.md')) {
    // Insert after the "Architecture Patterns" section header
    let content = readFileSync('LEARNINGS.md', 'utf-8');
    const insertPoint = content.indexOf('## Anti-Patterns');
    if (insertPoint !== -1) {
      content = content.slice(0, insertPoint) + entries + '\n\n' + content.slice(insertPoint);
      writeFileSync('LEARNINGS.md', content);
    } else {
      appendFileSync('LEARNINGS.md', entries + '\n');
    }
  }
}

/**
 * Update the quality floor in .quality-floor.json if metrics improved.
 */
export function updateQualityFloor(metrics: Record<string, number>): void {
  if (!existsSync('.quality-floor.json')) return;

  const floor = JSON.parse(readFileSync('.quality-floor.json', 'utf-8'));
  let improved = false;

  // For these metrics, LOWER is better
  const lowerIsBetter = ['bundleSizeKB', 'tsErrors', 'anyCount', 'mockCount', 'a11yViolations', 'longestResponseMs'];

  // For these metrics, HIGHER is better
  const higherIsBetter = ['coveragePercent'];

  for (const key of lowerIsBetter) {
    if (metrics[key] !== undefined && metrics[key] < floor[key]) {
      console.log(`  Quality floor improved: ${key} ${floor[key]} -> ${metrics[key]}`);
      floor[key] = metrics[key];
      improved = true;
    }
  }

  for (const key of higherIsBetter) {
    if (metrics[key] !== undefined && metrics[key] > floor[key]) {
      console.log(`  Quality floor improved: ${key} ${floor[key]} -> ${metrics[key]}`);
      floor[key] = metrics[key];
      improved = true;
    }
  }

  if (improved) {
    floor.lastUpdated = new Date().toISOString();
    floor.updatedBy = 'verifier-agent';
    writeFileSync('.quality-floor.json', JSON.stringify(floor, null, 2) + '\n');
  }
}

// NOTE: The verifier prompt template is in orchestrator/prompts/verifier.ts
// This module provides the utility functions used by the verifier agent at runtime.
