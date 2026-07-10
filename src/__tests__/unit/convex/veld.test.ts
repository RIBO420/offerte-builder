/**
 * Unit tests veld-rol: urensegmenten + afrondingsflow (PRD §2.6 + bijlage C,
 * fase 1 stap 9a).
 *
 * Dekt de acceptatietests (definition of done):
 * - §8.10 urensegmenten: een geplande dag levert voorgestelde segmenten uit
 *   de dagkaart-blokken (reistijd/klant/pauze); bevestigen wint van het
 *   voorstel (afgeleid tot bevestigd, geen dubbele opslag);
 * - §2.6 "Wie is achter": niet-gelogd bezoek → achterstand; gelogd maar
 *   boven de (instelbare) drempel → afwijking;
 * - §8.8 afronding: alles ✓ → alles-afgerond (uitgevoerd + facturatie-
 *   markering door de mutation); één taak ◐/○ → rest-taken mét resterende
 *   normtijd;
 * - §8.5 delta: standaardbus heeft alles behalve grasmaaier → checklist
 *   toont exact "grasmaaier";
 * - rolchecks: medewerker alleen de eigen dag; kantoor corrigeert/heropent.
 */

import { describe, it, expect } from "vitest";
import {
  berekenDagkaart,
  DAGKAART_DEFAULTS,
  type KlantStop,
} from "../../../../convex/dagkaartLogica";
import {
  beoordeelBezoek,
  berekenMateriaalDelta,
  blokkenNaarVoorstellen,
  DEFAULT_AFWIJKING_DREMPELS,
  filterVoorstellen,
  isGeldigSegmentTijdvak,
  magAfronden,
  magDagHeropenen,
  magDagVanMedewerker,
  magMeerwerkBeoordelen,
  magUrenLoggen,
  normaliseerItemNaam,
  overlapt,
  segmentMinuten,
  verdeelTaakAfronding,
  type AfrondTaakInvoer,
  type VeldRol,
} from "../../../../convex/veldLogica";

// ─── Test-hulpjes ────────────────────────────────────────────────────────────

const stop = (id: string, duurMinuten: number): KlantStop => ({
  werkitemId: id,
  adres: `${id}-straat 1, Emmen`,
  duurMinuten,
});

/**
 * Geplande dag: vertrek 07:00, 2 klanten, pauze 12:00–12:30 (defaults).
 * Klant B loopt over de pauze heen, zodat het pauzeblok verschijnt.
 */
const geplandeDagBlokken = () =>
  berekenDagkaart(DAGKAART_DEFAULTS, [stop("A", 240), stop("B", 120)], [
    20, 15, 25,
  ]);

// ─── §8.10 — Voorgestelde segmenten uit de geplande dag ─────────────────────

describe("voorinvulling uit de dagkaart (§8.10)", () => {
  it("vertaalt een geplande dag naar voorstellen: reistijd, werken (mét werkitem), pauze", () => {
    const voorstellen = blokkenNaarVoorstellen(geplandeDagBlokken());

    // 3 reistijden (heen, tussen, terug) + 2 klantblokken + 1 pauze
    expect(voorstellen.filter((v) => v.categorie === "reistijd")).toHaveLength(3);
    expect(voorstellen.filter((v) => v.categorie === "pauze")).toHaveLength(1);

    const werken = voorstellen.filter((v) => v.categorie === "werken");
    expect(werken).toHaveLength(2);
    expect(werken.map((w) => w.werkitemId)).toEqual(["A", "B"]);

    // Eerste voorstel: reistijd direct na vertrek 07:00
    expect(voorstellen[0]).toMatchObject({
      categorie: "reistijd",
      beginTijd: "07:00",
      eindTijd: "07:20",
    });
    // Eerste klantblok sluit aan op de reistijd
    expect(werken[0].beginTijd).toBe("07:20");
  });

  it("stelt vertrek-/einde-dag-markers en blokken zonder duur niet voor", () => {
    const voorstellen = blokkenNaarVoorstellen(geplandeDagBlokken());
    expect(voorstellen.every((v) => segmentMinuten(v) > 0)).toBe(true);
    // Alleen reistijd/werken/pauze — geen vertrek/loods_afronding/einde_dag
    expect(
      voorstellen.every((v) =>
        ["reistijd", "werken", "pauze"].includes(v.categorie)
      )
    ).toBe(true);
  });

  it("laat een voorstel vervallen zodra een opgeslagen segment het tijdvak dekt (bevestigen wint)", () => {
    const voorstellen = blokkenNaarVoorstellen(geplandeDagBlokken());
    const eerste = voorstellen[0];

    // De medewerker bevestigt (of corrigeert) het eerste segment
    const opgeslagen = [{ beginTijd: eerste.beginTijd, eindTijd: eerste.eindTijd }];
    const rest = filterVoorstellen(voorstellen, opgeslagen);

    expect(rest).toHaveLength(voorstellen.length - 1);
    expect(rest).not.toContainEqual(eerste);
  });

  it("laat ook een deels overlappend voorstel vervallen (gecorrigeerde tijden)", () => {
    const voorstellen = blokkenNaarVoorstellen(geplandeDagBlokken());
    // Correctie die over de eerste twee voorstellen heen loopt
    const opgeslagen = [{ beginTijd: "07:10", eindTijd: "07:40" }];
    const rest = filterVoorstellen(voorstellen, opgeslagen);
    expect(rest.length).toBeLessThan(voorstellen.length - 1);
  });

  it("valideert segment-tijdvakken (HH:MM, begin vóór eind)", () => {
    expect(isGeldigSegmentTijdvak("07:00", "08:30")).toBe(true);
    expect(isGeldigSegmentTijdvak("08:30", "07:00")).toBe(false);
    expect(isGeldigSegmentTijdvak("07:00", "07:00")).toBe(false);
    expect(isGeldigSegmentTijdvak("7:00", "08:00")).toBe(false);
    expect(isGeldigSegmentTijdvak("07:00", "24:30")).toBe(false);
  });

  it("detecteert overlap (grenzen raken mag)", () => {
    const a = { beginTijd: "08:00", eindTijd: "09:00" };
    expect(overlapt(a, { beginTijd: "08:30", eindTijd: "10:00" })).toBe(true);
    expect(overlapt(a, { beginTijd: "09:00", eindTijd: "10:00" })).toBe(false);
    expect(overlapt(a, { beginTijd: "07:00", eindTijd: "08:00" })).toBe(false);
  });
});

