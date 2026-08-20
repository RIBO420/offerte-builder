/**
 * De rekenkern van het werkbord "Mijn dag" (functionele inventaris §B1–§B3).
 *
 * Alles wat het bord *beslist* — wie welke taak ziet, in welke kolom hij valt
 * en wanneer hij "blijft liggen" — zit in `verdeel-op.ts` en nergens anders.
 * Dat is bewust: een bord dat zijn regels in JSX heeft staan, kun je alleen
 * nog met de muis testen, en juist deze regels zijn de klantafspraak.
 *
 * Wat hier vastligt en zonder test stilletjes wegzakt:
 *
 * 1. **Perspectief** (§B1): "Van mij" is maker óf checker; "Uitgezet door mij"
 *    is uitzetter = ik én maker ≠ ik — anders staat je eigen werk twee keer op
 *    het bord.
 * 2. **Kolommen** (§B2): een te late taak hoort bij **Vandaag** (niet in een
 *    "verleden"-kolom die niemand aankijkt), "Deze week" loopt t/m vrijdag en
 *    "Later" vangt alles zonder datum.
 * 3. **Klaar is verborgen**, behalve in de Status-indeling — daar is het de
 *    vierde kolom en het bewijs van je dag.
 * 4. **Blijft liggen** (§B3): exact drie triggers, hard vóór zacht, klaar
 *    uitgesloten, en alleen taken waar ík iets mee te maken heb. De teller
 *    loopt bij STILSTAND, niet bij drukte.
 * 5. **Geen dubbeling**: staat een taak in de rode kolom, dan staat hij niet
 *    óók in een gewone kolom — anders vink je hem daar af en blijft de
 *    signalering hangen.
 */

import { describe, it, expect } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import {
  blijftLiggen,
  eindVanWerkweek,
  redenen,
  verdeelOp,
  type BordTaak,
} from "@/components/mijn-dag/verdeel-op";
import type { ToewijsbaarPersoon } from "@/components/taken/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const IK = "u_ik" as Id<"users">;
const BART = "u_bart" as Id<"users">;
const MIRA = "u_mira" as Id<"users">;

function persoon(id: Id<"users">, naam: string): ToewijsbaarPersoon {
  return {
    _id: id,
    naam,
    initialen: naam
      .split(" ")
      .map((deel) => deel[0])
      .join("")
      .toUpperCase(),
    isAdmin: false,
  };
}

const IK_P = persoon(IK, "Ricardo Bos");
const BART_P = persoon(BART, "Bart de Vries");
const MIRA_P = persoon(MIRA, "Mira Jansen");
const PERSONEN = [BART_P, MIRA_P, IK_P];

/** Woensdag 19 augustus 2026 — midden in de week, zodat "deze week" leeft. */
const VANDAAG = "2026-08-19";

let teller = 0;

function taak(overrides: Partial<BordTaak> = {}): BordTaak {
  teller += 1;
  const makerId = overrides.makerId;
  const checkerId = overrides.checkerId;
  return {
    _id: `t${teller}` as Id<"klantTaken">,
    klantId: "k1" as Id<"klanten">,
    klantNaam: "Familie Jansen",
    titel: `Taak ${teller}`,
    status: "todo",
    prioriteit: "normaal",
    deadline: undefined,
    stilDagen: 0,
    makerId,
    checkerId,
    uitgezetDoorId: undefined,
    maker: makerId ? (PERSONEN.find((p) => p._id === makerId) ?? null) : null,
    checker: checkerId
      ? (PERSONEN.find((p) => p._id === checkerId) ?? null)
      : null,
    ...overrides,
  };
}

const BASIS = {
  ikId: IK,
  personen: PERSONEN,
  vandaag: VANDAAG,
  perspectief: "alles" as const,
  statusChip: "alles" as const,
  blijftLiggenModus: "uit" as const,
};

/** Alle taken die ná verdeling ergens in een kolom staan. */
function kolomTaken(kolommen: Array<{ items: BordTaak[] }>): string[] {
  return kolommen.flatMap((k) => k.items.map((t) => t._id.toString()));
}

// ─── §B1 Perspectief ─────────────────────────────────────────────────────────

