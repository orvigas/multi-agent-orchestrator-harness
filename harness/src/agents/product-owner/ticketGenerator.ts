import { Ticket, TicketMetadata, RefinementData, TicketGenerationResult, TicketType } from './types';
import { ProductOwnerLLMService } from './llmService';
import fs from 'fs';
import path from 'path';

const METADATA_PATH = path.join(process.cwd(), 'harness/tickets/metadata.json');
const ARCHIVE_PATH = path.join(process.cwd(), 'harness/tickets/archive.json');

export class TicketGenerator {
  private metadata: TicketMetadata;
  private llmService: ProductOwnerLLMService;

  constructor() {
    this.metadata = this.loadMetadata();
    this.llmService = new ProductOwnerLLMService();
  }

  private loadMetadata(): TicketMetadata {
    try {
      if (fs.existsSync(METADATA_PATH)) {
        const data = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
        return data;
      }
    } catch (error) {
      console.warn('No metadata found, creating new one');
    }

    return {
      nextId: 1,
      totalTickets: 0,
      lastTicketTime: new Date().toISOString(),
      createdTickets: [],
    };
  }

  private saveMetadata(): void {
    const dir = path.dirname(METADATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(METADATA_PATH, JSON.stringify(this.metadata, null, 2));
  }

  private generateId(): string {
    const id = `TASK-${String(this.metadata.nextId).padStart(3, '0')}`;
    this.metadata.nextId += 1;
    return id;
  }

  async estimateComplexity(refinement: RefinementData): Promise<number> {
    // Try LLM first if enabled
    if (this.llmService.isEnabled()) {
      try {
        return await this.llmService.estimateComplexity(refinement);
      } catch (error) {
        console.warn('LLM complexity estimation failed, falling back to heuristics');
      }
    }

    // Fallback to heuristics
    let complexity = 2;

    if (refinement.restrictions && refinement.restrictions.length > 0) complexity += 1;
    if (refinement.useCases && refinement.useCases.length > 2) complexity += 1;
    if (refinement.priority === 'critical') complexity += 1;

    return Math.min(complexity, 5);
  }

  private estimateSize(complexity: number, numRequirements: number): TicketType | 'xlarge' {
    if (complexity >= 4 && numRequirements >= 4) return 'xlarge';
    if (complexity >= 3 && numRequirements >= 3) return 'large';
    if (complexity >= 2) return 'medium';
    return 'small';
  }

  async createTicket(refinement: RefinementData, isSubtask: boolean = false): Promise<Ticket> {
    const id = this.generateId();
    const complexity = await this.estimateComplexity(refinement);
    const size = this.estimateSize(complexity, refinement.requirements?.length || 1);

    // Generate acceptance criteria with LLM if available
    let acceptanceCriteria = this.generateAcceptanceCriteria(refinement);
    if (this.llmService.isEnabled()) {
      try {
        const llmCriteria = await this.llmService.generateAcceptanceCriteria(refinement);
        if (llmCriteria.length > 0) {
          acceptanceCriteria = llmCriteria;
        }
      } catch (error) {
        console.warn('LLM acceptance criteria generation failed, using heuristics');
      }
    }

    return {
      id,
      type: 'feature',
      status: 'backlog',
      title: refinement.userRequest,
      description: `${refinement.userRequest}\n\nFunctionality: ${refinement.functionality || 'Not specified'}\nRestrictions: ${refinement.restrictions?.join(', ') || 'None'}`,
      requirements: refinement.requirements || [refinement.userRequest],
      acceptance_criteria: acceptanceCriteria,
      size: size as any,
      priority: refinement.priority || 'normal',
      complexity,
      story_points: complexity * 2,
      estimated_days: complexity,
      parent_epic: isSubtask ? undefined : null,
      subtasks: [],
      dependencies: [],
      blocked_by: null,
      rejection_reason: null,
      failure_reason: null,
      tags: refinement.tags || [],
      created_at: new Date().toISOString(),
      created_by: 'product-owner-agent',
      started_at: null,
      completed_at: null,
      assignee: null,
      reviewer: null,
    };
  }

  private generateAcceptanceCriteria(refinement: RefinementData): string[] {
    const criteria = [];
    if (refinement.useCases) {
      criteria.push(...refinement.useCases.map((uc) => `User can: ${uc}`));
    }
    criteria.push(`${refinement.userRequest} is implemented`);
    if (refinement.restrictions && refinement.restrictions.length > 0) {
      criteria.push(`Respects restrictions: ${refinement.restrictions.join(', ')}`);
    }
    return criteria;
  }

  async generateEpic(refinement: RefinementData, subtaskIds: string[]): Promise<Ticket> {
    const epicTicket = await this.createTicket(refinement);
    epicTicket.type = 'epic';
    epicTicket.size = 'xlarge';
    epicTicket.subtasks = subtaskIds;
    return epicTicket;
  }

  saveTicket(ticket: Ticket): void {
    this.metadata.totalTickets += 1;
    this.metadata.lastTicketTime = new Date().toISOString();
    this.metadata.createdTickets.push(ticket.id);

    const backlogPath = path.join(process.cwd(), 'harness/tickets/backlog.json');
    const dir = path.dirname(backlogPath);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let backlog = { tickets: [] };
    if (fs.existsSync(backlogPath)) {
      backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf-8'));
    }

    if (!Array.isArray(backlog.tickets)) backlog.tickets = [];
    backlog.tickets.push(ticket);

    fs.writeFileSync(backlogPath, JSON.stringify(backlog, null, 2));
    this.saveMetadata();
  }

  saveTickets(tickets: Ticket[]): void {
    tickets.forEach((ticket) => this.saveTicket(ticket));
  }

  archiveTicket(ticket: Ticket): void {
    const dir = path.dirname(ARCHIVE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let archive = { tickets: [] };
    if (fs.existsSync(ARCHIVE_PATH)) {
      archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf-8'));
    }

    if (!Array.isArray(archive.tickets)) archive.tickets = [];
    archive.tickets.push(ticket);

    fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
  }
}
