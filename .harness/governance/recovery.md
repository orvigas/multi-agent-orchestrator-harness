# Gobernanza del Recovery Loop

- Un diagnóstico con rootCause "Security" NUNCA se autofixea: siempre
  estrategia "abort" (= escalar a humano), sin excepción y sin importar
  cuántas iteraciones de presupuesto queden.
- Un mismo rootCause+detail repetido dos veces fuerza cambio de estrategia
  (change_context o change_model) — está prohibido reintentar exactamente
  igual una tercera vez.
- Máximo 3 iteraciones de Recovery por ticket. Al agotarse: abort con el
  `recoveryHistory` completo adjunto para revisión humana.
- `prepare_fix` nunca debe producir una `targetedFixTask` cuyo `touchesFiles`
  exceda los archivos ya señalados por la evidencia de fallo — si el
  diagnóstico sugiere que el problema es más amplio, eso es señal de que la
  estrategia correcta era `change_context` (volver a Planning), no un fix
  puntual más grande.