describe("perspectief (§B1)", () => {
  const vanMijAlsMaker = taak({ makerId: IK });
  const vanMijAlsChecker = taak({ checkerId: IK, makerId: BART });
  const uitgezetDoorMij = taak({ uitgezetDoorId: IK, makerId: BART });
  const uitgezetEnZelfMaker = taak({ uitgezetDoorId: IK, makerId: IK });
  const vanBart = taak({ makerId: BART, uitgezetDoorId: MIRA });

  const alle = [
    vanMijAlsMaker,
    vanMijAlsChecker,
    uitgezetDoorMij,
    uitgezetEnZelfMaker,
    vanBart,
  ];

  it("'Van mij' = maker óf checker ben ik", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: alle,
      indeling: "wanneer",
      perspectief: "mij",
    });
    expect(kolomTaken(kolommen).sort()).toEqual(
      [
        vanMijAlsMaker._id.toString(),
        vanMijAlsChecker._id.toString(),
        uitgezetEnZelfMaker._id.toString(),
      ].sort()
    );
  });

  it("'Uitgezet door mij' laat werk weg dat ik zelf maak", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: alle,
      indeling: "wanneer",
      perspectief: "uitgezet",
    });
    expect(kolomTaken(kolommen)).toEqual([uitgezetDoorMij._id.toString()]);
  });

  it("'Alles' toont het hele team", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: alle,
      indeling: "wanneer",
      perspectief: "alles",
    });
    expect(kolomTaken(kolommen)).toHaveLength(alle.length);
  });
});

// ─── §B1 Statuschips ─────────────────────────────────────────────────────────

describe("statuschips (§B1)", () => {
  const todo = taak({ status: "todo", makerId: IK });
  const bezig = taak({ status: "bezig", makerId: IK });
  const check = taak({ status: "check", makerId: IK });
  const klaar = taak({ status: "klaar", makerId: IK });
  const alle = [todo, bezig, check, klaar];

  it("filtert op één status", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: alle,
      indeling: "wanneer",
      statusChip: "check",
    });
    expect(kolomTaken(kolommen)).toEqual([check._id.toString()]);
  });

  it("verbergt klaar buiten de Status-indeling", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: alle,
      indeling: "wanneer",
    });
    expect(kolomTaken(kolommen)).not.toContain(klaar._id.toString());
    expect(kolomTaken(kolommen)).toHaveLength(3);
  });

  it("toont klaar wél in de Status-indeling", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: alle,
      indeling: "status",
    });
    const klaarKolom = kolommen.find((k) => k.key === "klaar");
    expect(klaarKolom?.items.map((t) => t._id)).toEqual([klaar._id]);
  });
});

// ─── §B2 Indeling "Wanneer" ──────────────────────────────────────────────────

describe("indeling Wanneer (§B2)", () => {
  it("berekent het einde van de werkweek als de eerstvolgende vrijdag", () => {
    expect(eindVanWerkweek("2026-08-19")).toBe("2026-08-21"); // woensdag → vrijdag
    expect(eindVanWerkweek("2026-08-21")).toBe("2026-08-21"); // vrijdag zelf
    expect(eindVanWerkweek("2026-08-22")).toBe("2026-08-28"); // zaterdag → volgende
    expect(eindVanWerkweek("2026-08-23")).toBe("2026-08-28"); // zondag → volgende
  });

  it("zet te late taken bij Vandaag, niet in een aparte hoek", () => {
    const teLaat = taak({ makerId: IK, deadline: "2026-08-11" });
    const vandaag = taak({ makerId: IK, deadline: VANDAAG });
    const morgen = taak({ makerId: IK, deadline: "2026-08-20" });
    const vrijdag = taak({ makerId: IK, deadline: "2026-08-21" });
    const volgendeWeek = taak({ makerId: IK, deadline: "2026-08-25" });
    const zonderDatum = taak({ makerId: IK });

    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: [teLaat, vandaag, morgen, vrijdag, volgendeWeek, zonderDatum],
      indeling: "wanneer",
    });

    const perKolom = Object.fromEntries(
      kolommen.map((k) => [k.key, k.items.map((t) => t._id.toString())])
    );
    expect(perKolom.vandaag).toEqual([
      teLaat._id.toString(),
      vandaag._id.toString(),
    ]);
    expect(perKolom.morgen).toEqual([morgen._id.toString()]);
    expect(perKolom.week).toEqual([vrijdag._id.toString()]);
    expect(perKolom.later).toEqual([
      volgendeWeek._id.toString(),
      zonderDatum._id.toString(),
    ]);
  });

  it("houdt de vier kolommen ook leeg overeind", () => {
    const { kolommen } = verdeelOp({ ...BASIS, taken: [], indeling: "wanneer" });
    expect(kolommen.map((k) => k.key)).toEqual([
      "vandaag",
      "morgen",
      "week",
      "later",
    ]);
    expect(kolommen.every((k) => k.sleepbaar)).toBe(true);
  });
});

