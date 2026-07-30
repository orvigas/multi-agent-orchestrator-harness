import fs from "node:fs";
import yaml from "js-yaml";
import "dotenv/config";
import { loadPlannerConfig } from "./loadPlannerConfig.js";
import { loadKnowledgeEngineConfig } from "./loadKnowledgeEngineConfig.js";
import { loadImplementationConfig } from "./loadImplementationConfig.js";
import { loadRecoveryConfig } from "./loadRecoveryConfig.js";
import { loadQualityGateConfig } from "./loadQualityGateConfig.js";

export interface RoleConfig {
  provider: string;
  model: string;
  maxTokens?: number;
}

export interface OrchestratorConfig {
  providers: Record<string, { apiKeyEnv: string; baseUrl?: string }>;
  roles: Record<string, RoleConfig>;
}

let cached: OrchestratorConfig | null = null;

// Cada capa 2-7 declara sus propios roles en su config/*.yml — providers.yml
// ya no duplica planner/implementer/recovery (ver el comentario de ese
// archivo). Se componen todos acá porque resolveModelForRole necesita ver
// CUALQUIER rol real (discovery, retriever, kb_verifier, plan_validator,
// recovery_diagnostician, recovery_strategist, quality_gate_reviewer, ...)
// sin importar en qué config/*.yml vive.
function buildRoleRegistry(orchestratorRoles: Record<string, RoleConfig>): Record<string, RoleConfig> {
  return {
    ...orchestratorRoles,
    ...loadPlannerConfig().roles,
    ...loadKnowledgeEngineConfig().roles,
    ...loadImplementationConfig().roles,
    ...loadRecoveryConfig().roles,
    ...loadQualityGateConfig().roles,
  };
}

// Distinta de los demás load*Config.ts (no usa createYamlConfigLoader): esta
// valida variables de entorno además de parsear, así que cachea el resultado
// ya validado en vez de solo el YAML crudo.
export function loadProvidersConfig(path = "config/providers.yml"): OrchestratorConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(path, "utf8");
  const cfg = yaml.load(raw) as OrchestratorConfig;
  // valida que cada apiKeyEnv referenciado exista en process.env
  for (const [name, p] of Object.entries(cfg.providers)) {
    if (!process.env[p.apiKeyEnv]) {
      throw new Error(`Falta la variable de entorno ${p.apiKeyEnv} para el provider "${name}"`);
    }
  }

  cfg.roles = buildRoleRegistry(cfg.roles);

  // Un rol que referencia un provider no declarado en providers.yml sería un
  // typo silencioso hasta que alguien conecte un modelo real — se valida acá,
  // no en cada llamada de resolveModelForRole.
  for (const [role, roleCfg] of Object.entries(cfg.roles)) {
    if (!cfg.providers[roleCfg.provider]) {
      throw new Error(
        `El rol "${role}" referencia el provider "${roleCfg.provider}", que no está declarado en config/providers.yml`
      );
    }
  }

  cached = cfg;
  return cfg;
}

// Contrato estándar: cada rol se resuelve a un chat model de LangChain,
// sin importar el provider. Esto es lo que da "cualquier proveedor,
// cualquier modelo, mismo contrato".
export async function resolveModelForRole(role: string, cfg: OrchestratorConfig) {
  const roleCfg = cfg.roles[role];
  if (!roleCfg) {
    throw new Error(`Rol desconocido: ${role}`);
  }
  const providerCfg = cfg.providers[roleCfg.provider];
  switch (roleCfg.provider) {
    case "anthropic": {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return new ChatAnthropic({ model: roleCfg.model, maxTokens: roleCfg.maxTokens });
    }
    case "openai":
    case "openrouter": {
      const { ChatOpenAI } = await import("@langchain/openai");
      return new ChatOpenAI({
        model: roleCfg.model,
        configuration: providerCfg.baseUrl ? { baseURL: providerCfg.baseUrl } : undefined,
      });
    }
    default:
      throw new Error(`Provider desconocido: ${roleCfg.provider}`);
  }
}
