import { describe, it, expect } from 'vitest';
import { parseMspdi } from '../parser';
import { exportMspdi } from '../exporter';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Sample</Name>
  <StartDate>2026-01-01T08:00:00</StartDate>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Mobilize</Name>
      <Start>2026-01-01T08:00:00</Start>
      <Finish>2026-01-05T17:00:00</Finish>
      <PercentComplete>50</PercentComplete>
      <OutlineLevel>1</OutlineLevel>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Excavate</Name>
      <Start>2026-01-06T08:00:00</Start>
      <Finish>2026-01-10T17:00:00</Finish>
      <PercentComplete>0</PercentComplete>
      <OutlineLevel>1</OutlineLevel>
      <PredecessorLink>
        <PredecessorUID>1</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
      </PredecessorLink>
    </Task>
  </Tasks>
  <Resources>
    <Resource>
      <UID>10</UID>
      <Name>Foreman</Name>
      <Type>Work</Type>
      <StandardRate>85.5</StandardRate>
    </Resource>
  </Resources>
  <Assignments>
    <Assignment>
      <TaskUID>2</TaskUID>
      <ResourceUID>10</ResourceUID>
      <Units>1</Units>
    </Assignment>
  </Assignments>
</Project>`;

describe('parseMspdi', () => {
  it('parses tasks, resources, assignments', () => {
    const result = parseMspdi(SAMPLE);
    expect(result.error).toBeNull();
    expect(result.data?.tasks.length).toBe(2);
    expect(result.data?.tasks[1].name).toBe('Excavate');
    expect(result.data?.resources[0].rate).toBe(85.5);
    expect(result.data?.assignments[0].taskUid).toBe('2');
  });

  it('extracts predecessor links', () => {
    const result = parseMspdi(SAMPLE);
    expect(result.data?.links.length).toBe(1);
    expect(result.data?.links[0].predecessorUid).toBe('1');
    expect(result.data?.links[0].type).toBe(1);
  });

  it('rejects non-Project XML', () => {
    const result = parseMspdi('<Foo />');
    expect(result.error?.category).toBe('ValidationError');
  });

  it('rejects empty content', () => {
    const result = parseMspdi('');
    expect(result.error?.category).toBe('ValidationError');
  });
});

describe('exportMspdi', () => {
  it('round-trips through parseMspdi', () => {
    const parsed = parseMspdi(SAMPLE);
    const xml = exportMspdi(parsed.data!);
    const reparsed = parseMspdi(xml);
    expect(reparsed.error).toBeNull();
    expect(reparsed.data?.name).toBe('Sample');
    expect(reparsed.data?.tasks.length).toBe(2);
    expect(reparsed.data?.links.length).toBe(1);
  });

  it('converts plain ISO date to MS Project T00:00:00', () => {
    const xml = exportMspdi({
      name: 'X',
      startDate: '2026-04-01',
      tasks: [],
      resources: [],
      assignments: [],
      links: [],
    });
    expect(xml).toContain('<StartDate>2026-04-01T00:00:00</StartDate>');
  });
});
