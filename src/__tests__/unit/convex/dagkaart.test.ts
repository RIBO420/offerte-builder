/**
 * Unit tests route-dagkaart + tijdcascade (PRD §2.2 weergave 2, stap 5b).
 *
 * Dekt de §8.9-cascade-test (definition of done):
 * - +15 minuten op klantblok A → alle vertrek- en aankomsttijden erna
 *   schuiven automatisch door;
 * - klant A en B omwisselen neemt taken én reistijden als één blok mee;
 * - handmatige overrides blijven ALTIJD leidend en worden nooit
 *   overschreven door herberekening;
 * - pauze blijft op de vaste tijd (werk eroverheen pauzeert);
 * - standaardblokken (vertrek loods, pauze, loods-afronding, einde-dag)
 *   worden automatisch geplaatst;
 * - ReistijdProvider: geen GOOGLE_MAPS_API_KEY → standaard-minuten
 *   (fail-closed, Maps gemockt — nooit echte calls);
 * - taak losmaken → rest-opdracht terug in de bak (splitsing);
 * - rolchecks: kantoor muteert, voorman leest (magPlanbordMuteren).
 */

import { describe, it, expect } from "vitest";
import {
  adresParenVoorDag,
  berekenDagkaart,
  DAGKAART_DEFAULTS,
  effectieveStandaarden,
  isGeldigeTijd,
  naarMinuten,
  naarTijd,
  normaliseerAdres,
  reistijdSleutel,
  splitsTaakUit,
  stopDuurMinuten,
  wisselStops,
  type DagBlok,
  type KlantStop,
} from "../../../../convex/dagkaartLogica";
import {
  GoogleMapsReistijd,
  kiesReistijdProvider,
  StandaardReistijd,
  type ReistijdFetch,
} from "../../../../convex/reistijdLogica";
import { magPlanbordMuteren } from "../../../../convex/planbordLogica";

// ─── Test-hulpjes ────────────────────────────────────────────────────────────

const stop = (
  id: string,
  duurMinuten: number,
  extra: Partial<KlantStop> = {}
): KlantStop => ({
  werkitemId: id,
  adres: `${id}straat 1, Meppel`,
  duurMinuten,
  ...extra,
});

const blokVan = (blokken: DagBlok[], id: string) => {
  const blok = blokken.find((b) => b.soort === "klant" && b.werkitemId === id);
  if (!blok) throw new Error(`Klantblok ${id} niet gevonden`);
  return blok;
};

const soortVolgorde = (blokken: DagBlok[]) => blokken.map((b) => b.soort);

// Standaard-dag: vertrek 07:00, pauze 12:00-12:30, afronding 30, reistijd 20
const S = DAGKAART_DEFAULTS;

// ─── Tijd-helpers ────────────────────────────────────────────────────────────

describe("tijd-helpers", () => {
  it("converteert HH:MM naar minuten en terug", () => {
    expect(naarMinuten("07:00")).toBe(420);
    expect(naarMinuten("12:30")).toBe(750);
    expect(naarTijd(420)).toBe("07:00");
    expect(naarTijd(755)).toBe("12:35");
  });

  it("valideert tijden (HH:MM, 24-uurs)", () => {
    expect(isGeldigeTijd("07:00")).toBe(true);
    expect(isGeldigeTijd("23:59")).toBe(true);
    expect(isGeldigeTijd("24:00")).toBe(false);
    expect(isGeldigeTijd("7:00")).toBe(false);
    expect(isGeldigeTijd("07:60")).toBe(false);
    expect(isGeldigeTijd("")).toBe(false);
  });
});

// ─── Standaardblokken (instelling, defaults van Mickey later §7.1) ───────────

