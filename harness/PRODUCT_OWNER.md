# 🎯 Product Owner Agent — Complete Guide

**Gestión interactiva de tickets con loop Q&A, LLM configuración, tests, y SQLite.**

---

## 📋 Quick Start (5 minutos)

```bash
# 1. Crear tickets con loop interactivo
cd harness && npm run po:create

# 2. Ver tickets
npm run po:list

# 3. Ejecutar con harness
HARNESS_MODE=llm npm run dev

# 4. Ver estadísticas
npm run po:stats
```

---

## 🎯 Core Features

### Loop Interactivo (5 Phases)
1. **Captura** - ¿Qué quieres hacer?
2. **Refinamiento** - Preguntas adaptativas
3. **Análisis** - Detección de complejidad
4. **Generación** - Creación de tickets
5. **Confirmación** - Guardar en backlog

### Generación de Tickets
- IDs únicos: TASK-001, TASK-002...
- Estimación automática: complejidad, story points, días
- División automática: épica + subtasks para tasks grandes
- Criterios de aceptación generados

### 6 Estados de Tickets
```
backlog → in-progress → done ✅
                     ↘ failed ❌
                     ↘ blocked 🚫
                     ↘ rejected ⛔
```

### CLI (6 Comandos)
```bash
npm run po:create              # Crear (interactivo)
npm run po:list [--status X]   # Listar
npm run po:details -- TASK-001 # Detalles
npm run po:move -- TASK-001 X  # Cambiar estado
npm run po:stats               # Estadísticas
npm run po:help                # Ayuda
```

---

## ⚙️ LLM Configuration

### Modos
- **Deterministic** (defecto): Sin costo, heurísticas, rápido
- **LLM**: Con Claude, refinamiento inteligente, criterios mejorados

### Activar LLM
```bash
echo "ANTHROPIC_API_KEY=sk-ant-v0-..." >> harness/.env
PO_MODE=llm npm run po:create
```

### Proveedores Soportados
- **Anthropic**: claude-opus-5 (mejor), sonnet-5 (balance), haiku (barato)
- **OpenAI**: gpt-4o, gpt-3.5-turbo
- **OpenRouter**: multi-proveedor

### Configuración (harness/config/product-owner.yml)
```yaml
roles:
  ticket_generator:
    provider: anthropic
    model: claude-opus-5
    maxTokens: 2048

budget:
  perSession: 2.00       # $ por sesión
  monthly: 500.00        # $ por mes

features:
  llmRefinement: true
  llmAcceptanceCriteria: true
  llmComplexityAnalysis: true
```

---

## 🧪 Tests & Monitoring

### Ejecutar Tests (26 tests)
```bash
npm run po:test
```

Tests incluyen:
- TicketGenerator (7): IDs, complejidad, criterios, épicas
- TicketDivider (6): Detección, división, dependencias
- TicketStateManager (7): Transiciones, timestamps, razones
- ProductOwnerLLMService (6): Modo, degradación, validación

### Token Tracking
```typescript
import { TokenTracker } from './tokenTracker';

const tracker = new TokenTracker();
tracker.trackUsage({
  provider: 'anthropic',
  model: 'claude-opus-5',
  inputTokens: 1500,
  outputTokens: 500,
  role: 'ticket_generator',
});

console.log(tracker.formatSummary(tracker.getSummary()));
```

### Budget Checking
```typescript
const { isOk, percentageUsed, costThisMonth } = 
  tracker.checkBudget(500, 80);

if (!isOk) console.warn(`Over budget: $${costThisMonth}`);
```

---

## 💾 SQLite Persistence

### Estructura
```
harness/tickets/
├── tickets.db          ← SQLite database
├── token-tracking.json ← LLM usage tracking
└── metadata.json       ← IDs + contador
```

### Métodos
```typescript
import { TicketDatabase } from './ticketDatabase';

const db = new TicketDatabase();

// Guardar/obtener
db.saveTicket(ticket);
const ticket = db.getTicket('TASK-001');

// Listar
const done = db.getTicketsByStatus('done');
const urgent = db.getTicketsByPriority('critical');

// Estadísticas
const stats = db.getStats();
// { total, byStatus, byPriority, bySize }

db.moveTicket('TASK-001', 'done');
db.close();
```

### Beneficios vs JSON
- Queries indexadas (O(log n) vs O(n))
- ACID compliance con WAL mode
- Soporte para concurrencia
- Mejor rendimiento con datos grandes

---

## 🔗 Harness Integration

### Flujo Automático
1. Usuario: `npm run po:create` → genera tickets en SQLite
2. Harness: `npm run dev` → lee backlog
3. Harness ejecuta cada ticket → reporta resultado
4. Agent mueve automáticamente al estado correcto

