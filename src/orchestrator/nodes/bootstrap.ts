import { loadProvidersConfig } from "../../config/loadConfig.js";
import { decisionEntry } from "../decisionLog.js";
import type { OrchestratorStateType } from "../state.js";

export function bootstrapNode(_state: OrchestratorStateType) {
  const config = loadProvidersConfig();
  return {
    config,
    decisionLog: [
      decisionEntry(
        "bootstrap",
        `Config cargada: ${Object.keys(config.roles).length} roles, ${Object.keys(config.providers).length} providers.`
      ),
    ],
  };
}
