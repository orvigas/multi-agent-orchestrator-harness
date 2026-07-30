# Testing

- Toda función de routing (`routeAfter*`) debe tener cobertura unitaria
  para cada rama que devuelve, incluyendo los casos límite de presupuesto
  y de estrategia de recovery.
- Los subgrafos de workflow (`planning`, `implementation`, `recovery`) se
  prueban invocándolos de forma aislada con un estado construido a mano,
  sin depender de que el grafo completo del Orchestrator esté compilado.
- Ningún test debe requerir credenciales reales de un proveedor de modelo.
