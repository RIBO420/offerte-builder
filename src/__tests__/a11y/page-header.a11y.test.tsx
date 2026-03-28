import { describe, it, vi } from "vitest";
import { expectNoA11yViolations } from "../a11y-helpers";
import { SidebarProvider } from "@/components/ui/sidebar";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/offertes",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock use-mobile hook (used by SmartBreadcrumb internally)
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Import after mocks
import { PageHeader } from "@/components/page-header";

/**
 * Helper to wrap PageHeader with required SidebarProvider context
 * (SidebarTrigger requires useSidebar context)
 */
function renderPageHeader(props: React.ComponentProps<typeof PageHeader> = {}) {
  return (
    <SidebarProvider>
      <PageHeader {...props} />
    </SidebarProvider>
  );
}

describe("PageHeader accessibility", () => {
  it("default PageHeader has no a11y violations", async () => {
    await expectNoA11yViolations(renderPageHeader());
  });

  it("PageHeader with custom labels has no a11y violations", async () => {
    await expectNoA11yViolations(
      renderPageHeader({
        customLabels: {
          "/dashboard/offertes": "Offerte voor Jan Jansen",
        },
      })
    );
  });

  it("PageHeader with children (action buttons) has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SidebarProvider>
        <PageHeader>
          <button type="button">Nieuwe offerte</button>
        </PageHeader>
      </SidebarProvider>
    );
  });

  it("PageHeader with showHomeIcon=false has no a11y violations", async () => {
    await expectNoA11yViolations(
      renderPageHeader({ showHomeIcon: false })
    );
  });

  it("PageHeader with maxItems has no a11y violations", async () => {
    await expectNoA11yViolations(
      renderPageHeader({ maxItems: 2 })
    );
  });
});
