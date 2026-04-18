#!/usr/bin/env npx ts-node
/**
 * orchestrator/index.ts — The Nervous System Controller
 *
 * Reads SPEC.md, identifies incomplete genes, routes tasks to specialist agents,
 * and coordinates wave-based parallel execution via git worktrees.
 *
 * Usage:
 *   npx ts-node orchestrator/index.ts --gene "Dashboard"        # Evolve one gene
 *   npx ts-node orchestrator/index.ts --overnight                # Full autonomous run
 *   npx ts-node orchestrator/index.ts --polish                   # Polishing season
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { buildInvestigatorPrompt } from './prompts/investigator';
import { buildImplementerPrompt } from './prompts/implementer';
import { buildTesterPrompt } from './prompts/tester';
import { buildCriticPrompt as buildCriticRolePrompt } from './prompts/critic';
import { buildVerifierPrompt as buildVerifierRolePrompt } from './prompts/verifier';
// Pipeline module available for future use: import { buildGenePipeline, buildPolishPipeline } from './pipeline';

// ─── Types ───

export type AgentRole = 'investigator' | 'implementer' | 'tester' | 'critic' | 'verifier';

export interface AgentTask {
  id: string;
  role: AgentRole;
  gene: string;
  prompt: string;
  dependsOn: string[];
  branch: string;
  maxCostUSD: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  output: string;
  filesChanged: string[];
  qualityDelta: Record<string, number>;
  durationMs: number;
}

interface SpecGene {
  name: string;
  expressionPercent: number;
  completionTarget: number;
  uncheckedCriteria: string[];
}

// ─── Configuration ───

const CONFIG = {
  maxConcurrentAgents: 5,
  maxTurnsPerAgent: 20,
  costCaps: {
    investigator: 2.0,
    implementer: 5.0,
    tester: 3.0,
    critic: 2.0,
    verifier: 1.5,
  } as Record<AgentRole, number>,
  models: {
    investigator: 'claude-opus-4-6',
    implementer: 'claude-sonnet-4-6',
    tester: 'claude-sonnet-4-6',
    critic: 'claude-opus-4-6',
    verifier: 'claude-sonnet-4-6',
  } as Record<AgentRole, string>,
  worktreeDir: '.worktrees',
  messageDir: '.worktrees/messages',
};

// ─── SPEC Parser ───

function parseSpecGenes(): SpecGene[] {
  const spec = readFileSync('SPEC.md', 'utf-8');
  const genes: SpecGene[] = [];
  const geneRegex = /### Gene: (.+)\n[\s\S]*?Expression Status:\*\* (\d+)%[\s\S]*?Completion Target:\*\* (\d+)%/g;

  let match;
  while ((match = geneRegex.exec(spec)) !== null) {
    const geneName = match[1];
    const expression = parseInt(match[2], 10);
    const target = parseInt(match[3], 10);

    // Find unchecked criteria for this gene
    const geneSection = spec.slice(match.index, spec.indexOf('### Gene:', match.index + 1) === -1
      ? spec.length
      : spec.indexOf('### Gene:', match.index + 1));

    const unchecked = [...geneSection.matchAll(/- \[ \] (.+)/g)].map(m => m[1]);

    genes.push({
      name: geneName,
      expressionPercent: expression,
      completionTarget: target,
      uncheckedCriteria: unchecked,
    });
  }

  return genes;
}

function prioritizeGenes(genes: SpecGene[]): SpecGene[] {
  // Priority: largest gap between current expression and target, with most unchecked criteria
  return genes
    .filter(g => g.uncheckedCriteria.length > 0)
    .sort((a, b) => {
      const gapA = a.completionTarget - a.expressionPercent;
      const gapB = b.completionTarget - b.expressionPercent;
      if (gapB !== gapA) return gapB - gapA;
      return b.uncheckedCriteria.length - a.uncheckedCriteria.length;
    });
}

// ─── Worktree Management ───

function ensureWorktreeDir() {
  if (!existsSync(CONFIG.worktreeDir)) {
    mkdirSync(CONFIG.worktreeDir, { recursive: true });
  }
  if (!existsSync(CONFIG.messageDir)) {
    mkdirSync(CONFIG.messageDir, { recursive: true });
  }
}

function createWorktree(taskId: string, branch: string): string {
  const worktreePath = join(CONFIG.worktreeDir, taskId);
  try {
    execSync(`git worktree add "${worktreePath}" -b ${branch} 2>/dev/null || git worktree add "${worktreePath}" ${branch} 2>/dev/null || true`, {
      stdio: 'pipe',
    });
  } catch {
    console.warn(`Warning: Could not create worktree for ${taskId}, using main directory`);
  }
  return worktreePath;
}

function _cleanupWorktree(taskId: string) {
  const worktreePath = join(CONFIG.worktreeDir, taskId);
  try {
    execSync(`git worktree remove "${worktreePath}" --force 2>/dev/null || true`, { stdio: 'pipe' });
  } catch {
    // Cleanup is best effort
  }
}

// ─── Agent Execution ───

function extractGeneSection(spec: string, geneName: string): string {
  const geneStart = spec.indexOf(`### Gene: ${geneName}`);
  if (geneStart === -1) return '';
  const nextGene = spec.indexOf('### Gene:', geneStart + 1);
  return spec.slice(geneStart, nextGene === -1 ? spec.length : nextGene);
}

function buildAgentPrompt(task: AgentTask, context?: { filesChanged?: string[]; investigationFindings?: string; criticOutput?: string }): string {
  const spec = readFileSync('SPEC.md', 'utf-8');
  const geneSection = extractGeneSection(spec, task.gene);
  const unchecked = [...geneSection.matchAll(/- \[ \] (.+)/g)].map(m => m[1]);

  // Use the dedicated prompt templates for each role
  let rolePrompt: string;
  switch (task.role) {
    case 'investigator':
      rolePrompt = buildInvestigatorPrompt(task.gene, geneSection);
      break;
    case 'implementer':
      rolePrompt = buildImplementerPrompt(
        task.gene,
        unchecked,
        context?.investigationFindings || task.prompt
      );
      break;
    case 'tester':
      rolePrompt = buildTesterPrompt(task.gene, context?.filesChanged || []);
      break;
    case 'critic':
      rolePrompt = buildCriticRolePrompt(task.gene, context?.filesChanged || []);
      break;
    case 'verifier':
      rolePrompt = buildVerifierRolePrompt(task.gene, context?.criticOutput || '');
      break;
  }

  // Append shared context that all agents need
  const learnings = existsSync('LEARNINGS.md') ? readFileSync('LEARNINGS.md', 'utf-8') : '';
  const decisions = existsSync('DECISIONS.md') ? readFileSync('DECISIONS.md', 'utf-8') : '';

  return `${rolePrompt}

## Shared Context

### LEARNINGS.md (What Has Worked Before)
${learnings.slice(0, 3000)}

### DECISIONS.md (Architecture Constants)
${decisions.slice(0, 2000)}

## Your Specific Task
${task.prompt}

## Universal Rules
1. Read SPEC.md before writing any code.
2. Follow patterns in LEARNINGS.md.
3. Respect architecture laws in DECISIONS.md.
4. NEVER use hyphens in UI text. Use commas or periods.
5. NEVER add mock data to production code.
6. If you encounter ambiguity, write to QUESTIONS.md and stop.`;
}

async function executeAgentTask(task: AgentTask, context?: { filesChanged?: string[]; investigationFindings?: string; criticOutput?: string }): Promise<TaskResult> {
  const startTime = Date.now();
  const worktreePath = createWorktree(task.id, task.branch);
  const agentPrompt = buildAgentPrompt(task, context);

  return new Promise((resolve) => {
    const proc: ChildProcess = spawn('claude', [
      '--print',
      '--model', CONFIG.models[task.role],
      '--max-turns', String(CONFIG.maxTurnsPerAgent),
      agentPrompt,
    ], {
      cwd: worktreePath || '.',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let _errorOutput = '';

    proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { _errorOutput += d.toString(); });

    proc.on('close', (code: number | null) => {
      const durationMs = Date.now() - startTime;

      let filesChanged: string[] = [];
      try {
        filesChanged = execSync(
          `git -C "${worktreePath}" diff --name-only HEAD~1 HEAD 2>/dev/null || echo ""`,
          { encoding: 'utf-8' }
        ).split('\n').filter(Boolean);
      } catch {
        // No changes or git error
      }

      // Write agent message for inter-agent communication
      const message = {
        from: `${task.role}-${task.id}`,
        type: task.role === 'critic' ? 'defect-list' : 'completion',
        gene: task.gene,
        success: code === 0,
        filesChanged,
        durationMs,
        timestamp: new Date().toISOString(),
      };

      try {
        writeFileSync(
          join(CONFIG.messageDir, `${task.id}.json`),
          JSON.stringify(message, null, 2)
        );
      } catch {
        // Message writing is best effort
      }

      resolve({
        taskId: task.id,
        success: code === 0,
        output: output.slice(0, 5000),
        filesChanged,
        qualityDelta: {},
        durationMs,
      });
    });

    // Timeout: kill agent if it runs too long (15 minutes per task)
    setTimeout(() => {
      proc.kill('SIGTERM');
    }, 15 * 60 * 1000);
  });
}

// ─── Wave Execution ───

async function executeWave(tasks: AgentTask[], context?: { filesChanged?: string[]; investigationFindings?: string; criticOutput?: string }): Promise<TaskResult[]> {
  console.log(`\n  Executing wave: ${tasks.length} agents in parallel`);
  tasks.forEach(t => console.log(`    [${t.role}] ${t.gene}: ${t.prompt.slice(0, 80)}...`));

  const results = await Promise.allSettled(
    tasks.map(task => executeAgentTask(task, context))
  );

  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      const result = r.value;
      console.log(`    ✓ [${tasks[i].role}] ${tasks[i].gene}: ${result.success ? 'success' : 'failed'} (${(result.durationMs / 1000).toFixed(1)}s)`);
      return result;
    }
    console.log(`    ✗ [${tasks[i].role}] ${tasks[i].gene}: error`);
    return {
      taskId: tasks[i].id,
      success: false,
      output: (r.reason as Error)?.message ?? 'unknown error',
      filesChanged: [],
      qualityDelta: {},
      durationMs: 0,
    };
  });
}

// ─── Pipeline: Full Gene Implementation ───

async function implementGene(gene: SpecGene): Promise<void> {
  const timestamp = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ORGANISM: Implementing gene "${gene.name}"`);
  console.log(`  Expression: ${gene.expressionPercent}% -> Target: ${gene.completionTarget}%`);
  console.log(`  Unchecked criteria: ${gene.uncheckedCriteria.length}`);
  console.log(`${'='.repeat(60)}`);

  // Wave 1: Investigation (read only)
  const investigateResult = await executeWave([{
    id: `investigate-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
    role: 'investigator',
    gene: gene.name,
    prompt: `Investigate the current state of "${gene.name}". Map every file that implements this gene. List every gap between SPEC.md criteria and actual implementation. Output a structured gap analysis.`,
    dependsOn: [],
    branch: `organism/investigate-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
    maxCostUSD: CONFIG.costCaps.investigator,
  }]);

  if (!investigateResult[0]?.success) {
    console.log(`  Investigation failed for ${gene.name}. Skipping.`);
    return;
  }

  // Wave 2: Implementation + Testing (parallel)
  const investigationFindings = investigateResult[0].output.slice(0, 2000);
  const implResults = await executeWave([
    {
      id: `implement-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
      role: 'implementer',
      gene: gene.name,
      prompt: `Implement the following unchecked acceptance criteria for "${gene.name}":\n${gene.uncheckedCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nInvestigation findings:\n${investigationFindings}`,
      dependsOn: [investigateResult[0].taskId],
      branch: `organism/implement-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
      maxCostUSD: CONFIG.costCaps.implementer,
    },
    {
      id: `test-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
      role: 'tester',
      gene: gene.name,
      prompt: `Write comprehensive tests for "${gene.name}". Cover: unit tests for business logic, property tests for invariants defined in SPEC.md, edge cases (empty state, maximum items, concurrent operations).`,
      dependsOn: [],
      branch: `organism/test-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
      maxCostUSD: CONFIG.costCaps.tester,
    },
  ], { investigationFindings });

  // Wave 3: Adversarial Review
  const implFilesChanged = implResults[0]?.filesChanged || [];
  const criticResults = await executeWave([{
    id: `critic-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
    role: 'critic',
    gene: gene.name,
    prompt: `Review all changes for "${gene.name}". Files changed by implementer: ${implFilesChanged.join(', ') || 'unknown'}. Find: spec violations, architecture law violations, performance issues, accessibility gaps, missing error handling. Be ruthless.`,
    dependsOn: implResults.map(r => r.taskId),
    branch: `organism/critic-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
    maxCostUSD: CONFIG.costCaps.critic,
  }], { filesChanged: implFilesChanged });

  // Wave 4: Verification
  const criticOutput = criticResults[0]?.output.slice(0, 2000) || 'No critic output';
  await executeWave([{
    id: `verify-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
    role: 'verifier',
    gene: gene.name,
    prompt: `Verify all changes for "${gene.name}". Run quality gates (build, tests, type check). Update SPEC.md checkboxes for criteria that are now met. Append any learnings to LEARNINGS.md. Report merge readiness.\n\nCritic findings:\n${criticOutput}`,
    dependsOn: [criticResults[0]?.taskId || ''],
    branch: `organism/verify-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
    maxCostUSD: CONFIG.costCaps.verifier,
  }], { criticOutput, filesChanged: implFilesChanged });

  console.log(`\n  Gene "${gene.name}" implementation cycle complete.`);
}

// ─── Main Entry Points ───

async function overnightRun() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  ORGANISM: Overnight Autonomous Run       ║');
  console.log('║  Reading genome... Identifying gaps...     ║');
  console.log(`║  ${new Date().toISOString()}    ║`);
  console.log('╚══════════════════════════════════════════╝');

  ensureWorktreeDir();

  const genes = parseSpecGenes();
  const prioritized = prioritizeGenes(genes);

  console.log(`\n  Found ${genes.length} genes, ${prioritized.length} with incomplete criteria.`);
  console.log('  Top 3 priorities:');
  prioritized.slice(0, 3).forEach((g, i) => {
    console.log(`    ${i + 1}. ${g.name} (${g.expressionPercent}% -> ${g.completionTarget}%, ${g.uncheckedCriteria.length} unchecked)`);
  });

  // Implement top 3 genes per overnight run
  for (const gene of prioritized.slice(0, 3)) {
    try {
      await implementGene(gene);
    } catch (err) {
      console.error(`  Error implementing ${gene.name}:`, (err as Error).message);
    }
  }

  // Run spec sync after all implementations
  try {
    execSync('npx ts-node scripts/spec-sync.ts', { stdio: 'inherit' });
  } catch {
    console.warn('  Warning: spec-sync failed');
  }

  console.log('\n  Overnight run complete. Review PRs over coffee.');
}

async function singleGeneRun(geneName: string) {
  ensureWorktreeDir();

  const genes = parseSpecGenes();
  const target = genes.find(g => g.name.toLowerCase().includes(geneName.toLowerCase()));

  if (!target) {
    console.error(`Gene "${geneName}" not found in SPEC.md. Available genes:`);
    genes.forEach(g => console.log(`  - ${g.name}`));
    process.exit(1);
  }

  await implementGene(target);
}

async function polishRun() {
  console.log('\n=== POLISHING SEASON ACTIVE ===');
  console.log('New feature development SUSPENDED. Only quality improvements allowed.\n');

  ensureWorktreeDir();

  const genes = parseSpecGenes();
  // Polish the most expressed genes (they have the most surface area to polish)
  const polishTargets = genes
    .filter(g => g.expressionPercent > 30)
    .sort((a, b) => b.expressionPercent - a.expressionPercent)
    .slice(0, 5);

  for (const gene of polishTargets) {
    const timestamp = Date.now();
    await executeWave([{
      id: `polish-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
      role: 'implementer',
      gene: gene.name,
      prompt: `POLISHING MODE for "${gene.name}". Do NOT add features. Improve ONLY:
1. Performance: make this faster (profile and optimize hot paths)
2. Accessibility: ensure WCAG 2.1 AA compliance (axe core zero violations)
3. Error handling: every error state must be beautiful, not a raw stack trace
4. Micro interactions: 60fps animations, satisfying feedback on every action
5. Edge cases: test with empty state, single item, 1000 items

Your goal: make a superintendent on a job site say "wow, this feels premium."`,
      dependsOn: [],
      branch: `organism/polish-${gene.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}`,
      maxCostUSD: 5,
    }]);
  }
}

// ─── CLI ───

const args = process.argv.slice(2);

if (args.includes('--overnight')) {
  overnightRun().catch(console.error);
} else if (args.includes('--polish')) {
  polishRun().catch(console.error);
} else if (args.includes('--gene')) {
  const geneIndex = args.indexOf('--gene');
  const geneName = args[geneIndex + 1];
  if (!geneName) {
    console.error('Usage: --gene "Gene Name"');
    process.exit(1);
  }
  singleGeneRun(geneName).catch(console.error);
} else {
  console.log(`
SiteSync PM Organism — Nervous System Controller

Usage:
  npx ts-node orchestrator/index.ts --gene "Dashboard"   # Evolve one gene
  npx ts-node orchestrator/index.ts --overnight           # Full autonomous run
  npx ts-node orchestrator/index.ts --polish              # Polishing season
  `);
}

export { parseSpecGenes, prioritizeGenes, implementGene, overnightRun, polishRun };
