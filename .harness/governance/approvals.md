# Approvals

## Allow (sin confirmación humana)
- Leer archivos del repo, ejecutar tests, lint, análisis estático.
- Crear parches en `src/**` y `tests/**`.

## Ask (requiere aprobación humana antes de aplicar)
- Cambios en `src/config/**`, `infra/**`, migraciones de base de datos.
- Cualquier cambio que borre más de 50 líneas en un solo archivo.

## Deny (el harness nunca lo hace, ni con aprobación)
- Modificar `.github/workflows/**` sin ticket explícito de infraestructura.
- Hacer `git push --force` a `main`.
- Instalar dependencias nuevas sin que el Quality Gate valide licencia y vulnerabilidades.
