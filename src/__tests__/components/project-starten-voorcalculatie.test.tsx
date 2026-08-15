/**
 * "Start project" bij een geaccepteerde offerte (/projecten/nieuw?offerte=…).
 *
 * De pagina bood iedereen dezelfde knop en liet de server het verschil maken:
 * bij een offerte zonder voorcalculatie-record kreeg de gebruiker een rauwe
 * ConvexError te zien. Nu wijst de pagina de weg:
 *
 * | offerte                    | voorcalculatie | knop                  |
 * |----------------------------|----------------|-----------------------|
 * | aanleg-wizard              | ontbreekt      | Naar voorcalculatie   |
 * | aanleg-wizard              | aanwezig       | Project Aanmaken      |
 * | vrij (PRD §2.5b)           | bestaat niet   | Project Aanmaken      |
 * | onderhoud (route 1)        | bestaat niet   | Project Aanmaken      |
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/projecten/nieuw",
  useSearchParams: () => new URLSearchParams("offerte=off_1"),
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/page-header", () => ({ PageHeader: () => null }));

// jsdom heeft geen matchMedia; de pagina vraagt alleen de motion-voorkeur op.
vi.mock("@/hooks/use-accessibility", () => ({ useReducedMotion: () => true }));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ user: { _id: "users:1" }, isLoading: false }),
}));

let offerteDoc: Record<string, unknown> | null;
let voorcalculatieDoc: Record<string, unknown> | null;

// `api.x.y` is een proxy: elke property-toegang levert een nieuwe referentie,
// dus de functienaam is de enige stabiele sleutel.
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useQuery: (functie: unknown) => {
      const naam = getFunctionName(functie as never);
      if (naam === "offertes:get") return offerteDoc;
      if (naam === "voorcalculaties:getByOfferte") return voorcalculatieDoc;
      return null; // projecten:getByOfferte — nog geen project
    },
    useMutation: () => vi.fn(),
  };
});

const { default: NieuwProjectPage } = await import(
  "@/app/(dashboard)/projecten/nieuw/page"
);

const offerte = (overrides: Record<string, unknown> = {}) => ({
  _id: "off_1",
  offerteNummer: "OFF-2026-017",
  type: "aanleg",
  status: "geaccepteerd",
  bron: "wizard",
  klant: { naam: "Jan de Vries", plaats: "Amsterdam" },
  totalen: { totaalInclBtw: 4356 },
  regels: [],
  ...overrides,
});

async function toon() {
  await act(async () => {
    render(<NieuwProjectPage />);
  });
}

beforeEach(() => {
  push.mockClear();
  offerteDoc = offerte();
  voorcalculatieDoc = null;
});

describe("Nieuw project — voorcalculatie-wegwijzer", () => {
  it("stuurt een aanleg-wizard zonder voorcalculatie naar de voorcalculatiepagina", async () => {
    await toon();

    const link = screen.getByRole("link", { name: /naar voorcalculatie/i });
    expect(link).toHaveAttribute("href", "/offertes/off_1/voorcalculatie");
    expect(
      screen.queryByRole("button", { name: /project aanmaken/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/nog geen voorcalculatie ingevuld/i)).toBeInTheDocument();
  });

  it("laat een vrije offerte zonder voorcalculatie gewoon een project starten", async () => {
    offerteDoc = offerte({ bron: "vrij" });

    await toon();

    expect(
      screen.getByRole("button", { name: /project aanmaken/i })
    ).toBeEnabled();
    expect(
      screen.queryByRole("link", { name: /naar voorcalculatie/i })
    ).not.toBeInTheDocument();
  });

  it("laat een onderhoud-offerte zonder voorcalculatie een project starten", async () => {
    offerteDoc = offerte({ type: "onderhoud" });

    await toon();

    expect(
      screen.getByRole("button", { name: /project aanmaken/i })
    ).toBeEnabled();
  });

  it("toont de gewone knop zodra de wizard-offerte een voorcalculatie heeft", async () => {
    voorcalculatieDoc = { _id: "voorcalculaties:1", offerteId: "off_1" };

    await toon();

    expect(
      screen.getByRole("button", { name: /project aanmaken/i })
    ).toBeEnabled();
  });
});
