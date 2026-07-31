import { createYamlConfigLoader } from './yamlConfigLoader';
import { z } from 'zod';

const RoleSchema = z.object({
  provider: z.string(),
  model: z.string(),
  maxTokens: z.number(),
  description: z.string().optional(),
});

const ModeSchema = z.object({
  enabled: z.boolean(),
  description: z.string().optional(),
  useLLM: z.boolean(),
  fallbackToDeterministic: z.boolean().optional(),
});

const BudgetSchema = z.object({
  perSession: z.number(),
  monthly: z.number(),
  warnAt: z.number(),
});

const RefinementSchema = z.object({
  questions: z.array(z.string()),
  generateAdditionalQuestions: z.boolean().optional(),
  maxAdditionalQuestions: z.number().optional(),
});

const ComplexitySchema = z.object({
  useLLM: z.boolean(),
  fallbackToHeuristics: z.boolean().optional(),
  minComplexity: z.number(),
  maxComplexity: z.number(),
});

const FeaturesSchema = z.object({
  llmRefinement: z.boolean(),
  llmAcceptanceCriteria: z.boolean(),
  llmComplexityAnalysis: z.boolean(),
  llmTaskDivision: z.boolean(),
  experimental: z.boolean(),
});

export const ProductOwnerConfigSchema = z.object({
  roles: z.record(RoleSchema),
  modes: z.record(ModeSchema),
  budget: BudgetSchema,
  features: FeaturesSchema,
  refinement: RefinementSchema,
  complexity: ComplexitySchema,
});

export type ProductOwnerConfig = z.infer<typeof ProductOwnerConfigSchema>;
export type ProductOwnerRole = z.infer<typeof RoleSchema>;
export type ProductOwnerMode = z.infer<typeof ModeSchema>;

const configLoader = createYamlConfigLoader<ProductOwnerConfig>(
  'product-owner.yml',
  ProductOwnerConfigSchema
);

export function loadProductOwnerConfig(): ProductOwnerConfig {
  return configLoader();
}

export function getProductOwnerRole(roleName: string): ProductOwnerRole {
  const config = loadProductOwnerConfig();
  const role = config.roles[roleName];
  if (!role) {
    throw new Error(`Product Owner role '${roleName}' not found in configuration`);
  }
  return role;
}

export function isLLMModeEnabled(): boolean {
  const config = loadProductOwnerConfig();
  const mode = process.env.PO_MODE || 'deterministic';
  const modeConfig = config.modes[mode];
  return modeConfig?.enabled && modeConfig?.useLLM ? true : false;
}

export function getProductOwnerBudget(): { perSession: number; monthly: number; warnAt: number } {
  const config = loadProductOwnerConfig();
  return config.budget;
}

export function isFeatureEnabled(feature: keyof Omit<typeof FeaturesSchema>): boolean {
  const config = loadProductOwnerConfig();
  return (config.features as any)[feature] ?? false;
}
