import { TicketDatabase } from './ticketDatabase';
import { TicketStatus } from './types';

export interface HarnessExecutionResult {
  ticketId: string;
  status: 'success' | 'failure' | 'blocked';
  failureReason?: string;
  blockedReason?: string;
  executionTime: number;
  timestamp: string;
}

export class HarnessIntegration {
  private db: TicketDatabase;
  private static readonly PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };
  private static readonly SIZE_ORDER = { small: 0, medium: 1, large: 2, xlarge: 3 };

  constructor() {
    this.db = new TicketDatabase();
  }

  /**
   * Get tickets ready for execution (in backlog)
   */
  getBacklogTickets() {
    return this.db.getTicketsByStatus('backlog');
  }

  /**
   * Start executing a ticket
   */
  startExecution(ticketId: string): boolean {
    return this.db.moveTicket(ticketId, 'in-progress');
  }

  /**
   * Report successful execution
   */
  reportSuccess(ticketId: string): HarnessExecutionResult {
    const startTime = Date.now();
    const success = this.db.moveTicket(ticketId, 'done');

    return {
      ticketId,
      status: 'success',
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Report failed execution
   */
  reportFailure(ticketId: string, reason: string): HarnessExecutionResult {
    const startTime = Date.now();
    const success = this.db.moveTicket(ticketId, 'failed', reason);

    return {
      ticketId,
      status: 'failure',
      failureReason: reason,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Report blocked execution (dependency issue)
   */
  reportBlocked(ticketId: string, reason: string): HarnessExecutionResult {
    const startTime = Date.now();
    const success = this.db.moveTicket(ticketId, 'blocked', reason);

    return {
      ticketId,
      status: 'blocked',
      blockedReason: reason,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get execution summary for all tickets
   */
  getExecutionSummary() {
    const stats = this.db.getStats();

    return {
      total: stats.total,
      done: stats.byStatus.done,
      failed: stats.byStatus.failed,
      blocked: stats.byStatus.blocked,
      inProgress: stats.byStatus['in-progress'],
      backlog: stats.byStatus.backlog,
      successRate: stats.byStatus.done / (stats.byStatus.done + stats.byStatus.failed) || 0,
    };
  }

  /**
   * Get recommended next tickets to execute
   */
  getNextTickets(limit: number = 5) {
    const backlogTickets = this.getBacklogTickets();

    // Prioritize by: priority -> size -> complexity
    return backlogTickets
      .sort((a, b) => {
        const priorityDiff = HarnessIntegration.PRIORITY_ORDER[a.priority as keyof typeof HarnessIntegration.PRIORITY_ORDER] -
                            HarnessIntegration.PRIORITY_ORDER[b.priority as keyof typeof HarnessIntegration.PRIORITY_ORDER];
        if (priorityDiff !== 0) return priorityDiff;

        const sizeDiff = HarnessIntegration.SIZE_ORDER[a.size as keyof typeof HarnessIntegration.SIZE_ORDER] -
                        HarnessIntegration.SIZE_ORDER[b.size as keyof typeof HarnessIntegration.SIZE_ORDER];
        if (sizeDiff !== 0) return sizeDiff;

        return a.complexity - b.complexity;
      })
      .slice(0, limit);
  }

  /**
   * Get unmet dependencies for a ticket
   */
  private getUnmetDependencies(ticketId: string): string[] {
    const ticket = this.db.getTicket(ticketId);
    if (!ticket || ticket.dependencies.length === 0) return [];

    const unmet: string[] = [];
    for (const depId of ticket.dependencies) {
      const depTicket = this.db.getTicket(depId);
      if (!depTicket || depTicket.status !== 'done') {
        unmet.push(depId);
      }
    }
    return unmet;
  }

  /**
   * Check if ticket has dependencies met
   */
  areDependenciesMet(ticketId: string): boolean {
    return this.getUnmetDependencies(ticketId).length === 0;
  }

  /**
   * Get blocking tickets
   */
  getBlockingTickets(ticketId: string): string[] {
    return this.getUnmetDependencies(ticketId);
  }

  /**
   * Export execution log
   */
  exportExecutionLog(format: 'json' | 'csv' = 'json') {
    const allTickets = this.db.getAllTickets();
    const completed = allTickets.filter((t) => t.status === 'done' || t.status === 'failed');

    if (format === 'json') {
      return JSON.stringify(completed, null, 2);
    }

    // CSV format
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Size', 'Started', 'Completed', 'ExecutionTime'];
    const rows = completed.map((t) => {
      const executionTime = t.completed_at && t.started_at
        ? new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()
        : 0;
      return [
        t.id,
        t.title,
        t.status,
        t.priority,
        t.size,
        t.started_at || '',
        t.completed_at || '',
        executionTime,
      ];
    });

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  close(): void {
    this.db.close();
  }
}
