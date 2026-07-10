/**
 * Unit tests planbord/weekbord (PRD §2.2, fase 1 stap 5a)
 *
 * Test de extraheerbare businesslogica uit convex/planbordLogica.ts,
 * de adapter (src/components/planbord/adapter.ts) en de periode-helpers:
 * - updatePlanning-flow-bouwstenen: dupliceren (duur/tijden-behoud),
 *   splitsen-validatie, ontplannen/overlap (werkitemOpDag)
 * - wachtrij-filtering: alleen relevante beurten per periode, projecten altijd
 * - team-loskoppelen-dag: overlapbepaling voor meerdaagse items
 * - seizoensvenster: waarschuwing (geen blokkade), incl. jaargrens-wrap
 * - migratie-afleiding weekPlanning → werkitem (idempotentie-bouwsteen:
 *   eenduidige datums, team alleen bij precies één kandidaat)
 * - bemanning-defaults per team-dag + afwezigheidsblokken
 * - rolchecks: alleen kantoor muteert het planbord
 * - beschikbaarheidsvenster-hint + voorkeursteam (werkitem wint van klant)
 * - periodetoggle: bereiken en navigatie
 */

import { describe, it, expect } from "vitest";
import {
  addDagen,
  afleidPlanningUitWeekPlanning,
  bemanningVoorDag,
  berekenDuplicaatPlanning,
  beschikbaarheidsHint,
  dagenTussen,
  datumBinnenVenster,
  effectievePlanvoorkeuren,
  isAfwezig,
  isoWeekdag,
  isRelevantVoorWachtrij,
  magPlanbordMuteren,
  overlaptPeriode,
  seizoensvensterWaarschuwing,
  valideerSplitsDelen,
  werkitemOpDag,
  WACHTRIJ_MARGE_DAGEN,
} from "../../../../convex/planbordLogica";
import {
  naarBemanningCel,
  naarEvents,
  naarResources,
  eventsVoorTeamDag,
} from "../../../../src/components/planbord/adapter";
import {
  kolomDatums,
  maandagVan,
  periodeBereik,
  schuifAnker,
} from "../../../../src/components/planbord/periode";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

// ─── Test-hulpjes ────────────────────────────────────────────────────────────

const teamId = (n: string) => n as Id<"teams">;
const medewerkerId = (n: string) => n as Id<"medewerkers">;
const projectId = (n: string) => n as Id<"projecten">;

function maakWerkitem(
  velden: Partial<Doc<"projecten">>
): Doc<"projecten"> {
  return {
    _id: projectId("werkitem1"),
    _creationTime: 0,
    userId: "user1" as Id<"users">,
    naam: "Testklus",
    status: "gepland",
    createdAt: 0,
    updatedAt: 0,
    ...velden,
  } as Doc<"projecten">;
}

// ─── Datum-helpers ───────────────────────────────────────────────────────────

