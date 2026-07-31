import * as readline from 'readline';
import { RefinementData, TicketGenerationResult, TicketPriority } from './types';
import { TicketGenerator } from './ticketGenerator';
import { TicketDivider } from './ticketDivider';
import { REFINEMENT_QUESTIONS, CONFIRMATION_QUESTIONS, formatQuestion, formatConfirmation } from './questions';

export class ProductOwnerAgent {
  private rl: readline.Interface;
  private generator: TicketGenerator;
  private divider: TicketDivider;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.generator = new TicketGenerator();
    this.divider = new TicketDivider();
  }

  async start(): Promise<void> {
    console.log('\n╭─────────────────────────────────────────────────────────────────╮');
    console.log('│                    🎯 PRODUCT OWNER AGENT                      │');
    console.log('│              Crea tickets mediante Q&A interactivo              │');
    console.log('╰─────────────────────────────────────────────────────────────────╯\n');

    try {
      const userRequest = await this.question('\nPhase 1: CAPTURA INICIAL\n──────────────────────────────────────────────────────\n❓ ¿Qué quieres hacer?\n> ');

      if (!userRequest.trim()) {
        console.log('❌ Debes ingresar una descripción de lo que quieres hacer');
        return;
      }

      console.log('\nPhase 2: REFINAMIENTO\n──────────────────────────────────────────────────────');

      const refinement: RefinementData = {
        userRequest: userRequest.trim(),
      };

      for (const q of REFINEMENT_QUESTIONS) {
        const answer = await this.question(formatQuestion(q));
        if (answer.trim()) {
          if (q.id === 'useCases') {
            refinement.useCases = answer.split(',').map((uc) => uc.trim());
          } else if (q.id === 'restrictions') {
            refinement.restrictions = answer.split(',').map((r) => r.trim());
          } else if (q.id === 'priority') {
            refinement.priority = answer.toLowerCase() as TicketPriority;
          } else {
            (refinement as any)[q.id] = answer.trim();
          }
        }
      }

      refinement.requirements = refinement.useCases || [refinement.userRequest];
      refinement.tags = refinement.functionality ? [refinement.functionality.toLowerCase()] : [];
      refinement.complexity = refinement.restrictions ? refinement.restrictions.length : 2;

      console.log('\nPhase 3: ANÁLISIS DE COMPLEJIDAD\n──────────────────────────────────────────────────────');

      const initialTicket = await this.generator.createTicket(refinement);
      const shouldDivide = this.divider.shouldDivide(initialTicket);

      if (shouldDivide) {
        console.log('✓ Detectado: Task es GRANDE (xlarge)');
        console.log('✓ Sugerencia: Dividir en épica + user stories');

        const divideAnswer = await this.question(formatConfirmation(CONFIRMATION_QUESTIONS[0]));
        if (divideAnswer.toLowerCase().startsWith('s')) {
          console.log('\nPhase 4: DIVISIÓN DE TAREAS\n──────────────────────────────────────────────────────');
          const tickets = await this.divider.divideTicket(initialTicket, refinement);
          await this.confirmAndSave(tickets);
          return;
        }
      }

      console.log('\nPhase 4: GENERACIÓN DE TICKETS\n──────────────────────────────────────────────────────');
      console.log('✓ Creando ticket: ' + initialTicket.id);

      await this.confirmAndSave([initialTicket]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      this.rl.close();
    }
  }

  private async confirmAndSave(tickets: any[]): Promise<void> {
    console.log('\nPhase 5: CONFIRMACIÓN\n──────────────────────────────────────────────────────');
    console.log('📋 RESUMEN DE TICKETS CREADOS:\n');

    const epic = tickets.find((t) => t.type === 'epic');
    const subtasks = tickets.filter((t) => t.type !== 'epic');

    if (epic) {
      console.log(`${epic.id} [EPIC] ${epic.title}`);
      console.log(`  └─ Prioridad: ${epic.priority}`);
      console.log(`  └─ Tamaño: ${epic.size}`);
      if (subtasks.length > 0) {
        subtasks.forEach((st: any) => {
          console.log(`    ${st.id} ${st.title} (${st.priority}, ${st.size})`);
        });
      }
    } else {
      tickets.forEach((t: any) => {
        console.log(`${t.id} ${t.title} (${t.priority}, ${t.size})`);
      });
    }

    const approveAnswer = await this.question(formatConfirmation(CONFIRMATION_QUESTIONS[1]));

    if (approveAnswer.toLowerCase().startsWith('s')) {
      this.generator.saveTickets(tickets);
      console.log('\n✅ Tickets creados exitosamente y movidos a backlog/');
      console.log(`📊 Total de tickets creados: ${tickets.length}`);
      console.log(`\nExecuta 'npm run po:list' para ver los tickets en backlog`);
    } else {
      console.log('❌ Operación cancelada');
    }
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  close(): void {
    this.rl.close();
  }
}
