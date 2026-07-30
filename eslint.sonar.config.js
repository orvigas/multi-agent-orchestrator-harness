import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

// Config AISLADO del eslint.config.js real (Capa 5, "lint" stage): este solo
// existe para el check "sonar" de la Capa 7 (code smells reales vía
// eslint-plugin-sonarjs, un sustituto honesto de SonarQube — ver ADR-style
// nota en 07-quality-gate-howto.md sección 1). No debe afectar el resultado
// de `npx eslint .` normal.
export default tseslint.config(
  { ignores: ["node_modules", "dist"] },
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tseslint.parser },
    ...sonarjs.configs.recommended,
  }
);
