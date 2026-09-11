/**
 * Bijzonderheden zijn het antwoord op de vraag die elke collega bij een klant
 * stelt: "waar moet ik op letten?" — sleutel, hond, toegang, vaste
 * werkzaamheden. Ze staan daarom op twee plekken vast:
 *
 * 1. In Instellingen als eigen paneel: één tekstvak dat je bewerkt en opslaat,
 *    en een lege staat die uitlegt waar het blok voor is.
 * 2. Op Actueel als compacte strook bovenaan — alleen als er iets staat, en
 *    nooit meer dan twee regels hoog; de volle tekst zit in `title`.
 *
 * Wat hier vastligt: opslaan gaat via `klanten.update({ id, bijzonderheden })`
 * en leegmaken stuurt een lege string (de wisconventie van `klanten.update`).
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
  } as never;
});

const updateKlant = vi.fn(async () => undefined);
const toastGoed = vi.fn();
const toastFout = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) =>
      getFunctionName(fn as never) === "klanten:update" ? updateKlant : vi.fn(),
    useQuery: () => null,
    useAction: () => vi.fn(async () => false),
  };
});

vi.mock("@/lib/toast-utils", () => ({
  showErrorToast: (bericht: string) => toastFout(bericht),
  showSuccessToast: (bericht: string) => toastGoed(bericht),
}));

// De drie blokken van Actueel hebben elk hun eigen Convex-queries; deze test
// gaat over de strook erboven, niet over hun inhoud.
vi.mock("@/components/klanten/dossier/gesprek-composer", () => ({
  GesprekComposer: () => <div>gesprek-composer</div>,
}));
vi.mock("@/components/klanten/klant-taken-card", () => ({
  KlantTakenCard: () => <div>taken</div>,
}));
vi.mock("@/components/tijdlijn/klant-tijdlijn", () => ({
  KlantTijdlijn: () => <div>tijdlijn</div>,
}));

import {
  BijzonderhedenPaneel,
  type KlantInstellingenGegevens,
} from "@/components/klanten/dossier/tab-instellingen";
import { TabActueel } from "@/components/klanten/dossier/tab-actueel";
import type { Id } from "../../../convex/_generated/dataModel";

const TEKST = "Sleutel hangt in het kastje links; hond loopt los in de tuin.";

const KLANT: KlantInstellingenGegevens = {
  _id: "k1" as Id<"klanten">,
  naam: "Alanys Rerimassie",
  adres: "Moershei 3",
  postcode: "6374 NR",
  plaats: "Landgraaf",
  klantType: "particulier",
};

beforeEach(() => {
  updateKlant.mockClear();
  toastGoed.mockClear();
  toastFout.mockClear();
});

describe("Bijzonderheden-paneel", () => {
  it("legt bij een lege klant uit waar het blok voor is", () => {
    render(<BijzonderhedenPaneel klant={KLANT} magBewerken />);

    expect(
      screen.getByText(/Vaste bijzonderheden die elke collega moet weten/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bijzonderheden toevoegen/ })
    ).toBeInTheDocument();
  });

  it("slaat een nieuwe tekst op via klanten.update", async () => {
    const gebruiker = userEvent.setup();
    render(<BijzonderhedenPaneel klant={KLANT} magBewerken />);

    await gebruiker.click(
      screen.getByRole("button", { name: /Bijzonderheden toevoegen/ })
    );
    await gebruiker.type(screen.getByLabelText("Bijzonderheden"), TEKST);
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith({
      id: "k1",
      bijzonderheden: TEKST,
    });
    expect(toastGoed).toHaveBeenCalledWith("Bijzonderheden bijgewerkt");
  });

  it("wist de tekst met een lege string", async () => {
    const gebruiker = userEvent.setup();
    render(
      <BijzonderhedenPaneel
        klant={{ ...KLANT, bijzonderheden: TEKST }}
        magBewerken
      />
    );

    await gebruiker.click(screen.getByRole("button", { name: /Wijzigen/ }));
    await gebruiker.clear(screen.getByLabelText("Bijzonderheden"));
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith({ id: "k1", bijzonderheden: "" });
  });

  it("gooit met Annuleren de wijziging weg", async () => {
    const gebruiker = userEvent.setup();
    render(
      <BijzonderhedenPaneel
        klant={{ ...KLANT, bijzonderheden: TEKST }}
        magBewerken
      />
    );

    await gebruiker.click(screen.getByRole("button", { name: /Wijzigen/ }));
    await gebruiker.type(screen.getByLabelText("Bijzonderheden"), " en nog wat");
    await gebruiker.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(updateKlant).not.toHaveBeenCalled();
    expect(screen.getByText(TEKST)).toBeInTheDocument();
  });

  it("biedt een geanonimiseerde klant geen bewerkknop", () => {
    render(
      <BijzonderhedenPaneel
        klant={{ ...KLANT, bijzonderheden: TEKST }}
        magBewerken={false}
      />
    );

    expect(screen.queryByRole("button", { name: /Wijzigen/ })).toBeNull();
  });
});

describe("Bijzonderheden-strook op Actueel", () => {
  it("toont de tekst bovenaan met de volle tekst in title", () => {
    render(
      <TabActueel
        klantId={"k1" as Id<"klanten">}
        onNaarTijdlijn={() => {}}
        bijzonderheden={TEKST}
      />
    );

    const strook = screen.getByTitle(TEKST);
    expect(strook).toBeInTheDocument();
    expect(strook).toHaveTextContent(TEKST);
  });

  it("blijft weg als er niets is vastgelegd", () => {
    render(
      <TabActueel klantId={"k1" as Id<"klanten">} onNaarTijdlijn={() => {}} />
    );

    expect(screen.queryByText(/Bijzonderheden/)).toBeNull();
  });
});
