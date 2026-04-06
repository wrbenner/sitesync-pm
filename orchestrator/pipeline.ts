/**
 * orchestrator/pipeline.ts — Wave-Based Parallel Execution Pipeline
 *
 * Tasks within a wave run in parallel. Waves execute in sequence.
 * Dependencies between tasks are resolved by wave ordering.
 */

import { AgentTask, TaskResult } from './index';

export interface Wave {
  name: string;
  tasks: AgentTask[];
  dependsOnWaves: string[];
}

export interface PipelineResult {
  waves: Array<{
    name: string;
    results: TaskResult[];
    durationMs: number;
  }>;
  totalDurationMs: number;
  totalTasks: number;
  successCount: number;
  failureCount: number;
}

/**
 * Build a standard 4-wave pipeline for a gene implementation.
 * Wave 1: Investigation (read only)
 * Wave 2: Implementation + Testing (parallel)
 * Wave 3: Adversarial Review
 * Wave 4: Verification
 */
export function buildGenePipeline(
  geneName: string,
  uncheckedCriteria: string[],
  timestamp: number = Date.now()
): Wave[] {
  const slug = geneName.toLowerCase().replace(/\s+/g, '-');

  return [
    {
      name: 'investigation',
      tasks: [{
        id: `investigate-${slug}-${timestamp}`,
        role: 'investigator',
        gene: geneName,
        prompt: `Investigate the current state of "${geneName}". Map every file. List every gap.`,
        dependsOn: [],
        branch: `organism/investigate-${slug}-${timestamp}`,
        maxCostUSD: 2.0,
      }],
      dependsOnWaves: [],
    },
    {
      name: 'build',
      tasks: [
        {
          id: `implement-${slug}-${timestamp}`,
          role: 'implementer',
          gene: geneName,
          prompt: `Implement unchecked criteria:\n${uncheckedCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
          dependsOn: [`investigate-${slug}-${timestamp}`],
          branch: `organism/implement-${slug}-${timestamp}`,
          maxCostUSD: 5.0,
        },
        {
          id: `test-${slug}-${timestamp}`,
          role: 'tester',
          gene: geneName,
          prompt: `Write comprehensive tests for "${geneName}". Unit tests, property tests, edge cases.`,
          dependsOn: [],
          branch: `organism/test-${slug}-${timestamp}`,
          maxCostUSD: 3.0,
        },
      ],
      dependsOnWaves: ['investigation'],
    },
    {
      name: 'review',
      tasks: [{
        id: `critic-${slug}-${timestamp}`,
        role: 'critic',
        gene: geneName,
        prompt: `Review all changes for "${geneName}". Find spec violations, architecture issues, bugs.`,
        dependsOn: [`implement-${slug}-${timestamp}`, `test-${slug}-${timestamp}`],
        branch: `organism/critic-${slug}-${timestamp}`,
        maxCostUSD: 2.0,
      }],
      dependsOnWaves: ['build'],
    },
    {
      name: 'verification',
      tasks: [{
        id: `verify-${slug}-${timestamp}`,
        role: 'verifier',
        gene: geneName,
        prompt: `Verify all changes for "${geneName}". Run quality gates. Update SPEC.md. Report merge readiness.`,
        dependsOn: [`critic-${slug}-${timestamp}`],
        branch: `organism/verify-${slug}-${timestamp}`,
        maxCostUSD: 1.5,
      }],
      dependsOnWaves: ['review'],
    },
  ];
}

/**
 * Build a polish pipeline (simpler: just implement + verify).
 */
export function buildPolishPipeline(
  geneName: string,
  timestamp: number = Date.now()
): Wave[] {
  const slug = geneName.toLowerCase().replace(/\s+/g, '-');

  return [
    {
      name: 'polish',
      tasks: [{
        id: `polish-${slug}-${timestamp}`,
        role: 'implementer',
        gene: geneName,
        prompt: `POLISHING MODE: Improve performance, accessibility, error handling, and micro-interactions for "${geneName}". Do NOT add features.`,
        dependsOn: [],
        branch: `organism/polish-${slug}-${timestamp}`,
        maxCostUSD: 5.0,
      }],
      dependsOnWaves: [],
    },
    {
      name: 'verify-polish',
      tasks: [{
        id: `verify-polish-${slug}-${timestamp}`,
        role: 'verifier',
        gene: geneName,
        prompt: `Verify polish changes for "${geneName}". Ensure no regressions. Update quality floor if metrics improved.`,
        dependsOn: [`polish-${slug}-${timestamp}`],
        branch: `organism/verify-polish-${slug}-${timestamp}`,
        maxCostUSD: 1.5,
      }],
      dependsOnWaves: ['polish'],
    },
  ];
}
