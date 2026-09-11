import { describe, it, expect } from "vitest";
import {
  klantMatcht,
  zoekbareTekst,
  zoektermen,
} from "@/lib/klant-zoeken";

const JAN = {
  naam: "Jan de Vries",
  email: "jan@voorbeeld.nl",
  telefoon: "06-12 34 56 78",
  adres: "Dorpsstraat 24A",
  postcode: "6041 MA",
  plaats: "Roermond",
};

const BEDRIJF = {
  naam: "Hoveniersbedrijf Groenveld B.V.",
  contactpersoon: "Petra Janssen",
  email: "info@groenveld.nl",
  adres: "Industrieweg 8",
  postcode: "6101 XK",
  plaats: "Echt",
  kvkNummer: "12345678",
};

const zoek = (klant: Parameters<typeof zoekbareTekst>[0], invoer: string) =>
  klantMatcht(zoekbareTekst(klant), zoektermen(invoer));

describe("zoektermen", () => {
  it("splitst op spaties en negeert lege invoer", () => {
    expect(zoektermen("  jan   roermond ")).toEqual(["jan", "roermond"]);
    expect(zoektermen("   ")).toEqual([]);
    expect(zoektermen("")).toEqual([]);
  });
});

describe("klant zoeken", () => {
  it("vindt op naam, ongeacht hoofdletters", () => {
    expect(zoek(JAN, "vries")).toBe(true);
    expect(zoek(JAN, "JAN")).toBe(true);
  });

  it("vindt ook op velden waar de oude serverzoekopdracht niet naar keek", () => {
    expect(zoek(JAN, "roermond")).toBe(true);
    expect(zoek(JAN, "voorbeeld.nl")).toBe(true);
    expect(zoek(JAN, "dorpsstraat")).toBe(true);
    expect(zoek(BEDRIJF, "petra")).toBe(true);
    expect(zoek(BEDRIJF, "12345678")).toBe(true);
  });

  it("combineert losse woorden over verschillende velden", () => {
    expect(zoek(JAN, "jan roermond")).toBe(true);
    expect(zoek(JAN, "jan echt")).toBe(false);
  });

  it("vindt een telefoonnummer ook zonder scheidingstekens", () => {
    expect(zoek(JAN, "0612345678")).toBe(true);
    expect(zoek(JAN, "06-12")).toBe(true);
  });

  it("vindt een postcode met en zonder spatie", () => {
    expect(zoek(JAN, "6041MA")).toBe(true);
    expect(zoek(JAN, "6041 ma")).toBe(true);
  });

  it("geeft geen valse treffers", () => {
    expect(zoek(JAN, "groenveld")).toBe(false);
    expect(zoek(BEDRIJF, "roermond")).toBe(false);
  });

  it("vindt op de losse voor- en achternaam", () => {
    const gesplitst = {
      naam: "Jan van der Berg",
      voornaam: "Jan",
      achternaam: "van der Berg",
      plaats: "Echt",
    };
    expect(zoek(gesplitst, "berg")).toBe(true);
    expect(zoek(gesplitst, "van der berg echt")).toBe(true);
  });

  it("vindt op het tweede telefoonnummer, met en zonder scheidingstekens", () => {
    const twee = { naam: "Piet Houtermann", telefoon2: "046-443 39 18" };
    expect(zoek(twee, "0464433918")).toBe(true);
    expect(zoek(twee, "046-443")).toBe(true);
  });

  it("vindt op het afwijkende uitvoeradres", () => {
    const metUitvoer = {
      naam: "Jan de Vries",
      adres: "Dorpsstraat 24A",
      postcode: "6041 MA",
      plaats: "Roermond",
      uitvoerAdres: {
        adres: "Beukenlaan 3",
        postcode: "6121 JG",
        plaats: "Born",
      },
    };
    expect(zoek(metUitvoer, "beukenlaan")).toBe(true);
    expect(zoek(metUitvoer, "born")).toBe(true);
    expect(zoek(metUitvoer, "6121jg")).toBe(true);
  });

  it("gaat om met ontbrekende velden", () => {
    expect(zoek({ naam: "Losse klant" }, "losse")).toBe(true);
    expect(zoek({}, "wat dan ook")).toBe(false);
  });

  it("blijft snel bij een volle lijst", () => {
    // 270 klanten is de huidige omvang na de import; dit moet ruim binnen één
    // frame (16 ms) blijven, anders voelt typen alsnog traag.
    const lijst = Array.from({ length: 270 }, (_, i) => ({
      naam: `Klant ${i} de Vries`,
      email: `klant${i}@voorbeeld.nl`,
      telefoon: `06-1234567${i % 10}`,
      adres: `Dorpsstraat ${i}`,
      postcode: "6041 MA",
      plaats: i % 2 ? "Roermond" : "Echt",
    }));
    const index = lijst.map(zoekbareTekst);
    const termen = zoektermen("vries roermond");

    const start = performance.now();
    const treffers = index.filter((h) => klantMatcht(h, termen)).length;
    const duur = performance.now() - start;

    expect(treffers).toBe(135);
    expect(duur).toBeLessThan(16);
  });
});
