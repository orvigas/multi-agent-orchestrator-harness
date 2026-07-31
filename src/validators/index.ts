import { ValidatorRegistry } from "./ValidatorRegistry.js";
import { JavaValidator } from "./JavaValidator.js";
import { PythonValidator } from "./PythonValidator.js";
import { GoValidator } from "./GoValidator.js";
import { RustValidator } from "./RustValidator.js";
import type { LanguageValidator } from "./LanguageValidator.js";

export * from "./LanguageValidator.js";
export { ValidatorRegistry } from "./ValidatorRegistry.js";
export { JavaValidator } from "./JavaValidator.js";
export { PythonValidator } from "./PythonValidator.js";
export { GoValidator } from "./GoValidator.js";
export { RustValidator } from "./RustValidator.js";

// Built-in validators
const BUILTIN_VALIDATORS: LanguageValidator[] = [
  new JavaValidator(),
  new PythonValidator(),
  new GoValidator(),
  new RustValidator(),
];

export function initializeValidators(): void {
  for (const validator of BUILTIN_VALIDATORS) {
    ValidatorRegistry.register(validator);
  }
}
