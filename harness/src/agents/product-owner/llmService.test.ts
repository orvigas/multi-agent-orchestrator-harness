import { test } from 'node:test';
import assert from 'node:assert';
import { ProductOwnerLLMService } from './llmService';
import { RefinementData } from './types';

test('ProductOwnerLLMService', async (t) => {
  // Mock environment for testing
  const originalEnv = process.env.PO_MODE;

  await t.test('should detect disabled LLM mode', () => {
    process.env.PO_MODE = 'deterministic';
    const service = new ProductOwnerLLMService();

    assert.strictEqual(service.isEnabled(), false);
  });

  await t.test('should handle graceful degradation on error', async () => {
    process.env.PO_MODE = 'deterministic';
    const service = new ProductOwnerLLMService();

    const refinement: RefinementData = {
      userRequest: 'Test task',
      priority: 'high',
    };

    // In deterministic mode, should return default values
    const complexity = await service.estimateComplexity(refinement);
    assert.strictEqual(typeof complexity, 'number');
    assert.ok(complexity >= 1 && complexity <= 5);
  });

  await t.test('should validate complexity range', async () => {
    process.env.PO_MODE = 'deterministic';
    const service = new ProductOwnerLLMService();

    const refinement: RefinementData = {
      userRequest: 'Any task',
    };

    const complexity = await service.estimateComplexity(refinement);

    assert.ok(complexity >= 1, 'Complexity should be >= 1');
    assert.ok(complexity <= 5, 'Complexity should be <= 5');
  });

  await t.test('should generate acceptance criteria structure', async () => {
    process.env.PO_MODE = 'deterministic';
    const service = new ProductOwnerLLMService();

    const refinement: RefinementData = {
      userRequest: 'Add login feature',
      useCases: ['User can login', 'User can logout'],
    };

    const criteria = await service.generateAcceptanceCriteria(refinement);

    assert.ok(Array.isArray(criteria));
    // If empty (in deterministic mode), that's ok - it will use heuristics
  });

  await t.test('should analyze task division', async () => {
    process.env.PO_MODE = 'deterministic';
    const service = new ProductOwnerLLMService();

    const refinement: RefinementData = {
      userRequest: 'Build OAuth system',
      useCases: ['Login', 'Signup', 'Logout', 'Refresh token'],
      priority: 'critical',
      restrictions: ['PCI compliance'],
    };

    const analysis = await service.analyzeShouldDivide(refinement, 4);

    assert.ok(typeof analysis === 'object');
    assert.ok('shouldDivide' in analysis);
    assert.ok('reason' in analysis);
  });

  await t.test('should generate refinement questions', async () => {
    process.env.PO_MODE = 'deterministic';
    const service = new ProductOwnerLLMService();

    const refinement: RefinementData = {
      userRequest: 'Implement payment system',
      functionality: 'Checkout',
    };

    const questions = await service.generateRefinementQuestions('Implement payment', refinement);

    assert.ok(Array.isArray(questions));
    // Questions may be empty in deterministic mode
  });

  // Cleanup
  process.env.PO_MODE = originalEnv || 'deterministic';
});
