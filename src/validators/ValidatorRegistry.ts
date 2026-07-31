import type { LanguageValidator } from "./LanguageValidator.js";

export class ValidatorRegistry {
  private static validators: Map<string, LanguageValidator> = new Map();

  static register(validator: LanguageValidator): void {
    ValidatorRegistry.validators.set(validator.language, validator);
  }

  static getValidator(language: string): LanguageValidator {
    const validator = ValidatorRegistry.validators.get(language);
    if (!validator) {
      throw new Error(`No validator found for language: ${language}`);
    }
    return validator;
  }

  static hasValidator(language: string): boolean {
    return ValidatorRegistry.validators.has(language);
  }

  static supportedLanguages(): string[] {
    return Array.from(ValidatorRegistry.validators.keys());
  }
}
