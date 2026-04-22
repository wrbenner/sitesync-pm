// AI annotations stub file.
// All functions return empty arrays. Real AI insights come from the ai_insights
// Supabase table via useAIInsights() in src/hooks/queries/index.ts.

export type AnnotationSeverity = 'critical' | 'warning' | 'info' | 'positive';
export type AnnotationCategory = 'schedule' | 'budget' | 'safety' | 'quality' | 'productivity' | 'coordination';

export interface AIAnnotation {
  id: string;
  entityType: 'rfi' | 'submittal' | 'task' | 'budget_division' | 'change_order' | 'crew' | 'schedule_phase' | 'punch_item' | 'drawing';
  entityId: number | string;
  severity: AnnotationSeverity;
  category: AnnotationCategory;
  title: string;
  insight: string;
  reasoning: string;
  suggestedAction: string;
  actionRoute?: string;
  confidence: number;
}

export interface PredictiveAlertData {
  id: string;
  page: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  insight: string;
  actionLabel: string;
  actionRoute: string;
  metrics: Array<{ label: string; value: string; trend: 'up' | 'down' | 'flat' }>;
  confidence: number;
  snoozeable: boolean;
}

export interface AIContextAnalysis {
  page: string;
  summary: string;
  keyMetrics: Array<{ label: string; value: string; status: 'good' | 'warning' | 'critical' }>;
  recommendations: string[];
  relatedInsights: string[];
}

// All functions return empty results. Real data comes from Supabase ai_insights table.
export function getAnnotationsForEntity(_entityType?: string, _entityId?: string | number): AIAnnotation[] {
  return [];
}

export function getAnnotationsForPage(): AIAnnotation[] {
  return [];
}

export function getPredictiveAlertsForPage(_page?: string): PredictiveAlertData[] {
  return [];
}

export function getContextAnalysisForPage(): AIContextAnalysis | undefined {
  return undefined;
}
