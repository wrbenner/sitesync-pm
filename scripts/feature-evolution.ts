#!/usr/bin/env npx ts-node
/**
 * scripts/feature-evolution.ts — The Reproductive System
 *
 * Features are not designed once and shipped. They evolve through:
 * Stage 1: Spec Mutation — generate N candidate specs
 * Stage 2: Selection — score candidates against user needs + architecture fit
 * Stage 3: Implementation — build the selected spec
 * Stage 4: Field Test — measure against acceptance criteria
 * Stage 5: Natural Selection — features that meet the bar ship; others are killed
 *
 * Usage:
 *   npx ts-node scripts/feature-evolution.ts --feature "Offline Sync" --need "Field workers lose connectivity"
 *   npx ts-node scripts/feature-evolution.ts --polish   # Run polishing season
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

// ─── Types ───

interface FeatureCandidate {
  id: string;
  name: string;
  specDraft: string;
  userValueScore: number;    // 0 to 10: how much do supers actually need this?
  architectureFitScore: number; // 0 to 10: fits existing patterns, no new complexity
  implementationRiskScore: number; // 0 to 10 (lower = better)
  fitnessScore: number;
}

// ─── Configuration ───

const VIABILITY_THRESHOLD = 6.0;
const NUM_CANDIDATES = 4;

// ─── Claude Integration ───

async function askClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', '--model', 'claude-opus-4-5', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Claude exited with code ${code}`));
    });

    setTimeout(() => proc.kill('SIGTERM'), 180000);
  });
}

// ─── Spec Evolution ───

async function generateSpecCandidates(
  featureName: string,
  userNeed: string,
  numCandidates: number
): Promise<FeatureCandidate[]> {
  const spec = readFileSync('SPEC.md', 'utf-8');
  const decisions = existsSync('DECISIONS.md') ? readFileSync('DECISIONS.md', 'utf-8') : '';
  const learnings = existsSync('LEARNINGS.md') ? readFileSync('LEARNINGS.md', 'utf-8').slice(0, 2000) : '';

  const prompt = `You are evolving a feature spec for SiteSync PM (construction project management).

Feature: ${featureName}
User Need: ${userNeed}
Target User: Superintendent managing 2 to 5 active job sites simultaneously.

Generate ${numCandidates} DIFFERENT spec candidates for this feature. Each should:
1. Address the user need in a fundamentally different way
2. Include acceptance criteria (testable, specific)
3. Consider mobile/field use (construction sites, poor connectivity)
4. Fit within the existing architecture (see DECISIONS.md summary below)

Architecture context:
- React 19 + TypeScript + Vite, inline styles with theme tokens
- Supabase backend (PostgreSQL + Auth + Storage + Realtime)
- Capacitor for mobile (camera, GPS, push, offline)
- Claude API for AI features

Known patterns from LEARNINGS.md:
${learnings.slice(0, 1000)}

Output as JSON:
\`\`\`json
[
  {
    "id": "candidate-1",
    "name": "${featureName} (Approach A)",
    "specDraft": "Full spec with acceptance criteria...",
    "approach": "Brief description of the approach"
  },
  ...
]
\`\`\``;

  try {
    const response = await askClaude(prompt);
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return parsed.map((c: { id: string; name: string; specDraft: string }) => ({
        ...c,
        userValueScore: 0,
        architectureFitScore: 0,
        implementationRiskScore: 0,
        fitnessScore: 0,
      }));
    }
  } catch (err) {
    console.error(`  Failed to generate candidates: ${(err as Error).message}`);
  }

  return [];
}

async function scoreCandidate(candidate: FeatureCandidate): Promise<FeatureCandidate> {
  const prompt = `Score this feature spec for a construction PM platform (SiteSync PM).

Feature: ${candidate.name}
Spec: ${candidate.specDraft.slice(0, 1500)}

Score on three dimensions (0 to 10):
1. User Value: How much does a construction superintendent actually need this? (10 = critical daily need, 1 = nice to have)
2. Architecture Fit: How well does this fit React + Supabase + Capacitor without adding new complexity? (10 = perfect fit, 1 = requires new framework)
3. Implementation Risk: How likely is this to have hidden complexity? (10 = very risky, 1 = straightforward)

Output as JSON:
\`\`\`json
{ "userValue": N, "architectureFit": N, "implementationRisk": N, "reasoning": "..." }
\`\`\``;

  try {
    const response = await askClaude(prompt);
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const scores = JSON.parse(jsonMatch[1]);
      candidate.userValueScore = scores.userValue || 5;
      candidate.architectureFitScore = scores.architectureFit || 5;
      candidate.implementationRiskScore = scores.implementationRisk || 5;

      // Fitness = user value * architecture fit / implementation risk
      candidate.fitnessScore = (
        (candidate.userValueScore * 0.4) +
        (candidate.architectureFitScore * 0.4) +
        ((10 - candidate.implementationRiskScore) * 0.2)
      );
    }
  } catch {
    // Scoring failed, use defaults
    candidate.fitnessScore = 5;
  }

  return candidate;
}

// ─── Kill Log ───

function recordKilledFeature(
  featureName: string,
  bestCandidate: FeatureCandidate,
  allCandidates: FeatureCandidate[]
): void {
  const date = new Date().toISOString().split('T')[0];
  const killCount = existsSync('KILLED_FEATURES.md')
    ? (readFileSync('KILLED_FEATURES.md', 'utf-8').match(/### KF-/g) || []).length
    : 0;

  const entry = `
### KF-${String(killCount + 1).padStart(3, '0')}: ${featureName} (killed ${date})
**User Need:** ${featureName}
**Best Candidate Score:** ${bestCandidate.fitnessScore.toFixed(1)}/10
**Kill Reason:** User value: ${bestCandidate.userValueScore}/10, Architecture fit: ${bestCandidate.architectureFitScore}/10, Risk: ${bestCandidate.implementationRiskScore}/10. Below viability threshold of ${VIABILITY_THRESHOLD}.
**Candidates Evaluated:** ${allCandidates.length}
**Alternative:** To be determined based on user feedback.
**Lesson Recorded:** Feature did not pass natural selection. Revisit if user need strengthens or architecture changes.
`;

  if (existsSync('KILLED_FEATURES.md')) {
    appendFileSync('KILLED_FEATURES.md', entry);
  }
}

// ─── Spec Append ───

function appendGeneToSpec(champion: FeatureCandidate): void {
  if (!existsSync('SPEC.md')) return;

  const newGene = `
### Gene: ${champion.name}
- **Expression Status:** 0% expressed (not yet implemented)
- **Completion Target:** 80%
- **Evolution Score:** ${champion.fitnessScore.toFixed(1)}/10 (user value: ${champion.userValueScore}, arch fit: ${champion.architectureFitScore}, risk: ${champion.implementationRiskScore})
- **Acceptance Criteria:**
${champion.specDraft.split('\n').filter(l => l.trim().startsWith('-')).map(l => `  - [ ] ${l.trim().replace(/^-\s*/, '')}`).join('\n')}
`;

  let spec = readFileSync('SPEC.md', 'utf-8');
  const insertPoint = spec.indexOf('## Strand 4:');
  if (insertPoint !== -1) {
    spec = spec.slice(0, insertPoint) + newGene + '\n' + spec.slice(insertPoint);
    writeFileSync('SPEC.md', spec);
  }
}

