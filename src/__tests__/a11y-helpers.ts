import { axe } from "vitest-axe";
import { render, type RenderResult } from "@testing-library/react";

// Matchers (toHaveNoViolations) are already extended in setup.ts via vitest-axe/matchers

/**
 * Renders a React element and asserts it has no axe accessibility violations.
 *
 * Usage:
 *   await expectNoA11yViolations(<Button>Click</Button>);
 *
 * Optionally pass axe configuration to customize rules:
 *   await expectNoA11yViolations(<Component />, { rules: { 'color-contrast': { enabled: false } } });
 */
export async function expectNoA11yViolations(
  ui: React.ReactElement,
  axeOptions?: Parameters<typeof axe>[1]
): Promise<RenderResult> {
  const renderResult = render(ui);
  const results = await axe(renderResult.container, axeOptions);
  expect(results).toHaveNoViolations();
  return renderResult;
}

/**
 * Runs axe on an already-rendered container element.
 * Useful when you need to interact with the component before checking a11y.
 *
 * Usage:
 *   const { container } = render(<Dialog open><DialogContent>...</DialogContent></Dialog>);
 *   await expectContainerAccessible(container);
 */
export async function expectContainerAccessible(
  container: HTMLElement,
  axeOptions?: Parameters<typeof axe>[1]
): Promise<void> {
  const results = await axe(container, axeOptions);
  expect(results).toHaveNoViolations();
}