// ─── §B2 Indeling "Wie" ──────────────────────────────────────────────────────

describe("indeling Wie (§B2)", () => {
  it("plaatst een taak bij maker én checker en vangt de rest op in 'Niet toegewezen'", () => {
    const gedeeld = taak({ makerId: BART, checkerId: MIRA });
    const vrij = taak({});

    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: [gedeeld, vrij],
      indeling: "wie",
    });

    const perKolom = Object.fromEntries(
      kolommen.map((k) => [k.key, k.items.map((t) => t._id.toString())])
    );
    expect(perKolom[BART.toString()]).toEqual([gedeeld._id.toString()]);
    expect(perKolom[MIRA.toString()]).toEqual([gedeeld._id.toString()]);
    expect(perKolom.__niet_toegewezen__).toEqual([vrij._id.toString()]);
  });

  it("verbergt lege personen buiten 'Alles', maar houdt mijn eigen kolom", () => {
    const vanBart = taak({ makerId: BART, checkerId: IK });

    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: [vanBart],
      indeling: "wie",
      perspectief: "mij",
    });

    const sleutels = kolommen.map((k) => k.key);
    expect(sleutels).toContain(BART.toString());
    expect(sleutels).toContain(IK.toString());
    expect(sleutels).not.toContain(MIRA.toString());
  });

  it("toont in 'Alles' iedereen, ook wie niets omhanden heeft", () => {
    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: [],
      indeling: "wie",
      perspectief: "alles",
    });
    const sleutels = kolommen.map((k) => k.key);
    expect(sleutels).toContain(MIRA.toString());
    expect(sleutels).toContain(BART.toString());
    expect(sleutels[sleutels.length - 1]).toBe("__niet_toegewezen__");
  });
});

// ─── §B2 Indelingen Status en Klant ──────────────────────────────────────────

describe("indelingen Status en Klant (§B2)", () => {
  it("Status heeft vier vaste kolommen in werkvolgorde", () => {
    const { kolommen } = verdeelOp({ ...BASIS, taken: [], indeling: "status" });
    expect(kolommen.map((k) => k.key)).toEqual([
      "todo",
      "bezig",
      "check",
      "klaar",
    ]);
  });

  it("Klant maakt een kolom per klant en staat slepen niet toe", () => {
    const jansen = taak({ makerId: IK, klantNaam: "Familie Jansen" });
    const abbing = taak({
      makerId: IK,
      klantId: "k2" as Id<"klanten">,
      klantNaam: "Abbing Vastgoed",
    });

    const { kolommen } = verdeelOp({
      ...BASIS,
      taken: [jansen, abbing],
      indeling: "klant",
    });

    expect(kolommen.map((k) => k.titel)).toEqual([
      "Abbing Vastgoed",
      "Familie Jansen",
    ]);
    expect(kolommen.every((k) => k.sleepbaar)).toBe(false);
  });
});

// ─── §B3 Dit blijft liggen ───────────────────────────────────────────────────

