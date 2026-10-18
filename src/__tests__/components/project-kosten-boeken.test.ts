import { describe, expect, it } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  boekBedrag,
  naarCreateArgs,
  type BoekInvoer,
  type BoekMachine,
  type BoekProduct,
} from "@/components/project/kosten/boeken";

const projectId = "p1" as Id<"projecten">;

const zand: BoekProduct = {
  _id: "prod1" as Id<"producten">,
  productnaam: "Ophoogzand",
  inkoopprijs: 24.5,
  eenheid: "m³",
};

const minigraver: BoekMachine = {
  _id: "mach1" as Id<"machines">,
  naam: "Minigraver",
  tarief: 45,
  tariefType: "uur",
};

const basis = { datum: "2026-10-18", hoeveelheid: 3 };

describe("naarCreateArgs — materiaal", () => {
  it("geeft productId, inkoopprijs en de productnaam als omschrijving mee", () => {
    const r = naarCreateArgs(projectId, { ...basis, soort: "materiaal", product: zand });
    expect(r).toEqual({
      ok: true,
      totaal: 73.5,
      args: {
        projectId,
        type: "materiaal",
        datum: "2026-10-18",
        hoeveelheid: 3,
        omschrijving: "Ophoogzand",
        prijsPerEenheid: 24.5,
        productId: zand._id,
        notities: undefined,
      },
    });
  });

  it("neemt een eigen omschrijving en notities over, getrimd", () => {
    const r = naarCreateArgs(projectId, {
      ...basis,
      soort: "materiaal",
      product: zand,
      omschrijving: "  Zand achtertuin ",
      notities: " bon 1234 ",
    });
    expect(r.ok && r.args.omschrijving).toBe("Zand achtertuin");
    expect(r.ok && r.args.notities).toBe("bon 1234");
  });

  it("weigert zonder artikel", () => {
    const r = naarCreateArgs(projectId, { ...basis, soort: "materiaal", product: null });
    expect(r.ok).toBe(false);
  });

  it("weigert een artikel zonder inkoopprijs (zou als € 0 tellen)", () => {
    const r = naarCreateArgs(projectId, {
      ...basis,
      soort: "materiaal",
      product: { ...zand, inkoopprijs: 0 },
    });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.fout).toContain("geen vaste inkoopprijs");
  });
});

describe("naarCreateArgs — machine", () => {
  it("geeft machineId en het (aangepaste) tarief mee", () => {
    const r = naarCreateArgs(projectId, {
      ...basis,
      hoeveelheid: 2.5,
      soort: "machine",
      machine: minigraver,
      tarief: 50,
    });
    expect(r).toEqual({
      ok: true,
      totaal: 125,
      args: {
        projectId,
        type: "machine",
        datum: "2026-10-18",
        hoeveelheid: 2.5,
        omschrijving: "Minigraver",
        prijsPerEenheid: 50,
        machineId: minigraver._id,
        notities: undefined,
      },
    });
  });

  it("weigert zonder machine of met tarief 0", () => {
    expect(naarCreateArgs(projectId, { ...basis, soort: "machine", machine: null, tarief: 45 }).ok).toBe(false);
    expect(naarCreateArgs(projectId, { ...basis, soort: "machine", machine: minigraver, tarief: 0 }).ok).toBe(false);
  });
});

describe("naarCreateArgs — gedeelde regels", () => {
  it("weigert een aantal van 0 of minder", () => {
    for (const hoeveelheid of [0, -1, Number.NaN]) {
      const r = naarCreateArgs(projectId, { ...basis, hoeveelheid, soort: "materiaal", product: zand });
      expect(r.ok).toBe(false);
    }
  });

  it("weigert een ongeldige datum", () => {
    const r = naarCreateArgs(projectId, { ...basis, datum: "18-10-2026", soort: "materiaal", product: zand });
    expect(r.ok).toBe(false);
  });
});

describe("boekBedrag", () => {
  it("rekent aantal × prijs, of null bij onvolledige invoer", () => {
    const materiaal: BoekInvoer = { ...basis, soort: "materiaal", product: zand };
    expect(boekBedrag(materiaal)).toBe(73.5);
    expect(boekBedrag({ ...materiaal, product: null })).toBeNull();
    expect(boekBedrag({ ...materiaal, hoeveelheid: 0 })).toBeNull();
    expect(boekBedrag({ ...basis, soort: "machine", machine: minigraver, tarief: 45 })).toBe(135);
  });
});
