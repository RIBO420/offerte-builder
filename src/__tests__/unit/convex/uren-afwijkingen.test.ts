/**
 * Unit tests afwijkingsregels + weekgrenzen van de Controlekamer
 * (`convex/lib/urenAfwijkingen.ts`; plan §2 van
 * docs/design/plannen/uren-controlekamer-plan.md).
 *
 * Dekt:
 * - elk van de zes afwijkingstypen, met het grensgeval erbij (exact op de
 *   drempel is GEEN afwijking — anders vult de wachtrij zich met ruis);
 * - de vaste volgorde van de redenen (de UI leest de eerste als afwijkingszin);
 * - weekgrenzen Europe/Amsterdam met maandag als start, inclusief de
 *   ISO-donderdagregel rond de jaarwissel en de zomertijd-sprong;
 * - de Nederlandse server-labels (weekLabel/dagLabel);
 * - kwijting-idempotentie: wie het laatst sprak heeft gelijk.
 */

import { describe, it, expect } from "vitest";
import {
  bepaalAfwijkingen,
  bepaalKwijting,
  dagLabelVan,
  dagTotaalUren,
  gatRedenen,
  geenPauzeReden,
  handmatigIpvVoorstelReden,
  heropendReden,
  huidigeWeekStart,
  indirecteMinuten,
  isIndirecteCategorie,
  isMaandag,
  isoWeekNummer,
  isWerkendeCategorie,
  kortDagLabelVan,
  laatsteWerkdagen,
  langeDagReden,
  minutenVanTijd,
  sorteerSegmenten,
  tijdVanMinuten,
  UREN_AFWIJKING_DREMPELS,
  urenVanMinuten,
  vandaagAmsterdam,
  weekDagen,
  weekLabelVan,
  weekStartVan,
  werkdagenVanWeek,
  werkendeMinuten,
  zonderWerkitemReden,
  type AfwijkingSegment,
} from "../../../../convex/lib/urenAfwijkingen";

// ─── Test-hulpjes ────────────────────────────────────────────────────────────

const seg = (
  beginTijd: string,
  eindTijd: string,
  categorie: AfwijkingSegment["categorie"] = "werken",
  extra: Partial<AfwijkingSegment> = {}
): AfwijkingSegment => ({
  beginTijd,
  eindTijd,
  categorie,
  werkitemId: categorie === "werken" ? "projecten:1" : null,
  bron: "voorstel",
  ...extra,
});

/** Normale dag: 07:00–12:00 werken, pauze, 12:30–16:00 werken (8,5 u). */
const normaleDag = (): AfwijkingSegment[] => [
  seg("07:00", "07:30", "reistijd"),
  seg("07:30", "12:00"),
  seg("12:00", "12:30", "pauze"),
  seg("12:30", "15:30"),
  seg("15:30", "16:00", "reistijd"),
];

// ─── Tijd- en totaalhelpers ─────────────────────────────────────────────────

describe("tijd- en totaalhelpers", () => {
  it("rekent HH:MM heen en terug", () => {
    expect(minutenVanTijd("07:30")).toBe(450);
    expect(minutenVanTijd("00:00")).toBe(0);
    expect(tijdVanMinuten(450)).toBe("07:30");
    expect(tijdVanMinuten(0)).toBe("00:00");
    // Onzin-invoer valt niet om maar levert 0 (fail-soft, geen NaN-uren)
    expect(minutenVanTijd("kwart over zeven")).toBe(0);
  });

  it("telt pauze niet mee als werkende tijd en werken niet als indirect", () => {
    expect(isWerkendeCategorie("pauze")).toBe(false);
    expect(isWerkendeCategorie("reistijd")).toBe(true);
    expect(isIndirecteCategorie("werken")).toBe(false);
    expect(isIndirecteCategorie("pauze")).toBe(false);
    expect(isIndirecteCategorie("teammeeting")).toBe(true);
  });

  it("dagtotaal = werkende tijd; reistijd is indirect", () => {
    // 30 + 270 + 180 + 30 = 510 min werkende tijd (pauze 30 valt buiten)
    expect(werkendeMinuten(normaleDag())).toBe(510);
    expect(dagTotaalUren(normaleDag())).toBe(8.5);
    expect(indirecteMinuten(normaleDag())).toBe(60);
    expect(urenVanMinuten(95)).toBe(1.6);
  });

  it("sorteert segmenten chronologisch zonder de invoer te muteren", () => {
    const invoer = [seg("12:30", "15:30"), seg("07:30", "12:00")];
    const gesorteerd = sorteerSegmenten(invoer);
    expect(gesorteerd.map((s) => s.beginTijd)).toEqual(["07:30", "12:30"]);
    expect(invoer[0].beginTijd).toBe("12:30");
  });
});

