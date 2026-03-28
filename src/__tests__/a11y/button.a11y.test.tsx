import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button accessibility", () => {
  it("default button has no a11y violations", async () => {
    const { container } = render(<Button>Opslaan</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("destructive variant has no a11y violations", async () => {
    const { container } = render(
      <Button variant="destructive">Verwijderen</Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("outline variant has no a11y violations", async () => {
    const { container } = render(
      <Button variant="outline">Annuleren</Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("secondary variant has no a11y violations", async () => {
    const { container } = render(
      <Button variant="secondary">Secundair</Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ghost variant has no a11y violations", async () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("link variant has no a11y violations", async () => {
    const { container } = render(<Button variant="link">Link</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("disabled button has no a11y violations", async () => {
    const { container } = render(<Button disabled>Uitgeschakeld</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("icon button with aria-label has no a11y violations", async () => {
    const { container } = render(
      <Button variant="ghost" size="icon" aria-label="Sluiten">
        <svg aria-hidden="true" width="16" height="16" />
      </Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
