import fs from "node:fs";
import yaml from "js-yaml";
import "dotenv/config";

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
