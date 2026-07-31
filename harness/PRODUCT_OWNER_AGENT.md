# 🎯 Product Owner Agent — Gestión Interactiva de Tickets

**Agent especializado para capturar requerimientos, crear tickets y gestionar su ciclo de vida**

---

## 📋 Tabla de Contenidos

1. [Quick Start](#quick-start)
2. [Características](#características)
3. [Uso desde CLI](#uso-desde-cli)
4. [Sistema de Estados](#sistema-de-estados)
5. [División Automática de Tasks](#división-automática-de-tasks)
6. [Ejemplos Prácticos](#ejemplos-prácticos)
7. [Integración con Harness](#integración-con-harness)

---

## ⚡ Quick Start

### Crear un Nuevo Ticket (Loop Interactivo)

```bash
npm run po:create
```

El agent te hará preguntas paso a paso:

1. **Phase 1**: ¿Qué quieres hacer?
2. **Phase 2**: Refinamiento (preguntas adaptativas)
3. **Phase 3**: Análisis de complejidad
4. **Phase 4**: Generación de tickets (posiblemente dividido en épica + subtasks)
5. **Phase 5**: Confirmación y guardado

### Listar Tickets

```bash
npm run po:list                    # Todos los tickets
npm run po:list -- --status backlog # Solo tickets en backlog
npm run po:list -- --status done   # Solo tickets completados
```

### Mover Tickets entre Estados

```bash
npm run po:move -- TASK-001 in-progress
npm run po:move -- TASK-001 done
npm run po:move -- TASK-001 failed --reason "Error de compilación"
npm run po:move -- TASK-001 blocked --reason "Esperando API externa"
```

---

## ✨ Características

### 1. Loop Interactivo de Preguntas

El agent realiza un refinamiento iterativo:

```
Q: ¿Qué quieres hacer?
A: Agregar login con Google OAuth

Q: ¿Para qué funcionalidad?
A: Módulo de autenticación

Q: ¿Cuáles son los casos de uso?
A: Usuarios pueden hacer login, signup con Google

Q: ¿Cuál es la prioridad?
A: Alta

Q: ¿Hay restricciones?
A: Debe reutilizar JWT existente
```

### 2. Generación Automática de Tickets

Cada ticket incluye:

- **ID único**: TASK-001, TASK-002, etc.
- **Title**: Descripción clara
- **Description**: Detalle completo
- **Requirements**: Lista de requisitos
- **Acceptance Criteria**: Criterios de aceptación generados automáticamente
- **Size**: small, medium, large, xlarge
- **Priority**: low, normal, high, critical
- **Complexity**: Escala 1-5 calculada automáticamente
- **Story Points**: Estimación automática
- **Estimated Days**: Días estimados
- **Tags**: Clasificación automática
- **Timestamps**: Creación y completación

### 3. División Automática de Tasks Grandes

Si un ticket es muy grande (xlarge):

```
✓ Detectado: Task es GRANDE (xlarge)
✓ Sugerencia: Dividir en épica + 3 user stories

¿Quieres dividir esto en tareas menores?
> sí

Creando épica: TASK-001
Creando subtask: TASK-002 (Setup & Configuration)
Creando subtask: TASK-003 (Core Implementation)
Creando subtask: TASK-004 (Integration & Testing)
```

La épica mantiene referencias a sus subtasks:
- Subtasks tienen `parent_epic` apuntando a la épica
- Épica tiene `subtasks` listando todos sus hijos
- Se crean dependencias entre subtasks automáticamente

### 4. Sistema de Estados Completo

```
backlog ──→ in-progress ──→ done
   ↓            ↓
rejected      failed ──→ blocked ──→ in-progress
   ↑                        ↓
   └────────────────────────┘
```

Transiciones válidas:
- **backlog**: → in-progress, rejected
- **in-progress**: → done, failed, blocked, rejected
- **done**: → blocked, rejected
- **failed**: → blocked, in-progress
- **blocked**: → in-progress, rejected
- **rejected**: → backlog

### 5. Gestión de Razones

Para transiciones que requieren justificación:

```bash
npm run po:move -- TASK-001 failed --reason "JWT token mismatch in payload"
npm run po:move -- TASK-001 blocked --reason "Waiting for API keys"
npm run po:move -- TASK-001 rejected --reason "Out of scope"
```

---

## 🚀 Uso desde CLI

### Crear Tickets

```bash
# Lanza el agent interactivo
npm run po:create

# Responde las preguntas
# El agent divide si es necesario
# Confirma y guarda
```

### Listar y Filtrar

```bash
# Todos los tickets (resumen por estado)
npm run po:list

# Solo tickets en backlog (listos para ejecutar)
npm run po:list -- --status backlog

# Tickets completados
npm run po:list -- --status done

# Tickets fallidos
npm run po:list -- --status failed

# Tickets bloqueados
npm run po:list -- --status blocked
```

### Ver Detalles

```bash
npm run po:details -- TASK-001
```

Muestra:
- Información completa del ticket
- Requirements y acceptance criteria
- Subtasks (si es épica)
- Dependencias
- Razones de fallo/bloqueo/rechazo

### Transicionar Estados

```bash
# Mover a in-progress
npm run po:move -- TASK-001 in-progress

# Completar
npm run po:move -- TASK-001 done

# Falló con razón
npm run po:move -- TASK-001 failed --reason "Error de compilación"

# Bloqueado
npm run po:move -- TASK-001 blocked --reason "Esperando dependencia externa"

# Rechazar
npm run po:move -- TASK-001 rejected --reason "Fuera de scope"
```

### Ver Estadísticas

```bash
npm run po:stats
```

Output:
```
📊 ESTADÍSTICAS

Total de tickets: 15

Por estado:
  backlog: 8
  in-progress: 2
  done: 4
  failed: 1

Por prioridad:
  high: 6
  normal: 7
  low: 2

Por tamaño:
  small: 5
  medium: 7
  large: 2
  xlarge: 1
```

### Ver Ayuda

```bash
npm run po:help
```

---

## 📊 Sistema de Estados

### Estructura de Archivos

```
harness/tickets/
├── backlog.json       ← Tickets listos para ejecutar
├── in-progress.json   ← En ejecución
├── done.json          ← Completados
├── failed.json        ← Fallidos (con razón)
├── blocked.json       ← Bloqueados (con razón)
├── rejected.json      ← Rechazados (con razón)
├── archive.json       ← Histórico completo
└── metadata.json      ← IDs, contador, auditoría
```

### Estructura de un Ticket

```json
{
  "id": "TASK-001",
  "type": "epic",
  "status": "backlog",
  "title": "Google OAuth Implementation",
  "description": "Implement OAuth2 flow...",
  "requirements": [
    "Setup OAuth endpoint",
    "Handle token exchange",
    "Store refresh tokens"
  ],
  "acceptance_criteria": [
    "Users can login with Google",
    "Token refresh works automatically",
    "Respects restrictions: JWT reutilization"
  ],
  "size": "xlarge",
  "priority": "high",
  "complexity": 4,
  "story_points": 8,
  "estimated_days": 4,
  "parent_epic": null,
  "subtasks": ["TASK-002", "TASK-003", "TASK-004"],
  "dependencies": [],
  "blocked_by": null,
  "rejection_reason": null,
  "failure_reason": null,
  "tags": ["auth", "oauth", "google"],
  "created_at": "2026-07-30T20:30:00Z",
  "created_by": "product-owner-agent",
  "started_at": null,
  "completed_at": null
}
```

---

## 🔀 División Automática de Tasks

### Cuándo se Divide

Un ticket se divide automáticamente si:

- Es muy complejo: `complexity >= 4` Y más de 4 requisitos
- O está explícitamente marcado como `xlarge`

### Cómo se Divide

1. El agent crea una **épica** con el título original
2. Divide en **4 user stories** máximo:
   - Setup & Configuration
   - Core Implementation
   - Integration & Testing
   - Documentation & Review
3. Cada subtask hereda:
   - Prioridad de la épica
   - Restricciones de la épica
   - Tags de la épica
4. Las subtasks pueden tener dependencias secuenciales

### Ejemplo de División

```
Usuario: "Agregar login con Google OAuth"
│
├─ Detecta: xlarge (4 requisitos + complejidad 4)
│
├─ Crea: TASK-001 [EPIC] Google OAuth Implementation
│   └─ Subtasks:
│       ├─ TASK-002 Setup Google OAuth Endpoint
│       ├─ TASK-003 Token Management & Refresh
│       └─ TASK-004 Integration with Existing JWT
│
└─ Relaciones:
    ├─ TASK-002 → (sin dependencias)
    ├─ TASK-003 → depende de TASK-002
    └─ TASK-004 → depende de TASK-003
```

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Feature Simple

```bash
$ npm run po:create

¿Qué quieres hacer?
> Agregar botón de logout

¿Para qué funcionalidad?
> Módulo de autenticación

¿Cuáles son los casos de uso específicos?
> Usuario puede hacer logout

¿Cuál es la prioridad?
> normal

¿Hay restricciones o dependencias?
> Presionar Enter (no)

[...]

✓ Detectado: Task es pequeño (small)

RESUMEN:
  TASK-001 Agregar botón de logout (normal, small)

¿Aprobar estos tickets?
> sí

✅ Tickets creados exitosamente
```

### Ejemplo 2: Feature Grande (Dividida)

```bash
$ npm run po:create

¿Qué quieres hacer?
> Implementar sistema de pagos con Stripe

¿Para qué funcionalidad?
> Sistema de checkout

¿Cuáles son los casos de uso específicos?
> Usuario puede agregar tarjeta, Usuario puede hacer pago, Admin ve reportes de transacciones

¿Cuál es la prioridad?
> critical

¿Hay restricciones?
> PCI compliance, No guardar números de tarjeta en BD

[...]

✓ Detectado: Task es GRANDE (xlarge)
✓ Sugerencia: Dividir en épica + 3 user stories

¿Quieres dividir esto en tareas menores?
> sí

Creando épica: TASK-001
Creando subtask: TASK-002 (Setup & Configuration)
Creando subtask: TASK-003 (Core Implementation)
Creando subtask: TASK-004 (Integration & Testing)

RESUMEN:
  TASK-001 [EPIC] Implementar sistema de pagos con Stripe
    ├─ TASK-002 Setup & Configuration
    ├─ TASK-003 Core Implementation
    └─ TASK-004 Integration & Testing

¿Aprobar estos tickets?
> sí

✅ Tickets creados exitosamente
```

### Ejemplo 3: Ciclo de Vida Completo

```bash
# 1. Crear ticket
$ npm run po:create
  > Ticket TASK-005 creado en backlog

# 2. Ver en backlog
$ npm run po:list -- --status backlog
  ├─ TASK-005 Mi feature (high, medium)

# 3. Harness lo ejecuta
$ npm run dev
  [Harness procesa TASK-005...]

# 4. Reporta éxito
# 5. Mover a done
$ npm run po:move -- TASK-005 done
  ✅ Ticket TASK-005 movido de in-progress a done

# 6. Ver completado
$ npm run po:list -- --status done
  ✅ TASK-005 Mi feature [high, medium]

# 7. Ver estadísticas
$ npm run po:stats
  Total: 15
  Backlog: 7, Done: 5, Failed: 1, Blocked: 2
```

---

## 🔄 Integración con Harness

### Flujo Completo

```
1. Usuario ejecuta: npm run po:create
   └─ Agent crea tickets en harness/tickets/backlog.json

2. Harness lee backlog
   └─ npm run dev

3. Para cada ticket en backlog:
   ├─ Harness mueve a in-progress
   ├─ Ejecuta: Knowledge Engine → Planner → Implementation → Validation
   └─ Resultado: done / failed / blocked

4. Harness reporta resultado
   └─ Agent mueve ticket al estado correcto
      ├─ Si éxito: → done
      ├─ Si error: → failed + failure_reason
      └─ Si dependencia: → blocked + blocked_by

5. Usuario ve estado actualizado
   └─ npm run po:list
```

### Backlog Format

El harness espera tickets en este formato en `harness/tickets/backlog.json`:

```json
{
  "tickets": [
    {
      "id": "TASK-001",
      "type": "feature",
      "title": "Implement feature X",
      "description": "...",
      "requirements": ["...", "..."],
      "priority": "high",
      "size": "medium",
      ...
    }
  ]
}
```

El agent product owner genera exactamente este formato automáticamente.

---

## 🔧 Configuración Avanzada

### Ubicación de Tickets

Por defecto, los tickets se guardan en:
```
harness/tickets/
```

Para cambiar, edita las rutas en:
- `src/agents/product-owner/ticketGenerator.ts`
- `src/agents/product-owner/stateManager.ts`

### Personalizar Preguntas

Edita `src/agents/product-owner/questions.ts`:

```typescript
export const REFINEMENT_QUESTIONS = [
  {
    id: 'custom_question',
    text: 'Tu pregunta aquí',
    hint: 'Sugerencia',
    optional: true,
  },
  // ... más preguntas
];
```

### Estimaciones Personalizadas

Edita la lógica en `ticketGenerator.ts`:

```typescript
private estimateComplexity(refinement: RefinementData): number {
  // Tu lógica personalizada aquí
}
```

---

## 📚 Ficheros del Agent

```
harness/src/agents/product-owner/
├── agent.ts              # Loop interactivo principal
├── ticketGenerator.ts    # Generación de tickets
├── ticketDivider.ts      # División de tasks grandes
├── stateManager.ts       # Gestión de estados
├── types.ts              # Tipos TypeScript
└── questions.ts          # Preguntas del loop

harness/src/scripts/
└── po-cli.ts             # CLI de gestión
```

---

## ✅ Checklist de Uso

- [ ] Ejecutar `npm install` en harness/
- [ ] Crear directorio: `mkdir -p harness/tickets`
- [ ] Ejecutar: `npm run po:create`
- [ ] Responder preguntas interactivamente
- [ ] Aprobar y guardar tickets
- [ ] Ver tickets: `npm run po:list`
- [ ] Ejecutar harness: `npm run dev`
- [ ] Mover tickets entre estados: `npm run po:move`
- [ ] Ver estadísticas: `npm run po:stats`

---

## 🎯 Resumen

El **Product Owner Agent** es un sistema completo para:

✅ Capturar requerimientos interactivamente  
✅ Crear tickets automáticamente numerados  
✅ Dividir tasks grandes en épicas + subtasks  
✅ Gestionar estados de tickets  
✅ Integrar con harness para ejecución automática  
✅ Auditoría completa de cambios  

**¡Listo para usar! Comienza con `npm run po:create`**

---

**Created:** 2026-07-30  
**Version:** 1.0  
**Status:** Production Ready
