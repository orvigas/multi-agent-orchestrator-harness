# Gobernanza de la Validation Pipeline

- `performance` solo se activa cuando `task.riskLevel` es "medium" o "high"
  (definido por Discovery en la Capa 3) o cuando el patch toca rutas listadas
  en `.harness/architecture/performance-sensitive.md`. Correrlo en cada patch
  de bajo riesgo desperdicia presupuesto sin aportar señal nueva.
- Ninguna etapa puede tener un LLM en el camino crítico de pass/fail. Si en
  el futuro se agrega un check "asistido por IA" (ej. revisión de
  vulnerabilidades no cubiertas por el scanner), su resultado va a
  `evidence` como dato adicional, nunca sustituye el exit code de la
  herramienta real.
- Toda `evidence` se trunca (ver `truncate()`) pero se conserva el log
  completo en el sandbox del patch para inspección humana — nunca se
  descarta, solo se resume lo que entra al state del grafo.
- Timeout por etapa es obligatorio (config `validation.timeouts`). Una
  herramienta que cuelga cuenta como `fail` con `evidence: "timeout"`, no
  como corrida indefinida.
