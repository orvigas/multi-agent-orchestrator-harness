# Requirements Capture & Ticket Creation

Guía completa para capturar requerimientos de usuarios y convertirlos en tickets que el harness pueda procesar automáticamente.

**Flujo:**
```
User Requirement
    ↓
[Parse → Structure → Validate]
    ↓
Ticket JSON
    ↓
[Backlog]
    ↓
[Orchestrator]
    ↓
Result
```

---

## Parte 1: Entender Qué es un Ticket

Un **ticket** es la unidad de trabajo que el harness procesa. Debe contener:

```json
{
  "ticketId": "TASK-1",
  "title": "Add email validation to LoginService",
  "description": "Users report login failures after restart",
  "targetRepoPath": "/path/to/my-repo",
  "priority": "high",
  "requirements": "Complete requirement description",
  "context": "Optional: Additional context"
}
```

### Campo: `ticketId`
- **Propósito:** Identificador único del ticket
- **Formato:** `TASK-123`, `FEAT-456`, `BUG-789`
- **Requerido:** Sí

### Campo: `title`
- **Propósito:** Resumen de una línea
- **Ejemplo:** "Fix null pointer in payment processor"
- **Requerido:** Sí

### Campo: `description`
- **Propósito:** Contexto breve
- **Longitud:** 2-5 líneas
- **Requerido:** Sí

### Campo: `targetRepoPath`
- **Propósito:** Ruta absoluta al repositorio objetivo
- **Ejemplo:** `/Users/orlando/projects/my-app`
- **Requerido:** Sí (o puede heredarse de config)

### Campo: `requirements`
- **Propósito:** Especificación detallada de qué implementar
- **Debe incluir:** Qué hacer, dónde hacerlo, restricciones
- **Longitud:** Párrafos, listas, pseudocódigo
- **Requerido:** Sí

### Campo: `priority`
- **Opciones:** `low`, `normal`, `high`, `critical`
- **Propósito:** Influye en decisiones del harness
- **Requerido:** No (default: `normal`)

### Campo: `context`
- **Propósito:** Información adicional (historiales, decisiones previas)
- **Requerido:** No

---

## Parte 2: Capturar Requerimientos del Usuario

### Escenario 1: Usuario reporta un bug

**User Input:**
```
"El login falla después de reiniciar el servidor. 
El mensaje de error dice 'email not valid'. 
Parece que la validación de email es demasiado estricta."
```

**Convertir a ticket:**

```json
{
  "ticketId": "BUG-2047",
  "title": "Fix overly strict email validation in LoginService",
  "description": "Users cannot login after server restart due to email validation error. Email validation rules appear overly restrictive.",
  "targetRepoPath": "/home/user/my-app",
  "priority": "high",
  "requirements": "Investigate email validation in LoginService:\n\n1. Find the email validation function (likely in auth/validators.ts)\n2. Review the regex pattern or validation logic\n3. Identify which valid emails are being rejected\n4. Update validation logic to accept RFC 5322 compliant emails\n5. Ensure existing tests still pass\n6. Add test cases for edge cases (subdomains, plus addressing)\n\nConstraints:\n- Do NOT change password validation\n- Do NOT modify database schema\n- Keep backward compatibility with existing user emails",
  "context": "This issue started appearing after upgrade to v2.3. Likely related to stricter email rules introduced in commit abc123."
}
```

### Escenario 2: Usuario solicita una nueva feature

**User Input:**
```
"We need to export user data to CSV. 
Currently, there's no way for admins to get user data out of the system.
They have to use the database directly which is risky."
```

**Convertir a ticket:**

```json
{
  "ticketId": "FEAT-5123",
  "title": "Add CSV export functionality for user data",
  "description": "Admins need ability to export user data to CSV format for reporting and compliance. Currently requires direct database access.",
  "targetRepoPath": "/home/user/my-app",
  "priority": "normal",
  "requirements": "Implement CSV export feature for admin users:\n\n1. Create new endpoint: GET /api/admin/users/export?format=csv\n2. Implement CSV formatting for user table (id, email, name, created_at, last_login)\n3. Add authentication check (admin role only)\n4. Add streaming response (for large datasets)\n5. Include unit tests for CSV formatting\n6. Add integration test for endpoint\n\nTechnical details:\n- Use csv library (already in dependencies)\n- Stream response with Content-Disposition header\n- Exclude sensitive fields (password_hash, api_keys)\n- Add rate limiting (1 export per 5 minutes per admin)\n\nAcceptance Criteria:\n- Admin can download CSV file from UI\n- File contains all users (paginated)\n- Export includes timestamp in filename\n- Data is properly escaped for CSV",
  "context": "Compliance requirement for Q3. Related to audit trail feature (FEAT-5100)."
}
```

