/**
 * De relatie-export van Top Tuinen, in miniatuur.
 *
 * Deze vorm heeft een paar eigenaardigheden die de import eerder stilzwijgend
 * lieten vallen, en die staan hier vast zodat ze niet terugkomen:
 *
 * 1. Het telefoonnummer staat verdeeld over "Telefoonnummer" en "Mobiel". In
 *    het echte klantbestand zat het in 182 van de 272 rijen alleen in "Mobiel";
 *    de import pakte één kolom en verloor die dus allemaal.
 * 2. Het volledige adres zit in de kolom "Plaats".
 * 3. Verschillende relaties delen één mailbox — een VvE-beheerder voert vier
 *    VvE's op één e-mailadres. Matchen op e-mail alleen zou die samenvoegen.
 * 4. "Klantnummer" is uniek per relatie en is daarmee de sleutel waarop een
 *    herhaalde import zichzelf herkent.
 */

import { describe, it, expect } from "vitest";
import { processKlantImportData } from "@/lib/klant-import-parser";

const KOP =
  "Type;Klantnummer;Bedrijfsnaam;Aanhef;Voornaam;Achternaam;E-mail;Categorie;Plaats;Telefoonnummer;Mobiel;Website";

const RIJEN = [
  // nummer alleen in Mobiel — het geval dat 182 keer voorkwam
  `Persoon;1004;;Mw.;Anja;Loijens;anja@voorbeeld.nl;Klant;Cannerweg 125, 6213 BA Maastricht;;06 21280584;`,
  // vast én mobiel: het tweede nummer mag niet verdwijnen
  `Persoon;1012;;Dhr.;Piet;Houtermann;piet@voorbeeld.nl;Klant;Dorpsstraat 4, 6121 AB Born;046 443 3918;06 21276398;`,
  // twee VvE's van dezelfde beheerder: zelfde mailbox, andere relatie
  `Bedrijf;1088;VvE Engelenkampstraat;;;;beheer@hetonvve.nl;Klant;Engelenkampstraat 1, 6131 JD Sittard;046 400 0001;;`,
  `Bedrijf;1117;VvE Ir. Lelystraat;;;;beheer@hetonvve.nl;Klant;Ir. Lelystraat 2, 6413 AB Heerlen;045 400 0002;;`,
  // echte dubbele rij: zelfde naam én postcode, ander klantnummer
  `Persoon;10041;;Dhr.;Loe;Bergevoet;loe@voorbeeld.nl;Klant;Kerkstraat 9, 6129 EM Urmond;;06 52605107;`,
  `Persoon;10045;;Dhr.;Loe;Bergevoet;loe@voorbeeld.nl;Klant;Kerkstraat 9, 6129 EM Urmond;;06 52605107;`,
  // bedrijf met contactpersoon en website
  `Bedrijf;1123;Amagard;Dhr.;Jan;Bakker;info@amagard.de;Leverancier;Königsbornerstraße 26a, 39175 Biederitz; +3139292599878;;http://www.amagard.com`,
].join("\n");

function parse(csv: string) {
  const regels = csv.split("\n").filter(Boolean);
  const kop = regels[0].split(";");
  return regels.slice(1).map((r) =>
    Object.fromEntries(r.split(";").map((v, i) => [kop[i], v.trim()]))
  );
}

const entries = processKlantImportData(parse(`${KOP}\n${RIJEN}`)).entries;
const zoek = (nr: string) => entries.find((e) => e.klantnummer === nr)!;

describe("relatie-export inlezen", () => {
  it("leest alle rijen", () => {
    expect(entries).toHaveLength(7);
  });

  it("pakt het nummer ook als het alleen in Mobiel staat", () => {
    expect(zoek("1004").telefoon).toBe("06 21280584");
  });

  it("bewaart het tweede nummer als er een vast én mobiel nummer is", () => {
    const piet = zoek("1012");
    expect(piet.telefoon).toBe("046 443 3918");
    expect(piet.extraTelefoon).toBe("06 21276398");
  });

  it("splitst het samengestelde adres uit de kolom Plaats", () => {
    const anja = zoek("1004");
    expect(anja.adres).toBe("Cannerweg 125");
    expect(anja.postcode).toBe("6213 BA");
    expect(anja.plaats).toBe("Maastricht");
  });

  it("leest klantnummer, website en contactpersoon", () => {
    const amagard = zoek("1123");
    expect(amagard.naam).toBe("Amagard");
    expect(amagard.contactpersoon).toBe("Jan Bakker");
    expect(amagard.website).toBe("http://www.amagard.com");
    expect(amagard.soort).toBe("leverancier");
  });

  it("herkent een buitenlandse postcode zonder de rij te weigeren", () => {
    const amagard = zoek("1123");
    expect(amagard.postcode).toBe("39175");
    expect(amagard.plaats).toBe("Biederitz");
    expect(amagard.opmerkingen).toContain("buitenlandse postcode");
  });
});