// ─── 1. Lange dag ───────────────────────────────────────────────────────────

describe("afwijking 1 — lange dag (> 9,5 u werkende tijd)", () => {
  it("signaleert een dag van 9,6 uur", () => {
    // 06:00–15:40 zonder pauze = 580 min = 9,67 u
    expect(langeDagReden([seg("06:00", "15:40")])).toEqual({
      type: "lange_dag",
      uren: 9.7,
    });
  });

  it("laat exact 9,5 uur staan (grensgeval: op de grens is geen afwijking)", () => {
    // 06:00–15:30 = 570 min = precies 9,5 u
    expect(langeDagReden([seg("06:00", "15:30")])).toBeNull();
    expect(UREN_AFWIJKING_DREMPELS.langeDagMinuten).toBe(570);
  });

  it("telt reistijd en indirecte tijd mee, pauze niet", () => {
    // 8 u werken + 2 u rijden = 10 u werkende tijd → lange dag,
    // ook al staat er maar 8 uur "werken"
    const dag = [
      seg("06:00", "07:00", "reistijd"),
      seg("07:00", "15:00"),
      seg("15:00", "15:30", "pauze"),
      seg("15:30", "16:30", "reistijd"),
    ];
    expect(langeDagReden(dag)).toEqual({ type: "lange_dag", uren: 10 });
    // Zonder de reistijd blijft dezelfde dag onder de drempel
    expect(langeDagReden([seg("07:00", "15:00")])).toBeNull();
  });

  it("een normale dag is geen lange dag", () => {
    expect(langeDagReden(normaleDag())).toBeNull();
  });
});

// ─── 2. Geen pauze ──────────────────────────────────────────────────────────

describe("afwijking 2 — geen pauze (> 5,5 u aaneengesloten)", () => {
  it("signaleert 6 uur aaneengesloten werken", () => {
    expect(geenPauzeReden([seg("07:00", "13:00")])).toEqual({
      type: "geen_pauze",
      uren: 6,
    });
  });

  it("laat exact 5,5 uur staan (grensgeval)", () => {
    expect(geenPauzeReden([seg("07:00", "12:30")])).toBeNull();
    expect(UREN_AFWIJKING_DREMPELS.geenPauzeMinuten).toBe(330);
  });

  it("een pauzesegment breekt de reeks", () => {
    // 07:00–12:00 (5 u) + pauze + 12:30–17:00 (4,5 u): geen enkele reeks > 5,5
    expect(geenPauzeReden(normaleDag())).toBeNull();
    expect(
      geenPauzeReden([
        seg("07:00", "12:00"),
        seg("12:00", "12:30", "pauze"),
        seg("12:30", "17:00"),
      ])
    ).toBeNull();
  });

  it("aansluitende segmenten van verschillende categorie vormen één reeks", () => {
    // Rijden + werken + BES-rit aan één stuk: 07:00–13:30 = 6,5 u
    const reden = geenPauzeReden([
      seg("07:00", "08:00", "reistijd"),
      seg("08:00", "13:00"),
      seg("13:00", "13:30", "afvalverwerker_bes", { werkitemId: null }),
    ]);
    expect(reden).toEqual({ type: "geen_pauze", uren: 6.5 });
  });

  it("een gat breekt de reeks ook (dan werkte hij niet)", () => {
    expect(
      geenPauzeReden([seg("07:00", "11:00"), seg("12:00", "15:00")])
    ).toBeNull();
  });

  it("overlappende segmenten worden niet dubbel geteld", () => {
    // 07:00–13:00 met een overlappend segment 12:00–13:00: 6 u, niet 7
    expect(
      geenPauzeReden([seg("07:00", "13:00"), seg("12:00", "13:00")])
    ).toEqual({ type: "geen_pauze", uren: 6 });
  });
});

