// Deep cross-linking resolver for SiteSync PM
// Every entity in the system can discover its related entities across all domains.

import { useNavigate } from 'react-router-dom';
import {
  tasks, rfis, submittals, schedulePhases, costData, punchList,
  crews, directory,
} from '../data/mockData';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EntityType =
  | 'task' | 'rfi' | 'submittal' | 'schedule_phase'
  | 'change_order' | 'person' | 'crew' | 'punch_item' | 'drawing';

export interface RelatedItem {
  entityType: EntityType;
  id: string | number;
  label: string;
  subtitle: string;
  navigateTo: string;
}

// ─── Navigation Hook ────────────────────────────────────────────────────────

export function useAppNavigate() {
  const navigate = useNavigate();
  return (route: string) => navigate(`/${route}`);
}

// ─── Keyword Matching ───────────────────────────────────────────────────────

const PHASE_KEYWORDS: Record<string, string[]> = {
  'Demolition': ['demolition', 'demo'],
  'Foundation': ['foundation', 'footing', 'excavation'],
  'Structure': ['structural', 'steel', 'bracing', 'concrete', 'erection', 'rebar'],
  'MEP': ['mechanical', 'electrical', 'plumbing', 'hvac', 'mep', 'panel', 'ductwork', 'conduit', 'zoning'],
  'Exterior': ['exterior', 'curtain wall', 'facade', 'south face'],
  'Interior': ['interior', 'framing', 'drywall', 'door', 'hardware', 'lobby', 'marble'],
  'Finishes': ['finishes', 'paint', 'flooring', 'lighting fixture', 'baseboard', 'tile'],
};

const DIVISION_KEYWORDS: Record<string, string[]> = {
  'Structural': ['structural', 'steel', 'bracing', 'concrete'],
  'Mechanical': ['mechanical', 'hvac', 'ductwork', 'zoning'],
  'Electrical': ['electrical', 'panel', 'conduit', 'wiring'],
  'Exterior': ['exterior', 'curtain wall', 'facade'],
  'Interior': ['interior', 'door', 'hardware', 'drywall', 'framing', 'marble', 'paint', 'lobby'],
};

function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function findPhase(text: string) {
  for (const [phaseName, keywords] of Object.entries(PHASE_KEYWORDS)) {
    if (matchKeywords(text, keywords)) {
      const phase = schedulePhases.find((p) => p.name === phaseName);
      if (phase) return phase;
    }
  }
  return null;
}

function findDivision(text: string) {
  for (const [divName, keywords] of Object.entries(DIVISION_KEYWORDS)) {
    if (matchKeywords(text, keywords)) {
      const div = costData.divisions.find((d) => d.name === divName);
      if (div) return div;
    }
  }
  return null;
}

function fmt(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Resolvers ──────────────────────────────────────────────────────────────

export function getRelatedItemsForRfi(rfiId: number): RelatedItem[] {
  const rfi = rfis.find((r) => r.id === rfiId);
  if (!rfi) return [];
  const items: RelatedItem[] = [];
  const searchText = `${rfi.title} ${rfi.rfiNumber}`;

  // Linked tasks
  tasks.forEach((t) => {
    const linked = t.linkedItems.some((li) => li.type === 'rfi' && li.id === rfi.rfiNumber);
    if (linked) {
      items.push({ entityType: 'task', id: t.id, label: t.title, subtitle: t.status.replace('_', ' '), navigateTo: 'tasks' });
    }
  });

  // Schedule phase
  const phase = findPhase(searchText);
  if (phase) {
    items.push({ entityType: 'schedule_phase', id: phase.id, label: `${phase.name} Phase`, subtitle: `${phase.progress}% complete`, navigateTo: 'schedule' });
  }

  // Change orders
  costData.changeOrders.forEach((co) => {
    if (matchKeywords(`${co.title} ${searchText}`, Object.values(DIVISION_KEYWORDS).flat().filter((kw) => matchKeywords(searchText, [kw])))) {
      // Simpler: check if CO and RFI share domain keywords
      const rfiDomain = Object.entries(DIVISION_KEYWORDS).find(([, kws]) => matchKeywords(searchText, kws));
      const coDomain = Object.entries(DIVISION_KEYWORDS).find(([, kws]) => matchKeywords(co.title, kws));
      if (rfiDomain && coDomain && rfiDomain[0] === coDomain[0]) {
        items.push({ entityType: 'change_order', id: co.id, label: `${co.coNumber}: ${co.title}`, subtitle: fmt(co.amount), navigateTo: 'budget' });
      }
    }
  });

  // People
  const fromPerson = directory.find((d) => d.company === rfi.from || d.role === rfi.from);
  if (fromPerson) {
    items.push({ entityType: 'person', id: fromPerson.id, label: fromPerson.contactName, subtitle: fromPerson.company, navigateTo: 'directory' });
  }
  const toPerson = directory.find((d) => d.company === rfi.to || d.role === rfi.to);
  if (toPerson && toPerson.id !== fromPerson?.id) {
    items.push({ entityType: 'person', id: toPerson.id, label: toPerson.contactName, subtitle: toPerson.company, navigateTo: 'directory' });
  }

  return items;
}

export function getRelatedItemsForTask(taskId: number): RelatedItem[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];
  const items: RelatedItem[] = [];
  const searchText = `${task.title} ${task.tags.join(' ')}`;

  // Linked RFIs
  task.linkedItems.forEach((li) => {
    if (li.type === 'rfi') {
      const rfi = rfis.find((r) => r.rfiNumber === li.id);
      if (rfi) items.push({ entityType: 'rfi', id: rfi.id, label: rfi.rfiNumber, subtitle: rfi.title, navigateTo: 'rfis' });
    }
    if (li.type === 'submittal') {
      const sub = submittals.find((s) => s.submittalNumber === li.id);
      if (sub) items.push({ entityType: 'submittal', id: sub.id, label: sub.submittalNumber, subtitle: sub.title, navigateTo: 'submittals' });
    }
  });

  // Schedule phase
  const phase = findPhase(searchText);
  if (phase) {
    items.push({ entityType: 'schedule_phase', id: phase.id, label: `${phase.name} Phase`, subtitle: `${phase.progress}% complete`, navigateTo: 'schedule' });
  }

  // Assignee in directory
  const person = directory.find((d) => d.company === task.assignee.company);
  if (person) {
    items.push({ entityType: 'person', id: person.id, label: person.contactName, subtitle: person.role, navigateTo: 'directory' });
  }

  // Matching crew
  const crew = crews.find((c) => {
    const crewText = `${c.name} ${c.task}`.toLowerCase();
    return task.tags.some((tag) => crewText.includes(tag.toLowerCase()));
  });
  if (crew) {
    items.push({ entityType: 'crew', id: crew.id, label: crew.name, subtitle: crew.task, navigateTo: 'crews' });
  }

  return items;
}