describe("standaardblokken", () => {
  it("gebruikt de defaults als er niets is ingesteld", () => {
    const s = effectieveStandaarden(null, null);
    expect(s).toEqual({
      vertrekTijd: "07:00",
      pauzeStart: "12:00",
      pauzeEind: "12:30",
      loodsAfrondingMinuten: 30,
      standaardReistijdMinuten: 20,
    });
  });

  it("laat bedrijfsinstelling boven default en dag-afwijking boven alles gaan", () => {
    const s = effectieveStandaarden(
      { vertrekTijd: "06:30", standaardReistijdMinuten: 15 },
      { vertrekTijd: "08:00" }
    );
    expect(s.vertrekTijd).toBe("08:00"); // dag-afwijking wint
    expect(s.standaardReistijdMinuten).toBe(15); // bedrijfsinstelling
    expect(s.pauzeStart).toBe("12:00"); // default
  });

  it("plaatst standaardblokken automatisch: vertrek → … → afronding → einde-dag", () => {
    const blokken = berekenDagkaart(S, [stop("a", 120)], [20, 20]);
    expect(soortVolgorde(blokken)).toEqual([
      "vertrek",
      "reistijd",
      "klant",
      "reistijd",
      "loods_afronding",
      "einde_dag",
    ]);
    expect(blokken[0]).toMatchObject({ start: "07:00", eind: "07:00" });
    // 07:00 vertrek → 07:20 aankomst → 09:20 klaar → 09:40 loods → 10:10
    expect(blokken.find((b) => b.soort === "loods_afronding")).toMatchObject({
      start: "09:40",
      eind: "10:10",
    });
    // Korte dag eindigt vóór de pauze → geen pauzeblok op deze kaart
    expect(blokken.find((b) => b.soort === "einde_dag")).toMatchObject({
      start: "10:10",
    });
    expect(blokken.find((b) => b.soort === "pauze")).toBeUndefined();
  });

  it("toont een lege dag als alleen vertrek + einde-dag (geen losse reistijd)", () => {
    const blokken = berekenDagkaart(S, [], []);
    expect(soortVolgorde(blokken)).toEqual(["vertrek", "einde_dag"]);
    expect(blokken[1]).toMatchObject({ start: "07:00" });
  });
});

// ─── Tijdcascade (§8.9) ──────────────────────────────────────────────────────

describe("tijdcascade (§8.9)", () => {
  // Basisdag: A (90 min) en B (60 min), reistijden 20/15/25
  const dag = () =>
    berekenDagkaart(S, [stop("A", 90), stop("B", 60)], [20, 15, 25]);

  it("berekent alle start- en aankomsttijden vanaf de vertrektijd", () => {
    const blokken = dag();
    // 07:00 → reis 20 → A 07:20-08:50 → reis 15 → B 09:05-10:05
    expect(blokVan(blokken, "A")).toMatchObject({ start: "07:20", eind: "08:50" });
    expect(blokVan(blokken, "B")).toMatchObject({ start: "09:05", eind: "10:05" });
    // terugreis 25 → 10:30, afronding 30 → 11:00
    expect(blokken.find((b) => b.soort === "einde_dag")?.start).toBe("11:00");
  });

  it("+15 minuten op klant A schuift alle tijden erna automatisch door", () => {
    const voor = dag();
    const na = berekenDagkaart(S, [stop("A", 105), stop("B", 60)], [20, 15, 25]);
    // A start onveranderd (duur wijzigen pint de starttijd niet)
    expect(blokVan(na, "A").start).toBe(blokVan(voor, "A").start);
    expect(blokVan(na, "A").eind).toBe("09:05"); // 08:50 + 15
    // Alles erna schuift exact 15 minuten door
    expect(blokVan(na, "B")).toMatchObject({ start: "09:20", eind: "10:20" });
    expect(na.find((b) => b.soort === "einde_dag")?.start).toBe("11:15");
  });

  it("een handmatige starttijd blijft leidend en cascadeert alles erna", () => {
    const blokken = berekenDagkaart(
      S,
      [stop("A", 90, { handmatigeStartTijd: "08:00" }), stop("B", 60)],
      [20, 15, 25]
    );
    const a = blokVan(blokken, "A");
    expect(a).toMatchObject({ start: "08:00", eind: "09:30", handmatigeStart: true });
    // B cascadeert vanaf de handmatige waarde: 09:30 + 15 reis
    expect(blokVan(blokken, "B")).toMatchObject({ start: "09:45", eind: "10:45" });
  });

  it("handmatige waarden worden bij herberekening nooit overschreven", () => {
    // Herberekening met andere reistijden: A's handmatige start blijft 08:00
    const eerste = berekenDagkaart(
      S,
      [stop("A", 90, { handmatigeStartTijd: "08:00" })],
      [20, 20]
    );
    const tweede = berekenDagkaart(
      S,
      [stop("A", 90, { handmatigeStartTijd: "08:00" })],
      [45, 45] // fors langere reistijden
    );
    expect(blokVan(eerste, "A").start).toBe("08:00");
    expect(blokVan(tweede, "A").start).toBe("08:00");
    expect(blokVan(tweede, "A").handmatigeStart).toBe(true);
  });

  it("omwisselen van A en B neemt het klantblok als één geheel mee", () => {
    const stops = [stop("A", 90), stop("B", 60)];
    const gewisseld = wisselStops(stops, 0, 1);
    // Het hele stop-object (taken zitten op het werkitem) is meegereisd
    expect(gewisseld.map((s) => s.werkitemId)).toEqual(["B", "A"]);
    expect(gewisseld[1]).toBe(stops[0]); // zelfde object, geen kopie van velden

    // Reistijden volgen de nieuwe adresvolgorde (per adrespaar opgezocht)
    const blokken = berekenDagkaart(S, gewisseld, [15, 15, 25]);
    expect(blokVan(blokken, "B")).toMatchObject({ start: "07:15", eind: "08:15" });
    expect(blokVan(blokken, "A")).toMatchObject({ start: "08:30", eind: "10:00" });
  });

  it("wisselStops laat ongeldige indices ongemoeid", () => {
    const stops = [stop("A", 60), stop("B", 60)];
    expect(wisselStops(stops, 0, 5).map((s) => s.werkitemId)).toEqual(["A", "B"]);
    expect(wisselStops(stops, -1, 1).map((s) => s.werkitemId)).toEqual(["A", "B"]);
  });

  it("valt terug op de standaard-reistijd als een reistijd ontbreekt", () => {
    const blokken = berekenDagkaart(S, [stop("A", 60)], []); // geen reistijden
    // vertrek 07:00 + standaard 20 → A 07:20
    expect(blokVan(blokken, "A").start).toBe("07:20");
  });
});