// ─── 3. Zonder werkitem ─────────────────────────────────────────────────────

describe("afwijking 3 — werken zonder werkitem", () => {
  it("signaleert een werken-segment zonder klus", () => {
    expect(
      zonderWerkitemReden([seg("08:00", "12:00", "werken", { werkitemId: null })])
    ).toEqual({ type: "zonder_werkitem" });
  });

  it("een pauze of reistijd zonder werkitem is normaal", () => {
    expect(
      zonderWerkitemReden([
        seg("07:00", "07:30", "reistijd"),
        seg("12:00", "12:30", "pauze"),
        seg("13:00", "14:00", "teammeeting", { werkitemId: null }),
      ])
    ).toBeNull();
  });

  it("een lege dag heeft geen reden (die valt onder 'achter')", () => {
    expect(zonderWerkitemReden([])).toBeNull();
  });
});

// ─── 4. Gat ─────────────────────────────────────────────────────────────────

describe("afwijking 4 — gat (> 60 min binnen 07:00–17:00)", () => {
  it("signaleert een gat van 3 uur midden op de dag", () => {
    expect(gatRedenen([seg("07:00", "09:00"), seg("12:00", "16:00")])).toEqual([
      { type: "gat", vanTijd: "09:00", totTijd: "12:00", minuten: 180 },
    ]);
  });

  it("laat exact 60 minuten staan (grensgeval)", () => {
    expect(gatRedenen([seg("07:00", "09:00"), seg("10:00", "16:00")])).toEqual(
      []
    );
    expect(UREN_AFWIJKING_DREMPELS.gatMinuten).toBe(60);
  });

  it("klemt het gat op het venster 07:00–17:00", () => {
    // Gat 05:00–08:00, binnen het venster daarvan 07:00–08:00 = 60 min
    expect(gatRedenen([seg("04:00", "05:00"), seg("08:00", "12:00")])).toEqual(
      []
    );
    // Gat 06:00–09:00 → binnen venster 07:00–09:00 = 120 min
    expect(gatRedenen([seg("05:00", "06:00"), seg("09:00", "12:00")])).toEqual([
      { type: "gat", vanTijd: "07:00", totTijd: "09:00", minuten: 120 },
    ]);
  });

  it("negeert een gat volledig buiten het venster (avondwerk)", () => {
    expect(gatRedenen([seg("17:30", "18:00"), seg("20:00", "21:00")])).toEqual(
      []
    );
  });

  it("het einde van de dag is geen gat", () => {
    // Dag stopt om 15:00; tot 17:00 is geen gat maar gewoon klaar
    expect(gatRedenen(normaleDag())).toEqual([]);
    expect(gatRedenen([seg("07:00", "15:00")])).toEqual([]);
  });

  it("meldt twee gaten apart", () => {
    const redenen = gatRedenen([
      seg("07:00", "08:00"),
      seg("10:00", "11:00"),
      seg("13:00", "14:00"),
    ]);
    expect(redenen).toHaveLength(2);
    expect(redenen[0]).toMatchObject({ vanTijd: "08:00", totTijd: "10:00" });
    expect(redenen[1]).toMatchObject({ vanTijd: "11:00", totTijd: "13:00" });
  });
});

// ─── 5. Handmatig i.p.v. voorstel ───────────────────────────────────────────

describe("afwijking 5 — handmatig i.p.v. voorstel", () => {
  const handmatigeDag = [
    seg("07:00", "12:00", "werken", { bron: "handmatig" }),
    seg("12:30", "16:00", "werken", { bron: "handmatig" }),
  ];

  it("signaleert een handgetypte dag terwijl er een dagkaart lag", () => {
    expect(handmatigIpvVoorstelReden(handmatigeDag, true)).toEqual({
      type: "handmatig_ipv_voorstel",
    });
  });

  it("zwijgt als er geen planning was (dan kán het niet anders)", () => {
    expect(handmatigIpvVoorstelReden(handmatigeDag, false)).toBeNull();
    expect(handmatigIpvVoorstelReden(handmatigeDag, undefined)).toBeNull();
  });

  it("zwijgt zodra één segment uit het voorstel komt (grensgeval)", () => {
    expect(
      handmatigIpvVoorstelReden(
        [...handmatigeDag, seg("16:00", "16:30", "reistijd")],
        true
      )
    ).toBeNull();
  });

  it("zwijgt bij een lege dag", () => {
    expect(handmatigIpvVoorstelReden([], true)).toBeNull();
  });
});

