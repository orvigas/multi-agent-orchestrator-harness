import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProvidersConfig } from "./loadConfig.js";

// Real: carga el registro compuesto (providers.yml + cada config/*.yml de
// capa) y confirma que ningún rol quedó apuntando a un provider inexistente
// — el tipo de typo que antes pasaba desapercibido porque nada llamaba
// resolveModelForRole en producción.
test("loadProvidersConfig: composes roles from every layer config, not just providers.yml", () => {
  const cfg = loadProvidersConfig();

  const expectedRoles = [
    "orchestrator",
    "discovery",
    "planner",
    "plan_validator",
    "retriever",
    "kb_verifier",
    "implementer",
    "recovery_diagnostician",
    "recovery_strategist",
    "quality_gate_reviewer",
  ];
  for (const role of expectedRoles) {
    assert.ok(cfg.roles[role], `esperaba que el rol "${role}" estuviera en el registro compuesto`);
  }
});

test("loadProvidersConfig: every role's provider is declared in providers.yml", () => {
  const cfg = loadProvidersConfig();

  for (const [role, roleCfg] of Object.entries(cfg.roles)) {
    assert.ok(
      cfg.providers[roleCfg.provider],
      `el rol "${role}" referencia el provider "${roleCfg.provider}", no declarado en providers.yml`
    );
  }
});

test("loadProvidersConfig: every declared provider has its apiKeyEnv set (placeholder or real)", () => {
  const cfg = loadProvidersConfig();

  for (const [name, p] of Object.entries(cfg.providers)) {
    assert.ok(process.env[p.apiKeyEnv], `falta ${p.apiKeyEnv} para el provider "${name}"`);
  }
});
