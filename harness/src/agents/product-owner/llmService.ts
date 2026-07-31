import Anthropic from '@anthropic-ai/sdk';
import { isLLMModeEnabled, getProductOwnerRole } from '../../config/loadProductOwnerConfig';
import { RefinementData, TicketPriority } from './types';

export class ProductOwnerLLMService {
  private client: Anthropic;
  private enabled: boolean;

  constructor() {
    this.client = new Anthropic();
    this.enabled = isLLMModeEnabled();
  }

  async generateRefinementQuestions(
    userRequest: string,
    existingRefinement: Partial<RefinementData>
  ): Promise<{ question: string; fieldName: string }[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const role = getProductOwnerRole('requirement_refiner');
      const prompt = `
Basándote en el siguiente requerimiento del usuario, genera 2-3 preguntas adicionales
para refinar y clarificar mejor sus necesidades.

Usuario dijo: "${userRequest}"

Lo que ya sabemos:
${Object.entries(existingRefinement)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Genera preguntas en formato JSON:
[
  { "question": "tu pregunta aquí?", "fieldName": "nombreDelCampo" },
  ...
]

Solo JSON, sin explicación adicional.
`;

      const response = await this.client.messages.create({
        model: role.model,
        max_tokens: role.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.warn('Error generating refinement questions:', error);
    }

    return [];
  }

  async generateAcceptanceCriteria(refinement: RefinementData): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const role = getProductOwnerRole('acceptance_criteria_generator');
      const prompt = `
Genera criterios de aceptación claros y verificables para este ticket:

Título: ${refinement.userRequest}
Funcionalidad: ${refinement.functionality || 'No especificada'}
Casos de uso: ${refinement.useCases?.join(', ') || 'No especificados'}
Restricciones: ${refinement.restrictions?.join(', ') || 'Ninguna'}

Formato: Array JSON de strings
["Criterio 1", "Criterio 2", ...]

Solo JSON, sin explicación adicional.
`;

      const response = await this.client.messages.create({
        model: role.model,
        max_tokens: role.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.warn('Error generating acceptance criteria:', error);
    }

    return [];
  }

  async estimateComplexity(refinement: RefinementData): Promise<number> {
    if (!this.enabled) {
      return 2; // Default
    }

    try {
      const role = getProductOwnerRole('task_analyzer');
      const prompt = `
Estima la complejidad de este ticket en una escala del 1 al 5:

Descripción: ${refinement.userRequest}
Funcionalidad: ${refinement.functionality || 'No especificada'}
Casos de uso: ${refinement.useCases?.length || 0} casos
Restricciones: ${refinement.restrictions?.length || 0} restricciones
Prioridad: ${refinement.priority || 'normal'}

Considera:
- Requisitos técnicos
- Integraciones necesarias
- Restricciones y dependencias
- Casos de uso múltiples

Responde SOLO con un número del 1 al 5.
`;

      const response = await this.client.messages.create({
        model: role.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const num = parseInt(content.text.trim());
        if (!isNaN(num) && num >= 1 && num <= 5) {
          return num;
        }
      }
    } catch (error) {
      console.warn('Error estimating complexity:', error);
    }

    return 2; // Default fallback
  }

  async analyzeShouldDivide(refinement: RefinementData, complexity: number): Promise<{
    shouldDivide: boolean;
    reason: string;
    suggestedDivision?: string[];
  }> {
    if (!this.enabled) {
      return { shouldDivide: false, reason: 'LLM mode disabled' };
    }

    try {
      const role = getProjectOwnerRole('task_analyzer');
      const prompt = `
¿Debería dividirse este ticket en épica + subtasks?

Descripción: ${refinement.userRequest}
Complejidad: ${complexity}/5
Casos de uso: ${refinement.useCases?.length || 0}
Restricciones: ${refinement.restrictions?.length || 0}

Criterios para dividir:
- Complejidad >= 4 Y múltiples casos de uso
- Más de 5 requisitos
- Múltiples áreas técnicas involucradas

Responde en JSON:
{
  "shouldDivide": boolean,
  "reason": "explicación breve",
  "suggestedDivision": ["subtask 1", "subtask 2", ...]  // si shouldDivide es true
}
`;

      const response = await this.client.messages.create({
        model: role.model,
        max_tokens: role.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.warn('Error analyzing task division:', error);
    }

    return { shouldDivide: false, reason: 'LLM analysis failed, falling back to heuristics' };
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

function getProjectOwnerRole(roleName: string) {
  return getProductOwnerRole(roleName);
}
