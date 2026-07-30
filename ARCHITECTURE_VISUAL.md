# Arquitectura Visual Completa del Harness

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TU MÁQUINA (Local)                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Node.js 18+                                                                               │ │
│  │ • /usr/local/bin/node                                                                     │ │
│  │ • npm                                                                                     │ │
│  │ • typescript                                                                              │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Harness (este repo)                                                                       │ │
│  │ /multiagent-harness/                                                                      │ │
│  │ ├── src/orchestrator/ ← Cerebro (elige qué hacer después)                                │ │
│  │ ├── src/workflows/                                                                        │ │
│  │ │   ├── knowledge-engine/                                                                │ │
│  │ │   ├── planner/                                                                         │ │
│  │ │   ├── implementation/                                                                  │ │
│  │ │   ├── validation-pipeline/                                                            │ │
│  │ │   ├── recovery/                                                                        │ │
│  │ │   ├── quality-gate/                                                                    │ │
│  │ │   └── merge-manager/                                                                   │ │
│  │ ├── config/                                                                               │ │
│  │ │   ├── providers.yml ← Qué modelo para cada rol                                        │ │
│  │ │   ├── validation-pipeline.yml ← Comandos a ejecutar                                    │ │
│  │ │   └── orchestrator.yml ← Presupuestos, budgets                                        │ │
│  │ ├── .env ← API KEYS (NUNCA commitear)                                                     │ │
│  │ └── .gitignore (incluye .env)                                                            │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ SSH (~/.ssh/id_ed25519)                                                                   │ │
│  │ • Clave privada ← Tus permisos en GitHub                                                 │ │
│  │ • Permite hacer git push sin contraseña                                                  │ │
│  │ • Seguro: nunca la expongas                                                              │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Docker Engine                                                                             │ │
│  │ • Crea contenedores aislados (mini-máquinas Linux)                                       │ │
│  │ • Cada ticket se corre en su propio contenedor                                           │ │
│  │ • Si algo explota: docker rm, tu PC está intacto                                         │ │
│  │ • Sandbox descartable: después del ticket, se borra                                      │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │ Git Client (~/.ssh/config apunta a github.com)                                           │ │
│  │ • git clone git@github.com:tu-org/mi-proyecto.git (clona vía SSH)                        │ │
│  │ • git push (sin pedir contraseña, usa SSH key)                                           │ │
│  │ • git fetch (trae cambios nuevos)                                                        │ │
│  │ • git tag (crea tags después de merge exitoso)                                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        ▲
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
        ┌──────────────────────┐           ┌──────────────────────┐
        │  GitHub/Jira (Cloud) │           │  PostgreSQL (Cloud)  │
        │                      │           │                      │
        │ Webhook: Issue open  │           │ Checkpoints          │
        │ → Triggers harness   │           │ • Step 1: found file │
        │                      │           │ • Step 2: generated  │
        │ Merge notification   │           │ • Step 3: validated  │
        │ ← Harness reports    │           │                      │
        │                      │           │ Time-travel: volver  │
        │                      │           │ a paso 2 si paso 3   │
        │                      │           │ falló                │
        └──────────────────────┘           └──────────────────────┘
        (Tu sistema de tracking)           (Durabilidad del estado)
                    ▲
                    │
                    │
        (Git push vía SSH desde Merge Manager)
