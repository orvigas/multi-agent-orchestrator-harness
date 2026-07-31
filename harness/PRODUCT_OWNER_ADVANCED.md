# 🚀 Product Owner Agent — Advanced Features

Documentación de características avanzadas: tests, token tracking, SQLite, integración con Harness.

---

## 📋 Tabla de Contenidos

1. [Tests Unitarios](#tests-unitarios)
2. [Token Tracking](#token-tracking)
3. [SQLite Persistence](#sqlite-persistence)
4. [Harness Integration](#harness-integration)
5. [Ejemplos Completos](#ejemplos-completos)

---

## 🧪 Tests Unitarios

### Ejecutar Tests

```bash
npm run po:test
```

### Cobertura de Tests

Tests implementados para:

#### TicketGenerator
- Generación de IDs únicos secuenciales
- Estimación de complejidad
- Generación de criterios de aceptación
- Estimación de tamaño
- Generación de épicas
- Persistencia de metadatos

#### TicketDivider
- Detección de tickets que deben dividirse
- Creación de épica + subtasks
- Creación automática de dependencias
- Herencia de propiedades de épica

#### TicketStateManager
- Validación de transiciones entre estados
- Registro de timestamps
- Grabación de razones (failure, blocked, rejection)
- Cálculo de estadísticas
- Manejo de múltiples estados

#### ProductOwnerLLMService
- Detección de modo LLM habilitado/deshabilitado
- Degradación elegante en modo deterministic
- Validación de rango de complejidad
- Generación de estructuras de criterios
- Análisis de división de tareas

### Ejecutar Test Específico

```bash
# Solo TicketGenerator
tsx --test src/agents/product-owner/ticketGenerator.test.ts

# Solo TicketDivider
tsx --test src/agents/product-owner/ticketDivider.test.ts

# Solo StateManager
tsx --test src/agents/product-owner/stateManager.test.ts

# Solo LLM Service
tsx --test src/agents/product-owner/llmService.test.ts
```

### Salida de Tests

```
✓ TicketGenerator
  ✓ should generate ticket with unique ID
  ✓ should generate sequential IDs
  ✓ should estimate complexity
  ✓ should generate acceptance criteria
  ✓ should estimate size based on complexity
  ✓ should create epic
  ✓ should save and persist metadata

✓ TicketDivider
  ✓ should detect xlarge tickets for division
  ✓ should not divide small tickets
  ✓ should return single ticket if no division needed
  ✓ should divide large ticket into epic + subtasks
  ✓ should create dependencies between subtasks
  ✓ should inherit epic properties to subtasks

✓ TicketStateManager
  ✓ should validate transitions
  ✓ should track timestamps on state change
  ✓ should record failure reasons
  ✓ should record blocked reasons
  ✓ should record rejection reasons
  ✓ should calculate statistics
  ✓ should track multiple states

✓ ProductOwnerLLMService
  ✓ should detect disabled LLM mode
  ✓ should handle graceful degradation on error
  ✓ should validate complexity range
  ✓ should generate acceptance criteria structure
  ✓ should analyze task division
  ✓ should generate refinement questions
```

---

## 💰 Token Tracking

Monitorea y rastrea el uso de tokens y costos de LLM.

### Uso

```typescript
import { TokenTracker } from './tokenTracker';

const tracker = new TokenTracker();

// Registrar uso
tracker.trackUsage({
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 1500,
  outputTokens: 500,
  role: 'ticket_generator',
});

// Obtener resumen
const summary = tracker.getSummary();
console.log(tracker.formatSummary(summary));

// Verificar presupuesto
const budget = tracker.checkBudget(500, 80);
if (!budget.isOk) {
  console.warn(`Budget exceeded: $${budget.costThisMonth} / $500`);
}
```

### Salida

```
📊 Token Usage Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Cost: $2.45
Tokens Used: 12.3K
Requests: 8

By Provider:
  anthropic: $2.45

By Model:
  claude-opus-5: $2.45

By Role:
  ticket_generator: $1.50
  requirement_refiner: $0.95
```

### Presupuesto

Configurar en `product-owner.yml`:

```yaml
budget:
  perSession: 2.00       # $ por sesión
  monthly: 500.00        # $ por mes
  warnAt: 80             # Advertencia al 80%
```

Verificar:

```typescript
const { isOk, percentageUsed, costThisMonth } = tracker.checkBudget(500, 80);

if (percentageUsed > 80) {
  console.warn(`⚠️  Budget warning: ${percentageUsed}% used this month`);
}
```

### Historial de Uso

```typescript
// Uso en últimas 2 horas
const recent = tracker.getUsageLastNHours(2);

// Uso este mes
const thisMonth = tracker.getUsageThisMonth();
```

---

## 💾 SQLite Persistence

Reemplaza JSON con SQLite para mejor rendimiento y consultas.

### Migrar de JSON a SQLite

```typescript
import { TicketDatabase } from './ticketDatabase';
import fs from 'fs';

// Leer tickets JSON
const jsonBacklog = JSON.parse(
  fs.readFileSync('harness/tickets/backlog.json', 'utf-8')
);

// Migrar a SQLite
const db = new TicketDatabase();
for (const ticket of jsonBacklog.tickets) {
  db.saveTicket(ticket);
}
db.close();
```

### Usar SQLite

```typescript
import { TicketDatabase } from './ticketDatabase';

const db = new TicketDatabase();

// Guardar ticket
db.saveTicket(ticket);

// Obtener ticket
const ticket = db.getTicket('TASK-001');

// Listar por estado
const done = db.getTicketsByStatus('done');

// Listar por prioridad
const critical = db.getTicketsByPriority('critical');

// Listar por tamaño
const small = db.getTicketsBySize('small');

// Obtener subtasks
const subtasks = db.getSubtasks('TASK-001');

// Estadísticas
const stats = db.getStats();
// {
//   total: 15,
//   byStatus: { backlog: 5, done: 8, failed: 2, blocked: 0, ... },
//   byPriority: { high: 8, normal: 5, low: 2 },
//   bySize: { small: 5, medium: 7, large: 2, xlarge: 1 }
// }

// Mover ticket entre estados
db.moveTicket('TASK-001', 'done');

// Cerrar conexión
db.close();
```

### Beneficios de SQLite

✅ **Mejor rendimiento**
- Queries indexadas
- Búsquedas O(log n) en lugar de O(n)

✅ **ACID compliance**
- Transacciones seguras
- No corrupción de datos

✅ **Consultas complejas**
- Filtros avanzados
- Agregaciones

✅ **Concurrencia**
- Múltiples lecturas simultáneas
- Escrituras serializadas

### Schema

```sql
CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  acceptance_criteria TEXT,
  size TEXT NOT NULL,
  priority TEXT NOT NULL,
  complexity INTEGER NOT NULL,
  story_points INTEGER NOT NULL,
  estimated_days INTEGER NOT NULL,
  parent_epic TEXT,
  subtasks TEXT,
  dependencies TEXT,
  blocked_by TEXT,
  rejection_reason TEXT,
  failure_reason TEXT,
  tags TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  assignee TEXT,
  reviewer TEXT,
  updated_at TEXT NOT NULL
);
```

---

## 🔗 Harness Integration

Integración completa con el Harness para ejecutar tickets automáticamente.

### Flujo Completo

```
1. User: npm run po:create
   └─ Genera tickets en SQLite

2. Harness: HARNESS_MODE=llm npm run dev
   └─ Lee tickets del backlog

3. Por cada ticket:
   ├─ Inicia ejecución (mueve a in-progress)
   ├─ Ejecuta workflow (Knowledge Engine → Implementation → Validation)
   ├─ Reporta resultado (success / failure / blocked)
   └─ Mueve a estado final (done / failed / blocked)

4. Harness Integration:
   └─ Tracking automático
   └─ Dependencias
   └─ Priorización
   └─ Estadísticas
```

### Uso

```typescript
import { HarnessIntegration } from './harnessIntegration';

const harness = new HarnessIntegration();

// Obtener tickets listos para ejecutar
const backlog = harness.getBacklogTickets();

for (const ticket of backlog) {
  // Verificar dependencias
  if (!harness.areDependenciesMet(ticket.id)) {
    const blocking = harness.getBlockingTickets(ticket.id);
    console.log(`Ticket ${ticket.id} bloqueado por: ${blocking.join(', ')}`);
    continue;
  }

  // Iniciar ejecución
  harness.startExecution(ticket.id);

  try {
    // Ejecutar ticket (aquí iría lógica del Harness)
    const result = await executeTicket(ticket);

    if (result.success) {
      harness.reportSuccess(ticket.id);
    } else {
      harness.reportFailure(ticket.id, result.error);
    }
  } catch (error) {
    harness.reportFailure(ticket.id, `Execution failed: ${error}`);
  }
}

// Ver resumen
const summary = harness.getExecutionSummary();
console.log(`Done: ${summary.done}/${summary.total}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);

// Exportar logs
const csvLog = harness.exportExecutionLog('csv');
fs.writeFileSync('execution-log.csv', csvLog);

harness.close();
```

### Recomendaciones Inteligentes

```typescript
// Obtener siguientes tickets a ejecutar (priorizados)
const nextTickets = harness.getNextTickets(5);

// Ordenados por:
// 1. Prioridad (critical > high > normal > low)
// 2. Tamaño (small < medium < large < xlarge)
// 3. Complejidad (menor primero)

nextTickets.forEach((ticket, index) => {
  console.log(`${index + 1}. ${ticket.id}: ${ticket.title}`);
  console.log(`   Priority: ${ticket.priority}, Size: ${ticket.size}, Complexity: ${ticket.complexity}`);
});
```

### Estadísticas en Tiempo Real

```typescript
const summary = harness.getExecutionSummary();

console.log(`
Total:      ${summary.total}
Done:       ${summary.done} ✅
Failed:     ${summary.failed} ❌
Blocked:    ${summary.blocked} 🚫
In Progress: ${summary.inProgress} ⏳
Backlog:    ${summary.backlog}

Success Rate: ${(summary.successRate * 100).toFixed(1)}%
`);
```

---

## 📊 Ejemplos Completos

### Ejemplo 1: Crear Tickets con LLM y Rastrear Costos

```bash
# 1. Crear tickets con LLM
PO_MODE=llm npm run po:create

# 2. Ver token usage
npm run po:stats

# 3. Output
# Total Cost: $2.34
# Tokens Used: 11.5K
# Requests: 3
```

### Ejemplo 2: Ejecutar con Harness e Integración

```bash
# 1. Generar tickets
npm run po:create

# 2. Ejecutar harness
HARNESS_MODE=llm npm run dev

# 3. Ver resultados
npm run po:list

# 4. Output
# BACKLOG: 0
# DONE: 12 ✅
# FAILED: 1 ❌
# BLOCKED: 2 🚫
```

### Ejemplo 3: Ejecutar Tests

```bash
# 1. Ejecutar todos los tests
npm run po:test

# 2. Output
# ✓ TicketGenerator (7 tests)
# ✓ TicketDivider (6 tests)
# ✓ TicketStateManager (7 tests)
# ✓ ProductOwnerLLMService (6 tests)
# 
# Total: 26 tests passed
```

---

## 📚 Archivos Relacionados

- `ticketDatabase.ts` — SQLite persistence
- `tokenTracker.ts` — Token usage tracking
- `harnessIntegration.ts` — Harness integration
- `ticketGenerator.test.ts` — Generator tests
- `ticketDivider.test.ts` — Divider tests
- `stateManager.test.ts` — State tests
- `llmService.test.ts` — LLM tests

---

## ✅ Checklist de Implementación

- [x] Tests unitarios (4 suites, 26 tests)
- [x] Token tracking con presupuesto
- [x] SQLite persistence
- [x] Harness integration
- [x] Documentación completa

---

**Versión:** 1.2  
**Status:** ✅ Production Ready  
**Última actualización:** 2026-07-30
