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
import {
  normaliseerImportTelefoon,
  vergelijkbareRelatienaam,
} from "../../../../convex/validators";

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
  // e-mailadres in de telefoonkolom; het echte nummer staat in Mobiel
  `Persoon;1190;;Mw.;Alicia;Icario;alicia@voorbeeld.nl;Klant;Kerkweg 3, 6131 AA Sittard;alicia_icario@hotmail.com;06 10101021;`,
  // buitenlands nummer — mag de rij niet laten sneuvelen
  `Persoon;1191;;Dhr.;Jil;Peltzer;jil@voorbeeld.nl;Klant;Hauptstr. 5, 52538 Selfkant;;+49 1522 3065320;`,
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
    expect(entries).toHaveLength(9);
  });

  it("negeert een e-mailadres in de telefoonkolom en pakt het echte nummer", () => {
    expect(zoek("1190").telefoon).toBe("06 10101021");
    expect(zoek("1190").extraTelefoon).toBeUndefined();
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

describe("telefoonnummers overleven de import", () => {
  it("laat buitenlandse nummers staan", () => {
    // Deze twaalf rijen sneuvelden eerder volledig: de strenge NL-validatie
    // gooide, en de import breekt per rij af — je verloor dus de hele klant.
    expect(normaliseerImportTelefoon("+49 1522 3065320")).toBe("+4915223065320");
    expect(normaliseerImportTelefoon("+1 510-316-8300")).toBe("+15103168300");
    expect(normaliseerImportTelefoon("+32 483 13 69 57")).toBe("+32483136957");
  });

  it("normaliseert 00-notatie naar +", () => {
    expect(normaliseerImportTelefoon("0032 483 136 957")).toBe("+32483136957");
  });

  it("laat een Nederlands nummer met spaties compact staan", () => {
    expect(normaliseerImportTelefoon("06 21280584")).toBe("0621280584");
  });

  it("laat een nummer staan dat niet aan een lengte voldoet", () => {
    // Dit staat zo in de bron; opschonen is aan kantoor, weggooien niet aan ons.
    expect(normaliseerImportTelefoon("+31146132257488273")).toBe("+31146132257488273");
  });

  it("weigert wat geen nummer is", () => {
    expect(normaliseerImportTelefoon("alicia_icario@hotmail.com")).toBeUndefined();
    expect(normaliseerImportTelefoon("onbekend")).toBeUndefined();
    expect(normaliseerImportTelefoon("-/-")).toBeUndefined();
    expect(normaliseerImportTelefoon("")).toBeUndefined();
  });
});

describe("rechtsvorm wegstrepen bij het vergelijken van namen", () => {
  it("ziet dezelfde leverancier ondanks B.V. of BV", () => {
    expect(vergelijkbareRelatienaam("Maxihuur Echt B.V.")).toBe(
      vergelijkbareRelatienaam("Maxihuur Echt BV")
    );
  });

  it("kent de vormen uit deze export", () => {
    expect(vergelijkbareRelatienaam("REMONDIS GmbH & Co.KG")).toBe("remondis");
    expect(vergelijkbareRelatienaam("Keizers Haaksbergen VOF")).toBe(
      "keizers haaksbergen"
    );
    expect(vergelijkbareRelatienaam("Wildkamp B.V.")).toBe("wildkamp");
  });

  it("knipt alleen achteraan, niet middenin een naam", () => {
    // Anders wordt "BV Sport" ineens "Sport" en matcht het met elke club.
    expect(vergelijkbareRelatienaam("BV Sport")).toBe("bv sport");
  });

  it("laat VvE en Stichting met rust", () => {
    // Dat zijn onderscheidende delen van de naam; twee VvE's uit elkaar houden
    // is belangrijker dan ze samenvoegen.
    expect(vergelijkbareRelatienaam("VvE Engelenkampstraat")).toBe(
      "vve engelenkampstraat"
    );
    expect(vergelijkbareRelatienaam("Stichting Kasteel Limbricht")).toBe(
      "stichting kasteel limbricht"
    );
    expect(vergelijkbareRelatienaam("VvE Engelenkampstraat")).not.toBe(
      vergelijkbareRelatienaam("VvE Ir. Lelystraat")
    );
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
  const naamKlein = vergelijkbareRelatienaam(rij.naam);
  const pc = rij.postcode.replace(/\s/g, "").toLowerCase();
  return (
    (rij.klantnummer
      ? db.find((d) => d.klantnummer === rij.klantnummer)
      : undefined) ??
    db.find(
      (d) =>
        vergelijkbareRelatienaam(String(d.naam)) === naamKlein &&
        String(d.postcode ?? "").replace(/\s/g, "").toLowerCase() === pc
    ) ??
    (rij.email
      ? db.find(
          (d) =>
            String(d.email ?? "").toLowerCase() === rij.email!.toLowerCase() &&
            vergelijkbareRelatienaam(String(d.naam)) === naamKlein
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
