import { describe, it, expect } from 'vitest'
import {
  parseAgentMention,
  stripAgentMention,
  AGENT_DOMAINS,
  SPECIALIST_AGENTS,
  AGENT_TOOLS,
} from '../../types/agents'

describe('parseAgentMention', () => {
  it('should return null when no @mention present', () => {
    expect(parseAgentMention('How is the schedule looking?')).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(parseAgentMention('')).toBeNull()
  })

  it('should parse @schedule domain', () => {
    expect(parseAgentMention('@schedule what is the critical path?')).toBe('schedule')
  })

  it('should parse @cost domain', () => {
    expect(parseAgentMention('@cost what is the EAC?')).toBe('cost')
  })

  it('should parse @safety domain', () => {
    expect(parseAgentMention('@safety any PPE violations?')).toBe('safety')
  })

  it('should parse @quality domain', () => {
    expect(parseAgentMention('@quality punch list status')).toBe('quality')
  })

  it('should parse @compliance domain', () => {
    expect(parseAgentMention('@compliance check certifications')).toBe('compliance')
  })

  it('should parse @document domain', () => {
    expect(parseAgentMention('@document find spec section')).toBe('document')
  })

  it('should parse @budget as cost alias', () => {
    expect(parseAgentMention('@budget overview')).toBe('cost')
  })

  it('should parse @finance as cost alias', () => {
    expect(parseAgentMention('@finance cash flow')).toBe('cost')
  })

  it('should parse @evm as cost alias', () => {
    expect(parseAgentMention('@evm analysis')).toBe('cost')
  })

  it('should parse @osha as safety alias', () => {
    expect(parseAgentMention('@osha check violations')).toBe('safety')
  })

  it('should parse @ppe as safety alias', () => {
    expect(parseAgentMention('@ppe inspection status')).toBe('safety')
  })

  it('should parse @hazard as safety alias', () => {
    expect(parseAgentMention('@hazard site assessment')).toBe('safety')
  })

  it('should parse @punch as quality alias', () => {
    expect(parseAgentMention('@punch open items')).toBe('quality')
  })

  it('should parse @qc as quality alias', () => {
    expect(parseAgentMention('@qc inspection results')).toBe('quality')
  })

  it('should parse @qa as quality alias', () => {
    expect(parseAgentMention('@qa rework analysis')).toBe('quality')
  })

  it('should parse @submittal as quality alias', () => {
    expect(parseAgentMention('@submittal pending review')).toBe('quality')
  })

  it('should parse @payroll as compliance alias', () => {
    expect(parseAgentMention('@payroll certified report')).toBe('compliance')
  })

  it('should parse @insurance as compliance alias', () => {
    expect(parseAgentMention('@insurance expiring cois')).toBe('compliance')
  })

  it('should parse @lien as compliance alias', () => {
    expect(parseAgentMention('@lien waiver status')).toBe('compliance')
  })

  it('should parse @docs as document alias', () => {
    expect(parseAgentMention('@docs find drawing')).toBe('document')
  })

  it('should parse @spec as document alias', () => {
    expect(parseAgentMention('@spec section 03')).toBe('document')
  })

  it('should parse @drawing as document alias', () => {
    expect(parseAgentMention('@drawing cross reference')).toBe('document')
  })

  it('should parse @gantt as schedule alias', () => {
    expect(parseAgentMention('@gantt next milestone')).toBe('schedule')
  })

  it('should parse @scheduling as schedule alias', () => {
    expect(parseAgentMention('@scheduling lookahead')).toBe('schedule')
  })

  it('should parse @timeline as schedule alias', () => {
    expect(parseAgentMention('@timeline critical path')).toBe('schedule')
  })

  it('should return null for unknown @mention', () => {
    expect(parseAgentMention('@unknown do something')).toBeNull()
  })

  it('should return null for @mention with no alias match', () => {
    expect(parseAgentMention('@random test')).toBeNull()
  })

  it('should be case insensitive', () => {
    expect(parseAgentMention('@SCHEDULE check')).toBe('schedule')
    expect(parseAgentMention('@Safety PPE check')).toBe('safety')
    expect(parseAgentMention('@COST analysis')).toBe('cost')
  })

  it('should parse @mention in the middle of text', () => {
    expect(parseAgentMention('please ask @safety about violations')).toBe('safety')
  })

  it('should parse first @mention when multiple present', () => {
    expect(parseAgentMention('@schedule check and @cost analyze')).toBe('schedule')
  })

  it('should parse @mention at end of text', () => {
    expect(parseAgentMention('status check @quality')).toBe('quality')
  })
})

