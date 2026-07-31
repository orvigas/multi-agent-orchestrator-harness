import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { TicketGenerator } from './ticketGenerator';
import { RefinementData } from './types';

test('TicketGenerator', async (t) => {
  const generator = new TicketGenerator();

  await t.test('should generate ticket with unique ID', async () => {
    const refinement: RefinementData = {
      userRequest: 'Test ticket',
      priority: 'high',
    };

    const ticket = await generator.createTicket(refinement);

    assert.strictEqual(ticket.id, 'TASK-001');
    assert.strictEqual(ticket.status, 'backlog');
    assert.strictEqual(ticket.type, 'feature');
    assert.strictEqual(ticket.priority, 'high');
    assert.ok(ticket.created_at);
    assert.strictEqual(ticket.created_by, 'product-owner-agent');
  });

  await t.test('should generate sequential IDs', async () => {
    const refinement1: RefinementData = {
      userRequest: 'First ticket',
    };
    const refinement2: RefinementData = {
      userRequest: 'Second ticket',
    };

    const ticket1 = await generator.createTicket(refinement1);
    const ticket2 = await generator.createTicket(refinement2);

    assert.strictEqual(ticket1.id, 'TASK-001');
    assert.strictEqual(ticket2.id, 'TASK-002');
  });

  await t.test('should estimate complexity', async () => {
    const simpleRefinement: RefinementData = {
      userRequest: 'Simple task',
      priority: 'low',
    };

    const complexRefinement: RefinementData = {
      userRequest: 'Complex task',
      priority: 'critical',
      restrictions: ['Constraint 1', 'Constraint 2'],
      useCases: ['Use case 1', 'Use case 2', 'Use case 3'],
    };

    const simpleTicket = await generator.createTicket(simpleRefinement);
    const complexTicket = await generator.createTicket(complexRefinement);

    assert.ok(simpleTicket.complexity < complexTicket.complexity);
  });

  await t.test('should generate acceptance criteria', async () => {
    const refinement: RefinementData = {
      userRequest: 'Add login feature',
      useCases: ['User can login', 'User can logout'],
    };

    const ticket = await generator.createTicket(refinement);

    assert.ok(ticket.acceptance_criteria.length > 0);
    assert.ok(ticket.acceptance_criteria.some((c) => c.includes('login')));
  });

  await t.test('should estimate size based on complexity', async () => {
    const smallRefinement: RefinementData = {
      userRequest: 'Fix typo',
    };

    const largeRefinement: RefinementData = {
      userRequest: 'Implement OAuth',
      priority: 'critical',
      restrictions: ['PCI compliance', 'JWT integration'],
      useCases: ['Login', 'Signup', 'Logout', 'Refresh token'],
    };

    const smallTicket = await generator.createTicket(smallRefinement);
    const largeTicket = await generator.createTicket(largeRefinement);

    assert.ok(
      ['small', 'medium'].includes(smallTicket.size),
      `Expected small ticket, got ${smallTicket.size}`
    );
    assert.ok(
      ['large', 'xlarge'].includes(largeTicket.size),
      `Expected large ticket, got ${largeTicket.size}`
    );
  });

  await t.test('should create epic', async () => {
    const refinement: RefinementData = {
      userRequest: 'Build e-commerce platform',
    };

    const epic = await generator.generateEpic(refinement, ['TASK-10', 'TASK-11', 'TASK-12']);

    assert.strictEqual(epic.type, 'epic');
    assert.strictEqual(epic.size, 'xlarge');
    assert.deepStrictEqual(epic.subtasks, ['TASK-10', 'TASK-11', 'TASK-12']);
  });

  await t.test('should save and persist metadata', async () => {
    const refinement: RefinementData = {
      userRequest: 'Persistence test',
    };

    const ticket = await generator.createTicket(refinement);
    generator.saveTicket(ticket);

    const metadataPath = path.join(process.cwd(), 'harness/tickets/metadata.json');
    assert.ok(fs.existsSync(metadataPath), 'Metadata file should exist');

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    assert.ok(metadata.nextId > 1, 'ID counter should be incremented');
  });
});
