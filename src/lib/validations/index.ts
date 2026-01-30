// Klant validation
export * from "./klant";

// Aanleg scope validations
export * from "./aanleg-scopes";

// Onderhoud scope validations
export * from "./onderhoud-scopes";

// Re-export z for convenience
export { z } from "zod";

// Type-safe validation helper
import { z } from "zod";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

/**
 * Validates data against a Zod schema and returns typed result
 */
export function validateData<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Convert Zod errors to a simple Record<string, string>
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    errors[path] = issue.message;
  }
  return { success: false, errors };
}