describe("datum-helpers", () => {
  it("addDagen telt over maand- en jaargrenzen", () => {
    expect(addDagen("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDagen("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDagen("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("dagenTussen is inclusief-exclusief consistent", () => {
    expect(dagenTussen("2026-05-14", "2026-05-14")).toBe(0);
    expect(dagenTussen("2026-05-14", "2026-05-16")).toBe(2);
  });

  it("isoWeekdag: maandag=1, zondag=7", () => {
    expect(isoWeekdag("2026-07-06")).toBe(1); // maandag
    expect(isoWeekdag("2026-07-12")).toBe(7); // zondag
  });

  it("overlaptPeriode detecteert randgevallen inclusief", () => {
    expect(overlaptPeriode("2026-05-01", "2026-05-03", "2026-05-03", "2026-05-10")).toBe(true);
    expect(overlaptPeriode("2026-05-01", "2026-05-02", "2026-05-03", "2026-05-10")).toBe(false);
  });
});

// ─── updatePlanning-flow-bouwstenen ─────────────────────────────────────────

describe("plannen/ontplannen: werkitemOpDag (ook basis van team-loskoppelen)", () => {
  it("ongepland werkitem valt op geen enkele dag", () => {
    expect(werkitemOpDag({ geplandeStart: undefined, geplandeEind: undefined }, "2026-05-14")).toBe(false);
  });

  it("eendaags werkitem valt alleen op zijn eigen dag", () => {
    const item = { geplandeStart: "2026-05-14", geplandeEind: undefined };
    expect(werkitemOpDag(item, "2026-05-14")).toBe(true);
    expect(werkitemOpDag(item, "2026-05-15")).toBe(false);
  });

  it("meerdaags werkitem raakt elke dag in zijn bereik (uitval-scenario)", () => {
    const item = { geplandeStart: "2026-05-13", geplandeEind: "2026-05-15" };
    expect(werkitemOpDag(item, "2026-05-13")).toBe(true);
    expect(werkitemOpDag(item, "2026-05-14")).toBe(true);
    expect(werkitemOpDag(item, "2026-05-15")).toBe(true);
    expect(werkitemOpDag(item, "2026-05-16")).toBe(false);
  });
});

describe("dupliceren: behoud van duur (team/tijden kopieert de mutation)", () => {
  it("eendaags item wordt eendaags op de doeldag", () => {
    expect(
      berekenDuplicaatPlanning(
        { geplandeStart: "2026-05-14", geplandeEind: "2026-05-14" },
        "2026-05-21"
      )
    ).toEqual({ geplandeStart: "2026-05-21", geplandeEind: "2026-05-21" });
  });

  it("driedaags item blijft driedaags", () => {
    expect(
      berekenDuplicaatPlanning(
        { geplandeStart: "2026-05-13", geplandeEind: "2026-05-15" },
        "2026-06-01"
      )
    ).toEqual({ geplandeStart: "2026-06-01", geplandeEind: "2026-06-03" });
  });

  it("item zonder eind wordt eendaags (nooit negatieve duur)", () => {
    expect(
      berekenDuplicaatPlanning({ geplandeStart: "2026-05-14", geplandeEind: undefined }, "2026-05-21")
    ).toEqual({ geplandeStart: "2026-05-21", geplandeEind: "2026-05-21" });
  });
});

describe("splitsen: validatie van delen", () => {
  it("vereist minimaal twee delen", () => {
    expect(valideerSplitsDelen([{ geplandeStart: "2026-05-14" }])).toMatch(/minimaal twee/);
  });

  it("accepteert twee geldige delen (ook met team-wissel)", () => {
    expect(
      valideerSplitsDelen([
        { geplandeStart: "2026-05-14", geplandeEind: "2026-05-14" },
        { geplandeStart: "2026-05-15", teamId: teamId("team2") },
      ])
    ).toBeNull();
  });

  it("weigert een deel waarvan het eind vóór de start ligt", () => {
    expect(
      valideerSplitsDelen([
        { geplandeStart: "2026-05-14" },
        { geplandeStart: "2026-05-15", geplandeEind: "2026-05-14" },
      ])
    ).toMatch(/vóór de startdatum/);
  });
});

// ─── Wachtrij-filtering ──────────────────────────────────────────────────────

describe("wachtrij: beurten alleen in relevante weken", () => {
  const week = { start: "2026-07-06", eind: "2026-07-12" };

  it("projecten zijn altijd relevant (geen ritme)", () => {
    expect(isRelevantVoorWachtrij({ type: "project", voorzieneDatum: undefined }, week.start, week.eind)).toBe(true);
    expect(isRelevantVoorWachtrij({ type: undefined, voorzieneDatum: undefined }, week.start, week.eind)).toBe(true);
  });

  it("beurt zonder voorziene datum blijft zichtbaar", () => {
    expect(isRelevantVoorWachtrij({ type: "onderhoudsbeurt", voorzieneDatum: undefined }, week.start, week.eind)).toBe(true);
  });

  it("beurt met voorziene datum in de periode is relevant", () => {
    expect(isRelevantVoorWachtrij({ type: "onderhoudsbeurt", voorzieneDatum: "2026-07-08" }, week.start, week.eind)).toBe(true);
  });

  it("beurt binnen de marge vóór de periode-einde is relevant", () => {
    const binnenMarge = addDagen(week.eind, WACHTRIJ_MARGE_DAGEN);
    expect(isRelevantVoorWachtrij({ type: "onderhoudsbeurt", voorzieneDatum: binnenMarge }, week.start, week.eind)).toBe(true);
  });

  it("beurt ver in de toekomst is NIET relevant", () => {
    expect(isRelevantVoorWachtrij({ type: "onderhoudsbeurt", voorzieneDatum: "2026-10-01" }, week.start, week.eind)).toBe(false);
  });

  it("achterstallige beurt (voorziene datum verstreken) blijft zichtbaar", () => {
    expect(isRelevantVoorWachtrij({ type: "onderhoudsbeurt", voorzieneDatum: "2026-03-01" }, week.start, week.eind)).toBe(true);
  });
});

// ─── Seizoensvenster-bewaking ────────────────────────────────────────────────

describe("seizoensvenster: waarschuwing, geen blokkade", () => {
  it("datum binnen normaal venster (mrt-nov)", () => {
    const venster = { vensterVanMaand: 3, vensterTotMaand: 11 };
    expect(datumBinnenVenster(venster, "2026-07-10")).toBe(true);
    expect(datumBinnenVenster(venster, "2026-01-15")).toBe(false);
  });

  it("venster over de jaargrens (okt-mrt)", () => {
    const venster = { vensterVanMaand: 10, vensterTotMaand: 3 };
    expect(datumBinnenVenster(venster, "2026-11-05")).toBe(true);
    expect(datumBinnenVenster(venster, "2026-02-05")).toBe(true);
    expect(datumBinnenVenster(venster, "2026-06-05")).toBe(false);
  });

  it("geen waarschuwing binnen het venster of zonder venster", () => {
    expect(seizoensvensterWaarschuwing({ vensterVanMaand: 3, vensterTotMaand: 11 }, "2026-07-10")).toBeNull();
    expect(seizoensvensterWaarschuwing(null, "2026-01-10")).toBeNull();
    expect(seizoensvensterWaarschuwing({}, "2026-01-10")).toBeNull();
  });

  it("waarschuwing buiten het venster noemt het venster en blokkeert niet", () => {
    const tekst = seizoensvensterWaarschuwing(
      { vensterVanMaand: 3, vensterTotMaand: 11 },
      "2026-01-10",
      "Heg knippen"
    );
    expect(tekst).toMatch(/buiten het seizoensvenster/);
    expect(tekst).toMatch(/maart t\/m november/);
    expect(tekst).toMatch(/Heg knippen/);
    expect(tekst).toMatch(/Plannen kan gewoon/);
  });

  it("geen waarschuwing zonder plandatum (ontplannen)", () => {
    expect(seizoensvensterWaarschuwing({ vensterVanMaand: 3, vensterTotMaand: 11 }, null)).toBeNull();
  });
});

// ─── Migratie-afleiding (weekPlanning → werkitem) ───────────────────────────

describe("migratie: afleiding uit weekPlanning-rijen", () => {
  const teams = [
    { _id: teamId("groen"), leden: [medewerkerId("jan"), medewerkerId("piet")], isActief: true },
    { _id: teamId("blauw"), leden: [medewerkerId("kees")], isActief: true },
    { _id: teamId("oud"), leden: [medewerkerId("jan"), medewerkerId("piet")], isActief: false },
  ];

  it("geen rijen → niets af te leiden (mutation slaat over)", () => {
    expect(afleidPlanningUitWeekPlanning([], teams)).toBeNull();
  });

  it("datums = min/max; team eenduidig als precies één actief team alle medewerkers bevat", () => {
    const afgeleid = afleidPlanningUitWeekPlanning(
      [
        { medewerkerId: medewerkerId("jan"), datum: "2026-05-15" },
        { medewerkerId: medewerkerId("piet"), datum: "2026-05-13" },
        { medewerkerId: medewerkerId("jan"), datum: "2026-05-14" },
      ],
      teams
    );
    expect(afgeleid).toEqual({
      geplandeStart: "2026-05-13",
      geplandeEind: "2026-05-15",
      teamId: teamId("groen"),
      redenGeenTeam: null,
    });
  });

  it("inactief team telt niet mee als kandidaat", () => {
    // "oud" heeft dezelfde leden als "groen" maar is inactief → nog steeds eenduidig
    const afgeleid = afleidPlanningUitWeekPlanning(
      [{ medewerkerId: medewerkerId("piet"), datum: "2026-05-13" }],
      teams
    );
    expect(afgeleid?.teamId).toBe(teamId("groen"));
  });

  it("geen team dat alle medewerkers bevat → gerapporteerd, niet gegokt", () => {
    const afgeleid = afleidPlanningUitWeekPlanning(
      [
        { medewerkerId: medewerkerId("jan"), datum: "2026-05-13" },
        { medewerkerId: medewerkerId("kees"), datum: "2026-05-13" },
      ],
      teams
    );
    expect(afgeleid?.teamId).toBeNull();
    expect(afgeleid?.redenGeenTeam).toMatch(/geen actief team/);
    // Datums blijven wél eenduidig migreerbaar
    expect(afgeleid?.geplandeStart).toBe("2026-05-13");
  });

  it("meerdere kandidaat-teams → niet eenduidig, gerapporteerd", () => {
    const meerTeams = [
      ...teams,
      { _id: teamId("groen2"), leden: [medewerkerId("jan"), medewerkerId("piet")], isActief: true },
    ];
    const afgeleid = afleidPlanningUitWeekPlanning(
      [{ medewerkerId: medewerkerId("jan"), datum: "2026-05-13" }],
      meerTeams
    );
    expect(afgeleid?.teamId).toBeNull();
    expect(afgeleid?.redenGeenTeam).toMatch(/meerdere teams/);
  });
});

// ─── Bemanning per team-dag + afwezigheid ───────────────────────────────────

describe("bemanning: default = vaste teamleden", () => {
  const team = { leden: [medewerkerId("jan"), medewerkerId("piet")] };

  it("zonder teamBemanning-rij gelden de vaste leden", () => {
    expect(bemanningVoorDag(team, null)).toEqual({
      medewerkerIds: team.leden,
      bron: "default",
    });
  });

  it("met rij wint de dag-specifieke bemanning", () => {
    expect(
      bemanningVoorDag(team, { medewerkerIds: [medewerkerId("kees")] })
    ).toEqual({ medewerkerIds: [medewerkerId("kees")], bron: "aangepast" });
  });
});

describe("afwezigheidsblokken blokkeren capaciteit", () => {
  const basis = { startDatum: "2026-05-13", eindDatum: "2026-05-15" };

  it("medewerker-scope raakt alleen die medewerker binnen het bereik", () => {
    const blok = { ...basis, medewerkerId: medewerkerId("jan"), teamId: undefined };
    expect(isAfwezig(blok, "2026-05-14", medewerkerId("jan"), teamId("groen"))).toBe(true);
    expect(isAfwezig(blok, "2026-05-14", medewerkerId("piet"), teamId("groen"))).toBe(false);
    expect(isAfwezig(blok, "2026-05-16", medewerkerId("jan"), teamId("groen"))).toBe(false);
  });

  it("team-scope raakt iedereen in dat team (bv. feestdag)", () => {
    const blok = { ...basis, medewerkerId: undefined, teamId: teamId("groen") };
    expect(isAfwezig(blok, "2026-05-13", medewerkerId("piet"), teamId("groen"))).toBe(true);
    expect(isAfwezig(blok, "2026-05-13", medewerkerId("piet"), teamId("blauw"))).toBe(false);
  });
});

// ─── Rolchecks ───────────────────────────────────────────────────────────────

describe("rolchecks: alleen kantoor muteert het planbord", () => {
  it.each(["directie", "projectleider", "admin"])("%s mag muteren", (rol) => {
    expect(magPlanbordMuteren(rol)).toBe(true);
  });

  it.each(["voorman", "medewerker", "klant", "viewer", "onderaannemer_zzp", "materiaalman", undefined, null, ""])(
    "%s mag NIET muteren",
    (rol) => {
      expect(magPlanbordMuteren(rol as string | null | undefined)).toBe(false);
    }
  );
});

// ─── Beschikbaarheidsvenster + voorkeursteam ────────────────────────────────

describe("beschikbaarheidsvenster: hint, geen blokkade", () => {
  it("geen venster → geen hint", () => {
    expect(beschikbaarheidsHint(null, "2026-07-09")).toBeNull();
  });

  it("'alleen donderdag': hint op andere dagen, geen hint op donderdag", () => {
    const venster = { dagen: [4] };
    expect(beschikbaarheidsHint(venster, "2026-07-09")).toBeNull(); // donderdag
    expect(beschikbaarheidsHint(venster, "2026-07-10")).toMatch(/donderdag/); // vrijdag
  });

  it("datumbereik: buiten van/tot geeft hint", () => {
    const venster = { vanDatum: "2026-08-01", totDatum: "2026-08-31" };
    expect(beschikbaarheidsHint(venster, "2026-07-10")).toMatch(/vanaf 2026-08-01/);
    expect(beschikbaarheidsHint(venster, "2026-09-01")).toMatch(/tot 2026-08-31/);
    expect(beschikbaarheidsHint(venster, "2026-08-15")).toBeNull();
  });

  it("voorkeuren: werkitem-velden winnen van klant-velden", () => {
    const werkitem = { voorkeursTeamId: teamId("blauw"), beschikbaarheidsVenster: undefined };
    const klant = {
      voorkeursTeamId: teamId("groen"),
      beschikbaarheidsVenster: { dagen: [4] },
    } as Pick<Doc<"klanten">, "voorkeursTeamId" | "beschikbaarheidsVenster">;
    const voorkeuren = effectievePlanvoorkeuren(werkitem, klant);
    expect(voorkeuren.voorkeursTeamId).toBe(teamId("blauw")); // override
    expect(voorkeuren.beschikbaarheidsVenster).toEqual({ dagen: [4] }); // fallback klant
  });
});

// ─── Adapter (B3: databinding-abstractie) ───────────────────────────────────

describe("adapter: Convex → resources/events", () => {
  it("naarEvents mapt alleen geplande werkitems", () => {
    const events = naarEvents([
      maakWerkitem({ _id: projectId("a"), geplandeStart: "2026-05-14", geplandeEind: "2026-05-15", teamId: teamId("groen"), volgordeBinnenDag: 2, geplandeStartTijd: "08:00", geplandeEindTijd: "12:00" }),
      maakWerkitem({ _id: projectId("b") }), // ongepland → hoort in de bak
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: projectId("a"),
      resourceId: teamId("groen"),
      start: "2026-05-14",
      eind: "2026-05-15",
      volgordeBinnenDag: 2,
      startTijd: "08:00",
    });
  });

  it("eventsVoorTeamDag filtert op team-dag en sorteert op volgorde", () => {
    const events = naarEvents([
      maakWerkitem({ _id: projectId("laat"), naam: "Laat", geplandeStart: "2026-05-14", teamId: teamId("groen"), volgordeBinnenDag: 2 }),
      maakWerkitem({ _id: projectId("vroeg"), naam: "Vroeg", geplandeStart: "2026-05-14", teamId: teamId("groen"), volgordeBinnenDag: 1 }),
      maakWerkitem({ _id: projectId("ander"), naam: "Ander team", geplandeStart: "2026-05-14", teamId: teamId("blauw") }),
    ]);
    const dag = eventsVoorTeamDag(events, teamId("groen"), "2026-05-14");
    expect(dag.map((e) => e.id)).toEqual([projectId("vroeg"), projectId("laat")]);
  });

  it("naarBemanningCel combineert default/override met afwezigheid en team-afwezigheid", () => {
    const context = {
      teams: [{ _id: teamId("groen"), naam: "Groen", leden: [medewerkerId("jan"), medewerkerId("piet")] }],
      bemanning: [
        { teamId: teamId("groen"), datum: "2026-05-14", medewerkerIds: [medewerkerId("jan")] },
      ],
      afwezigheid: [
        {
          medewerkerId: medewerkerId("jan"),
          teamId: undefined,
          startDatum: "2026-05-14",
          eindDatum: "2026-05-14",
        } as Doc<"afwezigheidsblokken">,
        {
          medewerkerId: undefined,
          teamId: teamId("groen"),
          startDatum: "2026-05-20",
          eindDatum: "2026-05-20",
        } as Doc<"afwezigheidsblokken">,
      ],
      medewerkerNamen: {},
    };
    // Override-dag: alleen jan, en jan is afwezig
    const cel = naarBemanningCel(context, teamId("groen"), "2026-05-14");
    expect(cel.bron).toBe("aangepast");
    expect(cel.medewerkerIds).toEqual([medewerkerId("jan")]);
    expect(cel.afwezigen).toEqual([medewerkerId("jan")]);
    expect(cel.teamAfwezig).toBe(false);
    // Default-dag met team-afwezigheid (feestdag)
    const feestdag = naarBemanningCel(context, teamId("groen"), "2026-05-20");
    expect(feestdag.bron).toBe("default");
    expect(feestdag.medewerkerIds).toEqual([medewerkerId("jan"), medewerkerId("piet")]);
    expect(feestdag.teamAfwezig).toBe(true);

    expect(naarResources(context)[0]).toEqual({
      id: teamId("groen"),
      naam: "Groen",
      ledenDefault: [medewerkerId("jan"), medewerkerId("piet")],
    });
  });
});

// ─── Periodetoggle ──────────────────────────────────────────────────────────

describe("periodetoggle: dag / 3 dagen / week / 14 dagen / 4 weken / maand", () => {
  it("maandagVan vindt de maandag van de week", () => {
    expect(maandagVan("2026-07-10")).toBe("2026-07-06"); // vrijdag → maandag
    expect(maandagVan("2026-07-06")).toBe("2026-07-06");
    expect(maandagVan("2026-07-12")).toBe("2026-07-06"); // zondag hoort bij die week
  });

  it("bereiken per periode", () => {
    expect(periodeBereik("dag", "2026-07-10")).toEqual({ start: "2026-07-10", eind: "2026-07-10" });
    expect(periodeBereik("3dagen", "2026-07-10")).toEqual({ start: "2026-07-10", eind: "2026-07-12" });
    expect(periodeBereik("week", "2026-07-10")).toEqual({ start: "2026-07-06", eind: "2026-07-12" });
    expect(periodeBereik("14dagen", "2026-07-10")).toEqual({ start: "2026-07-06", eind: "2026-07-19" });
    expect(periodeBereik("4weken", "2026-07-10")).toEqual({ start: "2026-07-06", eind: "2026-08-02" });
    expect(periodeBereik("maand", "2026-02-10")).toEqual({ start: "2026-02-01", eind: "2026-02-28" });
  });

  it("kolomDatums levert alle dagen inclusief", () => {
    expect(kolomDatums("2026-07-06", "2026-07-12")).toHaveLength(7);
    expect(kolomDatums("2026-07-06", "2026-07-06")).toEqual(["2026-07-06"]);
  });

  it("schuifAnker navigeert per periode-lengte", () => {
    expect(schuifAnker("week", "2026-07-10", 1)).toBe("2026-07-17");
    expect(schuifAnker("dag", "2026-07-10", -1)).toBe("2026-07-09");
    expect(schuifAnker("maand", "2026-12-15", 1)).toBe("2027-01-01");
  });
});