// ─── 6. Heropend ────────────────────────────────────────────────────────────

describe("afwijking 6 — heropend", () => {
  it("signaleert een heropende dag", () => {
    expect(heropendReden(true)).toEqual({ type: "heropend" });
    expect(heropendReden(false)).toBeNull();
    expect(heropendReden(undefined)).toBeNull();
  });
});

// ─── Alles samen: vaste volgorde ────────────────────────────────────────────

describe("bepaalAfwijkingen — vaste volgorde en lege uitkomst", () => {
  it("een normale bevestigde dag levert geen enkele reden op", () => {
    expect(
      bepaalAfwijkingen(normaleDag(), { heeftPlanning: true, isHeropend: false })
    ).toEqual([]);
  });

  it("houdt de volgorde lange dag → geen pauze → zonder werkitem → gat → handmatig → heropend", () => {
    const rommelDag: AfwijkingSegment[] = [
      // 06:00–12:00 aaneengesloten werken zonder klus (6 u)
      seg("06:00", "12:00", "werken", {
        werkitemId: null,
        bron: "handmatig",
      }),
      // gat 12:00–14:00
      seg("14:00", "18:00", "werken", { bron: "handmatig" }),
    ];
    const redenen = bepaalAfwijkingen(rommelDag, {
      heeftPlanning: true,
      isHeropend: true,
    });
    expect(redenen.map((r) => r.type)).toEqual([
      "lange_dag",
      "geen_pauze",
      "zonder_werkitem",
      "gat",
      "handmatig_ipv_voorstel",
      "heropend",
    ]);
  });
});

// ─── Kwijting ───────────────────────────────────────────────────────────────

describe("kwijting (logboek-akkoord) — wie het laatst sprak heeft gelijk", () => {
  it("zonder logboekregels is niets gekweten", () => {
    expect(bepaalKwijting([])).toEqual({ gekweten: false, heropend: false });
  });

  it("negeert regels die niets met kwijting te maken hebben", () => {
    expect(
      bepaalKwijting([
        { actie: "dag_ingediend", createdAt: 1 },
        { actie: "segment_gecorrigeerd", createdAt: 2 },
      ])
    ).toEqual({ gekweten: false, heropend: false });
  });

  it("een akkoord kweit de dag; een tweede akkoord verandert niets (idempotent)", () => {
    expect(bepaalKwijting([{ actie: "dag_akkoord", createdAt: 10 }])).toEqual({
      gekweten: true,
      heropend: false,
    });
    expect(
      bepaalKwijting([
        { actie: "dag_akkoord", createdAt: 10 },
        { actie: "dag_akkoord", createdAt: 20 },
      ])
    ).toEqual({ gekweten: true, heropend: false });
  });

  it("een heropening ná het akkoord zet de dag terug in de wachtrij", () => {
    expect(
      bepaalKwijting([
        { actie: "dag_akkoord", createdAt: 10 },
        { actie: "dag_heropend", createdAt: 20 },
      ])
    ).toEqual({ gekweten: false, heropend: true });
  });

  it("een akkoord ná de heropening kweit de dag opnieuw (nieuwe ronde)", () => {
    expect(
      bepaalKwijting([
        { actie: "dag_heropend", createdAt: 10 },
        { actie: "dag_akkoord", createdAt: 20 },
      ])
    ).toEqual({ gekweten: true, heropend: false });
  });
});

// ─── Weekgrenzen: Europe/Amsterdam, maandag als start ───────────────────────

