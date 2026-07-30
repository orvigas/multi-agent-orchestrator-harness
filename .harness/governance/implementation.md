# Gobernanza del Implementation Loop

- Máximo 3 intentos de patch por task antes de escalar. El sandbox del
  último intento fallido NO se borra — queda para inspección humana.
- El Implementer nunca aplica un patch directo a la rama de trabajo: siempre
  vía un sandbox aislado (copia en directorio temporal, ver
  config/implementation.yml → sandbox.mode).
- Si una task tocaría una ruta de `.harness/rules/forbidden-zones.md`, el
  Implementer debe devolver un patch vacío con rationale, nunca forzar el
  cambio.
- El quick-check nunca sustituye a la Validation Pipeline completa (Capa 5):
  solo filtra patches obviamente rotos antes de gastar una corrida completa.
