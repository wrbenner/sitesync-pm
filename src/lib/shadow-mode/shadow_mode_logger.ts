/**
 * shadow_mode_logger.ts — Tesla Data Engine Applied to Construction AI
 *
 * Runs AI suggestions in background BEFORE showing them to users.
 * Logs AI prediction vs human action for retraining.
 * Every disagreement between AI and human becomes a training signal.
 *
 * This is the core of SiteSync's data flywheel:
 * User opens RFI -> Shadow mode generates AI prediction
 * User makes different decision -> Disagreement logged
 * Retraining queue accumulates edge cases
 * AI model improves on next cycle
 * Better AI -> More accurate suggestions -> Users trust AI more -> More data
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Types ───

export type PredictionType = 'priority' | 'risk' | 'budget_alert' | 'schedule_impact' | 'assignee' | 'category';

export interface ShadowModeEvent {
  id: string;
  context: string;
  predictionType: PredictionType;
  ai_prediction: string;
  ai_confidence: number;
  ai_reasoning: string;
  human_action?: string;
  match?: boolean;
  sent_for_retraining: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface ShadowPrediction {
  predictionId: string;
  prediction: string;
  confidence: number;
  reasoning: string;
}

export interface RetrainingEntry {
  context: string;
  prediction_type: PredictionType;
  ai_prediction: string;
  ai_confidence: number;
  human_action: string;
  disagreement_severity: 'low' | 'medium' | 'high';
  created_at: string;
}

// ─── Shadow Mode Logger ───

export class ShadowModeLogger {
  private supabase: SupabaseClient;
  private pendingPredictions: Map<string, ShadowModeEvent> = new Map();

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    // import.meta.env is available in Vite-bundled context; safe fallback for Node.js
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    const url = supabaseUrl || env.VITE_SUPABASE_URL || '';
    const key = supabaseKey || env.VITE_SUPABASE_ANON_KEY || '';

    this.supabase = createClient(url, key);
  }

  /**
   * Generate a shadow prediction BEFORE showing AI suggestions to the user.
   * The prediction is stored locally until the human makes their decision.
   */
  async generateShadowPrediction(
    context: string,
    predictionType: PredictionType,
    contextData: Record<string, unknown>
  ): Promise<ShadowPrediction> {
    const predictionId = crypto.randomUUID();

    // Call the AI prediction edge function
    let prediction = '';
    let confidence = 0;
    let reasoning = '';

    try {
      const { data, error } = await this.supabase.functions.invoke('shadow-predict', {
        body: {
          context,
          predictionType,
          contextData,
        },
      });

      if (!error && data) {
        prediction = data.prediction || '';
        confidence = data.confidence || 0;
        reasoning = data.reasoning || '';
      }
    } catch {
      // Shadow mode should never break the main UI
      // If prediction fails, we just don't have a shadow prediction
      return { predictionId, prediction: '', confidence: 0, reasoning: '' };
    }

    // Store pending prediction
    this.pendingPredictions.set(predictionId, {
      id: predictionId,
      context,
      predictionType,
      ai_prediction: prediction,
      ai_confidence: confidence,
      ai_reasoning: reasoning,
      sent_for_retraining: false,
      created_at: new Date().toISOString(),
    });

    return { predictionId, prediction, confidence, reasoning };
  }

  /**
   * Record the human's actual decision.
   * This is the critical feedback loop — the "shadow mode" comparison.
   */
  async recordHumanAction(predictionId: string, humanAction: string): Promise<void> {
    const event = this.pendingPredictions.get(predictionId);
    if (!event) return;

    const match = this.comparePredictions(event.ai_prediction, humanAction);
    event.human_action = humanAction;
    event.match = match;
    event.resolved_at = new Date().toISOString();

    // High confidence disagreements go to retraining queue
    // These are the most valuable training signals
    if (!match && event.ai_confidence > 0.7) {
      event.sent_for_retraining = true;
      await this.queueForRetraining(event);
    }

    // Log to Supabase for analytics
    await this.logShadowEvent(event);

    this.pendingPredictions.delete(predictionId);
  }

  /**
   * Compare AI prediction to human action.
   * Handles fuzzy matching for predictions that are semantically similar.
   */
  private comparePredictions(aiPrediction: string, humanAction: string): boolean {
    // Exact match
    if (aiPrediction.toLowerCase().trim() === humanAction.toLowerCase().trim()) {
      return true;
    }

    // Priority level matching (e.g., "HIGH" vs "High" vs "high")
    const priorities = ['critical', 'high', 'medium', 'low'];
    const aiPriority = priorities.find(p => aiPrediction.toLowerCase().includes(p));
    const humanPriority = priorities.find(p => humanAction.toLowerCase().includes(p));
    if (aiPriority && humanPriority) {
      return aiPriority === humanPriority;
    }

    return false;
  }

  /**
   * Queue a disagreement for retraining.
   * These entries become the most valuable data for improving AI suggestions.
   */
  private async queueForRetraining(event: ShadowModeEvent): Promise<void> {
    const severity = this.calculateDisagreementSeverity(event);

    const entry: RetrainingEntry = {
      context: event.context,
      prediction_type: event.predictionType,
      ai_prediction: event.ai_prediction,
      ai_confidence: event.ai_confidence,
      human_action: event.human_action || '',
      disagreement_severity: severity,
      created_at: new Date().toISOString(),
    };

    try {
      await this.supabase
        .from('shadow_mode_retraining_queue')
        .insert(entry);
    } catch {
      // Retraining queue failure should never break the app
      console.warn('Failed to queue shadow mode event for retraining');
    }
  }

  /**
   * Calculate how significant a disagreement is.
   * High severity = AI was very confident and very wrong.
   */
  private calculateDisagreementSeverity(event: ShadowModeEvent): 'low' | 'medium' | 'high' {
    if (event.ai_confidence > 0.9) return 'high';
    if (event.ai_confidence > 0.7) return 'medium';
    return 'low';
  }

  /**
   * Log shadow mode event to Supabase for analytics.
   */
  private async logShadowEvent(event: ShadowModeEvent): Promise<void> {
    try {
      await this.supabase
        .from('shadow_mode_events')
        .insert({
          id: event.id,
          context: event.context,
          prediction_type: event.predictionType,
          ai_prediction: event.ai_prediction,
          ai_confidence: event.ai_confidence,
          human_action: event.human_action,
          match: event.match,
          sent_for_retraining: event.sent_for_retraining,
          created_at: event.created_at,
          resolved_at: event.resolved_at,
        });
    } catch {
      // Analytics logging should never break the app
    }
  }

  /**
   * Get shadow mode analytics for a time period.
   */
  async getAnalytics(days: number = 30): Promise<{
    totalPredictions: number;
    matchRate: number;
    retrainingQueueSize: number;
    topDisagreementContexts: string[];
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data: events } = await this.supabase
        .from('shadow_mode_events')
        .select('*')
        .gte('created_at', since);

      const { count: retrainingCount } = await this.supabase
        .from('shadow_mode_retraining_queue')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);

      const total = events?.length || 0;
      const matches = events?.filter(e => e.match).length || 0;

      return {
        totalPredictions: total,
        matchRate: total > 0 ? matches / total : 0,
        retrainingQueueSize: retrainingCount || 0,
        topDisagreementContexts: [],
      };
    } catch {
      return {
        totalPredictions: 0,
        matchRate: 0,
        retrainingQueueSize: 0,
        topDisagreementContexts: [],
      };
    }
  }
}

// Export singleton for app-wide use
let _instance: ShadowModeLogger | null = null;

export function getShadowModeLogger(): ShadowModeLogger {
  if (!_instance) {
    _instance = new ShadowModeLogger();
  }
  return _instance;
}
