import { isLLMModeEnabled, getProductOwnerRole } from '../../config/loadProductOwnerConfig';
import { RefinementData } from './types';

/**
 * Product Owner LLM Service (Stub)
 * In production, this would use the harness's unified LLM infrastructure.
 * For now, it provides heuristic fallbacks when LLM mode is disabled.
 */
export class ProductOwnerLLMService {
  private enabled: boolean;

  constructor() {
    this.enabled = isLLMModeEnabled();
  }

  async generateRefinementQuestions(
    userRequest: string,
    existingRefinement: Partial<RefinementData>
  ): Promise<{ question: string; fieldName: string }[]> {
    if (!this.enabled) return [];
    // TODO: Call harness LLM service with requirement_refiner role
    return [];
  }

  async generateAcceptanceCriteria(refinement: RefinementData): Promise<string[]> {
    if (!this.enabled) return [];
    // TODO: Call harness LLM service with acceptance_criteria_generator role
    return [];
  }

  async estimateComplexity(refinement: RefinementData): Promise<number> {
    if (!this.enabled) return 2;
    // TODO: Call harness LLM service with task_analyzer role
    return 2;
  }

  async analyzeShouldDivide(
    refinement: RefinementData,
    complexity: number
  ): Promise<{ shouldDivide: boolean; reason: string; suggestedDivision?: string[] }> {
    if (!this.enabled) {
      return { shouldDivide: false, reason: 'LLM mode disabled' };
    }
    // TODO: Call harness LLM service with task_analyzer role
    return { shouldDivide: false, reason: 'LLM analysis skipped' };
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
