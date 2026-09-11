/**
 * De naamhelper van de klant (convex/lib/klantNaam.ts).
 *
 * Mickey wil voor- en achternaam apart kunnen invullen en op achternaam
 * kunnen sorteren, terwijl `klanten.naam` de weergavenaam blijft. Deze vier
 * functies zijn de enige plek waar die afspraak leeft:
 *
 * 1. `samengesteldeNaam` — voor + achter → weergavenaam (of de bestaande naam);
 * 2. `splitsNaam` — weergavenaam → voor + achter, tussenvoegsels bij de achternaam;
 * 3. `sorteerNaam` — sorteersleutel, "van der Berg" onder de V;
 * 4. `lijktBedrijfsnaam` — herkent een bedrijfsnaam, zodat de migratie die
 *    niet in een voor- en achternaam knipt.
 */

import { describe, it, expect } from "vitest";
import {
  TUSSENVOEGSELS,
  lijktBedrijfsnaam,
  naamPatchVoor,
  samengesteldeNaam,
  sorteerNaam,
  splitsNaam,
} from "../../../../convex/lib/klantNaam";

describe("samengesteldeNaam", () => {
  it("plakt voornaam en achternaam aan elkaar", () => {
    expect(
      samengesteldeNaam({ voornaam: "Jan", achternaam: "van der Berg", naam: "Oude naam" })
    ).toBe("Jan van der Berg");
  });

  it("werkt met alleen een voornaam of alleen een achternaam", () => {
    expect(samengesteldeNaam({ voornaam: "Jan", naam: "Oude naam" })).toBe("Jan");
    expect(samengesteldeNaam({ achternaam: "de Vries", naam: "Oude naam" })).toBe(
      "de Vries"
    );
  });

  it("valt terug op naam als beide leeg zijn", () => {
    expect(samengesteldeNaam({ naam: "Hoveniersbedrijf Groenveld B.V." })).toBe(
      "Hoveniersbedrijf Groenveld B.V."
    );
    expect(
      samengesteldeNaam({ voornaam: "  ", achternaam: "", naam: "Groenveld B.V." })
    ).toBe("Groenveld B.V.");
  });

  it("trimt losse spaties weg", () => {
    expect(
      samengesteldeNaam({ voornaam: "  Jan ", achternaam: " de Vries ", naam: "x" })
    ).toBe("Jan de Vries");
  });
});

describe("splitsNaam", () => {
  it("neemt het eerste woord als voornaam en de rest als achternaam", () => {
    expect(splitsNaam("Jan de Vries")).toEqual({
      voornaam: "Jan",
      achternaam: "de Vries",
    });
  });

  it("houdt Nederlandse tussenvoegsels bij de achternaam", () => {
    expect(splitsNaam("Jan van der Berg")).toEqual({
      voornaam: "Jan",
      achternaam: "van der Berg",
    });
    expect(splitsNaam("Mieke op den Kamp")).toEqual({
      voornaam: "Mieke",
      achternaam: "op den Kamp",
    });
  });

  it("geeft bij één woord een lege voornaam", () => {
    expect(splitsNaam("Vries")).toEqual({ voornaam: "", achternaam: "Vries" });
  });

  it("laat een naam die met een tussenvoegsel begint heel", () => {
    expect(splitsNaam("van der Berg")).toEqual({
      voornaam: "",
      achternaam: "van der Berg",
    });
    expect(splitsNaam("'t Hooft")).toEqual({ voornaam: "", achternaam: "'t Hooft" });
  });

  it("gaat om met dubbele spaties en lege invoer", () => {
    expect(splitsNaam("  Jan   de  Vries  ")).toEqual({
      voornaam: "Jan",
      achternaam: "de Vries",
    });
    expect(splitsNaam("   ")).toEqual({ voornaam: "", achternaam: "" });
    expect(splitsNaam("")).toEqual({ voornaam: "", achternaam: "" });
  });

  it("publiceert de tussenvoegsellijst voor hergebruik", () => {
    expect(TUSSENVOEGSELS).toContain("van");
    expect(TUSSENVOEGSELS).toContain("der");
    expect(TUSSENVOEGSELS).toContain("'t");
  });
});

describe("sorteerNaam", () => {
  it("sorteert op achternaam en dan voornaam, in kleine letters", () => {
    expect(
      sorteerNaam({ naam: "Jan de Vries", voornaam: "Jan", achternaam: "de Vries" })
    ).toBe("de vries jan");
  });

  it("houdt het tussenvoegsel vooraan: van der Berg onder de V", () => {
    const berg = sorteerNaam({
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
    });
    const aalten = sorteerNaam({
      naam: "Piet Aalten",
      voornaam: "Piet",
      achternaam: "Aalten",
    });
    const zwart = sorteerNaam({
      naam: "Ria Zwart",
      voornaam: "Ria",
      achternaam: "Zwart",
    });

    expect([zwart, berg, aalten].sort()).toEqual([aalten, berg, zwart]);
  });

  it("valt terug op naam als er geen achternaam is", () => {
    expect(sorteerNaam({ naam: "Hoveniersbedrijf Groenveld B.V." })).toBe(
      "hoveniersbedrijf groenveld b.v."
    );
    expect(sorteerNaam({ naam: "Jan de Vries", voornaam: "Jan" })).toBe("jan de vries");
  });

  it("sorteert een zakelijke klant altijd op de bedrijfsnaam", () => {
    // Voor- en achternaam zijn bij een bedrijf hooguit de contactpersoon; de
    // lijst hoort dan op de bedrijfsnaam te staan (schema-afspraak).
    expect(
      sorteerNaam({
        naam: "Groenveld B.V.",
        voornaam: "Petra",
        achternaam: "Janssen",
        klantType: "zakelijk",
      })
    ).toBe("groenveld b.v.");
    expect(
      sorteerNaam({
        naam: "Jan de Vries",
        voornaam: "Jan",
        achternaam: "de Vries",
        klantType: "particulier",
      })
    ).toBe("de vries jan");
  });
});

