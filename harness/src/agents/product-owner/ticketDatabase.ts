import Database from 'better-sqlite3';
import path from 'path';
import { Ticket, TicketStatus } from './types';

const DB_PATH = path.join(process.cwd(), 'harness/tickets/tickets.db');

export class TicketDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT,
        acceptance_criteria TEXT,
        size TEXT NOT NULL,
        priority TEXT NOT NULL,
        complexity INTEGER NOT NULL,
        story_points INTEGER NOT NULL,
        estimated_days INTEGER NOT NULL,
        parent_epic TEXT,
        subtasks TEXT,
        dependencies TEXT,
        blocked_by TEXT,
        rejection_reason TEXT,
        failure_reason TEXT,
        tags TEXT,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        assignee TEXT,
        reviewer TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_priority ON tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_created_at ON tickets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_parent_epic ON tickets(parent_epic);
    `);
  }

  saveTicket(ticket: Ticket): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tickets (
        id, type, status, title, description, requirements, acceptance_criteria,
        size, priority, complexity, story_points, estimated_days, parent_epic,
        subtasks, dependencies, blocked_by, rejection_reason, failure_reason, tags,
        created_at, created_by, started_at, completed_at, assignee, reviewer, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      ticket.id,
      ticket.type,
      ticket.status,
      ticket.title,
      ticket.description,
      JSON.stringify(ticket.requirements),
      JSON.stringify(ticket.acceptance_criteria),
      ticket.size,
      ticket.priority,
      ticket.complexity,
      ticket.story_points,
      ticket.estimated_days,
      ticket.parent_epic,
      JSON.stringify(ticket.subtasks),
      JSON.stringify(ticket.dependencies),
      ticket.blocked_by,
      ticket.rejection_reason,
      ticket.failure_reason,
      JSON.stringify(ticket.tags),
      ticket.created_at,
      ticket.created_by,
      ticket.started_at,
      ticket.completed_at,
      ticket.assignee,
      ticket.reviewer,
      new Date().toISOString()
    );
  }

  getTicket(id: string): Ticket | null {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;
    return this.deserializeTicket(row);
  }

  getTicketsByStatus(status: TicketStatus): Ticket[] {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC');
    const rows = stmt.all(status) as any[];

    return rows.map((row) => this.deserializeTicket(row));
  }

  getAllTickets(): Ticket[] {
    const stmt = this.db.prepare('SELECT * FROM tickets ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => this.deserializeTicket(row));
  }

  getTicketsByPriority(priority: string): Ticket[] {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE priority = ? ORDER BY created_at DESC');
    const rows = stmt.all(priority) as any[];

    return rows.map((row) => this.deserializeTicket(row));
  }

  getTicketsBySize(size: string): Ticket[] {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE size = ? ORDER BY created_at DESC');
    const rows = stmt.all(size) as any[];

    return rows.map((row) => this.deserializeTicket(row));
  }

  getSubtasks(epicId: string): Ticket[] {
    const stmt = this.db.prepare('SELECT * FROM tickets WHERE parent_epic = ? ORDER BY created_at');
    const rows = stmt.all(epicId) as any[];

    return rows.map((row) => this.deserializeTicket(row));
  }

  getStats(): {
    total: number;
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<string, number>;
    bySize: Record<string, number>;
  } {
    const byStatus: Record<TicketStatus, number> = {
      backlog: 0,
      'in-progress': 0,
      done: 0,
      failed: 0,
      blocked: 0,
      rejected: 0,
    };

    const byPriority: Record<string, number> = {};
    const bySize: Record<string, number> = {};

    const stmt = this.db.prepare('SELECT status, priority, size FROM tickets');
    const rows = stmt.all() as any[];

    let total = 0;
    for (const row of rows) {
      total++;
      byStatus[row.status as TicketStatus]++;
      byPriority[row.priority] = (byPriority[row.priority] || 0) + 1;
      bySize[row.size] = (bySize[row.size] || 0) + 1;
    }

    return { total, byStatus, byPriority, bySize };
  }

  deleteTicket(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tickets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  moveTicket(ticketId: string, toStatus: TicketStatus, reason?: string): boolean {
    const ticket = this.getTicket(ticketId);
    if (!ticket) return false;

    ticket.status = toStatus;

    if (reason) {
      if (toStatus === 'rejected') ticket.rejection_reason = reason;
      if (toStatus === 'failed') ticket.failure_reason = reason;
      if (toStatus === 'blocked') ticket.blocked_by = reason;
    }

    if (toStatus === 'done' && !ticket.completed_at) {
      ticket.completed_at = new Date().toISOString();
    }

    if (toStatus === 'in-progress' && !ticket.started_at) {
      ticket.started_at = new Date().toISOString();
    }

    this.saveTicket(ticket);
    return true;
  }

  close(): void {
    this.db.close();
  }

  private deserializeTicket(row: any): Ticket {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      title: row.title,
      description: row.description,
      requirements: JSON.parse(row.requirements || '[]'),
      acceptance_criteria: JSON.parse(row.acceptance_criteria || '[]'),
      size: row.size,
      priority: row.priority,
      complexity: row.complexity,
      story_points: row.story_points,
      estimated_days: row.estimated_days,
      parent_epic: row.parent_epic,
      subtasks: JSON.parse(row.subtasks || '[]'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      blocked_by: row.blocked_by,
      rejection_reason: row.rejection_reason,
      failure_reason: row.failure_reason,
      tags: JSON.parse(row.tags || '[]'),
      created_at: row.created_at,
      created_by: row.created_by,
      started_at: row.started_at,
      completed_at: row.completed_at,
      assignee: row.assignee,
      reviewer: row.reviewer,
    };
  }
}
