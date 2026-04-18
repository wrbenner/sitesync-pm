import type { FeatureFlag, PageContract } from '../registry'

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'

export interface Finding {
  severity: Severity
  code: string
  message: string
}

export type ActualFlags = Partial<Record<FeatureFlag, boolean>>

export interface AuditResult {
  contract: PageContract
  /** What the static scan actually observed about the page. */
  actual: ActualFlags
  /** Mutation hook presence per entity kind. */
  mutations: {
    createPresent: boolean
    updatePresent: boolean
    deletePresent: boolean
  }
  findings: Finding[]
  /** 0-100 score — proportion of expected flags that are actually present. */
  score: number
}

export interface AuditReport {
  generatedAt: string
  totalRoutes: number
  passingRoutes: number
  averageScore: number
  results: AuditResult[]
  /** Registry-wide invariants (route-drift, missing files, etc.) */
  globalFindings: Finding[]
}
