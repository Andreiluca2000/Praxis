import type { ErrorObject } from 'ajv';

/** Vorkompilierte Ajv-Prüfer (erzeugt von scripts/build-validators.ts). */
interface Validator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}
export declare const rules: Validator;
export declare const settings: Validator;
