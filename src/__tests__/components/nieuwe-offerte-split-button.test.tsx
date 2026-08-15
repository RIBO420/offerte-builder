/**
 * De entree naar een nieuwe offerte (masterplan offerte-entree, fase A).
 *
 * Twee dingen moeten hier vastliggen, want beide zijn eerder stilzwijgend
 * misgegaan:
 *
 * 1. De hoofdklik blijft de tegel-dialog. De dropdown is een toevoeging, geen
 *    tussenstation: wie op "Nieuwe offerte" drukt ziet meteen de acht tegels.
 * 2. `klantId` reist door álle paden. Vanuit een klantdossier ging de klant
 *    eerder verloren op de vrije route (`?klantId=` werd daar nooit gelezen).
 *    En omgekeerd: zodra de ingang sluit moet de klantcontext weg zijn, anders
 *    start de volgende ⌘N ongemerkt een offerte voor de vorige klant.
 * 3. De vrije route laat je het type kiezen (eindschouw S5). Hij startte altijd
 *    `aanleg`; onderhoud kon alleen via de URL. Beide typen moeten vanuit het
 *    menu bereikbaar zijn — en het blijven er exact twee (TT-004).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix' menu's roepen hem wél aan.
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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/offertes",
  useSearchParams: () => new URLSearchParams(),
}));

const createOfferte = vi.fn(
  async (_argumenten: Record<string, unknown>) => "offerte_abc"
);
vi.mock("convex/react", () => ({
  useMutation: () => createOfferte,
  useQuery: () => undefined,
}));

import { CommandProvider } from "@/components/providers/command-provider";
import {
  ShortcutsProvider,
  useShortcuts,
} from "@/components/providers/shortcuts-provider";
import { NewOfferteDialog } from "@/components/new-offerte-dialog";
import { NieuweOfferteSplitButton } from "@/components/offerte/nieuwe-offerte-split-button";
import type { Id } from "../../../convex/_generated/dataModel";

const KLANT_ID = "klant_123" as Id<"klanten">;

/** Leest de klantcontext uit, zodat de Templates-ingang testbaar is zonder Sheet. */
function ContextProbe() {
  const { showTemplatesSheet, nieuweOfferteKlantId } = useShortcuts();
  return (
    <div>
      <span data-testid="templates-open">{String(showTemplatesSheet)}</span>
      <span data-testid="klant-context">{nieuweOfferteKlantId ?? "geen"}</span>
    </div>
  );
}

function opzet(props?: { klantId?: Id<"klanten"> }) {
  return render(
    <CommandProvider>
      <ShortcutsProvider>
        <NieuweOfferteSplitButton {...props} />
        <NewOfferteDialog />
        <ContextProbe />
      </ShortcutsProvider>
    </CommandProvider>
  );
}

const openMenu = async (gebruiker: ReturnType<typeof userEvent.setup>) => {
  await gebruiker.click(
    screen.getByRole("button", { name: "Meer manieren om te starten" })
  );
  await screen.findByRole("menuitem", { name: /Vrije offerte . aanleg/ });
};

/** De vrije rij van één type; "Vrije offerte" alleen is sinds S5 dubbelzinnig. */
const vrijeRij = (type: "aanleg" | "onderhoud") =>
  screen.getByRole("menuitem", { name: new RegExp(`Vrije offerte . ${type}`) });

beforeEach(() => {
  push.mockClear();
  createOfferte.mockClear();
});

