/**
 * De rapportage-payload komt met rúwe sleutels binnen (`water_elektra`,
 * `1_30_dagen`, `definitief`). Deze tests bewaken de vertaallaag die daar
 * mensentaal van maakt (masterplan R3) — inclusief de twee randen waar het op
 * de oude pagina misging: een onbekende sleutel die rauw in beeld lekte, en een
 * ontbrekende vergelijking die als "+100%" werd gepresenteerd.
 */

import { describe, expect, it } from "vitest";
import {
  PERIODE_GROEPEN,
  PERIODE_PRESETS,
  dagenTekst,
  formatPercentage,
  isPeriodePreset,
  menselijkeSleutel,
  offerteStatusFilter,
  offerteStatusLabel,
  ouderdomLabel,
  ouderdomLabelKort,
  ouderdomVraagtAandacht,
  periodePresetLabel,
  scopeLabel,
  stilTekst,
  telwoord,
  urenTekst,
  verschilTekst,
} from "@/lib/rapportage-labels";
import { PERIODE_PRESETS as SERVER_PRESETS } from "@convex/lib/rapportagePeriode";
import { OUDERDOMS_BUCKETS } from "@convex/lib/rapportageAggregatie";

describe("scopeLabel", () => {
  it("vertaalt de sleutels die de schouw rauw op een as aantrof", () => {
    expect(scopeLabel("water_elektra")).toBe("Water & elektra");
    expect(scopeLabel("gras_onderhoud")).toBe("Grasonderhoud");
    expect(scopeLabel("bestrating")).toBe("Bestrating");
  });

  it("kapitaliseert alle scopes gelijk — geen 'borders' naast 'Bestrating'", () => {
    for (const scope of ["grondwerk", "borders", "gras", "specials"]) {
      expect(scopeLabel(scope)[0]).toBe(scopeLabel(scope)[0].toUpperCase());
    }
  });

  it("laat een onbekende sleutel nooit rauw in beeld komen", () => {
    expect(scopeLabel("nieuwe_scope")).toBe("Nieuwe scope");
    expect(scopeLabel("")).toBe("Onbekend");
    expect(menselijkeSleutel("iets-met-streepjes")).toBe(
      "Iets met streepjes"
    );
  });
});

describe("offerteStatusLabel", () => {
  it("noemt een geaccepteerde offerte 'Getekend'", () => {
    expect(offerteStatusLabel("geaccepteerd")).toBe("Getekend");
  });

  it("laat de legacy-status 'definitief' hetzelfde heten als voorcalculatie", () => {
    // De cijferlaag telt `definitief` als voorcalculatie; als de UI hem anders
    // noemt, spreekt het label de telling tegen.
    expect(offerteStatusLabel("definitief")).toBe(
      offerteStatusLabel("voorcalculatie")
    );
    expect(offerteStatusFilter("definitief")).toBe("voorcalculatie");
  });
});

describe("ouderdomLabel", () => {
  it("dekt elke bucket die de server kan sturen", () => {
    for (const bucket of OUDERDOMS_BUCKETS) {
      expect(ouderdomLabel(bucket)).not.toContain("_");
      expect(ouderdomLabelKort(bucket)).not.toContain("_");
    }
  });

  it("markeert alleen vervallen buckets als aandachtspunt", () => {
    expect(ouderdomVraagtAandacht("nog_niet_vervallen")).toBe(false);
    expect(ouderdomVraagtAandacht("1_30_dagen")).toBe(true);
    expect(ouderdomVraagtAandacht("ouder_dan_60_dagen")).toBe(true);
  });
});

describe("periodepresets", () => {
  it("kent exact de presets die de server accepteert (R5)", () => {
    // Zou de UI er één méér aanbieden, dan is er weer een knop die iets anders
    // toont dan hij belooft — precies de klacht uit de schouw.
    expect([...PERIODE_PRESETS].sort()).toEqual([...SERVER_PRESETS].sort());
  });

  it("heeft voor elke preset een Nederlands label", () => {
    for (const preset of PERIODE_PRESETS) {
      expect(periodePresetLabel(preset)).toMatch(/^[A-Z]/);
    }
  });

  it("biedt alleen echte presets aan in de kiezer", () => {
    const inGroepen = PERIODE_GROEPEN.flatMap((groep) => groep.presets);
    for (const preset of inGroepen) {
      expect(PERIODE_PRESETS).toContain(preset);
    }
  });

  it("herkent een onbekende URL-waarde niet als preset", () => {
    expect(isPeriodePreset("dit-jaar")).toBe(true);
    expect(isPeriodePreset("deze-week")).toBe(false);
    expect(isPeriodePreset(null)).toBe(false);
  });
});

describe("verschilTekst", () => {
  it("zegt dat er geen basis is in plaats van +100% te verzinnen", () => {
    const zonder = verschilTekst(null);
    expect(zonder.toon).toBe("geen-basis");
    expect(zonder.tekst).toBe("geen gegevens over die periode");
    expect(zonder.tekst).not.toContain("%");
    expect(zonder.percentage).toBeNull();
  });

  it("behandelt undefined en NaN net zo voorzichtig", () => {
    expect(verschilTekst(undefined).toon).toBe("geen-basis");
    expect(verschilTekst(Number.NaN).toon).toBe("geen-basis");
  });

  it("schrijft groei en krimp uit", () => {
    expect(verschilTekst(12.4)).toMatchObject({
      toon: "vooruit",
      tekst: "12,4% meer",
    });
    expect(verschilTekst(-8)).toMatchObject({
      toon: "achteruit",
      tekst: "8% minder",
    });
  });

  it("noemt een verwaarloosbaar verschil gewoon gelijk", () => {
    expect(verschilTekst(0).toon).toBe("gelijk");
    expect(verschilTekst(0.02).tekst).toBe("vrijwel gelijk");
  });
});

describe("getallen in taal", () => {
  it("buigt enkelvoud en meervoud", () => {
    expect(telwoord(1, "offerte", "offertes")).toBe("1 offerte");
    expect(telwoord(7, "offerte", "offertes")).toBe("7 offertes");
    expect(dagenTekst(1)).toBe("1 dag");
    expect(dagenTekst(31)).toBe("31 dagen");
  });

  it("zegt 'vandaag' in plaats van '0 dagen stil'", () => {
    expect(stilTekst(0)).toBe("vandaag");
    expect(stilTekst(21)).toBe("21 dagen stil");
  });

  it("gebruikt de Nederlandse komma", () => {
    expect(formatPercentage(12.44)).toBe("12,4%");
    expect(formatPercentage(13)).toBe("13%");
    expect(formatPercentage(-8.2)).toBe("-8,2%");
    expect(urenTekst(7.25)).toBe("7,3 uur");
  });
});