export function getRelatedItemsForSubmittal(submittalId: number): RelatedItem[] {
  const sub = submittals.find((s) => s.id === submittalId);
  if (!sub) return [];
  const items: RelatedItem[] = [];
  const searchText = `${sub.title} ${sub.submittalNumber}`;

  // Phase
  const phase = findPhase(searchText);
  if (phase) {
    items.push({ entityType: 'schedule_phase', id: phase.id, label: `${phase.name} Phase`, subtitle: `${phase.progress}% complete`, navigateTo: 'schedule' });
  }

  // Related tasks
  tasks.forEach((t) => {
    const linked = t.linkedItems.some((li) => li.type === 'submittal' && li.id === sub.submittalNumber);
    if (linked) {
      items.push({ entityType: 'task', id: t.id, label: t.title, subtitle: t.status.replace('_', ' '), navigateTo: 'tasks' });
    }
  });

  // Person
  const person = directory.find((d) => d.company === sub.from);
  if (person) {
    items.push({ entityType: 'person', id: person.id, label: person.contactName, subtitle: person.company, navigateTo: 'directory' });
  }

  // Budget division
  const div = findDivision(searchText);
  if (div) {
    items.push({ entityType: 'change_order', id: div.id, label: `${div.name} Division`, subtitle: `${fmt(div.spent)} of ${fmt(div.budget)}`, navigateTo: 'budget' });
  }

  return items;
}

export function getRelatedItemsForChangeOrder(coId: number): RelatedItem[] {
  const co = costData.changeOrders.find((c) => c.id === coId);
  if (!co) return [];
  const items: RelatedItem[] = [];
  const searchText = co.title;

  // Matching RFI
  rfis.forEach((rfi) => {
    const rfDomain = Object.entries(DIVISION_KEYWORDS).find(([, kws]) => matchKeywords(rfi.title, kws));
    const coDomain = Object.entries(DIVISION_KEYWORDS).find(([, kws]) => matchKeywords(searchText, kws));
    if (rfDomain && coDomain && rfDomain[0] === coDomain[0]) {
      items.push({ entityType: 'rfi', id: rfi.id, label: rfi.rfiNumber, subtitle: rfi.title, navigateTo: 'rfis' });
    }
  });

  // Phase
  const phase = findPhase(searchText);
  if (phase) {
    items.push({ entityType: 'schedule_phase', id: phase.id, label: `${phase.name} Phase`, subtitle: `${phase.progress}% complete`, navigateTo: 'schedule' });
  }

  // Division
  const div = findDivision(searchText);
  if (div) {
    items.push({ entityType: 'change_order', id: div.id, label: `${div.name} Budget`, subtitle: `${fmt(div.spent)} spent`, navigateTo: 'budget' });
  }

  return items;
}

