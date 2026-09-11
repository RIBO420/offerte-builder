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
 *
 * Sinds de klantfeedback van Mickey (sep 2026) staan hier ook de vier nieuwe
 * gegevens vast: voor-/achternaam bij een particulier (met `naam` als
 * afgeleide), een tweede telefoonnummer, een afwijkend uitvoeradres dat
 * alleen compleet de deur uit mag, en het bijzonderheden-blok.
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

/** Dezelfde particulier, maar met alles wat sep 2026 toevoegde ingevuld. */
const PARTICULIER_COMPLEET: KlantInstellingenGegevens = {
  ...PARTICULIER,
  _id: "k3" as Id<"klanten">,
  voornaam: "Alanys",
  achternaam: "Rerimassie",
  telefoon2: "0455710000",
  bijzonderheden: "Sleutel hangt in het kastje; hond loopt los in de tuin.",
  uitvoerAdres: {
    adres: "Kerkstraat 12",
    postcode: "6411 CA",
    plaats: "Heerlen",
  },
};

/** Wat `klanten.update` na een ongewijzigd formulier hoort te krijgen. */
const BASIS_PAYLOAD = {
  id: "k2",
  naam: "Alanys Rerimassie",
  voornaam: "Alanys",
  achternaam: "Rerimassie",
  adres: "Moershei 3",
  postcode: "6374 NR",
  plaats: "Landgraaf",
  // Dicht (of leeg) uitvoeradres = wissen; drie lege velden is de afspraak
  // uit `klanten.update`, net als "" bij e-mail.
  uitvoerAdres: { adres: "", postcode: "", plaats: "" },
  email: "alanys@voorbeeld.nl",
  telefoon: "0680095331",
  telefoon2: "",
  klantType: "particulier" as const,
  contactpersoon: "",
  kvkNummer: "",
  btwNummer: "",
  website: "",
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

    // Een particulier heeft geen bedrijfsnaam maar een voor- en achternaam;
    // die splitst `splitsNaam` uit de opgeslagen naam zolang de losse velden
    // nog leeg zijn (klanten van vóór sep 2026).
    expect(screen.getByLabelText("Voornaam")).toHaveValue("Alanys");
    expect(screen.getByLabelText("Achternaam")).toHaveValue("Rerimassie");
    expect(screen.queryByLabelText("Bedrijfsnaam")).toBeNull();
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
    // Lege strings: alleen zo wist `klanten.update` een achtergebleven
    // zakelijk veld ook echt (undefined slaat hij over).
    expect(updateKlant).toHaveBeenCalledWith({
      ...BASIS_PAYLOAD,
      telefoon: "0687654321",
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

  it("blokkeert opslaan bij een lege verplichte achternaam", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    // Bij een particulier is de achternaam het enige naamveld in beeld; leeg
    // laten zou de oude naam stilzwijgend laten staan.
    await gebruiker.clear(screen.getByLabelText("Voornaam"));
    await gebruiker.clear(screen.getByLabelText("Achternaam"));
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByText("Achternaam is verplicht")).toBeInTheDocument();
    expect(updateKlant).not.toHaveBeenCalled();
  });

  it("blokkeert opslaan bij een lege bedrijfsnaam", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={ZAKELIJK} onKlaar={() => {}} />);

    await gebruiker.clear(screen.getByLabelText("Bedrijfsnaam"));
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByText("Naam is verplicht")).toBeInTheDocument();
    expect(updateKlant).not.toHaveBeenCalled();
  });
});

describe("Voor- en achternaam", () => {
  it("leidt `naam` af uit voornaam + achternaam", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    await gebruiker.clear(screen.getByLabelText("Voornaam"));
    await gebruiker.type(screen.getByLabelText("Voornaam"), "Alanis");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith({
      ...BASIS_PAYLOAD,
      naam: "Alanis Rerimassie",
      voornaam: "Alanis",
    });
  });

  it("houdt een tussenvoegsel bij de achternaam", async () => {
    render(
      <ContactgegevensFormulier
        klant={{ ...PARTICULIER, naam: "van der Berg" }}
        onKlaar={() => {}}
      />
    );

    expect(screen.getByLabelText("Voornaam")).toHaveValue("");
    expect(screen.getByLabelText("Achternaam")).toHaveValue("van der Berg");
  });

  it("wist voor- en achternaam bij een zakelijke klant", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={ZAKELIJK} onKlaar={() => {}} />);

    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith(
      expect.objectContaining({
        naam: "De Groene Tuin B.V.",
        voornaam: "",
        achternaam: "",
      })
    );
  });
});

