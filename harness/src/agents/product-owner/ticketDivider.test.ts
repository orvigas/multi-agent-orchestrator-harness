import { test } from 'node:test';
import assert from 'node:assert';
import { TicketDivider } from './ticketDivider';
import { RefinementData } from './types';

test('TicketDivider', async (t) => {
  const divider = new TicketDivider();

  await t.test('should detect xlarge tickets for division', () => {
    const xlargeTicket = {
      size: 'xlarge',
      complexity: 5,
      requirements: ['req1', 'req2', 'req3', 'req4', 'req5'],
    } as any;

    const shouldDivide = divider.shouldDivide(xlargeTicket);
    assert.strictEqual(shouldDivide, true);
  });

  await t.test('should not divide small tickets', () => {
    const smallTicket = {
      size: 'small',
      complexity: 1,
      requirements: ['req1'],
    } as any;

    const shouldDivide = divider.shouldDivide(smallTicket);
    assert.strictEqual(shouldDivide, false);
  });

  await t.test('should return single ticket if no division needed', async () => {
    const ticket = {
      id: 'TASK-001',
      size: 'small',
      complexity: 1,
      requirements: ['req1'],
      type: 'feature',
    } as any;

    const refinement: RefinementData = {
      userRequest: 'Small task',
    };

    const result = await divider.divideTicket(ticket, refinement);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'TASK-001');
  });

  await t.test('should divide large ticket into epic + subtasks', async () => {
    const largeTicket = {
      id: 'TASK-001',
      size: 'xlarge',
      complexity: 4,
      requirements: ['req1', 'req2', 'req3', 'req4'],
      type: 'feature',
      description: 'Large feature',
      title: 'Large feature',
      priority: 'high',
      tags: ['test'],
    } as any;

    const refinement: RefinementData = {
      userRequest: 'Large task',
      requirements: ['req1', 'req2', 'req3', 'req4'],
      priority: 'high',
    };

    const result = await divider.divideTicket(largeTicket, refinement);

    // Should have epic + subtasks
    assert.ok(result.length > 1);

    // First should be epic
    const epic = result[0];
    assert.strictEqual(epic.type, 'epic');
    assert.strictEqual(epic.size, 'xlarge');
    assert.ok(epic.subtasks.length > 0);

    // Remaining should be subtasks
    const subtasks = result.slice(1);
    subtasks.forEach((st) => {
      assert.strictEqual(st.type, 'feature');
      assert.strictEqual(st.parent_epic, 'TASK-001');
    });
  });

  await t.test('should create dependencies between subtasks', async () => {
    const largeTicket = {
      id: 'TASK-001',
      size: 'xlarge',
      complexity: 4,
      requirements: ['req1', 'req2', 'req3', 'req4'],
      type: 'feature',
      description: 'Large feature',
      title: 'Large feature',
      priority: 'high',
      tags: ['test'],
    } as any;

    const refinement: RefinementData = {
      userRequest: 'Large task',
      requirements: ['req1', 'req2', 'req3', 'req4'],
    };

    const result = await divider.divideTicket(largeTicket, refinement);
    const subtasks = result.slice(1);

    // First subtask should have no dependencies
    assert.strictEqual(subtasks[0].dependencies.length, 0);

    // Second should depend on first, etc
    for (let i = 1; i < subtasks.length; i++) {
      assert.ok(subtasks[i].dependencies.length > 0);
      assert.ok(subtasks[i].dependencies.includes(subtasks[i - 1].id));
    }
  });

  await t.test('should inherit epic properties to subtasks', async () => {
    const largeTicket = {
      id: 'TASK-001',
      size: 'xlarge',
      complexity: 4,
      requirements: ['req1', 'req2'],
      type: 'feature',
      description: 'Epic description',
      title: 'Epic title',
      priority: 'critical',
      tags: ['urgent', 'backend'],
    } as any;

    const refinement: RefinementData = {
      userRequest: 'Large task',
      priority: 'critical',
      restrictions: ['No downtime'],
      tags: ['urgent', 'backend'],
    };

    const result = await divider.divideTicket(largeTicket, refinement);
    const subtasks = result.slice(1);

    subtasks.forEach((st) => {
      assert.strictEqual(st.priority, 'critical');
      assert.ok(st.tags.includes('urgent') || st.tags.includes('backend'));
    });
  });
});
