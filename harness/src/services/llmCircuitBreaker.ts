/**
 * Circuit breaker for LLM providers (Phase 2.4).
 * Prevents cascading failures by disabling consistently failing providers.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerMetrics {
  provider: string;
  model: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  consecutiveFailures: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening (default: 5)
  successThreshold: number;      // Successes before closing (default: 2)
  timeout: number;               // Time before HALF_OPEN retry (ms, default: 60000)
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000,
};

/**
 * Circuit breaker per provider.
 * Tracks failures and prevents excessive retries to broken providers.
 */
export class CircuitBreaker {
  private metrics: Map<string, CircuitBreakerMetrics> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a provider is available (not open).
   */
  isAvailable(provider: string, model: string): boolean {
    const key = this.makeKey(provider, model);
    const metrics = this.metrics.get(key);

    if (!metrics) return true; // Unknown provider is available

    if (metrics.state === "CLOSED") return true;
    if (metrics.state === "OPEN") {
      // Check if timeout passed for HALF_OPEN attempt
      if (!metrics.lastFailureTime) return false;
      const timeSinceFailure = Date.now() - metrics.lastFailureTime;
      if (timeSinceFailure > this.config.timeout) {
        // Try to recover (HALF_OPEN state)
        metrics.state = "HALF_OPEN";
        metrics.consecutiveFailures = 0;
        return true;
      }
      return false;
    }

    return true; // HALF_OPEN is available for testing
  }

  /**
   * Record a successful call.
   */
  recordSuccess(provider: string, model: string): void {
    const key = this.makeKey(provider, model);
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        provider,
        model,
        state: "CLOSED",
        failureCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
      };
      this.metrics.set(key, metrics);
    }

    metrics.successCount++;
    metrics.consecutiveFailures = 0;

    // Close circuit if in HALF_OPEN and enough successes
    if (metrics.state === "HALF_OPEN" && metrics.successCount >= this.config.successThreshold) {
      metrics.state = "CLOSED";
      metrics.failureCount = 0;
    }
  }

  /**
   * Record a failed call.
   */
  recordFailure(provider: string, model: string): void {
    const key = this.makeKey(provider, model);
    let metrics = this.metrics.get(key);

    if (!metrics) {
      metrics = {
        provider,
        model,
        state: "CLOSED",
        failureCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
      };
      this.metrics.set(key, metrics);
    }

    metrics.failureCount++;
    metrics.consecutiveFailures++;
    metrics.lastFailureTime = Date.now();

    // Open circuit if threshold reached
    if (metrics.consecutiveFailures >= this.config.failureThreshold) {
      metrics.state = "OPEN";
    }
  }

  /**
   * Get current metrics for all providers.
   */
  getMetrics(): CircuitBreakerMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics for specific provider.
   */
  getProviderMetrics(provider: string, model: string): CircuitBreakerMetrics | null {
    const key = this.makeKey(provider, model);
    return this.metrics.get(key) ?? null;
  }

  /**
   * Reset all metrics (for testing).
   */
  reset(): void {
    this.metrics.clear();
  }

  /**
   * Reset specific provider.
   */
  resetProvider(provider: string, model: string): void {
    const key = this.makeKey(provider, model);
    this.metrics.delete(key);
  }

  /**
   * Format metrics for logging.
   */
  formatMetrics(): string {
    const metrics = this.getMetrics();
    if (metrics.length === 0) return "No circuit breaker metrics";

    const lines: string[] = ["=== Circuit Breaker Status ==="];

    for (const m of metrics) {
      const status = m.state === "OPEN" ? "🔴" : m.state === "HALF_OPEN" ? "🟡" : "🟢";
      lines.push(
        `${status} ${m.provider}/${m.model}: ${m.state} (${m.successCount}✓ ${m.failureCount}✗, streak:${m.consecutiveFailures})`
      );
    }

    return lines.join("\n");
  }

  private makeKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }
}

/**
 * Global circuit breaker singleton for LLM providers.
 */
let globalCircuitBreaker: CircuitBreaker | null = null;

export function getGlobalCircuitBreaker(): CircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new CircuitBreaker();
  }
  return globalCircuitBreaker;
}

/**
 * Reset global circuit breaker (for testing).
 */
export function resetGlobalCircuitBreaker(): void {
  globalCircuitBreaker = null;
}
