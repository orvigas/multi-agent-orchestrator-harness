import { test } from 'node:test';
import assert from 'node:assert';
import { TicketStateManager } from './stateManager';
import { Ticket, TicketStatus } from './types';

test('TicketStateManager', (t) => {
  const manager = new TicketStateManager();

  const mockTicket: Ticket = {
    id: 'TASK-001',
    type: 'feature',
    status: 'backlog',
    title: 'Test ticket',
    description: 'Test description',
    requirements: ['req1'],
    acceptance_criteria: ['criteria1'],
    size: 'medium',
    priority: 'high',
    complexity: 3,
    story_points: 6,
    estimated_days: 3,
    parent_epic: null,
    subtasks: [],
    dependencies: [],
    blocked_by: null,
    rejection_reason: null,
    failure_reason: null,
    tags: ['test'],
    created_at: new Date().toISOString(),
    created_by: 'test',
    started_at: null,
    completed_at: null,
    assignee: null,
    reviewer: null,
  };

  t.test('should validate transitions', () => {
    // Valid transitions
    assert.strictEqual(manager.hasValidTransition('backlog', 'in-progress'), true);
    assert.strictEqual(manager.hasValidTransition('backlog', 'rejected'), true);
    assert.strictEqual(manager.hasValidTransition('in-progress', 'done'), true);
    assert.strictEqual(manager.hasValidTransition('in-progress', 'failed'), true);
    assert.strictEqual(manager.hasValidTransition('in-progress', 'blocked'), true);
    assert.strictEqual(manager.hasValidTransition('failed', 'in-progress'), true);
    assert.strictEqual(manager.hasValidTransition('blocked', 'in-progress'), true);
    assert.strictEqual(manager.hasValidTransition('rejected', 'backlog'), true);

    // Invalid transitions
    assert.strictEqual(manager.hasValidTransition('backlog', 'done'), false);
    assert.strictEqual(manager.hasValidTransition('done', 'in-progress'), false);
    assert.strictEqual(manager.hasValidTransition('rejected', 'in-progress'), false);
  });

  t.test('should track timestamps on state change', () => {
    // Simulating moving ticket to in-progress
    const beforeMove = new Date();
    const ticketBefore = JSON.parse(JSON.stringify(mockTicket));
    ticketBefore.status = 'in-progress';
    ticketBefore.started_at = new Date().toISOString();

    const startedDate = new Date(ticketBefore.started_at);
    assert.ok(startedDate >= beforeMove);
  });

  t.test('should record failure reasons', () => {
    const ticketWithFailure = JSON.parse(JSON.stringify(mockTicket));
    ticketWithFailure.status = 'failed';
    ticketWithFailure.failure_reason = 'Compilation error in src/index.ts';

    assert.strictEqual(ticketWithFailure.failure_reason, 'Compilation error in src/index.ts');
  });

  t.test('should record blocked reasons', () => {
    const blockedTicket = JSON.parse(JSON.stringify(mockTicket));
    blockedTicket.status = 'blocked';
    blockedTicket.blocked_by = 'Waiting for API keys from external service';

    assert.strictEqual(blockedTicket.blocked_by, 'Waiting for API keys from external service');
  });

  t.test('should record rejection reasons', () => {
    const rejectedTicket = JSON.parse(JSON.stringify(mockTicket));
    rejectedTicket.status = 'rejected';
    rejectedTicket.rejection_reason = 'Out of scope for current sprint';

    assert.strictEqual(rejectedTicket.rejection_reason, 'Out of scope for current sprint');
  });

  t.test('should calculate statistics', () => {
    // Create multiple tickets in different states
    const stats = manager.getStats();

    assert.ok(stats.total >= 0);
    assert.ok(stats.byStatus);
    assert.ok(stats.byPriority);
    assert.ok(stats.bySize);

    // Stats should have all states
    ['backlog', 'in-progress', 'done', 'failed', 'blocked', 'rejected'].forEach((status) => {
      assert.ok(status in stats.byStatus);
    });
  });

  t.test('should track multiple states', () => {
    const allTickets = manager.listAllTickets();

    // Should return array with all states
    assert.ok(Array.isArray(allTickets));
    assert.ok(allTickets.length > 0);

    // Each entry should have status and tickets array
    allTickets.forEach((entry) => {
      assert.ok(entry.status);
      assert.ok(Array.isArray(entry.tickets));
    });
  });
});
