import { ProductOwnerAgent } from '../agents/product-owner/agent';
import { TicketStateManager } from '../agents/product-owner/stateManager';
import { TicketStatus } from '../agents/product-owner/types';

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  const manager = new TicketStateManager();

  switch (command) {
    case 'create':
    case 'c': {
      const agent = new ProductOwnerAgent();
      await agent.start();
      break;
    }

    case 'list':
    case 'ls': {
      const status = args[1]?.replace('--status', '').trim() as TicketStatus;
      if (status) {
        const tickets = manager.listTicketsByStatus(status);
        console.log(`\n📋 Tickets en ${status} (${tickets.length}):`);
        if (tickets.length === 0) {
          console.log(`   No hay tickets en ${status}`);
        } else {
          tickets.forEach((t) => {
            console.log(
              `   ├─ ${t.id} ${t.title} [${t.priority}, ${t.size}]${t.parent_epic ? ` (subtask de ${t.parent_epic})` : ''}`
            );
          });
        }
      } else {
        const all = manager.listAllTickets();
        console.log('\n📋 TODOS LOS TICKETS:\n');
        all.forEach(({ status, tickets }) => {
          if (tickets.length > 0) {
            console.log(`${status.toUpperCase()} (${tickets.length}):`);
            tickets.forEach((t) => {
              const statusEmoji =
                status === 'done' ? '✅' : status === 'failed' ? '❌' : status === 'blocked' ? '🚫' : status === 'rejected' ? '⛔' : '⏳';
              console.log(
                `  ${statusEmoji} ${t.id} ${t.title} [${t.priority}, ${t.size}]${t.parent_epic ? ` (subtask)` : ''}`
              );
            });
            console.log();
          }
        });
      }
      break;
    }

    case 'details':
    case 'd': {
      const ticketId = args[1];
      if (!ticketId) {
        console.log('❌ Uso: npm run po:details -- TASK-001');
        break;
      }
      const ticket = manager.getTicket(ticketId);
      if (!ticket) {
        console.log(`❌ Ticket ${ticketId} no encontrado`);
      } else {
        console.log(`\n📋 DETALLES DE ${ticket.id}\n`);
        console.log(`Título: ${ticket.title}`);
        console.log(`Estado: ${ticket.status}`);
        console.log(`Tipo: ${ticket.type}`);
        console.log(`Prioridad: ${ticket.priority}`);
        console.log(`Tamaño: ${ticket.size}`);
        console.log(`Complejidad: ${ticket.complexity}/5`);
        console.log(`Story Points: ${ticket.story_points}`);
        console.log(`Días estimados: ${ticket.estimated_days}`);
        console.log(`\nDescripción:\n${ticket.description}`);
        if (ticket.requirements.length > 0) {
          console.log(`\nRequierements:`);
          ticket.requirements.forEach((r) => console.log(`  - ${r}`));
        }
        if (ticket.acceptance_criteria.length > 0) {
          console.log(`\nCriterios de Aceptación:`);
          ticket.acceptance_criteria.forEach((c) => console.log(`  - ${c}`));
        }
        if (ticket.subtasks.length > 0) {
          console.log(`\nSubtasks:`);
          ticket.subtasks.forEach((st) => console.log(`  - ${st}`));
        }
        if (ticket.dependencies.length > 0) {
          console.log(`\nDependencias:`);
          ticket.dependencies.forEach((d) => console.log(`  - ${d}`));
        }
      }
      break;
    }

    case 'move':
    case 'm': {
      const ticketId = args[1];
      const toStatus = args[2] as TicketStatus;
      const reason = args.slice(3).join(' ');

      if (!ticketId || !toStatus) {
        console.log('❌ Uso: npm run po:move -- TASK-001 done [--reason "Razón"]');
        break;
      }

      const ticket = manager.getTicket(ticketId);
      if (!ticket) {
        console.log(`❌ Ticket ${ticketId} no encontrado`);
        break;
      }

      if (!manager.hasValidTransition(ticket.status, toStatus)) {
        console.log(`❌ Transición no válida: ${ticket.status} → ${toStatus}`);
        break;
      }

      const success = manager.moveTicket(ticket.status, toStatus, ticketId, reason);
      if (success) {
        console.log(`✅ Ticket ${ticketId} movido de ${ticket.status} a ${toStatus}`);
        if (reason) {
          console.log(`   Razón: ${reason}`);
        }
      } else {
        console.log(`❌ Error al mover el ticket`);
      }
      break;
    }

    case 'stats': {
      const stats = manager.getStats();
      console.log(`\n📊 ESTADÍSTICAS\n`);
      console.log(`Total de tickets: ${stats.total}`);
      console.log(`\nPor estado:`);
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        if (count > 0) console.log(`  ${status}: ${count}`);
      });
      console.log(`\nPor prioridad:`);
      Object.entries(stats.byPriority).forEach(([priority, count]) => {
        if (count > 0) console.log(`  ${priority}: ${count}`);
      });
      console.log(`\nPor tamaño:`);
      Object.entries(stats.bySize).forEach(([size, count]) => {
        if (count > 0) console.log(`  ${size}: ${count}`);
      });
      break;
    }

    case 'help':
    case 'h': {
      console.log(`
🎯 PRODUCT OWNER AGENT - CLI

Comandos:
  po create          Crear nuevo ticket (loop interactivo)
  po list [--status STATE]  Listar tickets (por estado opcional)
  po details TASK-ID         Ver detalles de un ticket
  po move TASK-ID STATUS     Mover ticket entre estados
  po stats           Ver estadísticas
  po help            Mostrar esta ayuda

Estados válidos: backlog, in-progress, done, failed, blocked, rejected

Ejemplos:
  npm run po:create
  npm run po:list -- --status backlog
  npm run po:details -- TASK-001
  npm run po:move -- TASK-001 in-progress
  npm run po:move -- TASK-001 failed --reason "Error de compilación"
      `);
      break;
    }

    default: {
      console.log('❌ Comando no reconocido');
      console.log("Ejecuta 'npm run po:help' para ver los comandos disponibles");
    }
  }
}

main().catch(console.error);