/**
 * De matchvolgorde uit convex/klanten.ts, los nagebouwd zodat de regels
 * testbaar zijn zonder Convex-runtime. Belangrijkste eigenschap: e-mail alleen
 * is géén match.
 */
function zoekBestaande<T extends Record<string, unknown>>(
  db: T[],
  rij: { naam: string; postcode: string; email?: string; klantnummer?: string }
): T | undefined {
  const naamKlein = rij.naam.toLowerCase();
  const pc = rij.postcode.replace(/\s/g, "").toLowerCase();
  return (
    (rij.klantnummer
      ? db.find((d) => d.klantnummer === rij.klantnummer)
      : undefined) ??
    db.find(
      (d) =>
        String(d.naam).toLowerCase() === naamKlein &&
        String(d.postcode ?? "").replace(/\s/g, "").toLowerCase() === pc
    ) ??
    (rij.email
      ? db.find(
          (d) =>
            String(d.email ?? "").toLowerCase() === rij.email!.toLowerCase() &&
            String(d.naam).toLowerCase() === naamKlein
        )
      : undefined)
  );
}

describe("bestaande relatie terugvinden", () => {
  it("houdt twee VvE's met dezelfde beheerder-mailbox uit elkaar", () => {
    const eerste = zoek("1088");
    const db = [
      {
        naam: eerste.naam,
        postcode: eerste.postcode,
        email: eerste.email,
        klantnummer: eerste.klantnummer,
      },
    ];
    // Zelfde e-mail, andere VvE: mag niet als bestaand worden gezien.
    expect(zoekBestaande(db, zoek("1117"))).toBeUndefined();
  });

  it("herkent dezelfde relatie op klantnummer", () => {
    const amagard = zoek("1123");
    const db = [{ naam: "Heel andere naam", postcode: "", email: "", klantnummer: "1123" }];
    expect(zoekBestaande(db, amagard)).toBeDefined();
  });

  it("herkent een echte dubbele rij op naam en postcode", () => {
    const eerste = zoek("10041");
    const db = [
      {
        naam: eerste.naam,
        postcode: eerste.postcode,
        email: eerste.email,
        klantnummer: eerste.klantnummer,
      },
    ];
    // Ander klantnummer, zelfde persoon op hetzelfde adres.
    expect(zoekBestaande(db, zoek("10045"))).toBeDefined();
  });
});

describe("aanvullen zonder overschrijven", () => {
  /** Alleen lege velden vullen — zoals de mutation het doet. */
  function vulAan(
    bestaand: Record<string, string | undefined>,
    rij: Record<string, string | undefined>
  ) {
    const patch: Record<string, string> = {};
    for (const veld of ["email", "telefoon", "adres", "postcode", "plaats"]) {
      const waarde = rij[veld];
      const huidig = bestaand[veld];
      if (waarde && !huidig?.trim()) patch[veld] = waarde;
    }
    return patch;
  }

  it("vult lege velden en laat ingevulde met rust", () => {
    const anja = zoek("1004");
    const bestaand = {
      email: "handmatig@ingevoerd.nl",
      telefoon: undefined,
      adres: "",
      postcode: "",
      plaats: "",
    };

    const patch = vulAan(bestaand, anja as unknown as Record<string, string>);

    expect(patch.email).toBeUndefined();
    expect(patch.telefoon).toBe("06 21280584");
    expect(patch.adres).toBe("Cannerweg 125");
  });

  it("levert een lege patch als er niets te halen valt", () => {
    const anja = zoek("1004");
    const patch = vulAan(
      anja as unknown as Record<string, string>,
      anja as unknown as Record<string, string>
    );
    expect(Object.keys(patch)).toHaveLength(0);
  });
});