// ─── Pauze op vaste tijd ─────────────────────────────────────────────────────

describe("pauze op vaste tijd", () => {
  it("laat werk dat over de pauze loopt pauzeren (eind schuift op)", () => {
    // A start 11:20 en duurt 120 min → loopt over 12:00 heen → eind +30
    const blokken = berekenDagkaart(
      S,
      [stop("A", 120, { handmatigeStartTijd: "11:20" })],
      [20, 20]
    );
    expect(blokVan(blokken, "A")).toMatchObject({ start: "11:20", eind: "13:50" });
    const pauze = blokken.find((b) => b.soort === "pauze");
    expect(pauze).toMatchObject({ start: "12:00", eind: "12:30" });
    // Chronologisch: pauze staat tussen de blokken op zijn vaste plek
    const index = blokken.findIndex((b) => b.soort === "pauze");
    expect(blokken[index - 1].soort).toBe("klant");
  });

  it("start werk dat op of na de pauzestart zou beginnen pas na de pauze", () => {
    // A eindigt 11:55, reistijd 10 → aankomst 12:05 valt in de pauze → B start 12:30
    const blokken = berekenDagkaart(
      S,
      [stop("A", 60, { handmatigeStartTijd: "10:55" }), stop("B", 60)],
      [20, 5, 20]
    );
    expect(blokVan(blokken, "A").eind).toBe("11:55");
    expect(blokVan(blokken, "B").start).toBe("12:30");
  });

  it("verschuift de pauze niet als de planner een duur aanpast (+§8.9)", () => {
    const basis = berekenDagkaart(S, [stop("A", 300)], [20, 20]);
    const langer = berekenDagkaart(S, [stop("A", 360)], [20, 20]);
    expect(basis.find((b) => b.soort === "pauze")).toMatchObject({
      start: "12:00",
      eind: "12:30",
    });
    expect(langer.find((b) => b.soort === "pauze")).toMatchObject({
      start: "12:00",
      eind: "12:30",
    });
    // De cascade schuift wél door (60 min langer werk → 60 min later klaar)
    expect(basis.find((b) => b.soort === "einde_dag")?.start).toBe("13:40");
    expect(langer.find((b) => b.soort === "einde_dag")?.start).toBe("14:40");
  });

  it("respecteert een dag-afwijking van de pauze (alleen afwijking opgeslagen)", () => {
    const s = effectieveStandaarden(null, { pauzeStart: "12:30", pauzeEind: "13:00" });
    const blokken = berekenDagkaart(s, [stop("A", 300)], [20, 20]);
    expect(blokken.find((b) => b.soort === "pauze")).toMatchObject({
      start: "12:30",
      eind: "13:00",
    });
  });
});

