// Type-augmentatie voor vitest-axe: setup.ts registreert de matchers via
// expect.extend(matchers), maar vitest-axe levert zelf geen module-augmentatie
// voor vitest. Hiermee kennen de a11y-tests toHaveNoViolations().
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