describe("Tweede telefoonnummer", () => {
  it("slaat een geldig tweede nummer op", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    await gebruiker.type(screen.getByLabelText("Telefoon 2"), "045-5710000");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    // Dezelfde opschoning als bij `telefoon`: streepjes en spaties eruit.
    expect(updateKlant).toHaveBeenCalledWith({
      ...BASIS_PAYLOAD,
      telefoon2: "0455710000",
    });
  });

  it("blokkeert opslaan bij een ongeldig tweede nummer", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    await gebruiker.type(screen.getByLabelText("Telefoon 2"), "12345");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(
      await screen.findByText(/Ongeldig telefoonnummer/)
    ).toBeInTheDocument();
    expect(updateKlant).not.toHaveBeenCalled();
  });
});

describe("Afwijkend uitvoeradres", () => {
  it("staat dicht zolang er geen uitvoeradres is", () => {
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    expect(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Plaats (uitvoer)")).toBeNull();
  });

  it("staat open zodra de klant er een heeft", () => {
    render(
      <ContactgegevensFormulier klant={PARTICULIER_COMPLEET} onKlaar={() => {}} />
    );

    expect(screen.getByLabelText("Adres (uitvoer)")).toHaveValue(
      "Kerkstraat 12"
    );
    expect(screen.getByLabelText("Postcode (uitvoer)")).toHaveValue("6411 CA");
    expect(screen.getByLabelText("Plaats (uitvoer)")).toHaveValue("Heerlen");
  });

  it("eist een compleet uitvoeradres zodra er iets ingevuld staat", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    await gebruiker.click(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    );
    await gebruiker.type(screen.getByLabelText("Adres (uitvoer)"), "Kerkstraat 12");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    expect(await screen.findByText("Postcode is verplicht")).toBeInTheDocument();
    expect(screen.getByText("Plaats is verplicht")).toBeInTheDocument();
    expect(updateKlant).not.toHaveBeenCalled();
  });

  it("stuurt een compleet uitvoeradres mee", async () => {
    const gebruiker = userEvent.setup();
    render(<ContactgegevensFormulier klant={PARTICULIER} onKlaar={() => {}} />);

    await gebruiker.click(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    );
    await gebruiker.type(screen.getByLabelText("Adres (uitvoer)"), "Kerkstraat 12");
    await gebruiker.type(screen.getByLabelText("Postcode (uitvoer)"), "6411ca");
    await gebruiker.type(screen.getByLabelText("Plaats (uitvoer)"), "Heerlen");
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith({
      ...BASIS_PAYLOAD,
      // Postcode wordt net als het hoofdadres genormaliseerd.
      uitvoerAdres: {
        adres: "Kerkstraat 12",
        postcode: "6411 CA",
        plaats: "Heerlen",
      },
    });
  });

  it("wist het uitvoeradres door het blok dicht te klappen", async () => {
    const gebruiker = userEvent.setup();
    render(
      <ContactgegevensFormulier klant={PARTICULIER_COMPLEET} onKlaar={() => {}} />
    );

    await gebruiker.click(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    );
    await gebruiker.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(updateKlant).toHaveBeenCalledTimes(1));
    expect(updateKlant).toHaveBeenCalledWith(
      expect.objectContaining({
        uitvoerAdres: { adres: "", postcode: "", plaats: "" },
      })
    );
  });
});

describe("Instellingen-tab", () => {
  it("klapt met Wijzigen om van weergave naar formulier en weer terug", async () => {
    const gebruiker = userEvent.setup();
    render(<TabInstellingen klant={PARTICULIER} isAnonymized={false} />);

    // Weergave: label/waarde-regels, geen invoervelden. Een particulier staat
    // er als voor- én achternaam, niet als één naamregel.
    expect(screen.getByText("Rerimassie")).toBeInTheDocument();
    expect(screen.queryByLabelText("Achternaam")).toBeNull();

    // Het bewerkknopje van Contactgegevens, niet dat van Bijzonderheden.
    const wijzigen = screen.getAllByRole("button", { name: /Wijzigen/ });
    await gebruiker.click(wijzigen[0]);
    expect(screen.getByLabelText("Achternaam")).toHaveValue("Rerimassie");

    // Annuleren gooit de wijziging weg: terug naar de oorspronkelijke waarde.
    await gebruiker.clear(screen.getByLabelText("Achternaam"));
    await gebruiker.type(screen.getByLabelText("Achternaam"), "Iets anders");
    await gebruiker.click(screen.getByRole("button", { name: "Annuleren" }));

    expect(updateKlant).not.toHaveBeenCalled();
    expect(screen.getByText("Rerimassie")).toBeInTheDocument();
  });

  it("biedt bij een geanonimiseerde klant geen bewerkknop aan", () => {
    render(<TabInstellingen klant={PARTICULIER} isAnonymized />);

    expect(screen.queryByRole("button", { name: /Wijzigen/ })).toBeNull();
  });
});
