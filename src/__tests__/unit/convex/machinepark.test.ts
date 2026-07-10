/**
 * Unit tests Machinepark (PRD §3.3, fase 2 stap 3)
 *
 * Test de pure businesslogica uit convex/machineparkLogica.ts:
 * - statusmapping voertuigen/machines ↔ uniforme middelstatus
 * - bus-keten (delta-checklist §2.6): dag-override → team-standaardbus →
 *   fallback eerste toegewezen voertuig (fase 1-vangnet)
 * - dubbel-claim-detectie: zelfde middel + zelfde dag = conflict;
 *   verschillende dagen of verschillende middelen niet
 * - weekbord-waarschuwingen: kapotte (effectieve) bus per team-dag,
 *   kapot gereserveerd middel, dubbele claims — waarschuwing, geen blokkade
 * - rolchecks: kantoor beheert, voorman/medewerker/klant leest alleen
 */

import { describe, it, expect } from "vitest";
import {
  bepaalEffectieveBus,
  berekenMaterieelWaarschuwingen,
  dubbelClaimWaarschuwing,
  kapotWaarschuwing,
  machineStatusNaarMiddelStatus,
  maakMiddelSleutel,
  magMachineparkMuteren,
  middelStatusNaarVoertuigStatus,
  vindDubbelClaims,
  voertuigStatusNaarMiddelStatus,
  type MiddelStatus,
} from "../../../../convex/machineparkLogica";

describe("statusmapping", () => {
  it("mapt voertuigstatus naar uniforme middelstatus en terug", () => {
    expect(voertuigStatusNaarMiddelStatus("actief")).toBe("beschikbaar");
    expect(voertuigStatusNaarMiddelStatus("onderhoud")).toBe("onderhoud");
    expect(voertuigStatusNaarMiddelStatus("kapot")).toBe("kapot");
    expect(voertuigStatusNaarMiddelStatus("inactief")).toBe("inactief");
    expect(middelStatusNaarVoertuigStatus("beschikbaar")).toBe("actief");
    expect(middelStatusNaarVoertuigStatus("kapot")).toBe("kapot");
  });

  it("machines: isActief=false wint; ontbrekende status = beschikbaar", () => {
    expect(machineStatusNaarMiddelStatus(undefined, true)).toBe("beschikbaar");
    expect(machineStatusNaarMiddelStatus("kapot", true)).toBe("kapot");
    expect(machineStatusNaarMiddelStatus("kapot", false)).toBe("inactief");
  });

  it("middelSleutel is genormaliseerd per soort+id", () => {
    expect(maakMiddelSleutel("voertuig", "v1")).toBe("voertuig:v1");
    expect(maakMiddelSleutel("machine", "m1")).toBe("machine:m1");
  });
});

describe("bus-keten (delta-checklist §2.6): dag-override > standaardbus > fallback", () => {
  it("dag-override wint van alles", () => {
    expect(
      bepaalEffectieveBus({
        dagOverrideVoertuigId: "override",
        teamStandaardVoertuigId: "standaard",
        toegewezenVoertuigen: ["fallback"],
      })
    ).toEqual({ voertuigId: "override", bron: "dag_override" });
  });

  it("zonder override wint de team-standaardbus", () => {
    expect(
      bepaalEffectieveBus({
        teamStandaardVoertuigId: "standaard",
        toegewezenVoertuigen: ["fallback"],
      })
    ).toEqual({ voertuigId: "standaard", bron: "team_standaard" });
  });

  it("vangnet = fase 1-gedrag: eerste toegewezen voertuig", () => {
    expect(
      bepaalEffectieveBus({ toegewezenVoertuigen: ["fallback", "tweede"] })
    ).toEqual({ voertuigId: "fallback", bron: "werkitem_fallback" });
  });

  it("zonder enige bron: geen bus (delta = alles, fail-closed)", () => {
    expect(bepaalEffectieveBus({})).toEqual({ voertuigId: null, bron: null });
    expect(bepaalEffectieveBus({ toegewezenVoertuigen: [] })).toEqual({
      voertuigId: null,
      bron: null,
    });
  });
});

describe("dubbel-claim-detectie (schaars materieel)", () => {
  const claim = (middel: string, datum: string, werkitem: string) => ({
    middelSleutel: middel,
    datum,
    werkitemId: werkitem,
  });

  it("zelfde middel op dezelfde dag door twee werkitems = conflict", () => {
    const conflicten = vindDubbelClaims([
      claim("machine:kraan", "2026-07-15", "w1"),
      claim("machine:kraan", "2026-07-15", "w2"),
    ]);
    expect(conflicten).toHaveLength(1);
    expect(conflicten[0]).toMatchObject({
      middelSleutel: "machine:kraan",
      datum: "2026-07-15",
    });
    expect(conflicten[0].werkitemIds.sort()).toEqual(["w1", "w2"]);
  });

  it("zelfde middel op verschillende dagen = géén conflict", () => {
    expect(
      vindDubbelClaims([
        claim("machine:kraan", "2026-07-15", "w1"),
        claim("machine:kraan", "2026-07-16", "w2"),
      ])
    ).toHaveLength(0);
  });

  it("verschillende middelen op dezelfde dag = géén conflict", () => {
    expect(
      vindDubbelClaims([
        claim("machine:kraan", "2026-07-15", "w1"),
        claim("voertuig:hoogwerker", "2026-07-15", "w2"),
      ])
    ).toHaveLength(0);
  });

  it("dubbele rijen van hetzelfde werkitem tellen niet als conflict", () => {
    expect(
      vindDubbelClaims([
        claim("machine:kraan", "2026-07-15", "w1"),
        claim("machine:kraan", "2026-07-15", "w1"),
      ])
    ).toHaveLength(0);
  });

  it("waarschuwingstekst is een waarschuwing, geen blokkade", () => {
    const tekst = dubbelClaimWaarschuwing("Kraan", "2026-07-15", "Aanleg Jansen");
    expect(tekst).toContain("Kraan");
    expect(tekst).toContain("2026-07-15");
    expect(tekst).toContain("Aanleg Jansen");
    expect(tekst.toLowerCase()).toContain("dubbel");
  });
});

