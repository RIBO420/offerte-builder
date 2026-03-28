import { describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../a11y-helpers";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/offertes/abc123/bewerken",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock use-mobile hook — default to desktop
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Import after mocks
import { SmartBreadcrumb } from "@/components/ui/smart-breadcrumb";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";

describe("SmartBreadcrumb accessibility", () => {
  it("breadcrumb with single item has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb
        items={[{ label: "Dashboard" }]}
        showHomeIcon={false}
      />
    );
  });

  it("breadcrumb with multiple items has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb
        items={[
          { label: "Offertes", href: "/offertes" },
          { label: "Offerte #abc123", href: "/offertes/abc123" },
          { label: "Bewerken" },
        ]}
      />
    );
  });

  it("breadcrumb with home icon has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb
        items={[
          { label: "Klanten", href: "/klanten" },
          { label: "Klant Details" },
        ]}
        showHomeIcon={true}
      />
    );
  });

  it("breadcrumb without home icon has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb
        items={[
          { label: "Instellingen", href: "/instellingen" },
          { label: "Machines" },
        ]}
        showHomeIcon={false}
      />
    );
  });

  it("breadcrumb with collapsed items (ellipsis dropdown) has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projecten", href: "/projecten" },
          { label: "Project X", href: "/projecten/123" },
          { label: "Kosten", href: "/projecten/123/kosten" },
          { label: "Details" },
        ]}
        maxItems={3}
      />
    );
  });

  it("breadcrumb with no items renders nothing (no violations)", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb items={[]} />
    );
  });

  it("breadcrumb with custom icons has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SmartBreadcrumb
        items={[
          {
            label: "Offertes",
            href: "/offertes",
            icon: <svg aria-hidden="true" width="16" height="16" />,
          },
          { label: "Nieuwe offerte" },
        ]}
      />
    );
  });
});

describe("BreadcrumbNav accessibility", () => {
  it("default BreadcrumbNav has no a11y violations", async () => {
    await expectNoA11yViolations(<BreadcrumbNav />);
  });

  it("BreadcrumbNav with custom labels has no a11y violations", async () => {
    await expectNoA11yViolations(
      <BreadcrumbNav
        customLabels={{
          "/offertes/abc123": "Offerte voor Jan Jansen",
        }}
      />
    );
  });

  it("BreadcrumbNav with skipSegments has no a11y violations", async () => {
    await expectNoA11yViolations(
      <BreadcrumbNav skipSegments={["dashboard"]} />
    );
  });

  it("BreadcrumbNav with showHomeIcon=false has no a11y violations", async () => {
    await expectNoA11yViolations(
      <BreadcrumbNav showHomeIcon={false} />
    );
  });
});
