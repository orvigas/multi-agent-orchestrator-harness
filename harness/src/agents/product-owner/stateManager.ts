import { Ticket, TicketStatus } from './types';
import fs from 'fs';
import path from 'path';

const BACKLOG_PATH = path.join(process.cwd(), 'harness/tickets/backlog.json');
const BASE_DIR = path.join(process.cwd(), 'harness/tickets');

const STATES: TicketStatus[] = ['backlog', 'in-progress', 'done', 'failed', 'blocked', 'rejected'];

export class TicketStateManager {
  private getStatePath(status: TicketStatus): string {
    return path.join(BASE_DIR, `${status}.json`);
  }

  private loadState(status: TicketStatus): { tickets: Ticket[] } {
    const filePath = this.getStatePath(status);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (error) {
      console.warn(`Could not load ${status} state`);
    }
    return { tickets: [] };
  }

  private saveState(status: TicketStatus, data: { tickets: Ticket[] }): void {
    const dir = path.dirname(this.getStatePath(status));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.getStatePath(status), JSON.stringify(data, null, 2));
  }

  moveTicket(
    ticketId: string,
    fromStatus: TicketStatus,
    toStatus: TicketStatus,
    reason?: string
  ): boolean {
    const fromState = this.loadState(fromStatus);
    const toState = this.loadState(toStatus);

    const ticketIndex = fromState.tickets.findIndex((t) => t.id === ticketId);
    if (ticketIndex === -1) {
      console.warn(`Ticket ${ticketId} not found in ${fromStatus}`);
      return false;
    }

    const ticket = fromState.tickets[ticketIndex];
    ticket.status = toStatus;

    if (reason) {
      if (toStatus === 'rejected') ticket.rejection_reason = reason;
      if (toStatus === 'failed') ticket.failure_reason = reason;
      if (toStatus === 'blocked') ticket.blocked_by = reason;
    }

    if (toStatus === 'done' || toStatus === 'in-progress') {
      if (toStatus === 'in-progress' && !ticket.started_at) {
        ticket.started_at = new Date().toISOString();
      }
      if (toStatus === 'done' && !ticket.completed_at) {
        ticket.completed_at = new Date().toISOString();
      }
    }

    fromState.tickets.splice(ticketIndex, 1);
    toState.tickets.push(ticket);

    this.saveState(fromStatus, fromState);
    this.saveState(toStatus, toState);

    return true;
  }

  getTicket(ticketId: string): Ticket | null {
    for (const status of STATES) {
      const state = this.loadState(status);
      const ticket = state.tickets.find((t) => t.id === ticketId);
      if (ticket) return ticket;
    }
    return null;
  }

  listTicketsByStatus(status: TicketStatus): Ticket[] {
    return this.loadState(status).tickets;
  }

  listAllTickets(): { status: TicketStatus; tickets: Ticket[] }[] {
    return STATES.map((status) => ({
      status,
      tickets: this.loadState(status).tickets,
    }));
  }

  getStats(): {
    total: number;
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<string, number>;
    bySize: Record<string, number>;
  } {
    const all = this.listAllTickets();
    const byStatus: Record<TicketStatus, number> = {} as any;
    const byPriority: Record<string, number> = {};
    const bySize: Record<string, number> = {};

    let total = 0;

    for (const { status, tickets } of all) {
      byStatus[status] = tickets.length;
      for (const ticket of tickets) {
        total += 1;
        byPriority[ticket.priority] = (byPriority[ticket.priority] || 0) + 1;
        bySize[ticket.size] = (bySize[ticket.size] || 0) + 1;
      }
    }

    return { total, byStatus, byPriority, bySize };
  }

  hasValidTransition(from: TicketStatus, to: TicketStatus): boolean {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      backlog: ['in-progress', 'rejected'],
      'in-progress': ['done', 'failed', 'blocked', 'rejected'],
      done: ['blocked', 'rejected'],
      failed: ['blocked', 'in-progress'],
      blocked: ['in-progress', 'rejected'],
      rejected: ['backlog'],
    };

    return validTransitions[from]?.includes(to) ?? false;
  }
}
