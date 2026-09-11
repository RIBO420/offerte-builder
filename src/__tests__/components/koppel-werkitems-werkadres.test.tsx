/**
 * Koppeldialoog bij acceptatie — het werkadres mag nooit stilzwijgend het
 * factuuradres worden.
 *
 * Het klantdossier komt met een eigen query binnen; zolang die onderweg is,
 * weet het scherm niet of deze klant een uitvoeradres heeft. Koppelen op dat
 * moment stuurde de ploeg naar het snapshot-adres van de offerte (= het
 * hoofdadres), zonder dat iemand dat zag. De knop wacht nu tot het dossier er
 * is. Tweede regel: de adreskeuze hoort niet mee te verhuizen naar de
 * volgende offerte, dus dicht = terug op "uitvoer".
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

/** Wat `api.klanten.get` teruggeeft: `undefined` = nog onderweg. */
let klantDossier: Record<string, unknown> | null | undefined;

const mutatie = vi.fn(async () => "werkitem_1");
vi.mock("convex/react", () => ({
  useMutation: () => mutatie,
  // Twee queries in dit scherm: de bouwstenenlijst (args `{}`) en het
  // klantdossier (args `{ id }`). Het dossier is wat deze suite stuurt.
  useQuery: (_ref: unknown, args: unknown) =>
    args && typeof args === "object" && "id" in args ? klantDossier : [],
}));

import { KoppelWerkitemsDialog } from "@/app/(dashboard)/offertes/[id]/components/koppel-werkitems-dialog";
import type { Doc } from "../../../convex/_generated/dataModel";

const OFFERTE = {
  _id: "offertes:1",
  klantId: "klanten:1",
  offerteNummer: "OF-2026-001",
  klant: {
    naam: "Jan de Vries",
    adres: "Hoofdweg 1",
    postcode: "1234 AB",
    plaats: "Meppel",
  },
  regels: [
    {
      id: "r1",
      scope: "bestrating",
      omschrijving: "Terras leggen",
      totaal: 1200,
      btwCode: 21,
    },
  ],
} as unknown as Doc<"offertes">;

const KLANT = {
  _id: "klanten:1",
  naam: "Jan de Vries",
  adres: "Hoofdweg 1",
  postcode: "1234 AB",
  plaats: "Meppel",
};

function toonDialoog(open = true) {
  return render(
    <KoppelWerkitemsDialog
      open={open}
      onOpenChange={() => {}}
      offerte={OFFERTE}
      onGekoppeld={async () => {}}
    />
  );
}

/** Eén toewijzing maken, zodat de koppelknop inhoudelijk klaar is. */
async function maakToewijzing(gebruiker: ReturnType<typeof userEvent.setup>) {
  await gebruiker.click(
    screen.getByLabelText("Selecteer regel Terras leggen")
  );
  await gebruiker.type(screen.getByLabelText("Naam werkitem"), "Terras");
  await gebruiker.click(screen.getByRole("button", { name: /Toewijzen/ }));
}

describe("KoppelWerkitemsDialog — wachten op het klantdossier", () => {
  beforeEach(() => {
    mutatie.mockClear();
  });

  it("houdt de koppelknop dicht zolang het dossier nog laadt", async () => {
    klantDossier = undefined;
    const gebruiker = userEvent.setup();
    toonDialoog();

    await maakToewijzing(gebruiker);

    expect(
      screen.getByRole("button", { name: /Koppel en accepteer/ })
    ).toBeDisabled();
  });

  it("geeft de knop vrij zodra het dossier binnen is", async () => {
    klantDossier = KLANT;
    const gebruiker = userEvent.setup();
    toonDialoog();

    await maakToewijzing(gebruiker);

    expect(
      screen.getByRole("button", { name: /Koppel en accepteer/ })
    ).toBeEnabled();
  });
});