// ─── Duur van een klantblok (override > tijden > geschatteUren > default) ────

describe("stopDuurMinuten", () => {
  it("laat de handmatige duur-override altijd winnen", () => {
    expect(
      stopDuurMinuten({ duurOverrideMinuten: 75, geschatteUren: 4 })
    ).toBe(75);
  });

  it("gebruikt anders het verschil tussen geplande start- en eindtijd", () => {
    expect(
      stopDuurMinuten({ geplandeStartTijd: "09:00", geplandeEindTijd: "10:30" })
    ).toBe(90);
  });

  it("valt terug op geschatteUren en daarna op de default", () => {
    expect(stopDuurMinuten({ geschatteUren: 2.5 })).toBe(150);
    expect(stopDuurMinuten({})).toBe(60);
  });

  it("negeert ongeldige of omgekeerde tijden", () => {
    expect(
      stopDuurMinuten({
        geplandeStartTijd: "11:00",
        geplandeEindTijd: "10:00",
        geschatteUren: 1,
      })
    ).toBe(60);
  });
});

// ─── Adresparen + cache-sleutels ─────────────────────────────────────────────

describe("adresparen voor reistijden", () => {
  it("bouwt loods → stops → loods (lengte = stops + 1)", () => {
    const paren = adresParenVoorDag("Loodsweg 1, Meppel", [
      "Astraat 1, Meppel",
      "Bstraat 2, Meppel",
    ]);
    expect(paren).toHaveLength(3);
    expect(paren[0]).toMatchObject({
      vanAdres: "Loodsweg 1, Meppel",
      naarAdres: "Astraat 1, Meppel",
    });
    expect(paren[2]).toMatchObject({ naarAdres: "Loodsweg 1, Meppel" });
  });

  it("levert null voor ontbrekende adressen (→ standaard-reistijd)", () => {
    const paren = adresParenVoorDag("Loodsweg 1", [null, "Bstraat 2"]);
    expect(paren[0]).toBeNull();
    expect(paren[1]).toBeNull();
    expect(paren[2]).not.toBeNull();
  });

  it("normaliseert adressen in de cache-sleutel (richting blijft relevant)", () => {
    expect(normaliseerAdres("  Dorpsstraat   1,  Meppel ")).toBe(
      "dorpsstraat 1, meppel"
    );
    expect(reistijdSleutel("A straat 1", "B straat 2")).toBe(
      "a straat 1|b straat 2"
    );
    expect(reistijdSleutel("A", "B")).not.toBe(reistijdSleutel("B", "A"));
  });
});

// ─── ReistijdProvider (Maps-key ontbreekt bewust; fail-closed) ──────────────