### Métodos de Integración
```typescript
import { HarnessIntegration } from './harnessIntegration';

const harness = new HarnessIntegration();

// Obtener tickets
const backlog = harness.getBacklogTickets();
const next = harness.getNextTickets(5);  // Priorizados

// Ejecutar
for (const ticket of next) {
  harness.startExecution(ticket.id);
  try {
    await executeTicket(ticket);
    harness.reportSuccess(ticket.id);
  } catch (error) {
    harness.reportFailure(ticket.id, error.message);
  }
}

// Estadísticas
const summary = harness.getExecutionSummary();
console.log(`Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);

// Exportar logs
const csv = harness.exportExecutionLog('csv');
fs.writeFileSync('execution-log.csv', csv);

harness.close();
```

### Priorización Automática
1. Priority: critical > high > normal > low
2. Size: small < medium < large < xlarge
3. Complexity: menor primero

---

## 📊 Estructura de Tickets

Cada ticket contiene:
```json
{
  "id": "TASK-001",
  "type": "feature|bug|epic",
  "status": "backlog|in-progress|done|failed|blocked|rejected",
  "title": "string",
  "description": "string",
  "requirements": ["req1", "req2"],
  "acceptance_criteria": ["criteria1"],
  "size": "small|medium|large|xlarge",
  "priority": "low|normal|high|critical",
  "complexity": 1-5,
  "story_points": number,
  "estimated_days": number,
  "parent_epic": "TASK-XXX | null",
  "subtasks": ["TASK-YYY"],
  "dependencies": ["TASK-ZZZ"],
  "failure_reason": "string | null",
  "blocked_by": "string | null",
  "rejection_reason": "string | null",
  "created_at": "ISO 8601",
  "started_at": "ISO 8601 | null",
  "completed_at": "ISO 8601 | null"
}
```

---

## 🔧 Arquitectura

### Componentes Principales
- **ProductOwnerAgent** - Loop interactivo Q&A
- **TicketGenerator** - Creación con IDs únicos
- **TicketDivider** - División automática de tasks
- **TicketStateManager** - Gestión de 6 estados
- **TicketDatabase** - Persistencia SQLite
- **TokenTracker** - Monitoreo de LLM costs
- **HarnessIntegration** - Integración con harness
- **ProductOwnerLLMService** - Configuración LLM

### CLI Scripts
- `po-cli.ts` - Interfaz CLI con 6 comandos

### Tests
- `*.test.ts` - 26 tests unitarios (4 suites)

---

## 📈 Ejemplos

### Ejemplo 1: Crear Tickets
```bash
$ npm run po:create

❓ ¿Qué quieres hacer?
> Agregar login con Google OAuth

❓ ¿Para qué funcionalidad?
> Módulo de autenticación

[continúa con refinamiento...]

✅ Tickets creados: TASK-001 (épica), TASK-002, TASK-003, TASK-004 (subtasks)
```

### Ejemplo 2: Ejecutar con LLM
```bash
$ PO_MODE=llm npm run po:create

El agent usa Claude para:
- Generar preguntas de refinamiento más inteligentes
- Crear criterios de aceptación con BDD/Gherkin
- Estimar complejidad contextualmente
- Sugerir división de tareas inteligente

Costo estimado: $0.50-$2.00 por ticket
```

### Ejemplo 3: Monitorear Ejecución
```bash
$ npm run po:list
BACKLOG: 4 ⏳
DONE: 2 ✅
FAILED: 1 ❌
BLOCKED: 1 🚫

$ npm run po:stats
Total Cost: $3.45
Tokens Used: 12.3K
Success Rate: 66.7%
```

---

## ✅ Checklist de Uso

- [ ] Configurar ANTHROPIC_API_KEY en .env (opcional)
- [ ] Ejecutar: `npm run po:create`
- [ ] Responder preguntas interactivamente
- [ ] Revisar tickets: `npm run po:list`
- [ ] Ejecutar harness: `npm run dev`
- [ ] Ver resultados: `npm run po:list`
- [ ] Ver estadísticas: `npm run po:stats`

---

## 📚 Archivos Relacionados

- `.claude/CLAUDE.md` - Instrucciones del harness
- `harness/README.md` - Setup del harness
- `harness/SETUP_WIZARD.md` - Configuración automática
- `harness/config/product-owner.yml` - Configuración PO Agent

---

## 🚀 Resumen

**Product Owner Agent** es un sistema completo para:
✅ Capturar requerimientos interactivamente  
✅ Generar tickets con IDs únicos  
✅ Dividir tasks grandes automáticamente  
✅ Gestionar 6 estados de tickets  
✅ Usar LLM para refinamiento inteligente  
✅ Rastrear costos de tokens  
✅ Persistir en SQLite  
✅ Integrar con harness  
✅26 tests unitarios  

**Status:** ✅ Production Ready v1.2

---

**Version:** 1.2  
**Last Updated:** 2026-07-30