```

---

## Flujo: Cómo un Ticket se convierte en código mergeado

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. USUARIO ABRE TICKET EN GITHUB/JIRA                                                      │
│    "Agregar validación de email en LoginService"                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         │ (Webhook)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. HARNESS INICIA (EN TU MÁQUINA, node process)                                            │
│    • Lee .env (API keys)                                                                   │
│    • Lee config/providers.yml (qué modelo para cada rol)                                   │
│    • Lee config/validation-pipeline.yml (compile, test, lint commands)                    │
│    • Guarda checkpoint en PostgreSQL: "Iniciando PROJ-123"                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. KNOWLEDGE ENGINE (Capa 2)                                                               │
│    Location: Contenedor Docker #1                                                          │
│    Tareas:                                                                                 │
│    • git clone mi-proyecto (dentro del contenedor, no toca tu máquina)                     │
│    • Busca: ¿dónde está LoginService?                                                      │
│    • Ejecuta tree-sitter, grep, vector search                                              │
│    • Lee .harness/rules/*.md del proyecto (constraints)                                     │
│    Result: confirmedEvidence[] (archivos + snippets relevantes)                            │
│    Checkpoint en PostgreSQL: "Knowledge completado"                                         │
│    Contenedor #1 se descarta                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. PLANNER (Capa 3)                                                                        │
│    Location: Node.js en tu máquina (usa evidencia de K-Engine)                            │
│    Tareas:                                                                                 │
│    • Discovery: analiza ticket + evidencia                                                 │
│    • Planning: "Tarea 1: Update LoginService, Tarea 2: Update tests"                       │
│    • Validation: ¿plan respeta .harness/architecture/adr/*.md?                             │
│    Result: plan con tasks ordenadas + dependencias                                         │
│    Checkpoint en PostgreSQL: "Plan generado"                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ├─ Tarea 1: Update service
                                         │   ▼
        ┌────────────────────────────────────────────────────────────┐
        │ 5. IMPLEMENTATION LOOP (Capa 4) para Task 1                │
        │    Location: Contenedor Docker #2 (fresco, aislado)       │
        │    Tareas:                                                 │
        │    • git clone (copia limpia del repo)                    │
        │    • Genera código: "validateEmail() en LoginService"      │
        │    • Quick-check: ¿compila? npm run build                │
        │    • Si falla: reintenta con feedback                     │
        │    Result: patch (formato diff con contexto)              │
        │    Checkpoint en PostgreSQL: "Impl Task 1"                │
        │    Contenedor #2 se descarta                              │
        │                                                             │
        │    ↓                                                        │
        │ 6. VALIDATION PIPELINE (Capa 5) para patch de Task 1       │
        │    Location: MISMO contenedor (guardamos el patch)         │
        │    Tareas:                                                 │
        │    • Compile: npm run build ✅                            │
        │    • Tests: npm test ✅                                   │
        │    • Lint: eslint ✅                                      │
        │    • Security: npm audit ✅                               │
        │    • Result: veredicto = PASS                            │
        │    • Checkpoint en PostgreSQL: "Validación 1: PASS"      │
        └────────────────────────────────────────────────────────────┘
                                         │
                                         ├─ Tarea 2: Update tests
                                         │   (Se repite flujo Impl+Valid)
                                         │   ▼
        ┌────────────────────────────────────────────────────────────┐
        │ 5b. IMPLEMENTATION LOOP para Task 2                        │
        │ 6b. VALIDATION PIPELINE para Task 2                        │
        │     (Mismo proceso, resultado: PASS)                       │
        └────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 7. RECOVERY LOOP (Capa 6)                                                                  │
│    Location: Node.js en tu máquina                                                        │
│    Tareas:                                                                                 │
│    • Todos los patches pasaron → failureCategory = null → SKIP recovery                   │
│    • (Si hubiera fallos, aquí se diagnostica + arregla)                                    │
│    Checkpoint en PostgreSQL: "Recovery: SKIPPED"                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 8. QUALITY GATE (Capa 7)                                                                   │
│    Location: Node.js en tu máquina                                                        │
│    Tareas:                                                                                 │
│    • Coverage: 95% → 96% (+1%) ✅                                                         │
│    • Sonar: 0 new code smells ✅                                                          │
│    • Architecture: respeta ADRs ✅                                                         │
│    • Documentation: comentarios en métodos nuevos ✅                                       │
│    • Verdict: CLEAR                                                                       │
│    Checkpoint en PostgreSQL: "Quality gate: CLEAR"                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 9. MERGE MANAGER (Capa 8)                                                                  │
│    Location: Node.js en tu máquina (usa SSH key para git)                                 │
│    Tareas:                                                                                 │
│    • git fetch origin main (obtiene cambios remotos)                                       │
│    • git merge origin/main (mezcla cambios)                                               │
│    • ¿Conflictos? SÍ → Escalate a humano                                                  │
│    •        NO → Continúa                                                                 │
│    • git tag ticket-PROJ-123 (crea tag)                                                    │
│    • git push origin main (vía SSH, sin contraseña) ← SSH KEY AQUÍ                         │
│    • git push --tags (publica tag)                                                        │
│    • Cierra ticket en GitHub/Jira                                                         │
│    Checkpoint en PostgreSQL: "Merge: SUCCESS, commit abc123"                               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 10. OBSERVABILIDAD & AUDITORÍA                                                             │
│     • LangSmith: Registra cada paso (Knowledge → Plan → Impl → Valid → Merge)             │
│     • PostgreSQL Checkpoints: Todo guardado para time-travel                               │
│     • Sentry: Email/Slack si algo falló                                                   │
│     • GitHub: Comentario en el issue con detalles                                         │
│     • Audit log: "HARNESS mergeó PROJ-123 el 2026-07-29 10:15:30 UTC"                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                                ✨ ÉXITO ✨
                    Código en producción, ticket cerrado
                    Todo automático en 2-5 minutos
```

---

## Resumen de componentes y por qué cada uno importa

### Capa de Infraestructura (Tu máquina)

