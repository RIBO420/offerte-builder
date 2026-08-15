/**
 * S1/S2 (eindschouw 15 aug 2026): er leefden drie offerte-editors naast elkaar.
 * Sinds de éénwording is `/offertes/[id]/bewerken` een wissel:
 *
 * | bron   | status                     | editor                       |
 * |--------|----------------------------|------------------------------|
 * | wizard | concept, voorcalculatie    | het werkblad, op deze route  |
 * | wizard | verzonden/getekend/afgew.  | geen — terug naar de offerte |
 * | vrij   | elke status                | `/offertes/[id]/vrij`        |
 *
 * De statusgrens is dezelfde als die van `offertes.koppelKlant`: zodra de
 * offerte naar de klant is gegaan, hoort een autosave-werkblad er niet meer
 * ongevraagd in te schrijven.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/offertes/off_1/bewerken",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

// Het werkblad zelf heeft een eigen (zwaar getest) binnenwerk; hier telt
// alleen of het gemónteerd wordt, en met welk document.
vi.mock("@/components/offerte/werkbank", () => ({
  Werkbank: ({ type, offerteId }: { type: string; offerteId?: string }) => (
    <div data-testid="werkbank" data-type={type} data-offerte={offerteId} />
  ),
}));
vi.mock("@/components/offerte/werkbank/werkbank-skelet", () => ({
  WerkbankSkelet: () => <div data-testid="skelet" />,
}));
vi.mock("@/components/page-header", () => ({ PageHeader: () => null }));

let document_: Record<string, unknown> | null | undefined;
vi.mock("convex/react", () => ({
  useQuery: () => document_,
  useMutation: () => vi.fn(),
}));

const { default: OfferteBewerkenPage } = await import(
  "@/app/(dashboard)/offertes/[id]/bewerken/page"
);

async function toon() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <OfferteBewerkenPage params={Promise.resolve({ id: "off_1" })} />
      </Suspense>
    );
  });
}

const offerte = (
  overrides: Partial<{ bron: string; status: string; type: string }> = {}
) => ({
  _id: "off_1",
  offerteNummer: "OFF-2026-050",
  type: "aanleg",
  status: "concept",
  bron: "wizard",
  regels: [],
  ...overrides,
});

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  document_ = offerte();
});

describe("/offertes/[id]/bewerken — welke editor opent", () => {
  it("opent het werkblad voor een wizard-offerte in concept", async () => {
    await toon();
    const werkbank = screen.getByTestId("werkbank");
    expect(werkbank.dataset.type).toBe("aanleg");
    expect(werkbank.dataset.offerte).toBe("off_1");
    expect(replace).not.toHaveBeenCalled();
  });

  it("opent het werkblad ook in voorcalculatie", async () => {
    document_ = offerte({ status: "voorcalculatie" });
    await toon();
    expect(screen.getByTestId("werkbank")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("geeft het onderhoudswerkblad voor een onderhoudsofferte", async () => {
    document_ = offerte({ type: "onderhoud" });
    await toon();
    expect(screen.getByTestId("werkbank").dataset.type).toBe("onderhoud");
  });

  it("stuurt een vrije offerte door naar de regel-editor", async () => {
    document_ = offerte({ bron: "vrij" });
    await toon();
    expect(replace).toHaveBeenCalledWith("/offertes/off_1/vrij");
    expect(screen.queryByTestId("werkbank")).toBeNull();
  });

  it("stuurt een vrije offerte ook door als hij al verzonden is", async () => {
    document_ = offerte({ bron: "vrij", status: "verzonden" });
    await toon();
    expect(replace).toHaveBeenCalledWith("/offertes/off_1/vrij");
  });

  it.each(["verzonden", "geaccepteerd", "afgewezen"])(
    "opent geen werkblad voor een offerte met status %s",
    async (status) => {
      document_ = offerte({ status });
      await toon();
      expect(replace).toHaveBeenCalledWith("/offertes/off_1");
      expect(screen.queryByTestId("werkbank")).toBeNull();
    }
  );

  it("toont het silhouet zolang de offerte nog laadt", async () => {
    document_ = undefined;
    await toon();
    expect(screen.getByTestId("skelet")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("meldt netjes dat de offerte niet bestaat", async () => {
    document_ = null;
    await toon();
    expect(screen.getByText("Offerte niet gevonden")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
