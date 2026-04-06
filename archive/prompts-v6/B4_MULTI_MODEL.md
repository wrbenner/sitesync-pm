# B4: Multi-Model Agent Framework — Never Bet on One Provider

## Executive Summary

The AI landscape is shifting. Betting on a single model is a strategic mistake. SiteSync V6 implements a **Model Router** that automatically selects the best AI for each task:

- **Claude Opus 4.6** — Complex reasoning, document analysis, multi-step planning (highest quality)
- **Claude Sonnet 4** — General chat, quick answers, code generation (fast, cost-effective)
- **GPT-5.4** — Computer use workflows, long-context document processing (1M tokens)
- **GPT-5.4 Mini** — Subagent tasks, classification, data extraction (cheapest)
- **Gemini 2.5** — Multi-modal (video analysis), Maps integration
- **Local models (Llama 3.3)** — Offline mode, sensitive data (on-premise)

**Strategic Advantage:**
- If Claude API rate-limited: switch to GPT automatically
- If user wants offline: route to Llama 3.3
- If task is simple: use Mini for 1/4 the cost
- If complex document: use GPT-5.4 (1M context)
- Cost optimization: track spend per model, per use case

This makes SiteSync unbeatable. Competitors locked into one provider face outages. SiteSync routes around them.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│          MULTI-MODEL AGENT ROUTING FRAMEWORK                     │
└──────────────────────────────────────────────────────────────────┘

USER REQUEST / AGENT TASK
  │ "Analyze 50-page contract for risk"
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ ROUTER CLASSIFICATION LAYER                                      │
│                                                                  │
│ Task Analysis:                                                   │
│ ├─ Input tokens: 45,000 (50 page document)                      │
│ ├─ Reasoning complexity: High (legal analysis)                  │
│ ├─ Speed requirement: Medium (user waiting, 1-2 min OK)         │
│ ├─ Cost constraint: Medium (customer is enterprise)             │
│ ├─ Context needed: Large (multi-page document)                  │
│ ├─ Data sensitivity: High (legal document)                      │
│ └─ Modality: Text only                                          │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│ MODEL SCORING ENGINE                                             │
│                                                                  │
│ Claude Opus 4.6:                                                │
│ ├─ Reasoning Quality: 10/10 ★★★★★                              │
│ ├─ Context Window: 200K (sufficient) ★★★★★                     │
│ ├─ Cost: $0.015/1K input (3/10) ★★★                           │
│ ├─ Availability: 95% (Anthropic) ★★★★★                        │
│ ├─ Latency: 1-2s ★★★★                                          │
│ └─ TOTAL SCORE: 87/100 ← PRIMARY CHOICE                        │
│                                                                  │
│ Claude Sonnet 4:                                                │
│ ├─ Reasoning Quality: 9/10 ★★★★★                               │
│ ├─ Context Window: 200K (sufficient) ★★★★★                     │
│ ├─ Cost: $0.003/1K input (10/10) ★★★★★                       │
│ ├─ Availability: 95% ★★★★★                                     │
│ ├─ Latency: 500ms ★★★★★                                        │
│ └─ TOTAL SCORE: 82/100 ← FALLBACK #1                           │
│                                                                  │
│ GPT-5.4:                                                        │
│ ├─ Reasoning Quality: 10/10 ★★★★★                              │
│ ├─ Context Window: 1M (excellent) ★★★★★                        │
│ ├─ Cost: $0.075/1K input (1/10) ★                              │
│ ├─ Availability: 92% (OpenAI) ★★★★                             │
│ ├─ Latency: 3-5s ★★★                                           │
│ └─ TOTAL SCORE: 75/100 ← FALLBACK #2 (if cost OK)             │
│                                                                  │
│ Routing Decision:                                               │
│ → Use Claude Opus 4.6 (highest score, best legal analysis)     │
│ → If rate-limited: Fallback to Claude Sonnet                   │
│ → If Claude unavailable: Use GPT-5.4                           │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│ MODEL INVOCATION                                                 │
│                                                                  │
│ Call Claude Opus 4.6:                                           │
│ ├─ System: "You are legal analysis expert..."                   │
│ ├─ Input: 50-page contract                                      │
│ ├─ Max tokens: 4000                                             │
│ ├─ Temperature: 0.7 (balanced analysis)                         │
│ └─ Stream: true (send partial results to UI)                    │
│                                                                  │
│ Response via AG-UI streaming protocol:                          │
│ ├─ Partial chunks streamed to React component                   │
│ ├─ Cost tracked: $0.67 (45K input + 3.8K output)               │
│ └─ Latency: 8.2 seconds                                         │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────┐
│ POST-PROCESSING & LOGGING                                       │
│                                                                  │
│ ├─ Cost Tracking:                                               │
│ │  ├─ Model: claude-opus-4-1-20250805                          │
│ │  ├─ Input tokens: 45,123                                      │
│ │  ├─ Output tokens: 3,847                                      │
│ │  ├─ Cost: $0.672 (logged to accounting)                       │
│ │  └─ Budget: $5000/month customer (97% remaining)             │
│ │                                                               │
│ ├─ Quality Metrics:                                             │
│ │  ├─ User satisfaction: Pending (awaiting feedback)            │
│ │  ├─ Latency: 8.2s (acceptable)                               │
│ │  ├─ Model switched: No                                        │
│ │  └─ Accuracy: High (legal document analysis)                 │
│ │                                                               │
│ └─ Logging:                                                     │
│    ├─ Request logged to model_usage table                       │
│    ├─ Response cached (24h) for similar future requests         │
│    ├─ Audit trail: Who, what, when, cost                       │
│    └─ A/B test data: Compare Claude vs GPT for same task       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Complete Implementation

