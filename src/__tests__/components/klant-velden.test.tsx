/**
 * Eén klant wordt op drie plekken ingevoerd: de klantenlijst, het
 * aanmaakdialoog en het dossier (Instellingen → Contactgegevens). Die drie
 * hadden tot sep 2026 elk hun eigen kopie van dezelfde veldblokken — met als
 * gevolg dat hetzelfde veld op de ene plek "Adres *" heette en op de andere
 * "Adres (uitvoer) *", en dat de uitklapknop op één plek geen focusring had.
 *
 * Deze test legt vast wat de gedeelde componenten beloven:
 *
 * 1. Het klanttype bepaalt de naamvelden: een bedrijf heeft één naam, een
 *    particulier een voor- en een achternaam.
 * 2. De labels zijn overal hetzelfde (de dossier-variant is leidend).
 * 3. De uitklapknop van het uitvoeradres is bedienbaar met een screenreader:
 *    `aria-expanded` zegt of het blok open staat en `aria-describedby` wijst
 *    naar de toelichting die vertelt waar het blok voor is.
 * 4. Dichtklappen is de manier om een uitvoeradres te wissen — en dat levert
 *    de wispayload van `klanten.update` op, niet `undefined`.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
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
  } as never;
});

// Het adresveld vraagt Places om suggesties; "niet beschikbaar" is hier de
// rust die de test wil — handmatig typen werkt altijd.
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(async () => false),
  useQuery: () => null,
  useMutation: () => vi.fn(),
}));

import { NaamVelden } from "@/components/klanten/velden/naam-velden";
import { TelefoonVelden } from "@/components/klanten/velden/telefoon-velden";
import { UitvoeradresVelden } from "@/components/klanten/velden/uitvoeradres-velden";
import { uitvoerAdresPayload } from "@/components/klanten/velden/klant-formulier-logica";

const NAMEN = { naam: "De Groene Tuin B.V.", voornaam: "Jan", achternaam: "Jansen" };
const ADRES = { adres: "Kerkstraat 12", postcode: "6411 CA", plaats: "Heerlen" };
const LEEG_ADRES = { adres: "", postcode: "", plaats: "" };

describe("NaamVelden", () => {
  it("toont bij een particulier een voor- en een achternaam", () => {
    render(
      <NaamVelden
        klantType="particulier"
        waarden={NAMEN}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    expect(screen.getByLabelText("Voornaam")).toHaveValue("Jan");
    expect(screen.getByLabelText("Achternaam *")).toHaveValue("Jansen");
    expect(screen.queryByLabelText("Bedrijfsnaam *")).toBeNull();
  });

  it("toont bij een bedrijf één bedrijfsnaam", () => {
    render(
      <NaamVelden
        klantType="zakelijk"
        waarden={NAMEN}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    expect(screen.getByLabelText("Bedrijfsnaam *")).toHaveValue(
      "De Groene Tuin B.V."
    );
    expect(screen.queryByLabelText("Voornaam")).toBeNull();
    expect(screen.queryByLabelText("Achternaam *")).toBeNull();
  });

  it("toont de bedrijfsnaam ook bij de andere niet-particuliere typen", () => {
    render(
      <NaamVelden
        klantType="vve"
        waarden={NAMEN}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    expect(screen.getByLabelText("Bedrijfsnaam *")).toBeInTheDocument();
  });

  it("meldt elke toetsaanslag met veldnaam en waarde", async () => {
    const gebruiker = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NaamVelden
        klantType="particulier"
        waarden={{ ...NAMEN, achternaam: "" }}
        onChange={onChange}
        idPrefix="t"
      />
    );

    await gebruiker.type(screen.getByLabelText("Achternaam *"), "B");

    expect(onChange).toHaveBeenCalledWith("achternaam", "B");
  });

  it("zet de foutmelding bij het veld waar hij over gaat", () => {
    render(
      <NaamVelden
        klantType="particulier"
        waarden={NAMEN}
        onChange={() => {}}
        fouten={{ achternaam: "Achternaam is verplicht" }}
        idPrefix="t"
      />
    );

    expect(screen.getByText("Achternaam is verplicht")).toBeInTheDocument();
    expect(screen.getByLabelText("Achternaam *")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText("Voornaam")).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("geeft elk veld een eigen id, zodat twee formulieren naast elkaar kunnen", () => {
    render(
      <NaamVelden
        klantType="particulier"
        waarden={NAMEN}
        onChange={() => {}}
        idPrefix="nk"
      />
    );

    expect(screen.getByLabelText("Voornaam")).toHaveAttribute("id", "nk-voornaam");
  });
});

describe("TelefoonVelden", () => {
  it("toont beide nummers met dezelfde labels", () => {
    render(
      <TelefoonVelden
        waarden={{ telefoon: "0612345678", telefoon2: "0455710000" }}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    expect(screen.getByLabelText("Telefoon")).toHaveValue("0612345678");
    expect(screen.getByLabelText("Telefoon 2")).toHaveValue("0455710000");
  });

  it("meldt een wijziging van het tweede nummer apart", async () => {
    const gebruiker = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TelefoonVelden
        waarden={{ telefoon: "", telefoon2: "" }}
        onChange={onChange}
        idPrefix="t"
      />
    );

    await gebruiker.type(screen.getByLabelText("Telefoon 2"), "0");

    expect(onChange).toHaveBeenCalledWith("telefoon2", "0");
  });

  it("zet de foutmelding bij het nummer waar hij over gaat", () => {
    render(
      <TelefoonVelden
        waarden={{ telefoon: "", telefoon2: "12345" }}
        onChange={() => {}}
        fouten={{ telefoon2: "Ongeldig telefoonnummer" }}
        idPrefix="t"
      />
    );

    expect(screen.getByText("Ongeldig telefoonnummer")).toBeInTheDocument();
    expect(screen.getByLabelText("Telefoon 2")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});

describe("UitvoeradresVelden", () => {
  it("houdt de velden weg zolang het blok dicht staat", () => {
    render(
      <UitvoeradresVelden
        open={false}
        onOpenChange={() => {}}
        waarden={LEEG_ADRES}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    expect(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Plaats (uitvoer) *")).toBeNull();
  });

  it("toont de drie sub-labels zodra het blok open staat", () => {
    render(
      <UitvoeradresVelden
        open
        onOpenChange={() => {}}
        waarden={ADRES}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    const knop = screen.getByRole("button", { name: /Afwijkend uitvoeradres/ });
    expect(knop).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Adres (uitvoer) *")).toHaveValue("Kerkstraat 12");
    expect(screen.getByLabelText("Postcode (uitvoer) *")).toHaveValue("6411 CA");
    expect(screen.getByLabelText("Plaats (uitvoer) *")).toHaveValue("Heerlen");
  });

  it("wijst met aria-describedby naar de toelichting bij de knop", () => {
    render(
      <UitvoeradresVelden
        open={false}
        onOpenChange={() => {}}
        waarden={LEEG_ADRES}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    const knop = screen.getByRole("button", { name: /Afwijkend uitvoeradres/ });
    const beschrijving = knop.getAttribute("aria-describedby");
    expect(beschrijving).toBeTruthy();

    // De toelichting staat er ook als het blok dicht is: juist dán wil je
    // weten waar de knop voor is.
    const toelichting = document.getElementById(beschrijving!);
    expect(toelichting).toHaveTextContent(/Alleen invullen als het werk/);
  });

  it("klapt open en dicht via onOpenChange", async () => {
    const gebruiker = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <UitvoeradresVelden
        open={false}
        onOpenChange={onOpenChange}
        waarden={LEEG_ADRES}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    await gebruiker.click(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    );

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("meldt een wijziging met de veldnaam van het uitvoeradres", async () => {
    const gebruiker = userEvent.setup();
    const onChange = vi.fn();
    render(
      <UitvoeradresVelden
        open
        onOpenChange={() => {}}
        waarden={LEEG_ADRES}
        onChange={onChange}
        idPrefix="t"
      />
    );

    await gebruiker.type(screen.getByLabelText("Plaats (uitvoer) *"), "H");

    expect(onChange).toHaveBeenCalledWith("plaats", "H");
  });

  it("zet de foutmelding bij het veld waar hij over gaat", () => {
    render(
      <UitvoeradresVelden
        open
        onOpenChange={() => {}}
        waarden={{ ...ADRES, postcode: "" }}
        onChange={() => {}}
        fouten={{ postcode: "Postcode is verplicht" }}
        idPrefix="t"
      />
    );

    expect(screen.getByText("Postcode is verplicht")).toBeInTheDocument();
    expect(screen.getByLabelText("Postcode (uitvoer) *")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

  it("levert dichtklappen de wispayload van klanten.update op", async () => {
    const gebruiker = userEvent.setup();
    let open = true;
    const onOpenChange = vi.fn((volgende: boolean) => {
      open = volgende;
    });
    render(
      <UitvoeradresVelden
        open
        onOpenChange={onOpenChange}
        waarden={ADRES}
        onChange={() => {}}
        idPrefix="t"
      />
    );

    await gebruiker.click(
      screen.getByRole("button", { name: /Afwijkend uitvoeradres/ })
    );

    // Drie lege velden, niet `undefined`: dat laatste laat het opgeslagen
    // uitvoeradres juist staan.
    expect(open).toBe(false);
    expect(uitvoerAdresPayload(open, ADRES, "bijwerken")).toEqual({
      adres: "",
      postcode: "",
      plaats: "",
    });
  });
});
