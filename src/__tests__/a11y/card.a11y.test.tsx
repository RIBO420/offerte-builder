import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, it, expect } from "vitest";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

describe("Card accessibility", () => {
  it("basic card with content has no a11y violations", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Offerte overzicht</CardTitle>
          <CardDescription>Bekijk uw recente offertes</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Hier staat de inhoud van de kaart.</p>
        </CardContent>
        <CardFooter>
          <Button>Bekijken</Button>
        </CardFooter>
      </Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("card with subtle variant has no a11y violations", async () => {
    const { container } = render(
      <Card variant="subtle">
        <CardContent>
          <p>Subtiele kaart inhoud.</p>
        </CardContent>
      </Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("card with elevated variant has no a11y violations", async () => {
    const { container } = render(
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Uitgelichte kaart</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Inhoud met verhoogde stijl.</p>
        </CardContent>
      </Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("minimal card without header has no a11y violations", async () => {
    const { container } = render(
      <Card>
        <CardContent>
          <p>Alleen inhoud, geen header.</p>
        </CardContent>
      </Card>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