// ─── Main Entry ───

async function evolveFeatureSpec(featureName: string, userNeed: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  REPRODUCTIVE SYSTEM: Evolving "${featureName}"`);
  console.log(`  User Need: ${userNeed}`);
  console.log(`${'='.repeat(60)}\n`);

  // Stage 1: Generate diverse candidates
  console.log('  Stage 1: Generating spec candidates...');
  const candidates = await generateSpecCandidates(featureName, userNeed, NUM_CANDIDATES);
  console.log(`  Generated ${candidates.length} candidates.`);

  if (candidates.length === 0) {
    console.error('  No candidates generated. Aborting.');
    return;
  }

  // Stage 2: Score each candidate
  console.log('  Stage 2: Scoring candidates...');
  const scored = await Promise.all(candidates.map(c => scoreCandidate(c)));
  scored.sort((a, b) => b.fitnessScore - a.fitnessScore);

  scored.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c.name}: fitness=${c.fitnessScore.toFixed(1)} (value=${c.userValueScore}, fit=${c.architectureFitScore}, risk=${c.implementationRiskScore})`);
  });

  // Stage 3: Natural selection
  const champion = scored[0];

  if (champion.fitnessScore < VIABILITY_THRESHOLD) {
    console.log(`\n  KILLED: "${featureName}" — best score ${champion.fitnessScore.toFixed(1)} < threshold ${VIABILITY_THRESHOLD}`);
    recordKilledFeature(featureName, champion, scored);
    return;
  }

  // Stage 4: Write champion to SPEC.md
  console.log(`\n  SELECTED: "${champion.name}" (fitness: ${champion.fitnessScore.toFixed(1)})`);
  appendGeneToSpec(champion);
  console.log('  Added to SPEC.md as new gene. Ready for implementation by the nervous system.');
}

// ─── Polishing Season ───

async function runPolishingSeason(): Promise<void> {
  console.log('\n=== POLISHING SEASON ACTIVE ===');
  console.log('New feature development SUSPENDED. Only quality improvements allowed.\n');

  // Read SPEC.md and find genes with highest expression (most surface area to polish)
  const spec = readFileSync('SPEC.md', 'utf-8');
  const geneRegex = /### Gene: (.+)\n[\s\S]*?Expression Status:\*\* (\d+)%/g;

  const genes: Array<{ name: string; expression: number }> = [];
  let match;
  while ((match = geneRegex.exec(spec)) !== null) {
    genes.push({ name: match[1], expression: parseInt(match[2], 10) });
  }

  const polishTargets = genes
    .filter(g => g.expression > 30)
    .sort((a, b) => b.expression - a.expression)
    .slice(0, 5);

  console.log('Polish targets (highest expression genes):');
  polishTargets.forEach((g, i) => {
    console.log(`  ${i + 1}. ${g.name} (${g.expression}% expressed)`);
  });

  console.log('\nRun: npx ts-node orchestrator/index.ts --polish');
}

// ─── CLI ───

const args = process.argv.slice(2);

if (args.includes('--polish')) {
  runPolishingSeason().catch(console.error);
} else if (args.includes('--feature') && args.includes('--need')) {
  const featureIdx = args.indexOf('--feature');
  const needIdx = args.indexOf('--need');
  const feature = args[featureIdx + 1];
  const need = args[needIdx + 1];

  if (feature && need) {
    evolveFeatureSpec(feature, need).catch(console.error);
  } else {
    console.error('Usage: --feature "Feature Name" --need "User need description"');
  }
} else {
  console.log(`
SiteSync PM Reproductive System — Feature Evolution

Usage:
  npx ts-node scripts/feature-evolution.ts --feature "Offline Sync" --need "Field workers lose connectivity"
  npx ts-node scripts/feature-evolution.ts --polish   # Run polishing season
  `);
}

export { evolveFeatureSpec, runPolishingSeason, VIABILITY_THRESHOLD };