describe("weekgrenzen (Europe/Amsterdam, maandag als start)", () => {
  it("maandag is de start van de week", () => {
    expect(weekStartVan("2026-08-10")).toBe("2026-08-10"); // maandag zelf
    expect(weekStartVan("2026-08-14")).toBe("2026-08-10"); // vrijdag
    expect(weekStartVan("2026-08-16")).toBe("2026-08-10"); // zondag hoort erbij
    expect(weekStartVan("2026-08-17")).toBe("2026-08-17"); // volgende maandag
    expect(isMaandag("2026-08-10")).toBe(true);
    expect(isMaandag("2026-08-16")).toBe(false);
  });

  it("een week is maandag t/m zondag; werkdagen zijn maandag t/m vrijdag", () => {
    expect(weekDagen("2026-08-10")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
    expect(werkdagenVanWeek("2026-08-10")).toHaveLength(5);
    expect(werkdagenVanWeek("2026-08-10").at(-1)).toBe("2026-08-14");
  });

  it("stapt correct over de zomertijd-sprong (29 maart 2026, 02:00 → 03:00)", () => {
    // De DST-nacht valt in de week van maandag 23 maart; kale datumreken mag
    // daar geen dag verliezen of verdubbelen.
    expect(weekStartVan("2026-03-29")).toBe("2026-03-23");
    expect(weekDagen("2026-03-23")).toHaveLength(7);
    expect(weekDagen("2026-03-23").at(-1)).toBe("2026-03-29");
    // En over de wintertijd-sprong (25 oktober 2026)
    expect(weekStartVan("2026-10-25")).toBe("2026-10-19");
    expect(weekDagen("2026-10-19").at(-1)).toBe("2026-10-25");
  });

  it("ISO-weeknummer volgt de donderdagregel", () => {
    expect(isoWeekNummer("2026-08-10")).toBe(33); // plan-voorbeeld
    expect(isoWeekNummer("2026-01-01")).toBe(1); // donderdag → week 1
    // 1 januari 2027 is een vrijdag en hoort bij week 53 van 2026
    expect(isoWeekNummer("2027-01-01")).toBe(53);
    expect(isoWeekNummer("2026-12-31")).toBe(53);
  });

  it("laatsteWerkdagen slaat het weekend over en geeft oudste eerst", () => {
    const dagen = laatsteWerkdagen("2026-08-14", 10);
    expect(dagen).toHaveLength(10);
    expect(dagen.at(-1)).toBe("2026-08-14");
    expect(dagen[0]).toBe("2026-08-03"); // twee volle werkweken terug
    expect(dagen).not.toContain("2026-08-08"); // zaterdag
    expect(dagen).not.toContain("2026-08-09"); // zondag
  });

  it("vandaagAmsterdam gebruikt de Nederlandse dag, niet de UTC-dag", () => {
    // 31 december 2026 23:30 UTC is in Nederland al 1 januari 2027
    expect(vandaagAmsterdam(Date.parse("2026-12-31T23:30:00Z"))).toBe(
      "2027-01-01"
    );
    // Midden op de dag verandert er niets
    expect(vandaagAmsterdam(Date.parse("2026-08-14T10:00:00Z"))).toBe(
      "2026-08-14"
    );
    // In de zomer is Nederland UTC+2: 22:30 UTC = de volgende dag
    expect(vandaagAmsterdam(Date.parse("2026-08-14T22:30:00Z"))).toBe(
      "2026-08-15"
    );
    expect(huidigeWeekStart(Date.parse("2026-08-14T22:30:00Z"))).toBe(
      "2026-08-10"
    );
  });
});

// ─── Nederlandse server-labels ──────────────────────────────────────────────

describe("server-labels (Nederlands)", () => {
  it("weekLabel zoals het plan hem voorschrijft", () => {
    expect(weekLabelVan("2026-08-10")).toBe("Week 33 · 10 t/m 16 augustus");
  });

  it("weekLabel noemt beide maanden bij een maandgrens", () => {
    // Week van maandag 27 juli t/m zondag 2 augustus 2026
    expect(weekLabelVan("2026-07-27")).toBe("Week 31 · 27 juli t/m 2 augustus");
  });

  it("dagLabel en kort daglabel", () => {
    expect(dagLabelVan("2026-08-10")).toBe("maandag 10 augustus 2026");
    expect(dagLabelVan("2026-08-16")).toBe("zondag 16 augustus 2026");
    expect(kortDagLabelVan("2026-08-11")).toBe("di 11 aug");
  });
});
