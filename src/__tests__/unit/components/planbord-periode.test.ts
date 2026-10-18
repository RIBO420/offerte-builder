import { describe, expect, it } from "vitest";
import {
  WEEKEND_GEWICHT,
  blokSpanFactor,
  bordDichtheid,
  bordRasterKolommen,
  celRandPx,
  kolomDatums,
  kolomKop,
  periodeBereik,
  type Periode,
} from "@/components/planbord/periode";
import { eventsPerTeamDag, eventsVoorTeamDag, teamDagSleutel, type PlanbordEvent } from "@/components/planbord/adapter";
import type { Id } from "../../../../convex/_generated/dataModel";

const ANKER = "2026-10-14"; // woensdag; oktober heeft 31 dagen

function kolommenVoor(periode: Periode): string[] {
  const { start, eind } = periodeBereik(periode, ANKER);
  return kolomDatums(start, eind);
}

describe("bordraster (harde regel 1: nooit zijwaarts scrollen)", () => {
  it.each([
    ["dag", 1, "ruim"],
    ["3dagen", 3, "ruim"],
    ["week", 7, "ruim"],
    ["14dagen", 14, "smal"],
    ["4weken", 28, "krap"],
    ["maand", 31, "krap"],
  ] as const)("%s: %i kolommen, dichtheid %s", (periode, aantal, dichtheid) => {
    const kolommen = kolommenVoor(periode);
    expect(kolommen).toHaveLength(aantal);
    expect(bordDichtheid(kolommen.length)).toBe(dichtheid);
  });

  it.each(["dag", "3dagen", "week", "14dagen", "4weken", "maand"] as const)(
    "%s: alle dagkolommen zonder ondergrens, teamkolom met procentplafond",
    (periode) => {
      const kolommen = kolommenVoor(periode);
      const sporen = bordRasterKolommen(kolommen).match(/min\([^)]*\)|minmax\([^)]*\)/g) ?? [];
      expect(sporen).toHaveLength(kolommen.length + 1);
      // Teamkolom: px-maximum, maar geeft mee als procent van de breedte.
      expect(sporen[0]).toMatch(/^min\(\d+px, \d+%\)$/);
      // Dagkolommen: minimum 0, dus het raster wordt nooit breder dan zijn container.
      for (const spoor of sporen.slice(1)) {
        expect(spoor).toMatch(/^minmax\(0, [\d.]+fr\)$/);
      }
    }
  );

  it("weekweergave: weekend smaller; langere periodes: alle kolommen gelijk", () => {
    const week = bordRasterKolommen(kolommenVoor("week"));
    expect(week.match(new RegExp(`minmax\\(0, ${WEEKEND_GEWICHT}fr\\)`, "g"))).toHaveLength(2);
    const maand = bordRasterKolommen(kolommenVoor("maand"));
    expect(maand).not.toContain(`${WEEKEND_GEWICHT}fr`);
  });

  it("blokbreedte telt weekendgewicht alleen op de weekweergave mee", () => {
    const week = kolommenVoor("week"); // ma 12 t/m zo 18 okt
    // vr t/m zo: 1 + 0.6 + 0.6, gedeeld door het gewicht van vrijdag
    expect(blokSpanFactor(week, "2026-10-16", "2026-10-18")).toBeCloseTo(2.2);
    const maand = kolommenVoor("maand");
    expect(blokSpanFactor(maand, "2026-10-16", "2026-10-18")).toBe(3);
    // Buiten beeld: één cel
    expect(blokSpanFactor(week, "2026-11-01", "2026-11-02")).toBe(1);
  });

  it("celrand volgt de celpadding per dichtheid", () => {
    expect(celRandPx("ruim")).toBe(13);
    expect(celRandPx("smal")).toBe(13);
    expect(celRandPx("krap")).toBe(5);
  });

  it("kolomkop: krap = 1-letterdag + dagnummer, voluit blijft beschikbaar", () => {
    expect(kolomKop("2026-10-14", "ruim")).toEqual({ dag: "wo", nummer: "14", voluit: "wo 14 okt" });
    expect(kolomKop("2026-10-14", "smal").dag).toBe("wo");
    expect(kolomKop("2026-10-14", "krap")).toEqual({ dag: "W", nummer: "14", voluit: "wo 14 okt" });
  });
});

describe("eventsPerTeamDag", () => {
  const teamA = "team_a" as Id<"teams">;
  const ev = (id: string, start: string, eind: string, resourceId: Id<"teams"> | null, volgorde?: number) =>
    ({
      id: id as Id<"projecten">,
      resourceId,
      start,
      eind,
      titel: id,
      type: "project",
      status: "gepland",
      volgordeBinnenDag: volgorde,
    }) as PlanbordEvent;

  it("geeft per cel dezelfde selectie en volgorde als eventsVoorTeamDag", () => {
    const events = [
      ev("a", "2026-10-12", "2026-10-14", teamA, 2),
      ev("b", "2026-10-13", "2026-10-13", teamA, 1),
      ev("c", "2026-10-13", "2026-10-13", null),
      ev("d", "2026-10-01", "2026-10-30", teamA),
    ];
    const kolommen = kolommenVoor("week");
    const map = eventsPerTeamDag(events, kolommen);
    for (const datum of kolommen) {
      for (const team of [teamA, null]) {
        expect((map.get(teamDagSleutel(team, datum)) ?? []).map((e) => e.id)).toEqual(
          eventsVoorTeamDag(events, team, datum).map((e) => e.id)
        );
      }
    }
  });
});

describe("isIsoDatum (URL-parameter ?datum=)", () => {
  it("accepteert alleen echte YYYY-MM-DD-datums", async () => {
    const { isIsoDatum } = await import("@/components/planbord/datum-nl");
    expect(isIsoDatum("2026-10-14")).toBe(true);
    expect(isIsoDatum("2028-02-29")).toBe(true);
    for (const fout of [null, "", "morgen", "2026-13-01", "2026-02-30", "2026-1-5", "2026-10-14x"]) {
      expect(isIsoDatum(fout)).toBe(false);
    }
  });
});