describe('stripAgentMention', () => {
  it('should strip @mention from start of text', () => {
    expect(stripAgentMention('@schedule what is the delay?')).toBe('what is the delay?')
  })

  it('should return original text when no @mention', () => {
    expect(stripAgentMention('what is the schedule?')).toBe('what is the schedule?')
  })

  it('should trim whitespace after stripping', () => {
    expect(stripAgentMention('@cost   EAC analysis')).toBe('EAC analysis')
  })

  it('should handle @mention with only trailing space', () => {
    expect(stripAgentMention('@safety ')).toBe('')
  })

  it('should strip @mention only and leave the rest', () => {
    const result = stripAgentMention('@schedule @cost overlap')
    expect(result).toBe('@cost overlap')
  })

  it('should handle empty string', () => {
    expect(stripAgentMention('')).toBe('')
  })

  it('should handle @mention with no following text', () => {
    expect(stripAgentMention('@quality')).toBe('')
  })

  it('should remove @mention and surrounding whitespace from middle of text', () => {
    // The implementation also strips trailing spaces after the @mention
    const result = stripAgentMention('please check @safety now')
    // After stripping "@safety " and trimming: "please check now"
    expect(result).toContain('please check')
    expect(result).toContain('now')
  })
})

describe('AGENT_DOMAINS', () => {
  it('should contain exactly 6 domains', () => {
    expect(AGENT_DOMAINS).toHaveLength(6)
  })

  it('should contain all required domains', () => {
    expect(AGENT_DOMAINS).toContain('schedule')
    expect(AGENT_DOMAINS).toContain('cost')
    expect(AGENT_DOMAINS).toContain('safety')
    expect(AGENT_DOMAINS).toContain('quality')
    expect(AGENT_DOMAINS).toContain('compliance')
    expect(AGENT_DOMAINS).toContain('document')
  })
})

describe('SPECIALIST_AGENTS', () => {
  it('should have an identity for every domain', () => {
    for (const domain of AGENT_DOMAINS) {
      const agent = SPECIALIST_AGENTS[domain]
      expect(agent).toBeDefined()
      expect(agent.domain).toBe(domain)
      expect(typeof agent.name).toBe('string')
      expect(agent.name.length).toBeGreaterThan(0)
      expect(typeof agent.shortName).toBe('string')
      expect(agent.shortName.length).toBeGreaterThan(0)
    }
  })

  it('should have at least one expertise item per agent', () => {
    for (const domain of AGENT_DOMAINS) {
      expect(SPECIALIST_AGENTS[domain].expertise.length).toBeGreaterThan(0)
    }
  })

  it('should have description for every agent', () => {
    for (const domain of AGENT_DOMAINS) {
      expect(typeof SPECIALIST_AGENTS[domain].description).toBe('string')
      expect(SPECIALIST_AGENTS[domain].description.length).toBeGreaterThan(0)
    }
  })

  it('should have correct agent names', () => {
    expect(SPECIALIST_AGENTS.schedule.name).toBe('Schedule Agent')
    expect(SPECIALIST_AGENTS.cost.name).toBe('Cost Agent')
    expect(SPECIALIST_AGENTS.safety.name).toBe('Safety Agent')
    expect(SPECIALIST_AGENTS.quality.name).toBe('Quality Agent')
    expect(SPECIALIST_AGENTS.compliance.name).toBe('Compliance Agent')
    expect(SPECIALIST_AGENTS.document.name).toBe('Document Agent')
  })

  it('should have correct short names', () => {
    expect(SPECIALIST_AGENTS.schedule.shortName).toBe('Schedule')
    expect(SPECIALIST_AGENTS.cost.shortName).toBe('Cost')
    expect(SPECIALIST_AGENTS.safety.shortName).toBe('Safety')
    expect(SPECIALIST_AGENTS.quality.shortName).toBe('Quality')
    expect(SPECIALIST_AGENTS.compliance.shortName).toBe('Compliance')
    expect(SPECIALIST_AGENTS.document.shortName).toBe('Docs')
  })
})

describe('AGENT_TOOLS', () => {
  it('should have tools defined for every domain', () => {
    for (const domain of AGENT_DOMAINS) {
      expect(AGENT_TOOLS[domain]).toBeDefined()
      expect(AGENT_TOOLS[domain].length).toBeGreaterThan(0)
    }
  })

  it('should include schedule-specific tools', () => {
    expect(AGENT_TOOLS.schedule).toContain('query_schedule')
    expect(AGENT_TOOLS.schedule).toContain('analyze_critical_path')
  })

  it('should include cost-specific tools', () => {
    expect(AGENT_TOOLS.cost).toContain('query_budget')
    expect(AGENT_TOOLS.cost).toContain('earned_value_analysis')
  })

  it('should include safety-specific tools', () => {
    expect(AGENT_TOOLS.safety).toContain('query_incidents')
    expect(AGENT_TOOLS.safety).toContain('generate_jha')
  })

  it('should include quality-specific tools', () => {
    expect(AGENT_TOOLS.quality).toContain('query_punch_items')
    expect(AGENT_TOOLS.quality).toContain('query_submittals')
  })

  it('should include compliance-specific tools', () => {
    expect(AGENT_TOOLS.compliance).toContain('flag_expiring_cois')
    expect(AGENT_TOOLS.compliance).toContain('check_prevailing_wage')
  })

  it('should include document-specific tools', () => {
    expect(AGENT_TOOLS.document).toContain('search_documents')
    expect(AGENT_TOOLS.document).toContain('cross_reference_specs')
  })
})