describe("weekbord-waarschuwingen (kapot → team-dagen)", () => {
  const basis = {
    datums: ["2026-07-15", "2026-07-16"],
    teams: [
      { teamId: "team1", naam: "Groen", standaardVoertuigId: "busA" },
      { teamId: "team2", naam: "Blauw", standaardVoertuigId: null },
    ],
    busOverrides: [] as Array<{
      teamId: string;
      datum: string;
      voertuigId: string;
    }>,
    middelen: new Map<string, { naam: string; status: MiddelStatus }>([
      ["voertuig:busA", { naam: "VW Crafter (12-AB-34)", status: "kapot" }],
      ["voertuig:busB", { naam: "Ford Transit (56-CD-78)", status: "beschikbaar" }],
      ["machine:kraan", { naam: "Kraan", status: "kapot" }],
    ]),
    reserveringen: [] as Array<{
      middelSleutel: string;
      datum: string;
      werkitemId: string;
      teamId: string | null;
      werkitemNaam: string;
    }>,
  };

  it("kapotte standaardbus → waarschuwing op elke team-dag van dat team", () => {
    const w = berekenMaterieelWaarschuwingen(basis);
    const busWaarschuwingen = w.filter((x) => x.teamId === "team1");
    expect(busWaarschuwingen).toHaveLength(2); // beide dagen
    expect(busWaarschuwingen[0].tekst).toContain("KAPOT");
    expect(busWaarschuwingen[0].tekst).toContain("VW Crafter");
    // team zonder bus: geen waarschuwingen
    expect(w.filter((x) => x.teamId === "team2")).toHaveLength(0);
  });

  it("dag-override naar een gezonde bus onderdrukt de waarschuwing die dag", () => {
    const w = berekenMaterieelWaarschuwingen({
      ...basis,
      busOverrides: [
        { teamId: "team1", datum: "2026-07-15", voertuigId: "busB" },
      ],
    });
    const dagen = w.filter((x) => x.teamId === "team1").map((x) => x.datum);
    expect(dagen).toEqual(["2026-07-16"]); // alleen de niet-override-dag
  });

  it("kapot gereserveerd middel → waarschuwing op de team-dag van het werkitem", () => {
    const w = berekenMaterieelWaarschuwingen({
      ...basis,
      teams: [], // isoleer het reserverings-pad
      reserveringen: [
        {
          middelSleutel: "machine:kraan",
          datum: "2026-07-15",
          werkitemId: "w1",
          teamId: "team2",
          werkitemNaam: "Aanleg Jansen",
        },
      ],
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ teamId: "team2", datum: "2026-07-15" });
    expect(w[0].tekst).toContain("Kraan");
    expect(w[0].tekst).toContain("Aanleg Jansen");
  });

  it("dubbele claim op dezelfde dag → waarschuwing; andere dagen niet", () => {
    const reservering = (datum: string, werkitem: string, naam: string) => ({
      middelSleutel: "voertuig:busB",
      datum,
      werkitemId: werkitem,
      teamId: null,
      werkitemNaam: naam,
    });
    const zelfdeDag = berekenMaterieelWaarschuwingen({
      ...basis,
      teams: [],
      reserveringen: [
        reservering("2026-07-15", "w1", "Aanleg Jansen"),
        reservering("2026-07-15", "w2", "Beurt De Vries"),
      ],
    });
    expect(zelfdeDag).toHaveLength(1);
    expect(zelfdeDag[0].tekst).toContain("Dubbel geclaimd");
    expect(zelfdeDag[0].tekst).toContain("Aanleg Jansen");
    expect(zelfdeDag[0].tekst).toContain("Beurt De Vries");

    const verschillendeDagen = berekenMaterieelWaarschuwingen({
      ...basis,
      teams: [],
      reserveringen: [
        reservering("2026-07-15", "w1", "Aanleg Jansen"),
        reservering("2026-07-16", "w2", "Beurt De Vries"),
      ],
    });
    expect(verschillendeDagen).toHaveLength(0);
  });

  it("gezond materieel geeft geen waarschuwingen", () => {
    const w = berekenMaterieelWaarschuwingen({
      ...basis,
      teams: [{ teamId: "team1", naam: "Groen", standaardVoertuigId: "busB" }],
    });
    expect(w).toHaveLength(0);
  });

  it("kapotWaarschuwing benoemt soort en context", () => {
    expect(kapotWaarschuwing("Kraan", "machine", "gereserveerd")).toContain(
      "Machine"
    );
    expect(kapotWaarschuwing("Bus", "voertuig")).toContain("Bus/voertuig");
  });
});

describe("rolchecks (kantoor beheert, voorman leest)", () => {
  it("alleen kantoor (directie/projectleider/admin-legacy) mag muteren", () => {
    expect(magMachineparkMuteren("directie")).toBe(true);
    expect(magMachineparkMuteren("projectleider")).toBe(true);
    expect(magMachineparkMuteren("admin")).toBe(true); // legacy → directie
    expect(magMachineparkMuteren("voorman")).toBe(false);
    expect(magMachineparkMuteren("medewerker")).toBe(false);
    expect(magMachineparkMuteren("klant")).toBe(false);
    expect(magMachineparkMuteren("onderaannemer_zzp")).toBe(false);
    expect(magMachineparkMuteren(undefined)).toBe(false);
  });
});
