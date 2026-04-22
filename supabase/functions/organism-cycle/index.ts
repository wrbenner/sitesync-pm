// =============================================================================
// Organism Cycle — The Brain
// =============================================================================
//
// Single Supabase Edge Function that runs the organism's entire
// Perceive → Reason → Build → Verify → Learn cycle.
//
// Uses aiRouter.ts for multi-model AI calls, Supabase for state,
// and the GitHub REST API for repo operations.
// =============================================================================


import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { routeAI, type AIResponse } from '../shared/aiRouter.ts'

// ── Types ───────────────────────────────────────────────────────────────────

interface CycleContext {
  supabase: SupabaseClient
  githubToken: string
  owner: string
  repo: string
  cycleId: string
  tokensIn: number
  tokensOut: number
  modelsUsed: Set<string>
}

interface Experiment {
  title: string
  target_file: string
  target_metric: string
  instruction: string
  expected_improvement: string
  risk_level: 'low' | 'medium' | 'high'
  score?: number
}

interface PerceptionData {
  ci_status: string
  open_prs: number
  recent_commits: string[]
  quality_floor: Record<string, unknown> | null
  schema_gaps: string
  learnings_tail: string
  recent_experiments: Record<string, unknown>[]
  skills: Record<string, unknown>[]
  supabase_stats: Record<string, unknown>
  timestamp: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com'
const OWNER = 'sitesync-pm'
const REPO = 'sitesync-pm'

const CONSTITUTION_PROTECTED_PATHS = [
  'GOVERNANCE.md',
  'CODEOWNERS',
  '.github/CODEOWNERS',
  '.github/workflows/homeostasis.yml',
  '.github/workflows/organism-verify.yml',
  '.agent/CONSTITUTION.md',
]

const CONSTITUTION_PROTECTED_PATTERNS = [
  /\.github\/workflows\/organism-.*\.yml$/,
  /billing/i,
  /payment/i,
  /invoice/i,
  /financial/i,
  /stripe/i,
]

// ── GitHub API Helpers ──────────────────────────────────────────────────────

async function ghGet(ctx: CycleContext, path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `token ${ctx.githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'organism-cycle',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub GET ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function ghPost(ctx: CycleContext, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `token ${ctx.githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'organism-cycle',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function ghPut(ctx: CycleContext, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${ctx.githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'organism-cycle',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function ghGetFileContent(ctx: CycleContext, path: string, ref = 'main'): Promise<{ content: string; sha: string } | null> {
  try {
    const data = await ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/contents/${path}?ref=${ref}`) as {
      content: string
      sha: string
      encoding: string
    }
    const decoded = atob(data.content.replace(/\n/g, ''))
    return { content: decoded, sha: data.sha }
  } catch {
    return null
  }
}

// ── AI Call Wrapper (tracks tokens) ─────────────────────────────────────────

async function ai(ctx: CycleContext, task: 'reasoning' | 'classification', system: string, userMsg: string, maxTokens = 4096): Promise<AIResponse> {
  console.log(`[organism] AI call: task=${task}, max_tokens=${maxTokens}`)
  const response = await routeAI({
    task,
    system,
    messages: [{ role: 'user', content: userMsg }],
    max_tokens: maxTokens,
    temperature: 0.3,
  })
  ctx.tokensIn += response.usage.input_tokens
  ctx.tokensOut += response.usage.output_tokens
  ctx.modelsUsed.add(`${response.provider}/${response.model}`)
  console.log(`[organism] AI response: provider=${response.provider}, model=${response.model}, tokens_in=${response.usage.input_tokens}, tokens_out=${response.usage.output_tokens}, latency=${response.latency_ms}ms`)
  return response
}

// ── Phase 1: PERCEIVE ───────────────────────────────────────────────────────

async function perceive(ctx: CycleContext): Promise<PerceptionData> {
  console.log('[organism] === PHASE: PERCEIVE ===')

  // Update cycle phase
  await ctx.supabase.from('organism_cycles').update({ phase: 'perceive' }).eq('id', ctx.cycleId)

  // Parallel GitHub API calls
  const [
    ciRuns,
    openPrs,
    recentCommits,
    qualityFloor,
    schemaGaps,
    learnings,
  ] = await Promise.all([
    ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/actions/runs?per_page=5`).catch(() => ({ workflow_runs: [] })),
    ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/pulls?state=open&per_page=20`).catch(() => []),
    ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/commits?per_page=10`).catch(() => []),
    ghGetFileContent(ctx, '.quality-floor.json'),
    ghGetFileContent(ctx, 'SCHEMA_GAP_ANALYSIS.md'),
    ghGetFileContent(ctx, 'LEARNINGS.md'),
  ])

  // CI status summary
  const runs = (ciRuns as { workflow_runs: Array<{ name: string; conclusion: string; status: string }> }).workflow_runs ?? []
  const ciStatus = runs.map((r) => `${r.name}: ${r.conclusion ?? r.status}`).join(', ') || 'no recent runs'

  // Open PR count
  const prList = Array.isArray(openPrs) ? openPrs : []
  const openPrCount = prList.length

  // Recent commit messages
  const commits = Array.isArray(recentCommits) ? recentCommits : []
  const commitMessages = commits.slice(0, 10).map((c: { commit: { message: string } }) =>
    c.commit.message.split('\n')[0]
  )

  // Quality floor
  let qualityFloorData: Record<string, unknown> | null = null
  if (qualityFloor) {
    try {
      qualityFloorData = JSON.parse(qualityFloor.content)
    } catch { /* skip */ }
  }

  // Schema gaps — extract summary section (first 100 lines)
  const schemaGapSummary = schemaGaps?.content?.split('\n').slice(0, 100).join('\n') ?? 'no schema gap analysis found'

  // Learnings — last 50 lines
  const learningsTail = learnings?.content?.split('\n').slice(-50).join('\n') ?? 'no learnings file found'

  // Query Supabase for recent experiments and skills
  const { data: recentExperiments } = await ctx.supabase
    .from('organism_experiments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: skills } = await ctx.supabase
    .from('organism_skills')
    .select('*')
    .order('success_count', { ascending: false })

  // Supabase stats — table count via pg_stat
  const { count: tableCount } = await ctx.supabase
    .from('organism_cycles')
    .select('*', { count: 'exact', head: true })

  const perception: PerceptionData = {
    ci_status: ciStatus,
    open_prs: openPrCount,
    recent_commits: commitMessages,
    quality_floor: qualityFloorData,
    schema_gaps: schemaGapSummary,
    learnings_tail: learningsTail,
    recent_experiments: recentExperiments ?? [],
    skills: skills ?? [],
    supabase_stats: { organism_cycle_count: tableCount ?? 0 },
    timestamp: new Date().toISOString(),
  }

  // Store perception data
  await ctx.supabase.from('organism_cycles').update({ perception_data: perception }).eq('id', ctx.cycleId)

  console.log(`[organism] Perception complete: CI=${ciStatus}, open_prs=${openPrCount}, commits=${commitMessages.length}, experiments_history=${recentExperiments?.length ?? 0}, skills=${skills?.length ?? 0}`)
  return perception
}

// ── Phase 2: REASON ─────────────────────────────────────────────────────────

async function reason(ctx: CycleContext, perception: PerceptionData): Promise<Experiment | null> {
  console.log('[organism] === PHASE: REASON ===')
  await ctx.supabase.from('organism_cycles').update({ phase: 'reason' }).eq('id', ctx.cycleId)

  const constitutionText = `You are the reasoning engine for an autonomous software organism. You MUST obey these constitutional constraints:
- NEVER propose changes to: GOVERNANCE.md, CODEOWNERS, branch protections, organism-verify.yml, homeostasis.yml, CONSTITUTION.md, or any organism-*.yml workflow
- NEVER propose changes to: billing, payment, invoicing, Stripe, or financial code
- NEVER propose deleting tests
- Each experiment must target specific files declared upfront
- Maximum risk level for any experiment: medium (no high-risk experiments without prior success)
- Focus on construction software domain improvements`

  const recentExperimentSummary = perception.recent_experiments
    .slice(0, 10)
    .map((e: Record<string, unknown>) => `- ${e.title}: ${e.status}${e.failure_reason ? ` (failed: ${e.failure_reason})` : ''}`)
    .join('\n') || 'No prior experiments'

  const skillsSummary = perception.skills
    .map((s: Record<string, unknown>) => `- ${s.name}: success=${s.success_count}, fail=${s.failure_count}`)
    .join('\n') || 'No skills yet'

  const userPrompt = `Current state of the codebase:

CI Status: ${perception.ci_status}
Open PRs: ${perception.open_prs}
Recent commits:
${perception.recent_commits.map((c) => `  - ${c}`).join('\n')}

Quality floor: ${JSON.stringify(perception.quality_floor, null, 2) ?? 'not found'}

Schema gap analysis (summary):
${perception.schema_gaps}

Recent learnings:
${perception.learnings_tail}

Recent experiment history:
${recentExperimentSummary}

Available skills:
${skillsSummary}

Propose exactly 3 experiments as a JSON array. Each experiment should:
1. Target a specific file that needs improvement
2. Have a clear, measurable expected outcome
3. Be achievable in a single file change
4. Not repeat recently failed experiments
5. Prioritize: bug fixes > schema gaps > test coverage > code quality

Return ONLY valid JSON in this format:
[
  {
    "title": "descriptive title",
    "target_file": "path/to/file.ts",
    "target_metric": "what metric improves",
    "instruction": "detailed instruction for the builder",
    "expected_improvement": "what specifically gets better",
    "risk_level": "low|medium"
  }
]`

  // Claude generates experiments
  const reasoningResponse = await ai(ctx, 'reasoning', constitutionText, userPrompt, 4096)

  // Parse experiments from response
  let experiments: Experiment[] = []
  try {
    const jsonMatch = reasoningResponse.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      experiments = JSON.parse(jsonMatch[0])
    }
  } catch (err) {
    console.error('[organism] Failed to parse experiments JSON:', err)
    throw new Error(`Reason phase: could not parse experiments from AI response`)
  }

  if (experiments.length === 0) {
    console.log('[organism] No experiments proposed')
    return null
  }

  console.log(`[organism] Proposed ${experiments.length} experiments`)

  // Cross-validate with OpenAI (classification task)
  const validationPrompt = `You are a senior code reviewer. Evaluate these proposed experiments for a construction project management application. Score each 1-10 on: feasibility, impact, and safety.

Experiments: ${JSON.stringify(experiments, null, 2)}

Return JSON: [{ "title": "...", "score": N, "concerns": "..." }]`

  const validationResponse = await ai(ctx, 'classification', 'Score experiments objectively.', validationPrompt, 2048)

  // Parse validation scores
  let scores: Array<{ title: string; score: number; concerns: string }> = []
  try {
    const jsonMatch = validationResponse.content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      scores = JSON.parse(jsonMatch[0])
    }
  } catch {
    console.warn('[organism] Could not parse validation scores, using unscored experiments')
  }

  // Merge scores into experiments
  for (const exp of experiments) {
    const scoreEntry = scores.find((s) => s.title === exp.title)
    exp.score = scoreEntry?.score ?? 5
  }

  // Sort by score descending
  experiments.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  // Store all experiments in DB
  for (const exp of experiments) {
    await ctx.supabase.from('organism_experiments').insert({
      cycle_id: ctx.cycleId,
      title: exp.title,
      target_file: exp.target_file,
      target_metric: exp.target_metric,
      instruction: exp.instruction,
      expected_improvement: exp.expected_improvement,
      risk_level: exp.risk_level,
      status: 'proposed',
    })
  }

  // Store experiments in cycle
  await ctx.supabase.from('organism_cycles').update({ experiments }).eq('id', ctx.cycleId)

  // Pick the highest-scored experiment
  const chosen = experiments[0]
  console.log(`[organism] Chosen experiment: "${chosen.title}" (score: ${chosen.score}, risk: ${chosen.risk_level}, file: ${chosen.target_file})`)

  return chosen
}

// ── Constitutional Compliance Check ─────────────────────────────────────────

function checkConstitutionalCompliance(experiment: Experiment): string | null {
  const targetFile = experiment.target_file

  // Check protected paths
  for (const protectedPath of CONSTITUTION_PROTECTED_PATHS) {
    if (targetFile === protectedPath || targetFile.endsWith(`/${protectedPath}`)) {
      return `Constitutional violation: cannot modify protected file "${protectedPath}"`
    }
  }

  // Check protected patterns
  for (const pattern of CONSTITUTION_PROTECTED_PATTERNS) {
    if (pattern.test(targetFile)) {
      return `Constitutional violation: file "${targetFile}" matches protected pattern ${pattern}`
    }
  }

  // Check risk level
  if (experiment.risk_level === 'high') {
    return `Constitutional violation: high-risk experiments not allowed`
  }

  return null
}

// ── Phase 3: BUILD ──────────────────────────────────────────────────────────

async function build(ctx: CycleContext, experiment: Experiment): Promise<{ prNumber: number; prUrl: string } | null> {
  console.log('[organism] === PHASE: BUILD ===')
  await ctx.supabase.from('organism_cycles').update({ phase: 'build' }).eq('id', ctx.cycleId)

  // Constitutional compliance check
  const violation = checkConstitutionalCompliance(experiment)
  if (violation) {
    console.error(`[organism] ${violation}`)
    await ctx.supabase.from('organism_experiments')
      .update({ status: 'skipped', failure_reason: violation })
      .eq('cycle_id', ctx.cycleId)
      .eq('title', experiment.title)
    throw new Error(violation)
  }

  // Mark experiment as executing
  await ctx.supabase.from('organism_experiments')
    .update({ status: 'executing' })
    .eq('cycle_id', ctx.cycleId)
    .eq('title', experiment.title)

  // Read the target file from GitHub
  const targetFile = await ghGetFileContent(ctx, experiment.target_file)
  const currentContent = targetFile?.content ?? ''
  const fileSha = targetFile?.sha ?? null

  console.log(`[organism] Target file: ${experiment.target_file} (${currentContent.length} chars, sha: ${fileSha ?? 'new file'})`)

  // Read context files if the instruction references them
  let contextContent = ''
  const contextFileMatches = experiment.instruction.match(/(?:see|from|in|like)\s+(\S+\.\w+)/gi)
  if (contextFileMatches) {
    for (const match of contextFileMatches.slice(0, 3)) {
      const filePath = match.replace(/^(?:see|from|in|like)\s+/i, '')
      const contextFile = await ghGetFileContent(ctx, filePath)
      if (contextFile) {
        contextContent += `\n--- ${filePath} ---\n${contextFile.content.slice(0, 2000)}\n`
      }
    }
  }

  // Generate new file content via Claude
  const buildSystem = `You are a senior construction software engineer. Execute this experiment precisely. Return ONLY the complete new file content, no explanations, no markdown code fences, no surrounding text. Just the raw file content.`

  const buildPrompt = `Experiment: ${experiment.title}
Instruction: ${experiment.instruction}
Expected improvement: ${experiment.expected_improvement}
Target file: ${experiment.target_file}

Current file content:
\`\`\`
${currentContent || '(new file — create from scratch)'}
\`\`\`
${contextContent ? `\nContext files:\n${contextContent}` : ''}

Return ONLY the complete updated file content. No explanations.`

  const buildResponse = await ai(ctx, 'reasoning', buildSystem, buildPrompt, 8192)

  // Clean the response — strip any markdown code fences if the model added them
  let newContent = buildResponse.content.trim()
  if (newContent.startsWith('```')) {
    const lines = newContent.split('\n')
    lines.shift() // remove opening fence
    if (lines[lines.length - 1]?.trim() === '```') {
      lines.pop() // remove closing fence
    }
    newContent = lines.join('\n')
  }

  if (!newContent || newContent.length < 10) {
    throw new Error('Build phase: AI returned empty or too-short content')
  }

  console.log(`[organism] Generated content: ${newContent.length} chars`)

  // Create a branch
  const branchName = `organism/exp-${Date.now()}`

  // Get main branch SHA
  const mainRef = await ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/git/ref/heads/main`) as {
    object: { sha: string }
  }
  const mainSha = mainRef.object.sha

  // Create the branch
  await ghPost(ctx, `/repos/${ctx.owner}/${ctx.repo}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha: mainSha,
  })
  console.log(`[organism] Created branch: ${branchName}`)

  // Create or update the file on the new branch
  const encodedContent = btoa(unescape(encodeURIComponent(newContent)))

  const commitBody: Record<string, unknown> = {
    message: `organism: ${experiment.title}\n\n${experiment.instruction}\n\nExpected improvement: ${experiment.expected_improvement}\nRisk level: ${experiment.risk_level}`,
    content: encodedContent,
    branch: branchName,
  }
  if (fileSha) {
    commitBody.sha = fileSha
  }

  await ghPut(ctx, `/repos/${ctx.owner}/${ctx.repo}/contents/${experiment.target_file}`, commitBody)
  console.log(`[organism] Committed file: ${experiment.target_file}`)

  // Create a PR
  const prBody = `## Organism Experiment

**Title:** ${experiment.title}
**Target file:** ${experiment.target_file}
**Target metric:** ${experiment.target_metric}
**Risk level:** ${experiment.risk_level}

### Instruction
${experiment.instruction}

### Expected Improvement
${experiment.expected_improvement}

### AI Models Used
${Array.from(ctx.modelsUsed).join(', ')}

### Cost
- Input tokens: ${ctx.tokensIn}
- Output tokens: ${ctx.tokensOut}

---
*This PR was generated by the organism's autonomous cycle.*`

  const pr = await ghPost(ctx, `/repos/${ctx.owner}/${ctx.repo}/pulls`, {
    title: `organism: ${experiment.title}`,
    head: branchName,
    base: 'main',
    body: prBody,
  }) as { number: number; html_url: string }

  console.log(`[organism] Created PR #${pr.number}: ${pr.html_url}`)

  // Update experiment with PR info
  await ctx.supabase.from('organism_experiments')
    .update({ pr_number: pr.number, pr_url: pr.html_url })
    .eq('cycle_id', ctx.cycleId)
    .eq('title', experiment.title)

  // Store build result
  await ctx.supabase.from('organism_cycles').update({
    build_result: {
      branch: branchName,
      pr_number: pr.number,
      pr_url: pr.html_url,
      file: experiment.target_file,
      content_length: newContent.length,
    },
  }).eq('id', ctx.cycleId)

  return { prNumber: pr.number, prUrl: pr.html_url }
}