describe("blijft liggen (§B3)", () => {
  it("meldt een deadline die voorbij is (hard)", () => {
    const t = taak({ makerId: IK, deadline: "2026-08-11" });
    const r = redenen(t, IK, VANDAAG);
    expect(r).toHaveLength(1);
    expect(r[0].hard).toBe(true);
    expect(r[0].tekst).toContain("deadline voorbij");
    expect(r[0].tekst).toContain("11 aug");
  });

  it("meldt een check die twee dagen bij de checker ligt (hard)", () => {
    const t = taak({ status: "check", makerId: IK, checkerId: BART, stilDagen: 2 });
    const r = redenen(t, IK, VANDAAG);
    expect(r).toEqual([
      { tekst: "ligt 2d te wachten op Bart", hard: true },
    ]);
  });

  it("meldt pas ná twee dagen wachten op een check", () => {
    const t = taak({ status: "check", makerId: IK, checkerId: BART, stilDagen: 1 });
    expect(redenen(t, IK, VANDAAG)).toEqual([]);
  });

  it("meldt drie dagen stilstand bij een ánder (zacht)", () => {
    const t = taak({ makerId: BART, uitgezetDoorId: IK, stilDagen: 4 });
    const r = redenen(t, IK, VANDAAG);
    expect(r).toEqual([{ tekst: "4d geen beweging bij Bart", hard: false }]);
  });

  it("meldt stilstand bij mijzelf niet — dat is mijn eigen werkvoorraad", () => {
    const t = taak({ makerId: IK, stilDagen: 9 });
    expect(redenen(t, IK, VANDAAG)).toEqual([]);
  });

  it("laat klaar met rust, hoe lang hij ook stilligt", () => {
    const t = taak({
      status: "klaar",
      makerId: BART,
      uitgezetDoorId: IK,
      stilDagen: 30,
      deadline: "2026-07-01",
    });
    expect(redenen(t, IK, VANDAAG)).toEqual([]);
  });

  it("neemt alleen taken waar ik maker, checker of uitzetter van ben", () => {
    const vanMij = taak({ makerId: BART, uitgezetDoorId: IK, stilDagen: 5 });
    const vanNiemand = taak({ makerId: BART, uitgezetDoorId: MIRA, stilDagen: 5 });

    const lijst = blijftLiggen([vanMij, vanNiemand], IK, VANDAAG);
    expect(lijst.map((x) => x.taak._id)).toEqual([vanMij._id]);
  });

  it("zet harde redenen boven zachte", () => {
    const zacht = taak({ makerId: BART, uitgezetDoorId: IK, stilDagen: 5 });
    const hard = taak({ makerId: IK, deadline: "2026-08-01" });

    const lijst = blijftLiggen([zacht, hard], IK, VANDAAG);
    expect(lijst.map((x) => x.taak._id)).toEqual([hard._id, zacht._id]);
  });
});

// ─── §B3 Geen dubbeling ──────────────────────────────────────────────────────

describe("geen dubbeling met de gewone kolommen (§B3)", () => {
  const vastgelopen = taak({ makerId: IK, deadline: "2026-08-01" });
  const gewoon = taak({ makerId: IK, deadline: VANDAAG });

  it("haalt een blijft-liggen-taak uit de kolommen in kolom-modus", () => {
    const { kolommen, blijftLiggen: lijst } = verdeelOp({
      ...BASIS,
      taken: [vastgelopen, gewoon],
      indeling: "wanneer",
      blijftLiggenModus: "kolom",
    });

    expect(lijst.map((x) => x.taak._id)).toEqual([vastgelopen._id]);
    expect(kolomTaken(kolommen)).toEqual([gewoon._id.toString()]);
  });

  it("laat hem in balk-modus juist wél in zijn kolom staan", () => {
    const { kolommen, blijftLiggen: lijst } = verdeelOp({
      ...BASIS,
      taken: [vastgelopen, gewoon],
      indeling: "wanneer",
      blijftLiggenModus: "balk",
    });

    expect(lijst).toHaveLength(1);
    expect(kolomTaken(kolommen).sort()).toEqual(
      [vastgelopen._id.toString(), gewoon._id.toString()].sort()
    );
  });

  it("geeft in modus 'uit' geen signalering en dus ook geen gaten", () => {
    const { kolommen, blijftLiggen: lijst } = verdeelOp({
      ...BASIS,
      taken: [vastgelopen, gewoon],
      indeling: "wanneer",
      blijftLiggenModus: "uit",
    });

    expect(lijst).toEqual([]);
    expect(kolomTaken(kolommen)).toHaveLength(2);
  });
});
