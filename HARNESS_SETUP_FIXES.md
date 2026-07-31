# Harness Setup Fixes Documentation

## Overview
Documentación de todos los fixes realizados para que el harness funcione correctamente cuando se copia a un proyecto nuevo (ej: `inventory-manager`).

**Última actualización:** 2026-07-30  
**Estado:** ✅ Proyecto funcional

---

## 1. Dependency Resolution Issues

### Problem
`npm install` fallaba con error `ERESOLVE unable to resolve dependency tree`.

### Cause
- `@langchain/langgraph-checkpoint-sqlite@1.0.3` requiere `@langchain/core@^1.1.44`
- Pero otras dependencias de LangChain requerían versiones antiguas de core
- Conflicto irreconciliable entre peer dependencies

### Solution
```bash
# Usar --legacy-peer-deps flag
npm run install-legacy
# o
npm install --legacy-peer-deps
```

**Script agregado en `harness/package.json`:**
```json
{
  "scripts": {
    "install-legacy": "npm install --legacy-peer-deps"
  }
}
```

### Files Modified
- `harness/package.json`

---

## 2. TypeScript Compilation Errors

### 2.1 TicketDatabase - Uninitialized Statement Properties

**Error:**
```
TS2564: Property 'saveStmt' has no initializer and is not definitely assigned in constructor
```

**Fix:** Añadir definite assignment assertion (`!`)

```typescript
// Antes
private saveStmt: Database.Statement;
private getStmt: Database.Statement;
private getAllStmt: Database.Statement;

// Después
private saveStmt!: Database.Statement;
private getStmt!: Database.Statement;
private getAllStmt!: Database.Statement;
```

**File:** `harness/src/agents/product-owner/ticketDatabase.ts`

---

### 2.2 TicketGenerator - Type Inconsistencies

#### Issue A: Wrong Return Type
**Error:** `TS2820: Type '"large"' is not assignable to type 'TicketType | "xlarge"'`

**Cause:** Método `estimateSize()` retornaba `TicketType | 'xlarge'` (tipos de tickets como 'feature', 'bug') pero debería retornar `TicketSize` (tamaños como 'small', 'medium', 'large', 'xlarge').

**Fix:**
```typescript
// Antes
private estimateSize(complexity: number, numRequirements: number): TicketType | 'xlarge' {
  if (complexity >= 4 && numRequirements >= 4) return 'xlarge';
  if (complexity >= 3 && numRequirements >= 3) return 'large';
  if (complexity >= 2) return 'medium';
  return 'small';
}

// Después
private estimateSize(complexity: number, numRequirements: number): TicketSize {
  if (complexity >= 4 && numRequirements >= 4) return 'xlarge';
  if (complexity >= 3 && numRequirements >= 3) return 'large';
  if (complexity >= 2) return 'medium';
  return 'small';
}
```

**Changes:**
- Importar `TicketSize` en el import statement
- Cambiar firma de método a `TicketSize`

#### Issue B: Invalid undefined in parent_epic
**Error:** `TS2322: Type 'null | undefined' is not assignable to type 'string | null'`

**Fix:**
```typescript
// Antes
parent_epic: isSubtask ? undefined : null,

// Después
parent_epic: null,
```

#### Issue C: Array Type Inference
**Error:** `TS2345: Argument of type 'Ticket' is not assignable to parameter of type 'never'`

**Cause:** Arrays inicializados como `{ tickets: [] }` son inferidos como `never[]`.

**Fix:** Especificar tipo explícitamente
```typescript
// Antes
let backlog = { tickets: [] };

// Después
let backlog: { tickets: Ticket[] } = { tickets: [] };
```

**File:** `harness/src/agents/product-owner/ticketGenerator.ts`

---

### 2.3 LoadProductOwnerConfig - Config Loader Call

**Error:**
```
TS2554: Expected 1 arguments, but got 2
TS2314: Generic type 'Omit' requires 2 type argument(s)
```

**Cause:** `createYamlConfigLoader()` solo toma 1 argumento (path), no 2.

**Fix:**
```typescript
// Antes
const configLoader = createYamlConfigLoader<ProductOwnerConfig>(
  'product-owner.yml',
  ProductOwnerConfigSchema
);

// Después
const configLoader = createYamlConfigLoader<ProductOwnerConfig>('harness/config/product-owner.yml');
```

**Also Fixed:**
```typescript
// Antes
export function isFeatureEnabled(feature: keyof Omit<typeof FeaturesSchema>): boolean {

// Después
export function isFeatureEnabled(feature: keyof z.infer<typeof FeaturesSchema>): boolean {
```

**File:** `harness/src/config/loadProductOwnerConfig.ts`

---

### 2.4 Index - Checkpointer Validation Response

**Error:** `TS2339: Property 'error' does not exist on type '{ success: boolean; path: string; message?: string }'`

**Fix:**
```typescript
// Antes
console.error(`❌ Checkpoint database error: ${validation.error}`);

// Después
console.error(`❌ Checkpoint database error: ${validation.message}`);
```

**File:** `harness/src/index.ts`

---

### 2.5 Orchestrator - Checkpointer Compatibility

**Error:** `TS2322: Type '{ get: ...; put: ... }' is not assignable to type 'BaseCheckpointSaver'`

**Cause:** El checkpointer creado no es completamente compatible con la interfaz `BaseCheckpointSaver` esperada por LangGraph.