### Escenario 3: Usuario describe una refactorización

**User Input:**
```
"The validation module has grown too large. 
It's 3000 lines and mixes email validation, phone validation, 
and custom rule validation all together. 
We need to split it up."
```

**Convertir a ticket:**

```json
{
  "ticketId": "REFACTOR-890",
  "title": "Split validation.ts into modular validators",
  "description": "The main validation module is too large (3000+ lines) and mixes multiple validation types. Needs refactoring into focused modules.",
  "targetRepoPath": "/home/user/my-app",
  "priority": "normal",
  "requirements": "Refactor src/auth/validation.ts into modular validators:\n\nCreate new structure:\n- src/validators/email.ts — Email validation only\n- src/validators/phone.ts — Phone validation only\n- src/validators/rules.ts — Custom business rules\n- src/validators/index.ts — Unified exports\n\nFor each validator:\n1. Extract related functions from main file\n2. Keep public API identical (no breaking changes)\n3. Update imports in calling code\n4. Run existing tests (must all pass)\n5. Add unit tests for each module\n\nConstraints:\n- ZERO breaking changes for external API\n- All existing tests must pass without modification\n- Performance must not degrade\n- Types must remain accurate",
  "context": "This refactoring is blocking FEAT-5124 (custom validators plugin system). Part of code health initiative."
}
```

---

## Parte 3: Crear un Backlog

El harness procesa tickets desde un **backlog** — un archivo JSON con una lista de tickets.

### 3.1 Estructura del backlog

**`harness/backlog.json`:**

```json
{
  "tickets": [
    {
      "ticketId": "TASK-1",
      "title": "Fix email validation",
      "description": "...",
      "targetRepoPath": "/path/to/repo",
      "priority": "high",
      "requirements": "..."
    },
    {
      "ticketId": "TASK-2",
      "title": "Add CSV export",
      "description": "...",
      "targetRepoPath": "/path/to/repo",
      "priority": "normal",
      "requirements": "..."
    }
  ],
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z",
    "source": "user-submitted",
    "targetRepoPath": "/path/to/repo"
  }
}
```

### 3.2 Crear backlog de ejemplo

```bash
cd harness

# Crear archivo de backlog
cat > backlog.json << 'EOF'
{
  "tickets": [
    {
      "ticketId": "BUG-1",
      "title": "Fix email validation regex",
      "description": "Email validation is rejecting valid emails",
      "targetRepoPath": "/Users/user/my-project",
      "priority": "high",
      "requirements": "Find and fix the email validation regex in LoginService.ts to accept RFC 5322 compliant emails. Add tests for edge cases."
    }
  ],
  "metadata": {
    "createdAt": "2026-07-30T10:00:00Z"
  }
}
EOF

cat backlog.json
```

---

## Parte 4: Flujo Completo de Requerimiento a Ticket a Ejecución

```
┌─────────────────────────────────────────┐
│  1. USER REPORTS REQUIREMENT            │
│  "El login no funciona después del ...  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  2. PARSE REQUIREMENT                   │
│  - Identificar problema                 │
│  - Contexto                             │
│  - Qué se necesita                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  3. STRUCTURE AS TICKET                 │
│  {                                      │
│    "ticketId": "BUG-2047",             │
│    "title": "...",                     │
│    "requirements": "..."               │
│  }                                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  4. ADD TO BACKLOG.JSON                 │
│  harness/backlog.json                  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  5. EXECUTE HARNESS                     │
│  cd harness                             │
│  npm run dev                            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  6. ORCHESTRATOR PROCESSES TICKET       │
│                                         │
│  [Knowledge Engine] Find evidence       │
│  [Planner] Create plan                  │
│  [Implementation] Generate patches      │
│  [Validation] Run tests/lint            │
│  [Recovery] Handle failures (if any)    │
│  [Quality Gate] Review metrics          │
│  [Merge Manager] Merge result           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  7. RESULTS & DECISION TRAIL            │
│                                         │
│  ✅ Success: Changes merged             │
│  ⚠️ Escalated: Manual review needed    │
│  ❌ Failed: Needs diagnosis             │
└─────────────────────────────────────────┘
```

---

## Parte 5: Ejecutar Tickets

### 5.1 Ejecutar un único ticket

