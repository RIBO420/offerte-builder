/**
 * De twee paden achter het entree-menu die eerder doodliepen:
 *
 * - `/offertes/nieuw/vrij` was een tussenscherm dat `?klantId=` niet las. Het is
 *   nu een doorgeefluik dat direct een leeg concept aanmaakt — mét de klant en
 *   zonder client-side offertenummer (dat reserveert de server).
 * - De Templates-Sheet roept `createOfferteFromTemplate` aan, dat tot nu toe
 *   nergens in de UI werd gebruikt; de klant uit het dossier gaat mee.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

beforeAll(() => {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const push = vi.fn();
let zoekparameters = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/offertes",
  useSearchParams: () => zoekparameters,
}));

const mutatie = vi.fn(async () => "offerte_uit_sjabloon");
vi.mock("convex/react", () => ({
  useMutation: () => mutatie,
  useQuery: () => undefined,
}));

const templates = [
  {
    _id: "tpl_1",
    naam: "Strakke stadstuin",
    omschrijving: "Bestrating met smalle borders",
    type: "aanleg" as const,
    scopes: ["grondwerk", "bestrating", "borders"],
    isSystem: false,
  },
];
vi.mock("@/hooks/use-standaardtuinen", () => ({
  useStandaardtuinen: () => ({
    templates,
    isLoading: false,
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { CommandProvider } from "@/components/providers/command-provider";
import {
  ShortcutsProvider,
  useShortcuts,
} from "@/components/providers/shortcuts-provider";
import { TemplatesSheet } from "@/components/offerte/templates-sheet";
import NieuweVrijeOffertePage from "@/app/(dashboard)/offertes/nieuw/vrij/page";
import type { Id } from "../../../convex/_generated/dataModel";

const KLANT_ID = "klant_123" as Id<"klanten">;

beforeEach(() => {
  push.mockClear();
  mutatie.mockClear();
  zoekparameters = new URLSearchParams();
});

describe("/offertes/nieuw/vrij is een doorgeefluik", () => {
  it("maakt één leeg concept aan en gaat door naar de regel-editor", async () => {
    render(<NieuweVrijeOffertePage />);

    await waitFor(() => expect(mutatie).toHaveBeenCalledTimes(1));
    expect(mutatie).toHaveBeenCalledWith({
      type: "aanleg",
      bron: "vrij",
      klantId: undefined,
      algemeenParams: { bereikbaarheid: "goed" },
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/offertes/offerte_uit_sjabloon/vrij")
    );
  });

  it("neemt `?klantId=` en `?type=` uit de URL mee (de verloren-klant-bug)", async () => {
    zoekparameters = new URLSearchParams({
      klantId: KLANT_ID,
      type: "onderhoud",
    });

    render(<NieuweVrijeOffertePage />);

    await waitFor(() =>
      expect(mutatie).toHaveBeenCalledWith(
        expect.objectContaining({ klantId: KLANT_ID, type: "onderhoud" })
      )
    );
  });
});

describe("Templates-Sheet", () => {
  function Opener({ klantId }: { klantId?: Id<"klanten"> }) {
    const { setShowTemplatesSheet } = useShortcuts();
    return (
      <button onClick={() => setShowTemplatesSheet(true, { klantId })}>
        open sheet
      </button>
    );
  }

  const opzet = (klantId?: Id<"klanten">) =>
    render(
      <CommandProvider>
        <ShortcutsProvider>
          <Opener klantId={klantId} />
          <TemplatesSheet />
        </ShortcutsProvider>
      </CommandProvider>
    );

  it("toont naam, type-badge en scope-tags per sjabloon", async () => {
    const gebruiker = userEvent.setup();
    opzet();

    await gebruiker.click(screen.getByRole("button", { name: "open sheet" }));

    expect(await screen.findByText("Strakke stadstuin")).toBeInTheDocument();
    expect(screen.getByText("Aanleg")).toBeInTheDocument();
    expect(screen.getByText("Grondwerk")).toBeInTheDocument();
    expect(screen.getByText("Bestrating")).toBeInTheDocument();
  });

  it("start met 'Gebruik deze' een offerte uit het sjabloon, mét de klant", async () => {
    const gebruiker = userEvent.setup();
    opzet(KLANT_ID);

    await gebruiker.click(screen.getByRole("button", { name: "open sheet" }));
    await gebruiker.click(
      await screen.findByRole("button", { name: /Gebruik deze/ })
    );

    await waitFor(() =>
      expect(mutatie).toHaveBeenCalledWith({
        templateId: "tpl_1",
        klantId: KLANT_ID,
      })
    );
    // S2 (eindschouw 15 aug): de landing was de detailpagina, en daar bleef
    // het bij "0 regels, € 0" — een sjabloon draagt scopes en hoeveelheden,
    // maar de regels rekent de browser uit. Het werkblad doet dat wél.
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/offertes/offerte_uit_sjabloon/bewerken"
      )
    );
  });
});
