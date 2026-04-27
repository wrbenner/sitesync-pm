import { describe, it, expect } from 'vitest'
import {
  AGENT_DOMAINS,
  AGENT_TOOLS,
  SPECIALIST_AGENTS,
  type AgentDomain,
} from './agents'

describe('agents — AGENT_DOMAINS', () => {
  it('exposes the documented 6 domains', () => {
    expect(AGENT_DOMAINS).toEqual([
      'schedule', 'cost', 'safety', 'quality', 'compliance', 'document',
    ])
  })

  it('domains are unique (no duplicates)', () => {
    expect(new Set(AGENT_DOMAINS).size).toBe(AGENT_DOMAINS.length)
  })
})

describe('agents — AGENT_TOOLS', () => {
  it('every domain has at least one tool', () => {
    for (const domain of AGENT_DOMAINS) {
      expect(AGENT_TOOLS[domain].length, `${domain} has no tools`).toBeGreaterThan(0)
    }
  })

  it('every tool name is unique within its domain', () => {
    for (const domain of AGENT_DOMAINS) {
      const tools = AGENT_TOOLS[domain]
      expect(new Set(tools).size, `duplicate tool in ${domain}`).toBe(tools.length)
    }
  })

  it('every tool name is snake_case (no spaces, lowercase, underscores allowed)', () => {
    for (const tools of Object.values(AGENT_TOOLS)) {
      for (const tool of tools) {
        expect(tool, `tool "${tool}" is not snake_case`).toMatch(/^[a-z_]+$/)
      }
    }
  })

  it('schedule agent has the documented core tools', () => {
    expect(AGENT_TOOLS.schedule).toEqual(
      expect.arrayContaining([
        'query_tasks', 'query_schedule', 'predict_delays',
        'analyze_critical_path', 'query_weather_impact', 'suggest_reordering',
      ]),
    )
  })

  it('cost agent has the EVM + change-order tools', () => {
    expect(AGENT_TOOLS.cost).toEqual(
      expect.arrayContaining([
        'query_budget', 'query_change_orders', 'earned_value_analysis',
        'forecast_costs', 'query_contingency', 'draft_change_order',
      ]),
    )
  })

  it('safety agent owns incident + inspection + JHA generation', () => {
    expect(AGENT_TOOLS.safety).toContain('generate_jha')
    expect(AGENT_TOOLS.safety).toContain('query_incidents')
  })

  it('compliance agent owns COI + payroll tools', () => {
    expect(AGENT_TOOLS.compliance).toContain('flag_expiring_cois')
    expect(AGENT_TOOLS.compliance).toContain('query_payroll')
    expect(AGENT_TOOLS.compliance).toContain('check_prevailing_wage')
  })

  it('document agent has spec-section + PDF extraction tools', () => {
    expect(AGENT_TOOLS.document).toContain('find_spec_sections')
    expect(AGENT_TOOLS.document).toContain('extract_from_pdf')
    expect(AGENT_TOOLS.document).toContain('generate_closeout_docs')
  })
})

describe('agents — SPECIALIST_AGENTS catalog', () => {
  it('every domain has a specialist identity', () => {
    for (const domain of AGENT_DOMAINS) {
      expect(SPECIALIST_AGENTS[domain], `missing identity for ${domain}`).toBeDefined()
    }
  })

  it('every identity has all required fields populated', () => {
    for (const [domain, identity] of Object.entries(SPECIALIST_AGENTS)) {
      expect(identity.domain).toBe(domain)
      expect(identity.name).toBeTruthy()
      expect(identity.shortName).toBeTruthy()
      expect(identity.description).toBeTruthy()
      expect(Array.isArray(identity.expertise)).toBe(true)
      expect(identity.expertise.length, `${domain} has no expertise`).toBeGreaterThan(0)
      expect(identity.icon).toBeTruthy()
      expect(identity.accentColor).toBeTruthy()
    }
  })

  it('agent names are unique', () => {
    const names = Object.values(SPECIALIST_AGENTS).map((a) => a.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('every agent name contains "Agent" suffix', () => {
    for (const agent of Object.values(SPECIALIST_AGENTS)) {
      expect(agent.name, `${agent.shortName} missing Agent suffix`).toMatch(/Agent$/)
    }
  })

  it('the domain key in the record matches the identity.domain field', () => {
    // Self-consistency check — paired-key invariant
    for (const [key, identity] of Object.entries(SPECIALIST_AGENTS) as Array<
      [AgentDomain, typeof SPECIALIST_AGENTS[AgentDomain]]
    >) {
      expect(identity.domain).toBe(key)
    }
  })
})
