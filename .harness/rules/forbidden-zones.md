# Zonas prohibidas

El Implementation Loop NUNCA debe escribir en:

- `secrets/`
- `**/*.pem`, `**/*.key`
- `legacy/` (código congelado, solo lectura)

Si una tarea requiere tocar estas rutas, el Orchestrator debe escalar
directamente a `governance/escalation.md` sin pasar por Recovery.
