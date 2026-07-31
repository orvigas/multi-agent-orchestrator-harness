import fs from 'fs';
import path from 'path';

export interface TokenUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
  role: string;
  cost: number;
}

export interface CostSummary {
  totalCost: number;
  tokensUsed: number;
  requestCount: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byRole: Record<string, number>;
}

// Token prices (in USD per 1M tokens)
const TOKEN_PRICES: Record<string, Record<string, { input: number; output: number }>> = {
  anthropic: {
    'claude-opus-5': { input: 15, output: 75 },
    'claude-sonnet-5': { input: 3, output: 15 },
    'claude-haiku-4-5': { input: 0.8, output: 4 },
  },
  openai: {
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  },
};

const TRACKING_PATH = path.join(process.cwd(), 'harness/tickets/token-tracking.json');

export class TokenTracker {
  private usage: TokenUsage[] = [];

  constructor() {
    this.loadUsage();
  }

  private loadUsage(): void {
    try {
      if (fs.existsSync(TRACKING_PATH)) {
        const data = JSON.parse(fs.readFileSync(TRACKING_PATH, 'utf-8'));
        this.usage = Array.isArray(data) ? data : [];
      }
    } catch (error) {
      console.warn('Could not load token tracking data');
      this.usage = [];
    }
  }

  private async saveUsage(): Promise<void> {
    const dir = path.dirname(TRACKING_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // TODO: Batch writes using a timer (flush every 5s or after N entries)
    // For now, use sync to maintain existing behavior
    fs.writeFileSync(TRACKING_PATH, JSON.stringify(this.usage, null, 2));
  }

  private calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const prices = TOKEN_PRICES[provider]?.[model];
    if (!prices) {
      console.warn(`No pricing found for ${provider}/${model}, estimating...`);
      // Estimate: 1M input tokens = $10, 1M output tokens = $20
      return (inputTokens * 0.01 + outputTokens * 0.02) / 1000;
    }

    const inputCost = (inputTokens * prices.input) / 1_000_000;
    const outputCost = (outputTokens * prices.output) / 1_000_000;
    return inputCost + outputCost;
  }

  trackUsage(usage: Omit<TokenUsage, 'timestamp' | 'cost'>): void {
    const cost = this.calculateCost(usage.provider, usage.model, usage.inputTokens, usage.outputTokens);

    const entry: TokenUsage = {
      ...usage,
      timestamp: new Date().toISOString(),
      cost,
    };

    this.usage.push(entry);
    this.saveUsage();
  }

  getSummary(): CostSummary {
    const summary: CostSummary = {
      totalCost: 0,
      tokensUsed: 0,
      requestCount: this.usage.length,
      byProvider: {},
      byModel: {},
      byRole: {},
    };

    for (const entry of this.usage) {
      summary.totalCost += entry.cost;
      summary.tokensUsed += entry.inputTokens + entry.outputTokens;

      summary.byProvider[entry.provider] = (summary.byProvider[entry.provider] || 0) + entry.cost;
      summary.byModel[entry.model] = (summary.byModel[entry.model] || 0) + entry.cost;
      summary.byRole[entry.role] = (summary.byRole[entry.role] || 0) + entry.cost;
    }

    return summary;
  }

  getUsageLastNHours(hours: number): TokenUsage[] {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.usage.filter((entry) => new Date(entry.timestamp).getTime() > cutoffTime);
  }

  getUsageThisMonth(): TokenUsage[] {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return this.usage.filter((entry) => new Date(entry.timestamp).getTime() >= monthStart);
  }

  checkBudget(monthlyBudget: number, warnAt: number = 80): {
    isOk: boolean;
    percentageUsed: number;
    costThisMonth: number;
  } {
    const monthlyUsage = this.getUsageThisMonth();
    const costThisMonth = monthlyUsage.reduce((sum, entry) => sum + entry.cost, 0);
    const percentageUsed = (costThisMonth / monthlyBudget) * 100;

    return {
      isOk: costThisMonth <= monthlyBudget,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      costThisMonth: Math.round(costThisMonth * 100) / 100,
    };
  }

  formatSummary(summary: CostSummary): string {
    const lines = [
      '📊 Token Usage Summary',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `Total Cost: $${summary.totalCost.toFixed(2)}`,
      `Tokens Used: ${(summary.tokensUsed / 1000).toFixed(1)}K`,
      `Requests: ${summary.requestCount}`,
      '',
      'By Provider:',
      ...Object.entries(summary.byProvider).map(([provider, cost]) => `  ${provider}: $${cost.toFixed(2)}`),
      '',
      'By Model:',
      ...Object.entries(summary.byModel).map(([model, cost]) => `  ${model}: $${cost.toFixed(2)}`),
      '',
      'By Role:',
      ...Object.entries(summary.byRole).map(([role, cost]) => `  ${role}: $${cost.toFixed(2)}`),
    ];

    return lines.join('\n');
  }
}
