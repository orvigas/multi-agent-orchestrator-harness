import { callLLM, HARNESS_MODE } from "../../../services/llm.js";
import type { RecoveryStateType } from "../state.js";
import type { Strategy } from "../types.js";

// Stand-in determinista para el rol "recovery_strategist": las reglas duras
// (presupuesto agotado, Security, fallo repetido) son ya deterministas en el
// propio how-to — se implementan tal cual. Solo la "zona de juicio" final
// (un fallo nuevo, no repetido, no Security) es una heurística en vez de una
// llamada real a un modelo: confidence "low" (o sin intentos previos que lo
// respalden) -> "retry"; confidence "high" con >=2 intentos de patch ya
// fallidos -> "rollback" (seguir insistiendo incrementalmente no está
// funcionando). "partial_retry"/"change_context" fuera de las reglas duras
// no tienen una señal real distinta en este sistema (no hay mecanismo de
// patch parcial granular), así que no se producen fuera de esos casos —
// igual que otras capas dejan valores del tipo alcanzables solo por reglas
// explícitas, no por la heurística de juicio.
export async function decideStrategyNode(state: RecoveryStateType): Promise<{ strategy: Strategy; recoveryIteration: number }> {
  const { diagnosis, recoveryIteration, maxRecoveryIterations, patchAttempts } = state;
  const nextIteration = recoveryIteration + 1;

  // Regla dura 1: presupuesto de recovery agotado -> abort, sin importar el diagnóstico
  if (recoveryIteration >= maxRecoveryIterations) {
    return { strategy: "abort", recoveryIteration: nextIteration };
  }

  // Regla dura 2: Security SIEMPRE requiere aprobación humana, nunca autofix silencioso
  if (diagnosis!.rootCause === "Security") {
    return { strategy: "abort", recoveryIteration: nextIteration }; // "abort" aquí = escalar, no continuar solo
  }

  // Regla dura 2b: MergeConflict (Capa 8) SIEMPRE escala, nunca autoresuelve
  // — el árbol real divergió del snapshot del sandbox; reintentar el mismo
  // patch (o cualquier variante) no arregla una divergencia externa. Ver
  // .harness/governance/merge-manager.md.
  if (diagnosis!.rootCause === "MergeConflict") {
    return { strategy: "abort", recoveryIteration: nextIteration };
  }

  // Regla dura 3: mismo error repetido -> cambiar de estrategia, NUNCA reintentar igual
  if (diagnosis!.isRepeatedFailure) {
    if (diagnosis!.rootCause === "Architecture" || diagnosis!.rootCause === "Dependencies") {
      // change_context aquí significa: el Orchestrator vuelve a Planning, no a Implementation
      return { strategy: "change_context", recoveryIteration: nextIteration };
    }
    return { strategy: "change_model", recoveryIteration: nextIteration };
  }

  // Zona de juicio: fallo nuevo, no repetido, no Security.
  // Modo LLM: pedir a Claude que decida estrategia inteligentemente
  if (HARNESS_MODE === "llm" && state.config) {
    try {
      // Build attempt history for context
      const attemptSummary = patchAttempts.slice(-3).map((a, i) => {
        const status = a.patch ? "✓ Generated" : "✗ Validation failed";
        return `  Attempt ${patchAttempts.length - 2 + i}: ${status}`;
      }).join("\n");

      const userPrompt = `
## Failure Diagnosis
**Root Cause:** ${diagnosis!.rootCause}
**Confidence:** ${diagnosis!.confidence}
**Detail:** ${diagnosis!.detail}

## Recent Attempt History
${attemptSummary || "  (no attempts yet)"}

## Recovery Strategies

**Recommendation System** (choose the FIRST matching):
1. HIGH confidence + Architecture/Dependencies → "change_context"
   (Understanding is solid; the problem is in planning, not implementation)

2. MEDIUM/LOW confidence + <2 attempts → "retry"
   (Not enough data to change strategy; try with improved diagnostics)

3. MEDIUM/LOW confidence + ≥2 attempts → "change_model"
   (Pattern suggests understanding is incomplete; reformulate)

4. (Default) → "retry"

## Strategy Meanings
- "retry": Apply improved patch based on this diagnosis
- "rollback": Revert and escalate (not available for new failures)
- "partial_retry": Reduced scope (not available in current system)
- "change_context": Go back to Planning; understanding was wrong
- "change_model": Ask for different problem interpretation

## Your Decision
Return ONLY this JSON:
{"strategy": "retry|change_context|change_model"}
`;

      const response = await callLLM(
        {
          role: "recovery_strategist",
          systemPrompt: "Decide recovery strategy based on diagnosis and failure history.",
          userPrompt,
          temperature: 0.5,
          maxTokens: 200,
        },
        state.config
      );

      const result = JSON.parse(response.content);
      const strategy: Strategy = result.strategy || "retry";

      return { strategy, recoveryIteration: nextIteration };
    } catch (err) {
      // Fallback a heurística si LLM falla
      console.error("LLM strategy decision failed:", err);
    }
  }

  // Modo determinístico o fallback: usar heurística
  const strategy: Strategy =
    diagnosis!.confidence === "high" && patchAttempts.length >= 2 ? "rollback" : "retry";

  return { strategy, recoveryIteration: nextIteration };
}