describe("ReistijdProvider", () => {
  const mapsAntwoord = (seconden: number) => ({
    ok: true,
    json: async () => ({
      status: "OK",
      rows: [{ elements: [{ status: "OK", duration: { value: seconden } }] }],
    }),
  });

  it("kiest StandaardReistijd zonder API-key (fail-closed)", async () => {
    const provider = kiesReistijdProvider({ apiKey: undefined, standaardMinuten: 20 });
    expect(provider.bron).toBe("standaard");
    await expect(provider.berekenMinuten("A", "B")).resolves.toBe(20);
    // Lege of whitespace-key telt ook als afwezig
    expect(kiesReistijdProvider({ apiKey: "  ", standaardMinuten: 20 }).bron).toBe(
      "standaard"
    );
  });

  it("gebruikt de instelbare default-minuten per verplaatsing", async () => {
    const provider = new StandaardReistijd(35);
    await expect(provider.berekenMinuten()).resolves.toBe(35);
  });

  it("kiest GoogleMapsReistijd mét key en rondt seconden op naar minuten", async () => {
    const fetchMock: ReistijdFetch = async () => mapsAntwoord(23 * 60 + 1);
    const provider = kiesReistijdProvider({
      apiKey: "test-key",
      standaardMinuten: 20,
      fetchFn: fetchMock,
    });
    expect(provider.bron).toBe("google_maps");
    await expect(provider.berekenMinuten("A", "B")).resolves.toBe(24);
  });

  it("valt fail-closed terug op de standaard bij een netwerk- of API-fout", async () => {
    const kapot: ReistijdFetch = async () => {
      throw new Error("netwerk weg");
    };
    const nietOk: ReistijdFetch = async () => ({ ok: false, json: async () => ({}) });
    const zeroResults: ReistijdFetch = async () => ({
      ok: true,
      json: async () => ({
        status: "OK",
        rows: [{ elements: [{ status: "ZERO_RESULTS" }] }],
      }),
    });
    for (const fetchFn of [kapot, nietOk, zeroResults]) {
      const provider = new GoogleMapsReistijd(
        "test-key",
        new StandaardReistijd(20),
        fetchFn
      );
      await expect(provider.berekenMinuten("A", "B")).resolves.toBe(20);
    }
  });

  it("stuurt de adressen ge-encodeerd naar de Distance Matrix", async () => {
    let opgeroepenUrl = "";
    const fetchMock: ReistijdFetch = async (url) => {
      opgeroepenUrl = url;
      return mapsAntwoord(600);
    };
    const provider = new GoogleMapsReistijd("test-key", new StandaardReistijd(), fetchMock);
    await provider.berekenMinuten("Dorpsstraat 1, Meppel", "Kerkweg 2, Zwolle");
    expect(opgeroepenUrl).toContain("distancematrix");
    expect(opgeroepenUrl).toContain(encodeURIComponent("Dorpsstraat 1, Meppel"));
    expect(opgeroepenUrl).toContain(encodeURIComponent("Kerkweg 2, Zwolle"));
  });
});

// ─── Taak losmaken (rest-opdracht terug in de bak, §2.2) ────────────────────

describe("taak losmaken uit een klantblok", () => {
  const regels = [
    { omschrijving: "Gras maaien" },
    { omschrijving: "Haag snoeien" },
    { omschrijving: "Onkruid wieden" },
  ];

  it("splitst één taak af en houdt de rest bij elkaar", () => {
    const splitsing = splitsTaakUit(regels, 1);
    expect(splitsing).not.toBeNull();
    expect(splitsing?.losgemaakt.omschrijving).toBe("Haag snoeien");
    expect(splitsing?.overgebleven.map((r) => r.omschrijving)).toEqual([
      "Gras maaien",
      "Onkruid wieden",
    ]);
  });

  it("weigert de laatste taak los te maken (heel werkitem terug in de bak)", () => {
    expect(splitsTaakUit([{ omschrijving: "Enige taak" }], 0)).toBeNull();
    expect(splitsTaakUit([], 0)).toBeNull();
    expect(splitsTaakUit(undefined, 0)).toBeNull();
  });

  it("weigert een index buiten bereik", () => {
    expect(splitsTaakUit(regels, 3)).toBeNull();
    expect(splitsTaakUit(regels, -1)).toBeNull();
  });
});

// ─── Rolchecks: kantoor muteert, voorman leest ───────────────────────────────

describe("rolchecks dagkaart", () => {
  it("laat alleen kantoor (directie/projectleider) de dagkaart muteren", () => {
    expect(magPlanbordMuteren("directie")).toBe(true);
    expect(magPlanbordMuteren("projectleider")).toBe(true);
    expect(magPlanbordMuteren("admin")).toBe(true); // legacy → directie
  });

  it("laat voorman en veldrollen alleen lezen", () => {
    expect(magPlanbordMuteren("voorman")).toBe(false);
    expect(magPlanbordMuteren("medewerker")).toBe(false);
    expect(magPlanbordMuteren("klant")).toBe(false);
    expect(magPlanbordMuteren(undefined)).toBe(false);
  });
});
