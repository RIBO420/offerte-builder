/**
 * De sidebar staat standaard ingeklapt als iconenrand en klapt uit zodra je er
 * met de muis komt. Wie hem met de knop (of Cmd+B) vastpint, wil hem níét zien
 * dichtvallen zodra hij zijn muis wegneemt. Deze test legt beide kanten vast —
 * de hoverlaag en de pin die eroverheen gaat.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";

// Desktop: de hoverlaag bestaat niet op mobiel (daar is het een Sheet).
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function Balk() {
  return (
    <SidebarProvider defaultOpen={false}>
      <SidebarTrigger />
      <Sidebar variant="inset" collapsible="icon" aria-label="Hoofdnavigatie">
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

function balk() {
  const el = document.querySelector('[data-slot="sidebar"]');
  if (!el) throw new Error("sidebar niet gevonden");
  return el as HTMLElement;
}

function tik(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Sidebar hover-uitklap", () => {
  it("start ingeklapt, klapt uit bij hover en weer in als de muis weggaat", () => {
    render(<Balk />);
    expect(balk()).toHaveAttribute("data-state", "collapsed");

    fireEvent.mouseEnter(balk());
    // Korte vertraging: direct na binnenkomen gebeurt er nog niets.
    tik(50);
    expect(balk()).toHaveAttribute("data-state", "collapsed");

    tik(200);
    expect(balk()).toHaveAttribute("data-state", "expanded");

    fireEvent.mouseLeave(balk());
    tik(50);
    expect(balk()).toHaveAttribute("data-state", "expanded");

    tik(300);
    expect(balk()).toHaveAttribute("data-state", "collapsed");
  });

  it("laat een muis die er alleen langs schiet met rust", () => {
    render(<Balk />);

    fireEvent.mouseEnter(balk());
    tik(50);
    fireEvent.mouseLeave(balk());
    tik(500);

    expect(balk()).toHaveAttribute("data-state", "collapsed");
  });

  it("houdt een vastgepinde balk open als de muis weggaat", () => {
    const { getByRole } = render(<Balk />);

    fireEvent.click(getByRole("button", { name: /menu vastzetten/i }));
    expect(balk()).toHaveAttribute("data-state", "expanded");

    fireEvent.mouseEnter(balk());
    tik(300);
    fireEvent.mouseLeave(balk());
    tik(500);

    expect(balk()).toHaveAttribute("data-state", "expanded");
  });

  it("pint een door hover geopende balk vast met de knop", () => {
    const { getByRole } = render(<Balk />);

    fireEvent.mouseEnter(balk());
    tik(300);
    expect(balk()).toHaveAttribute("data-state", "expanded");

    // Klikken terwijl hij al openstaat betekent "houden", niet "dichtdoen".
    fireEvent.click(getByRole("button", { name: /menu vastzetten/i }));
    fireEvent.mouseLeave(balk());
    tik(500);
    expect(balk()).toHaveAttribute("data-state", "expanded");

    // En losmaken klapt hem meteen in, ook met de muis er nog op.
    fireEvent.mouseEnter(balk());
    tik(300);
    fireEvent.click(getByRole("button", { name: /menu inklappen/i }));
    tik(500);
    expect(balk()).toHaveAttribute("data-state", "collapsed");
  });
});
