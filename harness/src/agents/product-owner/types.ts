export type TicketStatus = 'backlog' | 'in-progress' | 'done' | 'failed' | 'blocked' | 'rejected';
export type TicketType = 'feature' | 'bug' | 'refactor' | 'tech-debt' | 'epic';
export type TicketSize = 'small' | 'medium' | 'large' | 'xlarge';
export type TicketPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Ticket {
  id: string;
  type: TicketType;
  status: TicketStatus;
  title: string;
  description: string;
  requirements: string[];
  acceptance_criteria: string[];
  size: TicketSize;
  priority: TicketPriority;
  complexity: number;
  story_points: number;
  estimated_days: number;
  parent_epic: string | null;
  subtasks: string[];
  dependencies: string[];
  blocked_by: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  tags: string[];
  created_at: string;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  assignee: string | null;
  reviewer: string | null;
}

export interface TicketMetadata {
  nextId: number;
  totalTickets: number;
  lastTicketTime: string;
  createdTickets: string[];
}

export interface RefinementData {
  userRequest: string;
  functionality?: string;
  useCases?: string[];
  priority?: TicketPriority;
  restrictions?: string[];
  beneficiaries?: string[];
  complexity?: number;
}

export interface TicketGenerationResult {
  tickets: Ticket[];
  epicId?: string;
  shouldDivide: boolean;
  reasonForDivision?: string;
}
