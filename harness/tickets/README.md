# 📋 Tickets Directory

Este directorio contiene todos los tickets gestionados por el **Product Owner Agent**.

## 📁 Estructura de Archivos

```
tickets/
├── backlog.json        ← Tickets listos para ejecutar por Harness
├── in-progress.json    ← Tickets actualmente en ejecución
├── done.json           ← Tickets completados exitosamente ✅
├── failed.json         ← Tickets que fallaron ❌
├── blocked.json        ← Tickets bloqueados 🚫
├── rejected.json       ← Tickets rechazados ⛔
├── archive.json        ← Histórico completo de todos los tickets
└── metadata.json       ← IDs, contador, auditoría
```

## 📊 Estados de Tickets

### backlog.json
Tickets listos para ser ejecutados por el Harness.

**Uso:**
- Harness lee este archivo
- Para cada ticket, ejecuta el orquestador
- Mueve a `in-progress.json` al empezar
- Mueve al estado final (done/failed/blocked) al terminar

### in-progress.json
Tickets actualmente siendo procesados por Harness.

**Nota:** Generalmente vacío entre ejecutiones del Harness.

### done.json
Tickets completados exitosamente.

**Incluye:**
- `completed_at`: Timestamp de completación
- Todos los detalles del ticket
- Sin razones de error

### failed.json
Tickets que fallaron durante ejecución.

**Incluye:**
- `failure_reason`: Descripción del error
- Stack trace o detalles del fallo
- Pasos para recuperación (si los hay)

### blocked.json
Tickets bloqueados por dependencias externas.

**Incluye:**
- `blocked_by`: Razón del bloqueo
- ID de ticket(s) que bloquean
- Cuándo se desbloquearon (si aplica)

### rejected.json
Tickets rechazados (fuera de scope, no prioritarios, etc).

**Incluye:**
- `rejection_reason`: Por qué fue rechazado
- Quién lo rechazó
- Cuándo puede reconsi derarse

## 📚 Ejemplos

Los archivos `example-*.json` contienen ejemplos de estructura para cada estado.

Para entender el formato, ver:
- `example-backlog.json` - Tickets en ejecución
- `example-done.json` - Tickets completados
- `example-failed.json` - Tickets fallidos con razón
- `example-blocked.json` - Tickets bloqueados con razón
- `example-rejected.json` - Tickets rechazados con razón
- `example-metadata.json` - Metadatos y auditoría

## 🔄 Flujo de Cambios de Estado

```
   backlog
      ↓
 in-progress ──→ done
      ↓             ↓
  failed ──→ blocked ──→ rejected
      ↑              ↓
      └──────────────┘
```

## 🚀 Uso del CLI

```bash
# Crear nuevo ticket (interactivo)
npm run po:create

# Listar tickets en backlog
npm run po:list -- --status backlog

# Ver detalles
npm run po:details -- TASK-001

# Mover entre estados
npm run po:move -- TASK-001 done
npm run po:move -- TASK-001 failed --reason "Error message"

# Ver estadísticas
npm run po:stats
```

## 📝 Estructura de un Ticket

```json
{
  "id": "TASK-001",
  "type": "feature|bug|refactor|tech-debt|epic",
  "status": "backlog|in-progress|done|failed|blocked|rejected",
  "title": "String con el título",
  "description": "Descripción detallada",
  "requirements": ["req1", "req2"],
  "acceptance_criteria": ["criteria1", "criteria2"],
  "size": "small|medium|large|xlarge",
  "priority": "low|normal|high|critical",
  "complexity": 1-5,
  "story_points": número,
  "estimated_days": número,
  "parent_epic": "TASK-XXX o null",
  "subtasks": ["TASK-YYY"],
  "dependencies": ["TASK-ZZZ"],
  "blocked_by": null | "razón",
  "rejection_reason": null | "razón",
  "failure_reason": null | "razón",
  "tags": ["tag1", "tag2"],
  "created_at": "ISO 8601 timestamp",
  "created_by": "product-owner-agent",
  "started_at": "ISO 8601 timestamp o null",
  "completed_at": "ISO 8601 timestamp o null",
  "assignee": null,
  "reviewer": null
}
```

## 🔐 Persisten cia

Todos los cambios se guardan inmediatamente en los archivos JSON.

**Auditoría:**
- Cada cambio de estado se registra con timestamp
- El histórico completo está en `archive.json`
- `metadata.json` mantiene contador de IDs

## 🔗 Integración con Harness

El Harness ejecuta tickets así:

1. Lee `backlog.json`
2. Para cada ticket:
   - Lo mueve a `in-progress.json`
   - Ejecuta: Knowledge Engine → Planner → Implementation → Validation
   - Reporta resultado
3. El Agent mueve el ticket al estado final:
   - Éxito → `done.json`
   - Error → `failed.json` (con razón)
   - Dependencia → `blocked.json` (con razón)

## 📊 Estadísticas

```bash
npm run po:stats
```

Muestra:
- Total de tickets
- Por estado
- Por prioridad
- Por tamaño

---

**Para más información:** Ver `PRODUCT_OWNER_AGENT.md`
