import { ValidatorRegistry } from "./ValidatorRegistry.js";
import type { LanguageValidator } from "./LanguageValidator.js";

export * from "./LanguageValidator.js";
export { ValidatorRegistry } from "./ValidatorRegistry.js";

// Built-in validators would go here
// For now, they are registered as needed
const BUILTIN_VALIDATORS: LanguageValidator[] = [];

export function initializeValidators(): void {
  for (const validator of BUILTIN_VALIDATORS) {
    ValidatorRegistry.register(validator);
  }
}