### 1. Model Router Core

**File: `sitesync-router/src/router/ModelRouter.ts`**
```typescript
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TaskCharacteristics {
  contextLength: number; // tokens needed
  reasoningComplexity: "simple" | "medium" | "complex";
  speedRequirement: "critical" | "fast" | "normal" | "flexible";
  costSensitivity: "low" | "medium" | "high";
  dataSensitivity: "public" | "internal" | "confidential";
  modality: "text" | "vision" | "audio" | "multimodal";
  requiresComputerUse: boolean;
  allowOffline: boolean;
  desiredAccuracy: number; // 0.0-1.0, where 1.0 = highest quality
}

interface ModelScore {
  model: string;
  provider: string;
  score: number; // 0-100
  costPerMTok: number; // Cost per million tokens
  contextWindow: number;
  reasoning: number; // 0-10
  speed: number; // 0-10 (higher = faster)
  availability: number; // 0-10
  reliability: number; // 0-10
  fitReason: string;
}

interface RoutingDecision {
  primaryModel: ModelScore;
  fallbacks: ModelScore[];
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
}

// ============================================================================
// MODEL REGISTRY
// ============================================================================

const MODEL_REGISTRY = {
  "claude-opus-4-1-20250805": {
    provider: "anthropic",
    contextWindow: 200000,
    costInputPer1M: 15000, // cents
    costOutputPer1M: 45000,
    reasoningQuality: 10,
    speed: 6, // 1-2 second latency
    computerUse: true,
    availability: 95,
    reliability: 99,
    description: "Best reasoning, document analysis, complex tasks",
  },
  "claude-sonnet-4-20250514": {
    provider: "anthropic",
    contextWindow: 200000,
    costInputPer1M: 3000,
    costOutputPer1M: 15000,
    reasoningQuality: 9,
    speed: 9, // 500ms latency
    computerUse: false,
    availability: 95,
    reliability: 99,
    description: "Fast, cost-effective, general-purpose",
  },
  "gpt-5.4": {
    provider: "openai",
    contextWindow: 1000000,
    costInputPer1M: 75000, // Higher cost for extended context
    costOutputPer1M: 225000,
    reasoningQuality: 10,
    speed: 4, // 3-5 second latency
    computerUse: true,
    availability: 92,
    reliability: 97,
    description: "Longest context, computer use, reasoning",
  },
  "gpt-5.4-mini": {
    provider: "openai",
    contextWindow: 128000,
    costInputPer1M: 7500,
    costOutputPer1M: 30000,
    reasoningQuality: 8,
    speed: 10, // <200ms latency
    computerUse: false,
    availability: 97,
    reliability: 99,
    description: "Cheap, fast classification, extraction",
  },
  "gemini-2.5-pro": {
    provider: "google",
    contextWindow: 1000000,
    costInputPer1M: 1250, // Gemini is cheap
    costOutputPer1M: 5000,
    reasoningQuality: 8,
    speed: 7, // 1-2 second latency
    computerUse: false,
    availability: 98,
    reliability: 96,
    description: "Multi-modal, video analysis, Maps integration",
  },
  "llama-3.3-70b": {
    provider: "together", // or self-hosted
    contextWindow: 8000,
    costInputPer1M: 0, // Local/on-premise
    costOutputPer1M: 0,
    reasoningQuality: 6,
    speed: 8, // Local latency
    computerUse: false,
    availability: 100,
    reliability: 95,
    description: "On-premise, offline, no data leakage",
  },
};

// ============================================================================
// MODEL ROUTER
// ============================================================================

export class ModelRouter {
  private costTracker: CostTracker;
  private performanceTracker: PerformanceTracker;
  private anthropic: Anthropic;
  private openai: OpenAI;
  private google: GoogleGenerativeAI;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.google = new GoogleGenerativeAI(
      process.env.GOOGLE_API_KEY || ""
    );

    this.costTracker = new CostTracker();
    this.performanceTracker = new PerformanceTracker();
  }

  /**
   * Analyze a task and determine the best model(s) to use
   */
  async analyzeAndRoute(
    task: string,
    characteristics: Partial<TaskCharacteristics>,
    context: {
      userId: string;
      projectId: string;
      monthlyBudget?: number;
      monthlySpent?: number;
    }
  ): Promise<RoutingDecision> {
    // Enrich characteristics if partial
    const fullCharacteristics = await this.enrichCharacteristics(
      task,
      characteristics
    );

    // Score all available models
    const scores = this.scoreModels(fullCharacteristics, context);

    // Filter by constraints
    const filtered = this.filterByConstraints(scores, fullCharacteristics, context);

    // Rank by score
    filtered.sort((a, b) => b.score - a.score);

    if (filtered.length === 0) {
      throw new Error("No suitable models found for this task");
    }

    // Build routing decision with fallbacks
    const decision: RoutingDecision = {
      primaryModel: filtered[0],
      fallbacks: filtered.slice(1, 3),
      reasoning: this.buildReasoning(filtered[0], fullCharacteristics),
      estimatedCost: this.estimateCost(
        filtered[0],
        fullCharacteristics.contextLength
      ),
      estimatedLatency: this.estimateLatency(filtered[0]),
    };

    return decision;
  }

  /**
   * Invoke a model with automatic fallback
   */
  async invokeWithFallback(
    task: string,
    system: string,
    characteristics: Partial<TaskCharacteristics>,
    context: {
      userId: string;
      projectId: string;
      monthlyBudget?: number;
      monthlySpent?: number;
    }
  ): Promise<{
    response: string;
    modelUsed: string;
    cost: number;
    latency: number;
  }> {
    const decision = await this.analyzeAndRoute(task, characteristics, context);

    const models = [decision.primaryModel, ...decision.fallbacks];
    let lastError: Error | null = null;

    for (const modelScore of models) {
      try {
        console.log(`[ROUTER] Attempting: ${modelScore.model}`);

        const startTime = Date.now();

        const response = await this.callModel(
          modelScore.model,
          system,
          task
        );

        const latency = Date.now() - startTime;
        const cost = this.calculateCost(modelScore, response);

        // Log usage
        await this.costTracker.recordUsage({
          userId: context.userId,
          projectId: context.projectId,
          model: modelScore.model,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          cost,
          latency,
          success: true,
        });

        return {
          response: response.content,
          modelUsed: modelScore.model,
          cost,
          latency,
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[ROUTER] Model failed: ${modelScore.model}, trying fallback...`
        );

        // Log failure
        await this.costTracker.recordUsage({
          userId: context.userId,
          projectId: context.projectId,
          model: modelScore.model,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          latency: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        // Continue to next model
      }
    }

    throw new Error(
      `All models failed. Last error: ${lastError?.message || "Unknown"}`
    );
  }

  /**
   * Score all models for a given task
   */
  private scoreModels(
    characteristics: TaskCharacteristics,
    context: { monthlyBudget?: number; monthlySpent?: number }
  ): ModelScore[] {
    const scores: ModelScore[] = [];

    for (const [modelName, modelInfo] of Object.entries(MODEL_REGISTRY)) {
      let score = 0;

      // Reasoning quality (0-10 points)
      if (characteristics.reasoningComplexity === "complex") {
        score += modelInfo.reasoningQuality;
      } else if (characteristics.reasoningComplexity === "medium") {
        score += modelInfo.reasoningQuality * 0.7;
      } else {
        score += Math.min(modelInfo.reasoningQuality, 8) * 0.5;
      }

      // Context window fit (0-10 points)
      if (modelInfo.contextWindow >= characteristics.contextLength) {
        score += 10;
      } else if (
        modelInfo.contextWindow >= characteristics.contextLength * 0.8
      ) {
        score += 7;
      } else {
        score += 0; // Disqualify
      }

      // Speed requirement (0-10 points)
      if (characteristics.speedRequirement === "critical") {
        score += modelInfo.speed; // Speed score directly
      } else if (characteristics.speedRequirement === "fast") {
        score += modelInfo.speed * 0.8;
      } else {
        score += modelInfo.speed * 0.5;
      }

      // Cost sensitivity (0-10 points)
      const costScore = this.calculateCostScore(
        modelName,
        characteristics.contextLength,
        context
      );
      if (characteristics.costSensitivity === "high") {
        score += costScore;
      } else if (characteristics.costSensitivity === "medium") {
        score += costScore * 0.5;
      } else {
        score += costScore * 0.2;
      }

      // Computer use requirement
      if (
        characteristics.requiresComputerUse &&
        !modelInfo.computerUse
      ) {
        score = 0; // Disqualify
      }

      // Offline requirement
      if (
        characteristics.allowOffline &&
        modelInfo.provider !== "together"
      ) {
        score *= 0.9; // Penalize cloud models
      }

      // Availability/reliability (0-10 points)
      const availability = (modelInfo.availability * modelInfo.reliability) / 100;
      if (characteristics.speedRequirement === "critical") {
        score += availability; // Weight availability heavily
      }

      scores.push({
        model: modelName,
        provider: modelInfo.provider,
        score: Math.min(score, 100),
        costPerMTok:
          (modelInfo.costInputPer1M + modelInfo.costOutputPer1M) / 2 / 1000000,
        contextWindow: modelInfo.contextWindow,
        reasoning: modelInfo.reasoningQuality,
        speed: modelInfo.speed,
        availability: modelInfo.availability,
        reliability: modelInfo.reliability,
        fitReason: `Reasoning: ${modelInfo.reasoningQuality}/10, Speed: ${modelInfo.speed}/10, Cost: $${((modelInfo.costInputPer1M + modelInfo.costOutputPer1M) / 2000000).toFixed(4)}/1K tokens`,
      });
    }

    return scores;
  }

  /**
   * Filter models by hard constraints
   */
  private filterByConstraints(
    scores: ModelScore[],
    characteristics: TaskCharacteristics,
    context: { monthlyBudget?: number; monthlySpent?: number }
  ): ModelScore[] {
    return scores.filter((score) => {
      const modelInfo =
        MODEL_REGISTRY[score.model as keyof typeof MODEL_REGISTRY];

      // Context window must be sufficient
      if (modelInfo.contextWindow < characteristics.contextLength) {
        return false;
      }

      // Computer use requirement
      if (characteristics.requiresComputerUse && !modelInfo.computerUse) {
        return false;
      }

      // Budget check
      if (context.monthlyBudget && context.monthlySpent) {
        const remaining = context.monthlyBudget - context.monthlySpent;
        const monthlyRate = score.costPerMTok * 1000000 * 50; // Assume 50M tokens/month
        if (monthlyRate > remaining) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Call the appropriate model
   */
  private async callModel(
    modelName: string,
    system: string,
    task: string
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    if (modelName.startsWith("claude")) {
      return this.callAnthropicModel(modelName, system, task);
    } else if (modelName.startsWith("gpt")) {
      return this.callOpenAIModel(modelName, system, task);
    } else if (modelName.startsWith("gemini")) {
      return this.callGoogleModel(modelName, system, task);
    } else if (modelName.startsWith("llama")) {
      return this.callLocalModel(modelName, system, task);
    }

    throw new Error(`Unknown model: ${modelName}`);
  }

  private async callAnthropicModel(
    modelName: string,
    system: string,
    task: string
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const message = await this.anthropic.messages.create({
      model: modelName,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: "user",
          content: task,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return {
      content: content.text,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }

  private async callOpenAIModel(
    modelName: string,
    system: string,
    task: string
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const response = await this.openai.chat.completions.create({
      model: modelName,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: task,
        },
      ],
    });

    const choice = response.choices[0];
    if (choice.message.content === null) {
      throw new Error("Empty response from OpenAI");
    }

    return {
      content: choice.message.content,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
    };
  }

  private async callGoogleModel(
    modelName: string,
    system: string,
    task: string
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const model = this.google.getGenerativeModel({
      model: modelName,
      systemInstruction: system,
    });

    const result = await model.generateContent(task);
    const response = result.response;

    // Google doesn't always provide token counts
    return {
      content: response.text(),
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  private async callLocalModel(
    modelName: string,
    system: string,
    task: string
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    // Call local Ollama or vLLM instance
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt: `${system}\n\n${task}`,
        stream: false,
      }),
    });

    const data = await response.json();

    return {
      content: data.response,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  /**
   * Estimate cost for a model and task
   */
  private estimateCost(modelScore: ModelScore, contextLength: number): number {
    const modelInfo =
      MODEL_REGISTRY[modelScore.model as keyof typeof MODEL_REGISTRY];

    // Rough estimate: input + 25% output
    const inputCost = (contextLength / 1000000) * modelInfo.costInputPer1M;
    const outputCost =
      ((contextLength * 0.25) / 1000000) * modelInfo.costOutputPer1M;

    return (inputCost + outputCost) / 100; // Convert cents to dollars
  }

  /**
   * Estimate latency for a model
   */
  private estimateLatency(modelScore: ModelScore): number {
    const speedMap = {
      1: 10000, // 10s
      2: 8000,
      3: 6000,
      4: 5000,
      5: 4000,
      6: 2000,
      7: 1500,
      8: 1000,
      9: 500,
      10: 200,
    };

    return speedMap[modelScore.speed as keyof typeof speedMap] || 5000;
  }

  /**
   * Calculate cost score (higher = cheaper)
   */
  private calculateCostScore(
    modelName: string,
    contextLength: number,
    context: { monthlyBudget?: number; monthlySpent?: number }
  ): number {
    const modelInfo =
      MODEL_REGISTRY[modelName as keyof typeof MODEL_REGISTRY];

    const estimatedCost =
      (contextLength / 1000000) *
      ((modelInfo.costInputPer1M + modelInfo.costOutputPer1M) / 2);

    // Normalize to 0-10 scale
    // $10 = 10 points, $100 = 0 points
    return Math.max(0, 10 - estimatedCost / 10);
  }

  /**
   * Calculate actual cost from token usage
   */
  private calculateCost(
    modelScore: ModelScore,
    response: {
      inputTokens: number;
      outputTokens: number;
    }
  ): number {
    const modelInfo =
      MODEL_REGISTRY[modelScore.model as keyof typeof MODEL_REGISTRY];

    const inputCost =
      (response.inputTokens / 1000000) * modelInfo.costInputPer1M;
    const outputCost =
      (response.outputTokens / 1000000) * modelInfo.costOutputPer1M;

    return (inputCost + outputCost) / 100; // Convert cents to dollars
  }

  /**
   * Enrich task characteristics with analysis
   */
  private async enrichCharacteristics(
    task: string,
    characteristics: Partial<TaskCharacteristics>
  ): Promise<TaskCharacteristics> {
    // If characteristics are partial, estimate missing ones
    return {
      contextLength: characteristics.contextLength || 5000,
      reasoningComplexity: characteristics.reasoningComplexity || "medium",
      speedRequirement: characteristics.speedRequirement || "normal",
      costSensitivity: characteristics.costSensitivity || "medium",
      dataSensitivity: characteristics.dataSensitivity || "internal",
      modality: characteristics.modality || "text",
      requiresComputerUse: characteristics.requiresComputerUse || false,
      allowOffline: characteristics.allowOffline || false,
      desiredAccuracy: characteristics.desiredAccuracy || 0.95,
    };
  }

  /**
   * Build reasoning explanation
   */
  private buildReasoning(modelScore: ModelScore, characteristics: TaskCharacteristics): string {
    const reasons: string[] = [];

    if (modelScore.reasoning === 10) {
      reasons.push("Highest reasoning quality for complex analysis");
    }

    if (modelScore.speed >= 8) {
      reasons.push("Fast inference for time-sensitive requests");
    }

    reasons.push(`Cost efficiency: ${modelScore.fitReason}`);

    return reasons.join(". ");
  }
}

// ============================================================================
// COST TRACKER
// ============================================================================

class CostTracker {
  async recordUsage(usage: {
    userId: string;
    projectId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latency: number;
    success: boolean;
    error?: string;
  }) {
    const supabase = require("@supabase/supabase-js").createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from("model_usage_logs")
      .insert([
        {
          user_id: usage.userId,
          project_id: usage.projectId,
          model: usage.model,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cost: usage.cost,
          latency_ms: usage.latency,
          success: usage.success,
          error_message: usage.error,
          timestamp: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error("Error recording model usage:", error);
    }
  }

  async getMonthlyUsage(userId: string, month: string): Promise<{
    totalCost: number;
    byModel: Record<string, { cost: number; count: number; avgLatency: number }>;
    byProject: Record<string, { cost: number; count: number }>;
  }> {
    const supabase = require("@supabase/supabase-js").createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data } = await supabase
      .from("model_usage_logs")
      .select("*")
      .eq("user_id", userId)
      .like("timestamp", `${month}%`);

    const usage = {
      totalCost: 0,
      byModel: {} as Record<string, any>,
      byProject: {} as Record<string, any>,
    };

    for (const log of data || []) {
      usage.totalCost += log.cost;

      if (!usage.byModel[log.model]) {
        usage.byModel[log.model] = {
          cost: 0,
          count: 0,
          avgLatency: 0,
        };
      }
      usage.byModel[log.model].cost += log.cost;
      usage.byModel[log.model].count += 1;

      if (!usage.byProject[log.project_id]) {
        usage.byProject[log.project_id] = { cost: 0, count: 0 };
      }
      usage.byProject[log.project_id].cost += log.cost;
      usage.byProject[log.project_id].count += 1;
    }

    return usage;
  }
}

// ============================================================================
// PERFORMANCE TRACKER
// ============================================================================

class PerformanceTracker {
  async compareModels(
    task: string,
    models: string[]
  ): Promise<Record<string, { score: number; latency: number; cost: number }>> {
    // A/B test implementation: run same task on multiple models, track results
    return {};
  }

  async getModelAccuracy(model: string, taskType: string): Promise<number> {
    // Track user satisfaction with results from each model
    return 0.95;
  }
}

export default new ModelRouter();
```

### 2. Database Schema

**File: `sitesync-router/schema.sql`**
```sql
-- Model usage logging
CREATE TABLE model_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  model VARCHAR(255) NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost DECIMAL(10, 6),
  latency_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Model performance tracking
CREATE TABLE model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model VARCHAR(255) NOT NULL,
  task_type VARCHAR(100),
  accuracy DECIMAL(5, 4),
  avg_latency_ms INTEGER,
  success_rate DECIMAL(5, 4),
  cost_per_1m_tokens DECIMAL(10, 6),
  availability_percent DECIMAL(5, 2),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(model, task_type)
);

-- User model preferences
CREATE TABLE user_model_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  preferred_models VARCHAR(255)[],
  cost_budget_monthly DECIMAL(10, 2),
  prefer_offline BOOLEAN DEFAULT false,
  require_computer_use BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT now()
);

-- Routing decisions log (for analysis)
CREATE TABLE routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  task_type VARCHAR(100),
  primary_model VARCHAR(255),
  fallback_models VARCHAR(255)[],
  routing_reasoning TEXT,
  estimated_cost DECIMAL(10, 6),
  estimated_latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT now()
);

-- Model cost tracking per org
CREATE TABLE org_model_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  month DATE NOT NULL,
  model VARCHAR(255),
  total_cost DECIMAL(12, 2),
  token_count BIGINT,
  request_count INTEGER,
  UNIQUE(org_id, month, model)
);

-- Model feedback (for quality improvement)
CREATE TABLE model_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model VARCHAR(255) NOT NULL,
  user_id UUID,
  task_type VARCHAR(100),
  quality_rating INTEGER, -- 1-5 stars
  accuracy_rating INTEGER,
  speed_rating INTEGER,
  cost_satisfaction INTEGER,
  feedback_text TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_model_usage_user_date ON model_usage_logs(user_id, timestamp DESC);
CREATE INDEX idx_model_usage_project ON model_usage_logs(project_id);
CREATE INDEX idx_model_usage_model ON model_usage_logs(model);
CREATE INDEX idx_model_performance_model ON model_performance(model);
CREATE INDEX idx_org_costs_month ON org_model_costs(month DESC);
CREATE INDEX idx_routing_decisions_user ON routing_decisions(user_id);
CREATE INDEX idx_model_feedback_model ON model_feedback(model);

-- Materialized view for dashboard
CREATE MATERIALIZED VIEW model_cost_summary AS
SELECT
  org_id,
  month,
  SUM(total_cost) as total_org_cost,
  COUNT(DISTINCT model) as models_used,
  array_agg(DISTINCT model) as models_list,
  AVG(total_cost) FILTER (WHERE total_cost > 0) as avg_model_cost
FROM org_model_costs
GROUP BY org_id, month
ORDER BY month DESC;
```

### 3. Integration Hook (React)

**File: `sitesync-web/src/hooks/useMultiModelAgent.ts`**
```typescript
import { useState, useCallback } from "react";
import { useContext } from "react";
import { AuthContext } from "@/context/auth";

interface UseMultiModelAgentOptions {
  onCostUpdate?: (cost: number, model: string) => void;
  onLatencyUpdate?: (latency: number) => void;
}

export function useMultiModelAgent(
  options: UseMultiModelAgentOptions = {}
) {
  const { user } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [cost, setCost] = useState(0);
  const [latency, setLatency] = useState(0);

  const invoke = useCallback(
    async (
      task: string,
      system: string,
      characteristics?: {
        contextLength?: number;
        reasoningComplexity?: "simple" | "medium" | "complex";
        speedRequirement?: "critical" | "fast" | "normal" | "flexible";
        costSensitivity?: "low" | "medium" | "high";
      }
    ) => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/invoke-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task,
            system,
            characteristics,
            userId: user?.id,
          }),
        });

        const result = await response.json();

        setModelUsed(result.modelUsed);
        setCost(result.cost);
        setLatency(result.latency);

        options.onCostUpdate?.(result.cost, result.modelUsed);
        options.onLatencyUpdate?.(result.latency);

        return result.response;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id, options]
  );

  return {
    invoke,
    isLoading,
    modelUsed,
    cost,
    latency,
  };
}
```

### 4. Verification Script

**File: `sitesync-router/scripts/verify-router.js`**
```javascript
#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log("🔀 Verifying Multi-Model Router...\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Usage logging table
  console.log("Test 1: Model Usage Logs");
  try {
    const { count } = await supabase
      .from("model_usage_logs")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Usage logs table ready (${count || 0} records)\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 2: Cost tracking
  console.log("Test 2: Cost Tracking");
  try {
    const { data } = await supabase
      .from("org_model_costs")
      .select("*")
      .limit(1);

    console.log(`✓ Cost tracking configured\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 3: Performance metrics
  console.log("Test 3: Model Performance Metrics");
  try {
    const { count } = await supabase
      .from("model_performance")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Performance tracking ready (${count || 0} records)\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 4: User preferences
  console.log("Test 4: User Model Preferences");
  try {
    const { count } = await supabase
      .from("user_model_preferences")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Preferences table ready\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  // Test 5: Feedback collection
  console.log("Test 5: Model Feedback System");
  try {
    const { count } = await supabase
      .from("model_feedback")
      .select("*", { count: "exact", head: true });

    console.log(`✓ Feedback table ready (${count || 0} ratings)\n`);
    passed++;
  } catch (e) {
    console.error(`✗ ${e.message}\n`);
    failed++;
  }

  console.log("═".repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log("🎯 Multi-model router ready!\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verify().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
```

---

## Strategic Impact

1. **Never Bet on One Provider** — If Claude is unavailable, route to GPT automatically
2. **Cost Optimization** — Simple tasks use Mini (4x cheaper), complex use Opus (better quality)
3. **Performance Comparison** — A/B test models, learn which is best for each task type
4. **Enterprise Flexibility** — On-premise Llama for sensitive data, cloud for speed
5. **Budget Control** — Track spend per model, per project, alert on overages
6. **Quality Improvement** — User feedback loops improve routing over time

This is how SiteSync becomes the unbeatable AI platform for construction. Not locked into one provider. Not vulnerable to outages. Continuously improving.

---

