import { ValidatorRegistry } from "./ValidatorRegistry.js";
import { JavaValidator } from "./JavaValidator.js";
import { PythonValidator } from "./PythonValidator.js";
import type { LanguageValidator } from "./LanguageValidator.js";

export * from "./LanguageValidator.js";
export { ValidatorRegistry } from "./ValidatorRegistry.js";
export { JavaValidator } from "./JavaValidator.js";
export { PythonValidator } from "./PythonValidator.js";

// Built-in validators
const BUILTIN_VALIDATORS: LanguageValidator[] = [new JavaValidator(), new PythonValidator()];

export function initializeValidators(): void {
  for (const validator of BUILTIN_VALIDATORS) {
    ValidatorRegistry.register(validator);
  }
}
