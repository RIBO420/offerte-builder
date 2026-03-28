import { describe, it, vi } from "vitest";
import { Users, Search, Package, Activity } from "lucide-react";
import { expectNoA11yViolations } from "../a11y-helpers";
import { EmptyState } from "@/components/ui/empty-state";
import {
  NoKlanten,
  NoSearchResults,
  NoPrijsboekItems,
  NoRecentActivity,
  NoOffertes,
  NoProjecten,
} from "@/components/empty-states";

describe("EmptyState (base component) accessibility", () => {
  it("minimal EmptyState with title only has no a11y violations", async () => {
    await expectNoA11yViolations(
      <EmptyState title="Geen resultaten" />
    );
  });

  it("EmptyState with icon and description has no a11y violations", async () => {
    await expectNoA11yViolations(
      <EmptyState
        icon={<Users aria-hidden="true" />}
        title="Nog geen klanten"
        description="Je hebt nog geen klanten toegevoegd."
      />
    );
  });

  it("EmptyState with primary action has no a11y violations", async () => {
    await expectNoA11yViolations(
      <EmptyState
        icon={<Search aria-hidden="true" />}
        title="Geen resultaten"
        description="Probeer andere zoektermen."
        action={{
          label: "Zoekopdracht wissen",
          onClick: vi.fn(),
          variant: "outline",
        }}
      />
    );
  });

  it("EmptyState with primary and secondary actions has no a11y violations", async () => {
    await expectNoA11yViolations(
      <EmptyState
        icon={<Package aria-hidden="true" />}
        title="Geen items"
        description="Je prijsboek is nog leeg."
        action={{
          label: "Item toevoegen",
          onClick: vi.fn(),
        }}
        secondaryAction={{
          label: "Importeer uit CSV",
          onClick: vi.fn(),
        }}
      />
    );
  });

  it("EmptyState without icon has no a11y violations", async () => {
    await expectNoA11yViolations(
      <EmptyState
        title="Leeg"
        description="Er is niets om te tonen."
      />
    );
  });
});

describe("NoKlanten accessibility", () => {
  it("without action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoKlanten />);
  });

  it("with action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoKlanten onAction={vi.fn()} />);
  });
});

describe("NoSearchResults accessibility", () => {
  it("without action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoSearchResults />);
  });

  it("with action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoSearchResults onAction={vi.fn()} />);
  });
});

describe("NoPrijsboekItems accessibility", () => {
  it("without action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoPrijsboekItems />);
  });

  it("with action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoPrijsboekItems onAction={vi.fn()} />);
  });
});

describe("NoRecentActivity accessibility", () => {
  it("without action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoRecentActivity />);
  });

  it("with action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoRecentActivity onAction={vi.fn()} />);
  });
});

describe("NoOffertes accessibility", () => {
  it("without action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoOffertes />);
  });

  it("with action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoOffertes onAction={vi.fn()} />);
  });
});

describe("NoProjecten accessibility", () => {
  it("without action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoProjecten />);
  });

  it("with action has no a11y violations", async () => {
    await expectNoA11yViolations(<NoProjecten onAction={vi.fn()} />);
  });
});