// ── Phase 4: VERIFY (partial) ───────────────────────────────────────────────

async function verify(ctx: CycleContext, buildResult: { prNumber: number; prUrl: string } | null): Promise<void> {
  console.log('[organism] === PHASE: VERIFY ===')
  await ctx.supabase.from('organism_cycles').update({ phase: 'verify' }).eq('id', ctx.cycleId)

  if (!buildResult) {
    console.log('[organism] No build result to verify (no experiment executed)')
    await ctx.supabase.from('organism_cycles').update({
      verification_result: { status: 'skipped', reason: 'no build in this cycle' },
    }).eq('id', ctx.cycleId)
    return
  }

  // Check the PR exists
  try {
    const pr = await ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/pulls/${buildResult.prNumber}`) as {
      state: string
      mergeable: boolean | null
      mergeable_state: string
    }

    const verifyResult = {
      pr_number: buildResult.prNumber,
      pr_state: pr.state,
      mergeable: pr.mergeable,
      mergeable_state: pr.mergeable_state,
      note: 'Full verification happens via CI (homeostasis.yml + evals.yml) and organism-verify.yml cross-model review',
    }

    await ctx.supabase.from('organism_cycles').update({
      verification_result: verifyResult,
    }).eq('id', ctx.cycleId)

    console.log(`[organism] Verify: PR #${buildResult.prNumber} state=${pr.state}, mergeable=${pr.mergeable}`)
  } catch (err) {
    console.error(`[organism] Verify: could not check PR #${buildResult.prNumber}:`, err)
    await ctx.supabase.from('organism_cycles').update({
      verification_result: { status: 'error', error: String(err) },
    }).eq('id', ctx.cycleId)
  }
}

