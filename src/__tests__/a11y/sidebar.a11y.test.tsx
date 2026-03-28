import { describe, it, vi } from "vitest";

/**
 * AppSidebar accessibility tests
 *
 * SKIPPED: The AppSidebar component has too many external dependencies
 * to render in isolation for unit-level a11y testing:
 *
 * - Clerk auth hooks: useUser(), useClerk() (requires ClerkProvider)
 * - Convex hooks: useQuery() with api.configuratorAanvragen (requires ConvexProvider)
 * - Custom hooks: useIsAdmin(), useCurrentUserRole() (depend on Convex)
 * - next-themes: useTheme() (requires ThemeProvider)
 * - Sidebar context: useSidebar() (requires SidebarProvider)
 * - NotificationCenter component (has its own Convex dependencies)
 * - next/navigation: usePathname()
 * - next/image: Image component
 *
 * Mocking all of these correctly while still testing meaningful
 * accessibility behavior would result in a fragile test that
 * mostly tests mock wiring rather than real a11y.
 *
 * Recommendation: Test sidebar a11y via integration/e2e tests
 * (e.g., Playwright with axe-core) where all providers are available.
 */

// Instead, test the structural sidebar primitives that AppSidebar is built from
import { expectNoA11yViolations } from "../a11y-helpers";
import { SidebarProvider } from "@/components/ui/sidebar";

// Mock next/navigation for SidebarProvider internals
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock use-mobile for sidebar responsive behavior
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

describe("Sidebar structure accessibility", () => {
  it("sidebar with navigation groups has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SidebarProvider>
        <Sidebar aria-label="Hoofdnavigatie">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg">
                  <span>Top Tuinen</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Werk</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Dashboard">
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Klanten">
                      <span>Klanten</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <span>Gebruiker</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider>
    );
  });

  it("sidebar with multiple groups and separators has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SidebarProvider>
        <Sidebar aria-label="Navigatie">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Werk</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive>
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Financieel</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <span>Offertes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <span>Facturen</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
  });

  it("collapsed sidebar (defaultOpen=false) has no a11y violations", async () => {
    await expectNoA11yViolations(
      <SidebarProvider defaultOpen={false}>
        <Sidebar aria-label="Navigatie">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Werk</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Dashboard">
                      <span>Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    );
  });
});