export function getRelatedItemsForPunchItem(itemId: number): RelatedItem[] {
  const item = punchList.find((p) => p.id === itemId);
  if (!item) return [];
  const items: RelatedItem[] = [];
  const searchText = `${item.description} ${item.area}`;

  // Phase
  const phase = findPhase(searchText);
  if (phase) {
    items.push({ entityType: 'schedule_phase', id: phase.id, label: `${phase.name} Phase`, subtitle: `${phase.progress}% complete`, navigateTo: 'schedule' });
  }

  // Matching task
  tasks.forEach((t) => {
    const taskText = `${t.title} ${t.tags.join(' ')}`;
    const itemDomain = Object.entries(DIVISION_KEYWORDS).find(([, kws]) => matchKeywords(searchText, kws));
    const taskDomain = Object.entries(DIVISION_KEYWORDS).find(([, kws]) => matchKeywords(taskText, kws));
    if (itemDomain && taskDomain && itemDomain[0] === taskDomain[0]) {
      items.push({ entityType: 'task', id: t.id, label: t.title, subtitle: t.status.replace('_', ' '), navigateTo: 'tasks' });
      return;
    }
  });

  // Assignee
  const person = directory.find((d) => d.contactName.includes(item.assigned.split(' ')[1] || item.assigned));
  if (person) {
    items.push({ entityType: 'person', id: person.id, label: person.contactName, subtitle: person.role, navigateTo: 'directory' });
  }

  return items;
}

export function getRelatedItemsForInsight(insightId: number): RelatedItem[] {
  const items: RelatedItem[] = [];

  if (insightId === 1) {
    // Steel Delivery Delay
    items.push({ entityType: 'task', id: 1, label: 'Complete Floor 7 steel erection', subtitle: 'In Progress', navigateTo: 'tasks' });
    items.push({ entityType: 'task', id: 12, label: 'Procure secondary steel supplier quote', subtitle: 'In Progress', navigateTo: 'tasks' });
    items.push({ entityType: 'rfi', id: 4, label: 'RFI-004', subtitle: 'Structural connection at curtain wall', navigateTo: 'rfis' });
    items.push({ entityType: 'schedule_phase', id: 3, label: 'Structure Phase', subtitle: '100% complete', navigateTo: 'schedule' });
    items.push({ entityType: 'crew', id: 1, label: 'Steel Crew A', subtitle: 'Floor 7, 14 workers', navigateTo: 'crews' });
    items.push({ entityType: 'change_order', id: 1, label: 'CO-001: Additional structural bracing', subtitle: '$125,000', navigateTo: 'budget' });
  } else if (insightId === 2) {
    // Electrical RFI Pattern
    items.push({ entityType: 'rfi', id: 5, label: 'RFI-005', subtitle: 'Electrical panel location confirmation', navigateTo: 'rfis' });
    items.push({ entityType: 'task', id: 4, label: 'Electrical rough in floors 1 through 3', subtitle: 'In Progress', navigateTo: 'tasks' });
    items.push({ entityType: 'schedule_phase', id: 4, label: 'MEP Phase', subtitle: '62% complete', navigateTo: 'schedule' });
    items.push({ entityType: 'crew', id: 3, label: 'Electrical Crew C', subtitle: 'Floors 1-3, 8 workers', navigateTo: 'crews' });
  } else if (insightId === 3) {
    // Productivity Uplift
    items.push({ entityType: 'crew', id: 5, label: 'Framing Crew E', subtitle: 'Floors 8-12, 88% productivity', navigateTo: 'crews' });
    items.push({ entityType: 'schedule_phase', id: 5, label: 'Exterior Phase', subtitle: '55% complete', navigateTo: 'schedule' });
    items.push({ entityType: 'task', id: 3, label: 'Resolve curtain wall interface detail', subtitle: 'In Progress', navigateTo: 'tasks' });
  }

  return items;
}

export function getTasksForCrew(crewId: number): typeof tasks {
  const crew = crews.find((c) => c.id === crewId);
  if (!crew) return [];

  const crewKeywords: Record<number, string[]> = {
    1: ['structural', 'steel', 'erection'],
    2: ['mechanical', 'hvac', 'rough in'],
    3: ['electrical', 'conduit', 'panel'],
    4: ['exterior', 'curtain wall', 'facade'],
    5: ['interior', 'framing'],
    6: ['finishes', 'drywall', 'paint'],
  };

  const keywords = crewKeywords[crewId] || [];
  return tasks.filter((t) => {
    const text = `${t.title} ${t.tags.join(' ')} ${t.description}`.toLowerCase();
    return keywords.some((kw) => text.includes(kw)) && t.status !== 'done';
  }).slice(0, 2);
}

export function getPersonDetails(nameOrCompany: string) {
  return directory.find((d) =>
    d.contactName.toLowerCase().includes(nameOrCompany.toLowerCase()) ||
    d.company.toLowerCase().includes(nameOrCompany.toLowerCase())
  ) || null;
}
