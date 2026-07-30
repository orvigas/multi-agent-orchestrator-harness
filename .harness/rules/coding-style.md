# Estilo de código

- TypeScript estricto (`strict: true`); evitar `any` salvo en límites de
  librerías de terceros sin tipos.
- Módulos ESM (`import`/`export`), sin `require()` salvo import dinámico
  cuando sea estrictamente necesario (ver `resolveModelForRole`).
- Un archivo por nodo/subgrafo del Orchestrator; los nodos no llaman
  directamente a un provider de modelo — pasan por `resolveModelForRole`.