```
┌─ Node.js 18+ ────────── Runtime para ejecutar todo el harness
│
├─ SSH (~/.ssh/id_ed25519) ── Autenticación SEGURA en GitHub
│  │                          (sin contraseña, sin API keys expuestas)
│  └─ git push usa esto para autenticarse automáticamente
│
├─ Docker Engine ────────── Sandbox para Implementation + Validation
│  │                         (cada ticket en contenedor descartable)
│  └─ Si explota, borra contenedor. Tu PC: intacto.
│
├─ Git Client ─────────────  Operaciones Git
│  │                         (clone, merge, push, tag)
│  └─ Se conecta a GitHub vía SSH
│
└─ npm packages ───────────  Librerías que hacen todo funcionar
   (LangGraph, Zod, dotenv)
```

### Capa de Configuración (Tu harness repo)

```
├─ .env ─────────────────── API keys (NUNCA en git)
│
├─ config/providers.yml ─── Mapeo: rol → (provider, modelo)
│  │                        (ej: implementer → Anthropic/Claude)
│  └─ Aquí defines coste vs capacidad
│
├─ config/validation-pipeline.yml ── Comandos: npm test, eslint, etc.
│
└─ config/orchestrator.yml ────── Presupuestos, budgets, alertas
```

### Capa de Proyecto (Tu repo destino)

```
└─ .harness/ ────────────── Reglas del proyecto
   ├─ rules/*.md ───────────────── Restricciones (forbidden-zones, style)
   ├─ architecture/*.md ──────────── Descripción (patrones, ADRs)
   └─ governance/*.md ────────────── Permisos (quién puede hacer qué)
```

### Capa de Persistencia (Cloud)

```
├─ GitHub/Jira ───── Tu sistema de tracking + webhooks
│
└─ PostgreSQL ─────── Checkpoints (estado durable del harness)
```

---

## Por qué cada herramienta es CRÍTICA

| Herramienta | Qué pasa sin ella | Qué pasa con ella |
|---|---|---|
| **Node.js** | Harness no corre | ✅ Todo funciona |
| **SSH key** | Merge Manager falla (no puede hacer git push) | ✅ Push automático seguro |
| **Docker** | Implementation corre en tu máquina (PELIGRO) | ✅ Sandbox aislado |
| **PostgreSQL** | Pierdes checkpoints, no puedes hacer time-travel | ✅ Estado durable |
| **providers.yml** | No sabes qué modelo usar en cada paso | ✅ Roles claros |
| **.harness/rules** | Implementation toca código prohibido | ✅ Restricciones explícitas |
| **.harness/architecture** | Quality Gate no valida arquitectura | ✅ Validación de patrones |
| **validation-pipeline.yml** | Validation Pipeline no sabe qué comandos correr | ✅ Tests automáticos |

---

## Flujo de datos: Cómo el contenedor se aísla

```
┌─ Tu máquina ─────────────────────────────────────────────────────┐
│                                                                   │
│  Harness (Node.js)                                               │
│  • Lee ticket de GitHub                                          │
│  • Read-only: .harness/rules, config/                            │
│  • Read-only: ~/.ssh/id_ed25519 (para git push)                 │
│  • Read-only: .env (para API keys)                              │
│                                                                   │
│  Docker (Container #1 para Task 1)                               │
│  • git clone mi-proyecto (dentro del container)                 │
│  • npm install (dentro del container)                           │
│  • Genera código (dentro del container)                         │
│  • npm test (dentro del container)                              │
│  • Archivos modificados: SOLO dentro del container              │
│  • Resultado: patch (archivo, no en container)                  │
│  • Container se descarta → su /tmp se borra                    │
│                                                                   │
│  Tu máquina después: Exactamente igual que antes ✅             │
│                                                                   │
│  Docker (Container #2 para Task 2)                               │
│  • (Repetir todo, independiente de Container #1)               │
│  • Container se descarta                                        │
│                                                                   │
│  Merge Manager (Node.js)                                         │
│  • Lee los patches (archivos que guardamos)                    │
│  • git push vía SSH (desde aquí, no de container)              │
│  • Escribe en GitHub                                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

KEY PRINCIPLE: Los cambios ocurren DENTRO de containers descartables,
             el resultado final (patches) se guarda FUERA.
```

---

## Quick Checklist: ¿Tienes todo?

```
[✅] Node.js 18+ instalado
[✅] SSH configurado y funciona
[✅] Docker instalado y funciona
[✅] .env con API key válida
[✅] config/providers.yml creado
[✅] Tu proyecto tiene .harness/rules, .harness/architecture, .harness/governance
[✅] config/validation-pipeline.yml con tus comandos (npm test, eslint, etc)
[✅] Un ticket abierto en GitHub/Jira
[✅] npm run harness:execute corre sin errores
[✅] LangSmith conectado para ver qué hace (opcional pero recomendado)
```

Si todo está ✅, **estás listo para automatizar tickets en serio.**

🚀 El futuro es ahora.
