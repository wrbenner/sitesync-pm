import type { ComponentType } from 'react';

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
}

export const widgetDefinitions: WidgetDefinition[] = [
  {
    type: 'weather-impact',
    label: 'Weather Impact',
    description: '5 day forecast with outdoor work conflict analysis',
    icon: '🌤️',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: 'live-site',
    label: 'Live Site',
    description: 'Real time crew locations, headcounts, and arrivals',
    icon: '📍',
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: 'ai-insights',
    label: 'AI Insights',
    description: 'AI generated alerts for schedule, budget, safety, and quality',
    icon: '✨',
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: 'cash-flow',
    label: 'Cash Flow',
    description: 'Projected vs actual spend curve with burn rate',
    icon: '💰',
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    type: 'risk-heatmap',
    label: 'Risk Heatmap',
    description: 'Interactive likelihood vs impact risk matrix',
    icon: '🔥',
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: 'productivity-pulse',
    label: 'Productivity Pulse',
    description: 'Crew productivity sparklines with trend indicators',
    icon: '📊',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    type: 'milestone-timeline',
    label: 'Milestone Timeline',
    description: 'Critical path milestones with status and slack',
    icon: '🎯',
    defaultW: 8,
    defaultH: 2,
    minW: 6,
    minH: 2,
  },
  {
    type: 'photo-feed',
    label: 'Photo Feed',
    description: 'Latest site photos with AI tags and metadata',
    icon: '📸',
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
  },
  {
    type: 'bim-preview',
    label: 'BIM Preview',
    description: '3D site model preview with system overlay',
    icon: '🏗️',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
];

// Lazy import map, resolved at render time by DashboardGrid
export type WidgetComponentMap = Record<string, ComponentType>;

export function getWidgetDef(type: string): WidgetDefinition | undefined {
  return widgetDefinitions.find((w) => w.type === type);
}