// ─── §2.6 — "Wie is achter": achterstanden & afwijkingen ────────────────────

describe('"Wie is achter" (§2.6): achterstand en afwijking', () => {
  const bezoek = { werkitemId: "A", geplandeMinuten: 120 };

  it("markeert een gepland bezoek zonder enige log als achterstand", () => {
    expect(beoordeelBezoek(bezoek, undefined)).toEqual({
      soort: "achterstand",
      werkitemId: "A",
    });
    expect(beoordeelBezoek(bezoek, 0).soort).toBe("achterstand");
  });

  it("keurt een log binnen de drempels goed", () => {
    // 10 min verschil = 8,3% → onder 15 min én onder 20%
    expect(beoordeelBezoek(bezoek, 110).soort).toBe("ok");
    expect(beoordeelBezoek(bezoek, 120).soort).toBe("ok");
  });

  it("signaleert een afwijking boven de minuten-drempel (>15 min)", () => {
    const uitkomst = beoordeelBezoek(bezoek, 100); // 20 min = 16,7%
    expect(uitkomst.soort).toBe("afwijking");
    if (uitkomst.soort === "afwijking") {
      expect(uitkomst.verschilMinuten).toBe(20);
      expect(uitkomst.verschilProcent).toBeCloseTo(16.7, 1);
    }
  });

  it("signaleert een afwijking boven de procent-drempel (>20%)", () => {
    // Kort bezoek: 40 gepland, 50 gelogd = 10 min (onder 15) maar 25%
    const uitkomst = beoordeelBezoek(
      { werkitemId: "B", geplandeMinuten: 40 },
      50
    );
    expect(uitkomst.soort).toBe("afwijking");
  });

  it("gebruikt instelbare drempels (PRD-aanname, Mickey bevestigt later)", () => {
    // Zelfde 20-minuten-verschil is ok met ruimere drempels …
    expect(
      beoordeelBezoek(bezoek, 100, { minuten: 30, procent: 50 }).soort
    ).toBe("ok");
    // … en een afwijking met strengere drempels
    expect(
      beoordeelBezoek(bezoek, 115, { minuten: 2, procent: 1 }).soort
    ).toBe("afwijking");
    expect(DEFAULT_AFWIJKING_DREMPELS).toEqual({ minuten: 15, procent: 20 });
  });

  it("telt te véél gelogde tijd ook als afwijking (absoluut verschil)", () => {
    expect(beoordeelBezoek(bezoek, 150).soort).toBe("afwijking");
  });
});

// ─── §8.8 — Afrondingsflow op taakniveau ────────────────────────────────────

