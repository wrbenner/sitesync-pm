/**
 * orchestrator/worktrees.ts — Git Worktree Isolation Manager
 *
 * Each agent gets its own git worktree so no two agents modify the same files.
 * Worktrees are created on demand and cleaned up after the agent completes.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const WORKTREE_BASE = '.worktrees';

export interface WorktreeInfo {
  path: string;
  branch: string;
  taskId: string;
  createdAt: Date;
}

/**
 * Create an isolated git worktree for an agent task.
 * Each worktree gets its own branch so changes don't collide.
 */
export function createWorktree(taskId: string, branch: string): WorktreeInfo {
  const worktreePath = join(WORKTREE_BASE, taskId);

  if (!existsSync(WORKTREE_BASE)) {
    mkdirSync(WORKTREE_BASE, { recursive: true });
  }

  // Clean up if a stale worktree exists at this path
  if (existsSync(worktreePath)) {
    try {
      execSync(`git worktree remove "${worktreePath}" --force 2>/dev/null`, { stdio: 'pipe' });
    } catch {
      // Force remove the directory if git worktree remove fails
      rmSync(worktreePath, { recursive: true, force: true });
    }
  }

  // Delete the branch if it exists (from a previous run)
  try {
    execSync(`git branch -D ${branch} 2>/dev/null`, { stdio: 'pipe' });
  } catch {
    // Branch doesn't exist, that's fine
  }

  // Create the worktree with a new branch from HEAD
  try {
    execSync(`git worktree add "${worktreePath}" -b ${branch}`, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Failed to create worktree for ${taskId}: ${(err as Error).message}`);
  }

  return {
    path: worktreePath,
    branch,
    taskId,
    createdAt: new Date(),
  };
}

/**
 * Remove a worktree after the agent completes.
 * If the agent made changes, they remain on the branch for review.
 */
export function removeWorktree(taskId: string): void {
  const worktreePath = join(WORKTREE_BASE, taskId);

  try {
    execSync(`git worktree remove "${worktreePath}" --force 2>/dev/null`, { stdio: 'pipe' });
  } catch {
    // Best effort cleanup
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true });
    }
  }

  // Prune any dangling worktree references
  try {
    execSync('git worktree prune 2>/dev/null', { stdio: 'pipe' });
  } catch {
    // Best effort
  }
}

/**
 * List all active worktrees.
 */
export function listWorktrees(): WorktreeInfo[] {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktrees: WorktreeInfo[] = [];
    const entries = output.split('\n\n').filter(Boolean);

    for (const entry of entries) {
      const lines = entry.split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      const branchLine = lines.find(l => l.startsWith('branch '));

      if (pathLine && branchLine && pathLine.includes(WORKTREE_BASE)) {
        const path = pathLine.replace('worktree ', '');
        const branch = branchLine.replace(/^branch refs\/heads\//, '');
        const taskId = path.split('/').pop() || '';

        worktrees.push({
          path,
          branch,
          taskId,
          createdAt: new Date(), // Approximate
        });
      }
    }

    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Clean up all organism worktrees (for reset/maintenance).
 */
export function cleanupAllWorktrees(): void {
  const worktrees = listWorktrees();
  for (const wt of worktrees) {
    removeWorktree(wt.taskId);
  }
  console.log(`Cleaned up ${worktrees.length} worktrees.`);
}

/**
 * Check if a worktree has uncommitted changes.
 */
export function hasUncommittedChanges(taskId: string): boolean {
  const worktreePath = join(WORKTREE_BASE, taskId);
  try {
    const status = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the diff of changes made by an agent in its worktree.
 */
export function getWorktreeDiff(taskId: string): string {
  const worktreePath = join(WORKTREE_BASE, taskId);
  try {
    return execSync(`git -C "${worktreePath}" diff HEAD~1 HEAD --stat 2>/dev/null || echo "No commits yet"`, {
      encoding: 'utf-8',
    });
  } catch {
    return 'Unable to read diff';
  }
}
