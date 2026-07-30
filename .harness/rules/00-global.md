# Reglas globales del harness

Estas reglas aplican a cualquier proyecto destino que use este módulo, salvo
que un `.harness/` de proyecto o `.harness.local/` las sobreescriba.

- El Orchestrator nunca escribe código directamente: solo decide qué
  workflow (subgrafo) ejecutar a continuación.
- Toda decisión relevante (cambio de estrategia, retry, abort, cambio de
  modelo) se registra en `decisionLog`, nunca solo en logs de proceso.
- El estado del grafo (`OrchestratorState`) se mantiene delgado: solo
  decisiones y metadatos, nunca evidencia completa de ejecución (eso vive
  en el Knowledge Engine o en un Store aparte).