// ── Phase 5: LEARN ──────────────────────────────────────────────────────────

async function learn(ctx: CycleContext): Promise<void> {
  console.log('[organism] === PHASE: LEARN ===')
  await ctx.supabase.from('organism_cycles').update({ phase: 'learn' }).eq('id', ctx.cycleId)

  // Find experiments with PR numbers but no completion status
  const { data: pendingExperiments } = await ctx.supabase
    .from('organism_experiments')
    .select('*')
    .not('pr_number', 'is', null)
    .in('status', ['proposed', 'executing'])
    .order('created_at', { ascending: false })
    .limit(10)

  if (!pendingExperiments?.length) {
    console.log('[organism] No pending experiments to learn from')
    await ctx.supabase.from('organism_cycles').update({
      learnings: { checked: 0, learned: 0 },
    }).eq('id', ctx.cycleId)
    return
  }

  console.log(`[organism] Checking ${pendingExperiments.length} pending experiments`)
  const learnings: Array<{ experiment: string; outcome: string; learning: string }> = []

  for (const exp of pendingExperiments) {
    try {
      const pr = await ghGet(ctx, `/repos/${ctx.owner}/${ctx.repo}/pulls/${exp.pr_number}`) as {
        state: string
        merged: boolean
        merged_at: string | null
      }

      if (pr.merged) {
        // Success! Record the learning
        console.log(`[organism] Experiment "${exp.title}" succeeded (PR #${exp.pr_number} merged)`)

        await ctx.supabase.from('organism_experiments').update({
          status: 'succeeded',
          completed_at: pr.merged_at ?? new Date().toISOString(),
        }).eq('id', exp.id)

        // Record pattern learning
        await ctx.supabase.from('organism_learnings').insert({
          experiment_id: exp.id,
          category: 'pattern',
          content: `Experiment "${exp.title}" targeting ${exp.target_file} succeeded. Instruction: ${exp.instruction}`,
          confidence: 0.7,
        })

        // Check if this pattern could become a skill
        const { count: similarSuccesses } = await ctx.supabase
          .from('organism_experiments')
          .select('*', { count: 'exact', head: true })
          .eq('target_file', exp.target_file)
          .eq('status', 'succeeded')

        if ((similarSuccesses ?? 0) >= 3) {
          // Pattern validated enough times — upsert as skill
          const skillName = `improve-${exp.target_file.replace(/[/.]/g, '-')}`
          await ctx.supabase.from('organism_skills').upsert({
            name: skillName,
            description: `Improvements to ${exp.target_file} based on ${similarSuccesses} successful experiments`,
            trigger_conditions: `File ${exp.target_file} has schema gaps or quality issues`,
            instruction_template: exp.instruction,
            success_count: similarSuccesses ?? 0,
            last_used_at: new Date().toISOString(),
          }, { onConflict: 'name' })

          console.log(`[organism] Skill created/updated: ${skillName}`)
        }

        learnings.push({
          experiment: exp.title,
          outcome: 'succeeded',
          learning: `Pattern works for ${exp.target_file}`,
        })

      } else if (pr.state === 'closed') {
        // Failed — record anti-pattern
        console.log(`[organism] Experiment "${exp.title}" failed (PR #${exp.pr_number} closed without merge)`)

        await ctx.supabase.from('organism_experiments').update({
          status: 'failed',
          failure_reason: 'PR closed without merge',
          completed_at: new Date().toISOString(),
        }).eq('id', exp.id)

        await ctx.supabase.from('organism_learnings').insert({
          experiment_id: exp.id,
          category: 'anti_pattern',
          content: `Experiment "${exp.title}" targeting ${exp.target_file} failed — PR closed without merge. Avoid similar approach.`,
          confidence: 0.6,
        })

        // Update skill failure count if applicable
        const skillName = `improve-${exp.target_file.replace(/[/.]/g, '-')}`
        const { data: skill } = await ctx.supabase
          .from('organism_skills')
          .select('failure_count')
          .eq('name', skillName)
          .single()

        if (skill) {
          await ctx.supabase.from('organism_skills').update({
            failure_count: (skill.failure_count ?? 0) + 1,
          }).eq('name', skillName)
        }

        learnings.push({
          experiment: exp.title,
          outcome: 'failed',
          learning: `Approach failed for ${exp.target_file}`,
        })

      } else {
        // Still open — check later
        console.log(`[organism] Experiment "${exp.title}" still open (PR #${exp.pr_number})`)
      }
    } catch (err) {
      console.error(`[organism] Error checking experiment "${exp.title}":`, err)
    }
  }

  await ctx.supabase.from('organism_cycles').update({
    learnings: { checked: pendingExperiments.length, learned: learnings.length, details: learnings },
  }).eq('id', ctx.cycleId)

  console.log(`[organism] Learn complete: checked ${pendingExperiments.length}, learned from ${learnings.length}`)
}

// ── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const startTime = Date.now()
  console.log('[organism] === ORGANISM CYCLE STARTING ===')

  // Authentication: require Bearer ORGANISM_SECRET. Without this, anyone reaching
  // this endpoint could trigger autonomous code changes (unauthenticated RCE).
  const organismSecret = Deno.env.get('ORGANISM_SECRET')
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!organismSecret || authHeader !== `Bearer ${organismSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // No body is fine for manual triggers
  }

  // Get GitHub token from request body or env
  const githubToken = (body.github_token as string) ?? Deno.env.get('GITHUB_PAT') ?? ''
  if (!githubToken) {
    return new Response(JSON.stringify({ error: 'No GitHub token provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Resolve owner/repo from env or defaults
  const owner = Deno.env.get('GITHUB_OWNER') ?? OWNER
  const repo = Deno.env.get('GITHUB_REPO') ?? REPO

  // Create cycle record
  const { data: cycle, error: cycleError } = await supabase
    .from('organism_cycles')
    .insert({ phase: 'perceive', status: 'running' })
    .select('id')
    .single()

  if (cycleError || !cycle) {
    console.error('[organism] Failed to create cycle record:', cycleError)
    return new Response(JSON.stringify({ error: 'Failed to create cycle record', detail: cycleError }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ctx: CycleContext = {
    supabase,
    githubToken,
    owner,
    repo,
    cycleId: cycle.id,
    tokensIn: 0,
    tokensOut: 0,
    modelsUsed: new Set(),
  }

  console.log(`[organism] Cycle ${ctx.cycleId} started for ${owner}/${repo}`)

  try {
    // Phase 1: PERCEIVE
    const perception = await perceive(ctx)

    // Phase 2: REASON
    const experiment = await reason(ctx, perception)

    // Phase 3: BUILD (only if we have an experiment)
    let buildResult: { prNumber: number; prUrl: string } | null = null
    if (experiment) {
      buildResult = await build(ctx, experiment)
    } else {
      console.log('[organism] No experiment selected, skipping build phase')
    }

    // Phase 4: VERIFY
    await verify(ctx, buildResult)

    // Phase 5: LEARN
    await learn(ctx)

    // Mark cycle complete
    const elapsed = Date.now() - startTime
    await supabase.from('organism_cycles').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      cost_tokens_in: ctx.tokensIn,
      cost_tokens_out: ctx.tokensOut,
      models_used: Array.from(ctx.modelsUsed),
    }).eq('id', ctx.cycleId)

    console.log(`[organism] === CYCLE COMPLETE === elapsed=${elapsed}ms, tokens_in=${ctx.tokensIn}, tokens_out=${ctx.tokensOut}, models=${Array.from(ctx.modelsUsed).join(',')}`)

    return new Response(JSON.stringify({
      cycle_id: ctx.cycleId,
      status: 'completed',
      elapsed_ms: elapsed,
      experiment: experiment?.title ?? null,
      pr: buildResult,
      cost: { tokens_in: ctx.tokensIn, tokens_out: ctx.tokensOut },
      models: Array.from(ctx.modelsUsed),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const elapsed = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[organism] CYCLE FAILED after ${elapsed}ms:`, errorMsg)

    // Always mark the cycle as failed
    await supabase.from('organism_cycles').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: errorMsg,
      cost_tokens_in: ctx.tokensIn,
      cost_tokens_out: ctx.tokensOut,
      models_used: Array.from(ctx.modelsUsed),
    }).eq('id', ctx.cycleId)

    return new Response(JSON.stringify({
      cycle_id: ctx.cycleId,
      status: 'failed',
      error: errorMsg,
      elapsed_ms: elapsed,
      cost: { tokens_in: ctx.tokensIn, tokens_out: ctx.tokensOut },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
