/**
 * orchestrator/critics.ts — Adversarial Roles
 *
 * The Critic and Red Team agents. These exist to break things
 * and find what human review would miss.
 */

// unused imports removed

export interface Defect {
  severity: 'blocking' | 'major' | 'minor';
  category: 'spec-violation' | 'architecture-violation' | 'performance' | 'accessibility' | 'security' | 'edge-case' | 'correctness';
  file: string;
  line?: number;
  description: string;
  suggestedFix?: string;
}

export interface CriticReport {
  gene: string;
  timestamp: string;
  defects: Defect[];
  blockingCount: number;
  mergeReady: boolean;
  summary: string;
}

/**
 * Build the critic prompt that produces structured defect output.
 */
export function buildCriticPrompt(gene: string, filesChanged: string[]): string {
  return `You are the Critic for gene "${gene}". You are adversarial. Your job is to find defects.

## Files to Review
${filesChanged.map(f => `- ${f}`).join('\n')}

## Defect Categories
For each issue found, classify as:
- **blocking**: Prevents merge. Spec violation, data corruption risk, security flaw, build break.
- **major**: Should be fixed before merge. Performance regression, accessibility gap, missing error handling.
- **minor**: Can be fixed in follow-up. Code style, naming, non-critical edge case.

## What to Check
1. SPEC.md compliance: Does each changed file satisfy its acceptance criteria?
2. Architecture law violations: Reference DECISIONS.md. Are any laws broken?
3. Performance: Any O(n^2) operations? Unnecessary re-renders? Large bundle additions?
4. Accessibility: Missing aria labels? Color contrast issues? Keyboard navigation broken?
5. Security: User input unsanitized? RLS policies missing? Secrets exposed?
6. Edge cases: Empty arrays? Null values? Maximum length inputs? Concurrent operations?
7. Error handling: Every async operation needs try/catch. Every user action needs feedback.

## Output Format
Output a JSON array of defects:
\`\`\`json
[
  {
    "severity": "blocking",
    "category": "spec-violation",
    "file": "src/pages/Dashboard.tsx",
    "line": 42,
    "description": "Weather widget still uses mock data. SPEC.md requires OpenWeatherMap API.",
    "suggestedFix": "Replace mockWeather with useWeatherAPI() hook"
  }
]
\`\`\`

After the JSON, provide a summary: how many blocking/major/minor, and whether this is merge-ready.`;
}

/**
 * Build the red team prompt for adversarial attack scenarios.
 */
export function buildRedTeamPrompt(gene: string): string {
  return `You are the Red Team for gene "${gene}". Your job is to break the implementation.

## Attack Vectors (generate ALL of these)

### 1. Malicious Inputs (5 scenarios)
Design inputs that would cause:
- SQL injection through user-facing text fields
- XSS through rendered user content
- Integer overflow in financial calculations
- Path traversal in file operations
- Prototype pollution through JSON parsing

### 2. Concurrent Operations (3 scenarios)
Design scenarios where:
- Two users edit the same entity simultaneously
- A user submits a form while data is being synced
- A background job modifies data a user is viewing

### 3. Empty/Null/Undefined Edge Cases (2 scenarios)
Test with:
- Every optional field set to null
- Arrays with zero elements where at least one is expected

### 4. Adversarial User Flow (1 scenario)
A user who:
- Navigates backward mid-operation
- Switches between mobile and desktop mid-session
- Loses network connectivity during a save operation

## Rules
- All 11 scenarios must either: pass gracefully OR throw a typed error.
- Silent failures are blocking defects.
- Data corruption is a blocking defect.
- Output each test scenario as a concrete, executable test case.`;
}

/**
 * Parse a critic's output into a structured report.
 */
export function parseCriticOutput(output: string, gene: string): CriticReport {
  const defects: Defect[] = [];

  // Try to extract JSON defect array from output
  const jsonMatch = output.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        defects.push(...parsed);
      }
    } catch {
      // Could not parse JSON, extract defects from text
    }
  }

  const blockingCount = defects.filter(d => d.severity === 'blocking').length;

  return {
    gene,
    timestamp: new Date().toISOString(),
    defects,
    blockingCount,
    mergeReady: blockingCount === 0,
    summary: `${defects.length} defects found (${blockingCount} blocking, ${defects.filter(d => d.severity === 'major').length} major, ${defects.filter(d => d.severity === 'minor').length} minor). ${blockingCount === 0 ? 'Merge ready.' : 'BLOCKED.'}`,
  };
}
