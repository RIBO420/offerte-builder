/**
 * Lijstweergave van afspraken (PRD bijlage B, fase 2 §2.5 restitem A).
 *
 * Acceptatietests:
 * 1. "Mijn" = alleen afspraken van de eigen teams (voorman: teams waar de
 *    gekoppelde medewerker in de leden zit); zonder medewerker = leeg;
 * 2. Filters: team, status, periode (overlap, ook meerdaags);
 * 3. Sortering per kolom (datum/naam/team/status/tijd/uren), asc/desc,
 *    lege waarden achteraan bij oplopend;
 * 4. Zelfde data-adapter als het bord (naarEvents) — geen nieuwe opslag.
 */

import { describe, it, expect } from "vitest";
import type { PlanbordEvent } from "../../../components/planbord/adapter";
import {
  eigenTeamIds,
  filterAfspraken,
  sorteerAfspraken,
  type LijstFilters,
} from "../../../components/planbord/lijst";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Test-event; ids zijn strings (Convex-Id-branding is runtime irrelevant). */
function event(overrides: Record<string, unknown> = {}): PlanbordEvent {
  return {
    id: `projecten:${Math.random().toString(36).slice(2, 8)}`,
    resourceId: "teams:1",
    start: "2026-07-13",
    eind: "2026-07-13",
    titel: "Beurt heg",
    type: "onderhoudsbeurt",
    status: "gepland",
    ...overrides,
  } as unknown as PlanbordEvent;
}

const TEAMS = [
  { _id: "teams:1", leden: ["medewerkers:1", "medewerkers:2"] },
  { _id: "teams:2", leden: ["medewerkers:3"] },
];

const TEAM_NAMEN: Record<string, string> = {
  "teams:1": "Team Groen",
  "teams:2": "Team Blauw",
};

function alleFilters(overrides: Partial<LijstFilters> = {}): LijstFilters {
  return {
    weergave: "alle",
    teamId: null,
    status: null,
    van: null,
    tot: null,
    ...overrides,
  };
}

// ─── Mijn / Alle ─────────────────────────────────────────────────────────────

describe("eigenTeamIds", () => {
  it("vindt de teams waar de medewerker in de leden zit", () => {
    expect(eigenTeamIds(TEAMS, "medewerkers:1")).toEqual(new Set(["teams:1"]));
    expect(eigenTeamIds(TEAMS, "medewerkers:3")).toEqual(new Set(["teams:2"]));
  });

  it("geeft een lege set zonder gekoppelde medewerker", () => {
    expect(eigenTeamIds(TEAMS, null).size).toBe(0);
  });
});

describe("filterAfspraken — Mijn = eigen team", () => {
  const events = [
    event({ id: "projecten:a", resourceId: "teams:1", titel: "Eigen team" }),
    event({ id: "projecten:b", resourceId: "teams:2", titel: "Ander team" }),
    event({ id: "projecten:c", resourceId: null, titel: "Zonder team" }),
  ];

  it("toont bij Mijn alleen de afspraken van de eigen teams (voorman)", () => {
    const eigen = eigenTeamIds(TEAMS, "medewerkers:1");
    const resultaat = filterAfspraken(
      events,
      alleFilters({ weergave: "mijn" }),
      eigen
    );
    expect(resultaat.map((e) => e.titel)).toEqual(["Eigen team"]);
  });

  it("toont bij Mijn zonder gekoppelde medewerker niets", () => {
    const resultaat = filterAfspraken(
      events,
      alleFilters({ weergave: "mijn" }),
      eigenTeamIds(TEAMS, null)
    );
    expect(resultaat).toHaveLength(0);
  });

  it("toont bij Alle alles (ook zonder team)", () => {
    const resultaat = filterAfspraken(events, alleFilters(), new Set());
    expect(resultaat).toHaveLength(3);
  });
});

// ─── Filters: team / status / periode ────────────────────────────────────────