describe("lijktBedrijfsnaam", () => {
  it("herkent rechtsvormen en organisatiewoorden", () => {
    expect(lijktBedrijfsnaam("Hoveniersbedrijf Groenveld B.V.")).toBe(true);
    expect(lijktBedrijfsnaam("Groenveld BV")).toBe(true);
    expect(lijktBedrijfsnaam("Jansen VOF")).toBe(true);
    expect(lijktBedrijfsnaam("Jansen V.O.F.")).toBe(true);
    expect(lijktBedrijfsnaam("Bouwfonds NV")).toBe(true);
    expect(lijktBedrijfsnaam("Stichting Groenbeheer")).toBe(true);
    expect(lijktBedrijfsnaam("Gemeente Echt-Susteren")).toBe(true);
    expect(lijktBedrijfsnaam("VvE Parkzicht")).toBe(true);
    expect(lijktBedrijfsnaam("Berg Holding")).toBe(true);
    expect(lijktBedrijfsnaam("Smeets Advocaten")).toBe(true);
    expect(lijktBedrijfsnaam("Vastgoed Beheer")).toBe(true);
    expect(lijktBedrijfsnaam("Jansen & Zonen")).toBe(true);
  });

  it("kijkt niet naar hoofdletters", () => {
    expect(lijktBedrijfsnaam("groenveld b.v.")).toBe(true);
    expect(lijktBedrijfsnaam("vve parkzicht")).toBe(true);
  });

  it("laat persoonsnamen met rust", () => {
    expect(lijktBedrijfsnaam("Jan de Vries")).toBe(false);
    expect(lijktBedrijfsnaam("Mieke op den Kamp")).toBe(false);
    expect(lijktBedrijfsnaam("Bea Beheerder")).toBe(false);
    expect(lijktBedrijfsnaam("Nico Stichter")).toBe(false);
    expect(lijktBedrijfsnaam("")).toBe(false);
  });
});

/**
 * `naamPatchVoor` is de bewerkregel, gedeeld door het kantoorformulier
 * (`klanten.update`) en het portaal (`portaal.updateProfile`). Het portaal
 * stuurde eerst alleen `naam` en liet daarmee achterhaalde naamdelen staan:
 * een klant die zichzelf hernoemde, bleef in de kantoorlijst onder zijn oude
 * achternaam staan. Deze suite bewaakt de drie gevallen die dat verschil
 * maken.
 */
describe("naamPatchVoor", () => {
  const jan = { naam: "Jan de Vries", voornaam: "Jan", achternaam: "de Vries" };

  it("leidt naam af zodra er naamdelen meegaan", () => {
    expect(naamPatchVoor(jan, { achternaam: "Jansen" })).toEqual({
      achternaam: "Jansen",
      naam: "Jan Jansen",
    });
  });

  it("combineert meegestuurde naamdelen met een meegestuurde naam", () => {
    expect(
      naamPatchVoor(jan, { naam: "Onzin", voornaam: "Piet", achternaam: "Bakker" })
    ).toEqual({ naam: "Piet Bakker", voornaam: "Piet", achternaam: "Bakker" });
  });

  it("laat naam staan als beide naamdelen worden gewist", () => {
    const patch = naamPatchVoor(jan, { voornaam: undefined, achternaam: undefined });
    expect(patch.voornaam).toBeUndefined();
    expect(patch.achternaam).toBeUndefined();
    expect("naam" in patch).toBe(false);
  });

  it("laat de naamdelen staan als de naam er nog uit volgt", () => {
    expect(naamPatchVoor(jan, { naam: "Jan de Vries" })).toEqual({
      naam: "Jan de Vries",
    });
  });

  it("wist achterhaalde naamdelen als alleen een afwijkende naam meegaat", () => {
    const patch = naamPatchVoor(jan, { naam: "Jan Jansen" });
    expect(patch.naam).toBe("Jan Jansen");
    expect("voornaam" in patch).toBe(true);
    expect(patch.voornaam).toBeUndefined();
    expect("achternaam" in patch).toBe(true);
    expect(patch.achternaam).toBeUndefined();
  });

  it("raakt niets aan bij een klant zonder opgeslagen naamdelen", () => {
    expect(
      naamPatchVoor({ naam: "Groenveld B.V." }, { naam: "Groenveld Holding B.V." })
    ).toEqual({ naam: "Groenveld Holding B.V." });
  });

  it("geeft een lege patch als er niets meegestuurd wordt", () => {
    expect(naamPatchVoor(jan, {})).toEqual({});
  });
});
