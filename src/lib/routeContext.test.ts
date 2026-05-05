import { describe, it, expect } from 'vitest';
import {
  routeFromPath,
  contextToPromptBlock,
  clearRouteContextCache,
  type RouteContext,
} from './routeContext';

describe('routeFromPath', () => {
  it('routes drawings paths', () => {
    expect(routeFromPath('/drawings')).toBe('drawings');
    expect(routeFromPath('/projects/x/drawings/123')).toBe('drawings');
  });

  it('routes RFI paths', () => {
    expect(routeFromPath('/rfis')).toBe('rfis');
    expect(routeFromPath('/projects/x/rfi/4')).toBe('rfis');
  });

  it('routes file/document paths', () => {
    expect(routeFromPath('/files')).toBe('files');
    expect(routeFromPath('/documents/abc')).toBe('files');
  });

  it('routes schedule + gantt paths', () => {
    expect(routeFromPath('/schedule')).toBe('schedule');
    expect(routeFromPath('/gantt/123')).toBe('schedule');
  });

  it('routes budget + cost paths', () => {
    expect(routeFromPath('/budget')).toBe('budget');
    expect(routeFromPath('/cost-codes')).toBe('budget');
  });

  it('routes submittal paths', () => {
    expect(routeFromPath('/submittals')).toBe('submittals');
    expect(routeFromPath('/projects/x/submittal/9')).toBe('submittals');
  });

  it('routes daily-log paths', () => {
    expect(routeFromPath('/daily-log')).toBe('daily_logs');
  });

  it('routes safety paths', () => {
    expect(routeFromPath('/safety')).toBe('safety');
  });

  it('routes punch paths', () => {
    expect(routeFromPath('/punch-list')).toBe('punch_list');
  });

  it('routes dashboard paths', () => {
    expect(routeFromPath('/dashboard')).toBe('dashboard');
    expect(routeFromPath('/')).toBe('dashboard');
  });

  it('falls back to generic for unknown paths', () => {
    expect(routeFromPath('/some/random/path')).toBe('generic');
  });
});

describe('contextToPromptBlock', () => {
  function ctx(over: Partial<RouteContext> = {}): RouteContext {
    return {
      route: 'drawings',
      projectId: 'p1',
      projectName: 'Project Alpha',
      summary: 'Test summary',
      facts: { drawingsCount: 12, hasDiscrepancies: true },
      suggestedQuestions: [],
      proactiveAlerts: [
        { severity: 'critical', message: 'Important alert' },
      ],
      generatedAt: '2026-05-05T00:00:00Z',
      ...over,
    };
  }

  it('renders a route header line', () => {
    expect(contextToPromptBlock(ctx())).toContain('[Route context: drawings]');
  });

  it('includes projectName when present', () => {
    expect(contextToPromptBlock(ctx())).toContain('Project: Project Alpha');
  });

  it('omits projectName line when missing', () => {
    expect(contextToPromptBlock(ctx({ projectName: undefined }))).not.toContain('Project:');
  });

  it('emits each fact as a bullet', () => {
    const block = contextToPromptBlock(ctx());
    expect(block).toContain('- drawingsCount: 12');
    expect(block).toContain('- hasDiscrepancies: true');
  });

  it('skips facts whose value is null/undefined/empty string', () => {
    const block = contextToPromptBlock(
      ctx({ facts: { a: null, b: 'x', c: '', d: 0, e: false } }),
    );
    expect(block).toContain('- b: x');
    expect(block).not.toContain('- a:');
    expect(block).not.toContain('- c:');
    // 0 and false are emitted (only null/undefined/'' filtered)
    expect(block).toContain('- d: 0');
    expect(block).toContain('- e: false');
  });

  it('renders alerts with uppercase severity', () => {
    const block = contextToPromptBlock(ctx());
    expect(block).toContain('[CRITICAL] Important alert');
  });

  it('omits "Active alerts" header when there are none', () => {
    expect(contextToPromptBlock(ctx({ proactiveAlerts: [] }))).not.toContain('Active alerts');
  });

  it('omits "Facts" header when there are none', () => {
    expect(contextToPromptBlock(ctx({ facts: {} }))).not.toContain('Facts:');
  });
});

describe('clearRouteContextCache', () => {
  it('runs without error', () => {
    expect(() => clearRouteContextCache()).not.toThrow();
  });
});
