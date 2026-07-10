// Type-augmentatie voor vitest-axe: setup.ts registreert de matchers via
// expect.extend(matchers), maar vitest-axe levert zelf geen module-augmentatie
// voor vitest. Hiermee kennen de a11y-tests toHaveNoViolations().
//
// De "lege" interfaces hieronder zijn declaration merging (voegen leden toe aan
// bestaande vitest-interfaces) en dus niet equivalent aan hun supertype;
// no-empty-object-type slaat hier onterecht aan.
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  interface Assertion<T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