describe("Split-button Nieuwe offerte", () => {
  it("opent met de hoofdklik direct de tegel-dialog, zonder tussenmenu", async () => {
    const gebruiker = userEvent.setup();
    opzet();

    await gebruiker.click(screen.getByRole("button", { name: /Nieuwe offerte/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tuinaanleg/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Overige diensten/ })
    ).toBeInTheDocument();
  });

  it("toont in het chevron-menu vier rijke rijen met sneltoetsen", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    const rijen = screen.getAllByRole("menuitem");
    expect(rijen).toHaveLength(4);
    expect(rijen[0]).toHaveTextContent("Vrije offerte · aanleg");
    expect(rijen[0]).toHaveTextContent("eenmalig werk of maatwerk");
    expect(rijen[0]).toHaveTextContent("V");
    expect(rijen[1]).toHaveTextContent("Vrije offerte · onderhoud");
    expect(rijen[1]).toHaveTextContent("terugkerend onderhoudswerk");
    expect(rijen[1]).toHaveTextContent("O");
    expect(rijen[2]).toHaveTextContent("Scopes kiezen");
    expect(rijen[2]).toHaveTextContent("S");
    expect(rijen[3]).toHaveTextContent("Templates");
    expect(rijen[3]).toHaveTextContent("T");
  });

  it("maakt via de vrije aanleg-rij meteen een leeg concept en gaat naar de editor", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    await gebruiker.click(vrijeRij("aanleg"));

    await waitFor(() => expect(createOfferte).toHaveBeenCalledTimes(1));
    expect(createOfferte).toHaveBeenCalledWith(
      expect.objectContaining({ type: "aanleg", bron: "vrij" })
    );
    // Geen offertenummer meesturen: dat reserveert de server (raceconditie A6).
    expect(createOfferte.mock.calls[0][0]).not.toHaveProperty("offerteNummer");
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/offertes/offerte_abc/vrij")
    );
  });

  it("start via de vrije onderhoud-rij een offerte van type onderhoud (S5)", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    await gebruiker.click(vrijeRij("onderhoud"));

    await waitFor(() => expect(createOfferte).toHaveBeenCalledTimes(1));
    expect(createOfferte).toHaveBeenCalledWith(
      expect.objectContaining({ type: "onderhoud", bron: "vrij" })
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/offertes/offerte_abc/vrij")
    );
  });

  it("biedt exact twee vrije typen aan — nooit een derde (TT-004)", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    const vrijeRijen = screen
      .getAllByRole("menuitem")
      .filter((rij) => rij.textContent?.includes("Vrije offerte"));

    expect(vrijeRijen).toHaveLength(2);
  });

  it("opent via 'Templates' de Templates-Sheet", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    await gebruiker.click(screen.getByRole("menuitem", { name: /Templates/ }));

    await waitFor(() =>
      expect(screen.getByTestId("templates-open")).toHaveTextContent("true")
    );
  });

  it("laat 'Scopes kiezen' op dezelfde tegel-dialog uitkomen als de hoofdklik", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    await gebruiker.click(screen.getByRole("menuitem", { name: /Scopes kiezen/ }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("Sneltoetsen V/O/S/T", () => {
  it("werken zolang het menu open staat", async () => {
    const gebruiker = userEvent.setup();
    opzet();
    await openMenu(gebruiker);

    await gebruiker.keyboard("t");

    await waitFor(() =>
      expect(screen.getByTestId("templates-open")).toHaveTextContent("true")
    );
  });

  it("kiezen met V en O het type van de vrije offerte", async () => {
    for (const [toets, type] of [
      ["v", "aanleg"],
      ["o", "onderhoud"],
    ] as const) {
      const gebruiker = userEvent.setup();
      const scherm = opzet();
      await openMenu(gebruiker);

      await gebruiker.keyboard(toets);

      await waitFor(() =>
        expect(createOfferte).toHaveBeenCalledWith(
          expect.objectContaining({ type, bron: "vrij" })
        )
      );
      scherm.unmount();
      createOfferte.mockClear();
    }
  });

  it("doen niets zolang het menu dicht is (geen nieuwe globale letters)", async () => {
    const gebruiker = userEvent.setup();
    opzet();

    await gebruiker.keyboard("v");
    await gebruiker.keyboard("o");
    await gebruiker.keyboard("t");

    expect(createOfferte).not.toHaveBeenCalled();
    expect(screen.getByTestId("templates-open")).toHaveTextContent("false");
  });
});

describe("klantId-doorgifte vanaf een klantdossier", () => {
  it("geeft de klant mee aan het tegel-pad", async () => {
    const gebruiker = userEvent.setup();
    opzet({ klantId: KLANT_ID });

    await gebruiker.click(screen.getByRole("button", { name: /Nieuwe offerte/ }));
    await gebruiker.click(await screen.findByRole("button", { name: /Bestrating/ }));

    expect(push).toHaveBeenCalledWith(
      "/offertes/nieuw/aanleg?scope=bestrating&klantId=klant_123"
    );
  });

  it("geeft de klant mee aan beide vrije typen", async () => {
    for (const type of ["aanleg", "onderhoud"] as const) {
      const gebruiker = userEvent.setup();
      const scherm = opzet({ klantId: KLANT_ID });
      await openMenu(gebruiker);

      await gebruiker.click(vrijeRij(type));

      await waitFor(() =>
        expect(createOfferte).toHaveBeenCalledWith(
          expect.objectContaining({ klantId: KLANT_ID, bron: "vrij", type })
        )
      );
      scherm.unmount();
      createOfferte.mockClear();
    }
  });

  it("geeft de klant mee aan de Templates-Sheet", async () => {
    const gebruiker = userEvent.setup();
    opzet({ klantId: KLANT_ID });
    await openMenu(gebruiker);

    await gebruiker.click(screen.getByRole("menuitem", { name: /Templates/ }));

    await waitFor(() =>
      expect(screen.getByTestId("klant-context")).toHaveTextContent(KLANT_ID)
    );
  });

  it("wist de klantcontext zodra de ingang sluit", async () => {
    const gebruiker = userEvent.setup();
    opzet({ klantId: KLANT_ID });

    await gebruiker.click(screen.getByRole("button", { name: /Nieuwe offerte/ }));
    await screen.findByRole("dialog");
    expect(screen.getByTestId("klant-context")).toHaveTextContent(KLANT_ID);

    await gebruiker.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.getByTestId("klant-context")).toHaveTextContent("geen")
    );
  });
});