describe("afrondingsflow (§8.8): alles ✓ of rest-opdracht", () => {
  const taak = (
    omschrijving: string,
    status: AfrondTaakInvoer["status"],
    normUren?: number | null
  ): AfrondTaakInvoer => ({ omschrijving, status, normUren });

  it("alles afgerond → allesAfgerond, geen rest-taken", () => {
    const uitkomst = verdeelTaakAfronding([
      taak("Maaien", "afgerond", 1.5),
      taak("Heg snoeien", "afgerond", 2),
    ]);
    expect(uitkomst.allesAfgerond).toBe(true);
    expect(uitkomst.restTaken).toHaveLength(0);
    expect(uitkomst.resterendeNormUren).toBeNull();
  });

  it("één taak begonnen-niet-af → rest-opdracht met die taak en resterende normtijd", () => {
    const uitkomst = verdeelTaakAfronding([
      taak("Maaien", "afgerond", 1.5),
      taak("Heg snoeien", "begonnen_niet_af", 2),
    ]);
    expect(uitkomst.allesAfgerond).toBe(false);
    expect(uitkomst.restTaken).toHaveLength(1);
    expect(uitkomst.restTaken[0].omschrijving).toBe("Heg snoeien");
    expect(uitkomst.resterendeNormUren).toBe(2);
  });

  it("niet-gestarte én begonnen taken gaan samen als rest, normuren opgeteld", () => {
    const uitkomst = verdeelTaakAfronding([
      taak("Maaien", "afgerond", 1.5),
      taak("Heg snoeien", "begonnen_niet_af", 2),
      taak("Borders wieden", "niet_gestart", 0.75),
    ]);
    expect(uitkomst.restTaken.map((t) => t.omschrijving)).toEqual([
      "Heg snoeien",
      "Borders wieden",
    ]);
    expect(uitkomst.resterendeNormUren).toBe(2.75);
  });

  it("onbekende normtijden → resterendeNormUren null (geen schijnprecisie)", () => {
    const uitkomst = verdeelTaakAfronding([
      taak("Maaien", "afgerond", 1),
      taak("Losse klus", "niet_gestart", null),
    ]);
    expect(uitkomst.restTaken).toHaveLength(1);
    expect(uitkomst.resterendeNormUren).toBeNull();
  });

  it("lege takenlijst is nooit 'alles afgerond'", () => {
    expect(verdeelTaakAfronding([]).allesAfgerond).toBe(false);
  });
});

// ─── §8.5 — Materiaaldelta ──────────────────────────────────────────────────

describe("materiaaldelta (§8.5): benodigd minus businventaris", () => {
  const benodigd = [
    { naam: "Grasmaaier", soort: "machine" as const },
    { naam: "Heggenschaar", soort: "machine" as const },
    { naam: "Graszaad", soort: "materiaal" as const },
  ];

  it("standaardbus heeft alles behalve grasmaaier → checklist toont alleen 'grasmaaier'", () => {
    const delta = berekenMateriaalDelta(benodigd, [
      "Heggenschaar",
      "Graszaad",
      "Bezem",
    ]);
    expect(delta).toEqual([{ naam: "Grasmaaier", soort: "machine" }]);
  });

  it("alles aan boord → lege checklist", () => {
    expect(
      berekenMateriaalDelta(benodigd, ["grasmaaier", "heggenschaar", "graszaad"])
    ).toEqual([]);
  });

  it("vergelijkt naam-genormaliseerd (hoofdletters/spaties) en ontdubbelt", () => {
    const delta = berekenMateriaalDelta(
      [
        { naam: "  Grasmaaier ", soort: "machine" },
        { naam: "GRASMAAIER", soort: "machine" },
      ],
      []
    );
    expect(delta).toHaveLength(1);
    expect(normaliseerItemNaam("  GRAS  maaier ")).toBe("gras maaier");
  });

  it("zonder businventaris is de delta alle benodigdheden (fail-closed)", () => {
    expect(berekenMateriaalDelta(benodigd, [])).toHaveLength(3);
  });
});

// ─── Rolchecks (§8.5/§8.8) ──────────────────────────────────────────────────

describe("rolchecks veld-rol", () => {
  const rollen: VeldRol[] = ["kantoor", "voorman", "medewerker", "klant"];

  it("uren loggen/bevestigen: interne rollen wel, klant niet", () => {
    expect(rollen.filter(magUrenLoggen)).toEqual([
      "kantoor",
      "voorman",
      "medewerker",
    ]);
  });

  it("dag heropenen/corrigeren: alleen kantoor", () => {
    expect(rollen.filter(magDagHeropenen)).toEqual(["kantoor"]);
  });

  it("afronden en meerwerk aanvragen: veld + kantoor; beoordelen: alleen kantoor", () => {
    expect(rollen.filter(magAfronden)).toEqual([
      "kantoor",
      "voorman",
      "medewerker",
    ]);
    expect(rollen.filter(magMeerwerkBeoordelen)).toEqual(["kantoor"]);
  });

  it("medewerker/voorman zien alleen de eigen dag; kantoor elke dag", () => {
    expect(magDagVanMedewerker("medewerker", "m1", "m1")).toBe(true);
    expect(magDagVanMedewerker("medewerker", "m1", "m2")).toBe(false);
    expect(magDagVanMedewerker("voorman", "m1", "m2")).toBe(false);
    expect(magDagVanMedewerker("medewerker", null, "m2")).toBe(false);
    expect(magDagVanMedewerker("kantoor", null, "m2")).toBe(true);
    expect(magDagVanMedewerker("klant", "m1", "m1")).toBe(false);
  });
});