describe("filterAfspraken — team, status en periode", () => {
  const events = [
    event({ id: "projecten:a", resourceId: "teams:1", status: "gepland", start: "2026-07-13", eind: "2026-07-13" }),
    event({ id: "projecten:b", resourceId: "teams:2", status: "uitgevoerd", start: "2026-07-15", eind: "2026-07-15" }),
    // Meerdaags project dat de periodegrens overlapt
    event({ id: "projecten:c", resourceId: "teams:1", status: "in_uitvoering", start: "2026-07-10", eind: "2026-07-14", type: "project" }),
    event({ id: "projecten:d", resourceId: "teams:1", status: "gepland", start: "2026-08-01", eind: "2026-08-01" }),
  ];

  it("filtert op team", () => {
    const resultaat = filterAfspraken(
      events,
      alleFilters({ teamId: "teams:2" }),
      new Set()
    );
    expect(resultaat.map((e) => e.id)).toEqual(["projecten:b"]);
  });

  it("filtert op status", () => {
    const resultaat = filterAfspraken(
      events,
      alleFilters({ status: "gepland" }),
      new Set()
    );
    expect(resultaat.map((e) => e.id)).toEqual(["projecten:a", "projecten:d"]);
  });

  it("filtert op periode met overlap (meerdaags telt mee)", () => {
    const resultaat = filterAfspraken(
      events,
      alleFilters({ van: "2026-07-13", tot: "2026-07-19" }),
      new Set()
    );
    // a (13e), b (15e) en c (10-14 overlapt); d (augustus) niet
    expect(resultaat.map((e) => e.id)).toEqual([
      "projecten:a",
      "projecten:b",
      "projecten:c",
    ]);
  });

  it("combineert filters (Mijn + status + periode)", () => {
    const resultaat = filterAfspraken(
      events,
      alleFilters({
        weergave: "mijn",
        status: "gepland",
        van: "2026-07-01",
        tot: "2026-07-31",
      }),
      eigenTeamIds(TEAMS, "medewerkers:2")
    );
    expect(resultaat.map((e) => e.id)).toEqual(["projecten:a"]);
  });
});

// ─── Sortering per kolom ─────────────────────────────────────────────────────

describe("sorteerAfspraken", () => {
  const events = [
    event({ id: "projecten:a", titel: "Zebra", start: "2026-07-15", startTijd: "10:00", geschatteUren: 2, resourceId: "teams:2", status: "uitgevoerd" }),
    event({ id: "projecten:b", titel: "Appel", start: "2026-07-13", startTijd: undefined, geschatteUren: undefined, resourceId: "teams:1", status: "gepland" }),
    event({ id: "projecten:c", titel: "Mango", start: "2026-07-13", startTijd: "08:00", geschatteUren: 4, resourceId: null, status: "in_uitvoering" }),
  ];

  it("sorteert op datum (met tijd als secundaire sleutel)", () => {
    const asc = sorteerAfspraken(events, "datum", "asc", TEAM_NAMEN);
    // 13e 08:00 (c) vóór 13e zonder tijd (b), dan 15e (a)
    expect(asc.map((e) => e.id)).toEqual([
      "projecten:c",
      "projecten:b",
      "projecten:a",
    ]);
    const desc = sorteerAfspraken(events, "datum", "desc", TEAM_NAMEN);
    expect(desc[0].id).toBe("projecten:a");
  });

  it("sorteert op naam (NL, hoofdletterongevoelig)", () => {
    const asc = sorteerAfspraken(events, "naam", "asc", TEAM_NAMEN);
    expect(asc.map((e) => e.titel)).toEqual(["Appel", "Mango", "Zebra"]);
  });

  it("sorteert op team; zonder team achteraan bij oplopend", () => {
    const asc = sorteerAfspraken(events, "team", "asc", TEAM_NAMEN);
    expect(asc.map((e) => e.id)).toEqual([
      "projecten:a", // Team Blauw
      "projecten:b", // Team Groen
      "projecten:c", // zonder team
    ]);
  });

  it("sorteert op uren; ontbrekende uren achteraan bij oplopend", () => {
    const asc = sorteerAfspraken(events, "uren", "asc", TEAM_NAMEN);
    expect(asc.map((e) => e.geschatteUren)).toEqual([2, 4, undefined]);
    const desc = sorteerAfspraken(events, "uren", "desc", TEAM_NAMEN);
    expect(desc[0].geschatteUren).toBeUndefined();
  });

  it("muteert de invoerlijst niet", () => {
    const kopie = [...events];
    sorteerAfspraken(events, "naam", "desc", TEAM_NAMEN);
    expect(events).toEqual(kopie);
  });
});