```bash
cd harness

# Crear backlog con 1 ticket
cat > backlog.json << 'EOF'
{
  "tickets": [{
    "ticketId": "TEST-1",
    "title": "Test ticket",
    "description": "Testing harness execution",
    "targetRepoPath": "/path/to/repo",
    "requirements": "Add console.log('test') to main.ts"
  }]
}
EOF

# Ejecutar
HARNESS_MODE=deterministic npm run dev  # O npm run dev si LLM está configurado
```

### 5.2 Ejecutar múltiples tickets en secuencia

```bash
# backlog.json con múltiples tickets
cat > backlog.json << 'EOF'
{
  "tickets": [
    {
      "ticketId": "BUG-1",
      "title": "Fix validation",
      "requirements": "..."
    },
    {
      "ticketId": "FEAT-1",
      "title": "Add export",
      "requirements": "..."
    },
    {
      "ticketId": "REFACTOR-1",
      "title": "Split module",
      "requirements": "..."
    }
  ]
}
EOF

# Ejecutar
npm run dev  # Procesa en orden
```

El harness procesa tickets uno por uno, guardando checkpoints entre ejecuciones.

---

## Parte 6: Interpretar Resultados

Después de `npm run dev`, el harness genera:

### 6.1 Logs
```bash
# Ver última ejecución
npm run logs

# Contendrá decisiones como:
# [Knowledge Engine] Found 5 relevant files
# [Planner] Created plan with 3 tasks
# [Implementation] Generated patches for tasks 1,2,3
# [Validation] All tests passed
# [Quality Gate] Coverage: 92%, Architecture OK
# [Merge Manager] Successfully merged to main
```

### 6.2 Cost tracking
```bash
# Ver costos LLM
npm run costs

# Ejemplo output:
# Task TASK-1:
#   Discovery: $0.05
#   Planner: $0.15
#   Implementer: $0.25
#   Total: $0.45
#
# Global total: $0.45
```

### 6.3 Database (SQLite)
```bash
# Inspeccionar checkpoint database
sqlite3 data/harness-checkpoints.db

# Ver estado de última ejecución
SELECT * FROM checkpoint_state LIMIT 1;
```

### 6.4 Escalations
Si el harness no puede procesar automáticamente:

```bash
# Ver escalaciones (fallos que necesitan review manual)
npm run logs | grep -i "escalat"

# Tipos de escalación:
# - Security issue found
# - Architecture violation
# - Merge conflict
# - Budget exceeded
# - Max retries exceeded
```

---

## Parte 7: Best Practices para Requerimientos

### ✅ DO

- **Sé específico:** "Add email validation to LoginService" vs "Fix email stuff"
- **Incluye restricciones:** "Do NOT modify database schema"
- **Menciona archivos:** "In src/auth/validators.ts, update the email regex"
- **Describe entrada/salida:** "Function should accept RFC 5322 emails"
- **Incluye contexto:** "Related to security issue #2047"

### ❌ DON'T

- **Vague:** "Make the system better"
- **Too broad:** "Rewrite the entire auth module"
- **Conflicting:** "Add feature AND remove it"
- **Ambiguous:** "Fix the problem"
- **Too open-ended:** "Do whatever you think is best"

### 📋 Template de Requerimiento

```json
{
  "ticketId": "TYPE-XXXX",
  "title": "[One-line summary, max 70 chars]",
  "description": "[2-3 sentences of context]",
  "targetRepoPath": "/absolute/path/to/repo",
  "priority": "normal",
  "requirements": "Specific tasks:\n\n1. [First subtask]\n2. [Second subtask]\n3. [etc.]\n\nTechnical details:\n- Affected files: src/module/file.ts\n- Technologies: TypeScript, Jest\n- Dependencies: (list any new ones)\n\nConstraints:\n- Do NOT modify [restricted area]\n- MUST pass existing tests\n- Performance: [any limits?]",
  "context": "Related to: FEAT-XXX, ISSUE-XXX"
}
```

---

## Resumen: De Requerimiento a Ejecución

1. **Captura:** Usuario describe el problema/feature
2. **Estructura:** Convierte a JSON ticket format
3. **Backlog:** Agrega a `backlog.json`
4. **Ejecuta:** `npm run dev`
5. **Monitorea:** Ver logs y costos
6. **Interpreta:** Resultados, escalaciones, cambios

**Documentación relacionada:**
- `GETTING_STARTED.md` — Setup inicial
- `loops_prompts/` — Cómo funciona el orquestador
- `.harness/governance/` — Políticas de cada capa