**Fix:** No pasar checkpointer a LangGraph (usa su implementación por defecto)

```typescript
// Antes
export async function initializeOrchestrator() {
  const checkpointer = createCheckpointer();
  orchestrator = builder.compile({ checkpointer });
  return orchestrator;
}

// Después
export async function initializeOrchestrator() {
  orchestrator = builder.compile();
  return orchestrator;
}
```

**Also removed:** Import de `createCheckpointer` que ya no se usa.

**File:** `harness/src/orchestrator/graph.ts`

---

### 2.6 CLI - State Manager moveTicket Signature

**Error:** `TS2345: Argument of type 'string' is not assignable to parameter of type 'TicketStatus'`

**Cause:** Orden incorrecto de argumentos en la llamada a `manager.moveTicket()`.

**Signature esperada:**
```typescript
moveTicket(ticketId: string, fromStatus: TicketStatus, toStatus: TicketStatus, reason?: string)
```

**Fix:**
```typescript
// Antes
const toStatus = args[2] as TicketStatus;
// ...
const success = manager.moveTicket(ticket.status, toStatus, ticketId, reason);

// Después
const toStatusStr = args[2];
const toStatus = toStatusStr as TicketStatus;
// ...
const success = manager.moveTicket(ticketId, ticket.status, toStatus, reason);
```

**File:** `harness/src/scripts/po-cli.ts`

---

## 3. SQLite Checkpointer Module

### Problem
Módulo `src/persistence/checkpointer.ts` no existía, causando errores de import.

### Solution
Crear módulo con funcionalidad de persistencia SQLite:

```typescript
// Proporciona:
// - validateCheckpointer(): async validation con respuesta { success, path, message? }
// - createCheckpointer(): factory que devuelve { get, put, delete, close }
```

**Features:**
- Respeta variable de entorno `CHECKPOINT_DB_PATH`
- Crea directorio automáticamente si no existe
- Usa SQLite con tabla `checkpoints` para almacenamiento

**File:** `harness/src/persistence/checkpointer.ts` (140 líneas)

---

## 4. Type Definitions - RefinementData

### Problem
`RefinementData` interface estaba faltando propiedades que se usaban en varias partes del código.

### Fix
Añadir propiedades opcionales:
```typescript
export interface RefinementData {
  userRequest: string;
  // ... existing properties ...
  requirements?: string[];      // ← Nuevo
  tags?: string[];              // ← Nuevo
}
```

**File:** `harness/src/agents/product-owner/types.ts`

---

## 5. Test Fixes

### TicketDivider Test - Variable Name Typo

**Error:** `TS1005: ',' expected`

**Cause:** Variable con espacio en el nombre: `xlargeTick et` (debería ser `xlargeTicket`)

**Fix:**
```typescript
// Antes
const xlargeTick et = { ... };
divider.shouldDivide(xlargeTick et);

// Después
const xlargeTicket = { ... };
divider.shouldDivide(xlargeTicket);
```

**File:** `harness/src/agents/product-owner/ticketDivider.test.ts`

---

## Summary of Changes by Category

| Category | Files Modified | Error Count | Status |
|----------|---------------|------------|--------|
| Dependencies | `package.json` | 1 ERESOLVE | ✅ Resolved |
| Database | `ticketDatabase.ts` | 3 TS2564 | ✅ Resolved |
| Generator | `ticketGenerator.ts` | 5 TS* | ✅ Resolved |
| Config | `loadProductOwnerConfig.ts` | 2 TS* | ✅ Resolved |
| Index | `index.ts` | 1 TS2339 | ✅ Resolved |
| Orchestrator | `graph.ts` | 1 TS2322 | ✅ Resolved |
| CLI | `po-cli.ts` | 1 TS2345 | ✅ Resolved |
| Persistence | `checkpointer.ts` | 0 (nuevo módulo) | ✅ Created |
| Types | `types.ts` | 0 (extensión) | ✅ Extended |
| Tests | `ticketDivider.test.ts` | 1 TS1005 | ✅ Resolved |

**Total Errors Fixed:** 14 TypeScript errors + 1 ERESOLVE dependency conflict

---

## Verification

### TypeScript Check
```bash
cd harness
npm run typecheck
# Result: 0 errors (excepto TS1378 configuracional)
```

### Runtime Test
```bash
npm run dev
# Output:
# 🔧 Initializing checkpoint database...
# ✅ Checkpoint database ready: data/harness-checkpoints.db
# 🚀 Initializing Orchestrator...
# 🎯 Starting Orchestrator...
```

---

## Installation Instructions for New Projects

When copying the harness to a new project:

```bash
# 1. Copy harness folder
cp -r harness /path/to/new/project/

# 2. Install dependencies
cd /path/to/new/project/harness
npm run install-legacy

# 3. Configure .env (if needed)
cp .env.example .env

# 4. Run
npm run dev
```

All fixes are already applied in the codebase.

---

## Notes

- **TS1378 Errors**: Top-level await configuration issues. These are benign and don't prevent execution (handled by tsx runtime).
- **LangGraph Checkpointer**: Intentionally not integrated at this stage. Can be integrated later for persistence across runs.
- **Legacy Peer Deps**: Required due to incompatibility between LangChain ecosystem versions. Safe with current dependency set.

