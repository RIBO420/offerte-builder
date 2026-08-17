/**
 * Contactgegevens in het klantdossier waren tot nu toe alleen te lézen: naam,
 * adres en e-mail wijzigen kon je alleen via de klantenlijst. Sinds de
 * Instellingen-tab een echt bewerkformulier heeft, staan hier de dingen vast
 * die anders stilletjes terugvallen:
 *
 * 1. Het formulier begint met wat er al is (geen leeg formulier dat bij
 *    opslaan de halve klant wist).
 * 2. TT-002: KvK, BTW, website en contactpersoon horen bij een zakelijke
 *    klant en verschijnen niet bij een particulier.
 * 3. Opslaan stuurt precies wat er staat naar `klanten.update` — inclusief de
 *    lege strings die een omgezet klanttype moeten wissen.
 * 4. Een ongeldige invoer blokkeert het opslaan en zegt bij het veld zelf wat
 *    er mis is; er gaat dan géén mutation de deur uit.
 * 5. Bij een geanonimiseerde klant is er geen "Wijzigen" — dat zou de
 *    GDPR-stap stilzwijgend terugdraaien.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom kent de Pointer Capture-API niet; Radix (Select) roept hem wél aan.
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
const toastFout = vi.fn();
const toastGoed = vi.fn();

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useMutation: (fn: unknown) =>
      getFunctionName(fn as never) === "klanten:update" ? updateKlant : vi.fn(),
    useQuery: () => null,
    // Places-suggesties in het adresveld: "niet beschikbaar" is de rust die
    // deze test wil — handmatig typen werkt altijd.
    useAction: () => vi.fn(async () => false),
  };
});

vi.mock("@/lib/toast-utils", () => ({
  showErrorToast: (bericht: string) => toastFout(bericht),
  showSuccessToast: (bericht: string) => toastGoed(bericht),
}));

vi.mock("@/hooks/use-users", () => ({
  useIsAdmin: () => true,
}));

import {
  ContactgegevensFormulier,
  TabInstellingen,
  type KlantInstellingenGegevens,
} from "@/components/klanten/dossier/tab-instellingen";
import type { Id } from "../../../convex/_generated/dataModel";

const ZAKELIJK: KlantInstellingenGegevens = {
  _id: "k1" as Id<"klanten">,
  naam: "De Groene Tuin B.V.",
  adres: "Moershei 3",
  postcode: "6374 NR",
  plaats: "Landgraaf",
  email: "info@groenetuin.nl",
  telefoon: "0612345678",
  klantType: "zakelijk",
  contactpersoon: "Jan Jansen",
  kvkNummer: "12345678",
  btwNummer: "NL123456789B01",
  website: "www.groenetuin.nl",
};

const PARTICULIER: KlantInstellingenGegevens = {
  _id: "k2" as Id<"klanten">,
  naam: "Alanys Rerimassie",
  adres: "Moershei 3",
  postcode: "6374 NR",
  plaats: "Landgraaf",
  email: "alanys@voorbeeld.nl",
  telefoon: "0680095331",
  klantType: "particulier",
};

beforeEach(() => {
  updateKlant.mockClear();
  toastFout.mockClear();
  toastGoed.mockClear();
});

describe("Contactgegevens bewerken", () => {
  it("begint met de gegevens die er al staan", () => {
    render(<ContactgegevensFormulier klant={ZAKELIJK} onKlaar={() => {}} />);

    expect(screen.getByLabelText("Bedrijfsnaam")).toHaveValue(
      "De Groene Tuin B.V."
    );
    expect(screen.getByLabelText("Contactpersoon")).toHaveValue("Jan Jansen");
    expect(screen.getByLabelText("Postcode")).toHaveValue("6374 NR");
    expect(screen.getByLabelText("Telefoon")).toHaveValue("0612345678");
    expect(screen.getByLabelText("KvK-nummer")).toHaveValue("12345678");
    expect(screen.getByLabelText("Website")).toHaveValue("www.groenetuin.nl");
  });

  it("laat de zakelijke velden weg bij een particulier (TT-002)", () => {
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    expect(screen.getByLabelText("Naam")).toHaveValue("Alanys Rerimassie");
    expect(screen.queryByLabelText("KvK-nummer")).toBeNull();
    expect(screen.queryByLabelText("BTW-nummer")).toBeNull();
    expect(screen.queryByLabelText("Contactpersoon")).toBeNull();
    expect(screen.queryByLabelText("Website")).toBeNull();
  });

  it("slaat een gewijzigd veld op via klanten.update en sluit het formulier", async () => {
    const gebruiker = userEvent.setup();
    const onKlaar = vi.fn();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={onKlaar} />);

    const telefoon = screen.getByLabelText("Telefoon");
    await gebruiker.clear(telefoon);
    await gebruiker.type(telefoon, "0687654321");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith({
      id: "k2",
      naam: "Alanys Rerimassie",
      adres: "Moershei 3",
      postcode: "6374 NR",
      plaats: "Landgraaf",
      email: "alanys@voorbeeld.nl",
      telefoon: "0687654321",
      klantType: "particulier",
      // Lege strings: alleen zo wist `klanten.update` een achtergebleven
      // zakelijk veld ook echt (undefined slaat hij over).
      contactpersoon: "",
      kvkNummer: "",
      btwNummer: "",
      website: "",
    });
    await waitFor(() => expect(onKlaar).toHaveBeenCalled());
    expect(toastGoed).toHaveBeenCalledWith("Contactgegevens bijgewerkt");
  });

  it("blokkeert opslaan bij een ongeldig e-mailadres", async () => {
    const gebruiker = userEvent.setup();
    const onKlaar = vi.fn();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={onKlaar} />);

    const email = screen.getByLabelText("E-mail");
    await gebruiker.clear(email);
    await gebruiker.type(email, "alanys-apenstaartje-weg");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByText("Ongeldig e-mailadres")).toBeInTheDocument();
    expect(updateKlant).not.toHaveBeenCalled();
    expect(onKlaar).not.toHaveBeenCalled();
  });

  it("blokkeert opslaan bij een lege verplichte naam", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    await gebruiker.clear(screen.getByLabelText("Naam"));
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByText("Naam is verplicht")).toBeInTheDocument();
    expect(updateKlant).not.toHaveBeenCalled();
  });
});

describe("Instellingen-tab", () => {
  it("klapt met Wijzigen om van weergave naar formulier en weer terug", async () => {
    const gebruiker = userEvent.setup();
    render(<TabInstellingen klant={PARTICULIER} isAnonymized={false} />);

    // Weergave: label/waarde-regels, geen invoervelden.
    expect(screen.getByText("Alanys Rerimassie")).toBeInTheDocument();
    expect(screen.queryByLabelText("Naam")).toBeNull();

    await gebruiker.click(screen.getByRole("button", { name: /Wijzigen/ }));
    expect(screen.getByLabelText("Naam")).toHaveValue("Alanys Rerimassie");

    // Annuleren gooit de wijziging weg: terug naar de oorspronkelijke waarde.
    await gebruiker.clear(screen.getByLabelText("Naam"));
    await gebruiker.type(screen.getByLabelText("Naam"), "Iets anders");
    await gebruiker.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(updateKlant).not.toHaveBeenCalled();
    expect(screen.getByText("Alanys Rerimassie")).toBeInTheDocument();
  });

  it("biedt bij een geanonimiseerde klant geen bewerkknop aan", () => {
    render(<TabInstellingen klant={PARTICULIER} isAnonymized />);

    expect(screen.queryByRole("button", { name: /Wijzigen/ })).toBeNull();
  });
});
