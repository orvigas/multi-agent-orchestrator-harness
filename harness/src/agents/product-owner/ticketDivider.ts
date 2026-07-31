import { Ticket, RefinementData } from './types';
import { TicketGenerator } from './ticketGenerator';

export class TicketDivider {
  private generator: TicketGenerator;

  constructor() {
    this.generator = new TicketGenerator();
  }

  shouldDivide(ticket: Ticket): boolean {
    return ticket.size === 'xlarge' || (ticket.complexity >= 4 && ticket.requirements.length > 4);
  }

  divideTicket(ticket: Ticket, refinement: RefinementData): Ticket[] {
    if (!this.shouldDivide(ticket)) {
      return [ticket];
    }

    const subtasks = this.generateSubtasks(refinement, ticket.id);
    const epic = this.createEpic(ticket, subtasks.map((st) => st.id));

    return [epic, ...subtasks];
  }

  private generateSubtasks(refinement: RefinementData, parentId: string): Ticket[] {
    const subtasks: Ticket[] = [];

    const baseNames = [
      'Setup & Configuration',
      'Core Implementation',
      'Integration & Testing',
      'Documentation & Review',
    ];

    const requirements = refinement.requirements || [refinement.userRequest];
    const numSubtasks = Math.min(Math.ceil(requirements.length / 2), baseNames.length);

    for (let i = 0; i < numSubtasks; i++) {
      const subtaskRequirements = requirements.slice(i * 2, (i + 1) * 2);
      const subtaskRefinement: RefinementData = {
        userRequest: `${refinement.userRequest} - ${baseNames[i]}`,
        functionality: refinement.functionality,
        useCases: subtaskRequirements,
        priority: refinement.priority,
        restrictions: refinement.restrictions,
        complexity: Math.max(1, (refinement.complexity || 2) - 1),
      };

      const subtask = this.generator.createTicket(subtaskRefinement, true);
      subtask.type = 'feature';
      subtask.size = 'medium';
      subtask.parent_epic = parentId;
      subtask.dependencies = i > 0 ? [subtasks[i - 1].id] : [];

      subtasks.push(subtask);
    }

    return subtasks;
  }

  private createEpic(parentTicket: Ticket, subtaskIds: string[]): Ticket {
    return {
      ...parentTicket,
      type: 'epic',
      size: 'xlarge',
      subtasks: subtaskIds,
      description: `Epic: ${parentTicket.description}\n\nDivided into ${subtaskIds.length} user stories.`,
    };
  }
}
