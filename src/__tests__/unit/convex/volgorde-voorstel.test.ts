/**
 * "Stel volgorde voor" op de dagkaart (PRD bijlage B, fase 2 §2.5 restitem B —
 * route-intelligentie stap 2).
 *
 * Acceptatietests:
 * 1. Nearest-neighbour op bekende reistijden vanaf de loods → verwachte
 *    volgorde + geschatte tijdwinst;
 * 2. Handmatig vastgezette stop (geplandeStartTijd) wordt NIET verplaatst;
 * 3. Leeg / één stop / alles vastgezet = no-op (null — geen voorstel);
 * 4. Onbekende adresparen vallen terug op de standaard-reistijd;
 * 5. Preview only: de heuristiek is puur (geen schrijfacties); overnemen
 *    loopt via de bestaande herordenDag (kantoor-only, zie dagkaart.test.ts);
 * 6. Rolcheck: het voorstel is een plannergereedschap (kantoor-only query).
 */

import { describe, it, expect } from "vitest";
import {
  reistijdSleutel,
  stelVolgordeVoor,
  type VolgordeStop,
} from "../../../../convex/dagkaartLogica";
import { isKantoorRol } from "../../../../convex/roles";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOODS = "Loodsweg 1, Utrecht";
const A = "Adres A, Utrecht";
const B = "Adres B, Utrecht";
const C = "Adres C, Utrecht";

function stop(id: string, adres: string | null, vastOm?: string): VolgordeStop {
  return { werkitemId: id, adres, handmatigeStartTijd: vastOm ?? null };
}

/** Reistijden-map uit paren [van, naar, minuten] (beide richtingen gelijk). */
function reistijden(paren: [string, string, number][]): Map<string, number> {
  const map = new Map<string, number>();
  for (const [van, naar, minuten] of paren) {
    map.set(reistijdSleutel(van, naar), minuten);
    map.set(reistijdSleutel(naar, van), minuten);
  }
  return map;
}

// ─── Heuristiek: bekende reistijden → verwachte volgorde ─────────────────────

describe("stelVolgordeVoor — nearest-neighbour vanaf de loods", () => {
  // Loods dichtbij B; vanaf B is A dichterbij dan C.
  const kaart = reistijden([
    [LOODS, A, 30],
    [LOODS, B, 5],
    [LOODS, C, 25],
    [A, B, 10],
    [A, C, 40],
    [B, C, 20],
  ]);

  it("stelt de kortste route voor en berekent de tijdwinst", () => {
    // Huidige volgorde A → B → C: 30 + 10 + 20 + 25 (terug) = 85 min
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-a", A), stop("w-b", B), stop("w-c", C)],
      kaart,
      20
    );
    expect(voorstel).not.toBeNull();
    // Nearest-neighbour: B (5) → A (10) → C (40) → loods (25) = 80
    expect(voorstel?.volgorde).toEqual(["w-b", "w-a", "w-c"]);
    expect(voorstel?.oudeReistijdMinuten).toBe(85);
    expect(voorstel?.nieuweReistijdMinuten).toBe(80);
    expect(voorstel?.tijdwinstMinuten).toBe(5);
    expect(voorstel?.gewijzigd).toBe(true);
  });

  it("markeert een al-optimale volgorde als ongewijzigd", () => {
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-b", B), stop("w-a", A), stop("w-c", C)],
      kaart,
      20
    );
    expect(voorstel?.gewijzigd).toBe(false);
    expect(voorstel?.tijdwinstMinuten).toBe(0);
  });

  it("valt voor onbekende adresparen terug op de standaard-reistijd", () => {
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-a", A), stop("w-b", "Onbekend adres 9, Elders")],
      reistijden([[LOODS, A, 5]]),
      20
    );
    expect(voorstel).not.toBeNull();
    // Vanaf loods: A = 5 (bekend), onbekend = 20 (standaard) → A eerst
    expect(voorstel?.volgorde[0]).toBe("w-a");
    // Route: 5 + 20 + 20 = 45
    expect(voorstel?.nieuweReistijdMinuten).toBe(45);
  });

  it("houdt stops zonder adres op standaard-reistijd en blijft stabiel", () => {
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-1", null), stop("w-2", null), stop("w-3", null)],
      new Map(),
      20
    );
    // Alles gelijk → stabiele volgorde (laagste index wint), geen winst
    expect(voorstel?.volgorde).toEqual(["w-1", "w-2", "w-3"]);
    expect(voorstel?.gewijzigd).toBe(false);
    expect(voorstel?.tijdwinstMinuten).toBe(0);
  });
});

// ─── Handmatig vastgezette stops blijven staan (§8.9) ────────────────────────

describe("stelVolgordeVoor — handmatige starttijden blijven leidend", () => {
  const kaart = reistijden([
    [LOODS, A, 30],
    [LOODS, B, 5],
    [LOODS, C, 25],
    [A, B, 10],
    [A, C, 40],
    [B, C, 20],
  ]);

  it("verplaatst een stop met handmatige starttijd niet", () => {
    // A staat vast op positie 1 (index 0) — alleen B en C mogen wisselen
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-a", A, "08:00"), stop("w-c", C), stop("w-b", B)],
      kaart,
      20
    );
    expect(voorstel).not.toBeNull();
    expect(voorstel?.volgorde[0]).toBe("w-a"); // vast, niet verplaatst
    // Vanaf A: B (10) dichterbij dan C (40) → A, B, C
    expect(voorstel?.volgorde).toEqual(["w-a", "w-b", "w-c"]);
  });

  it("houdt een vastgezette stop óók midden in de dag op zijn plek", () => {
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-a", A), stop("w-c", C, "11:00"), stop("w-b", B)],
      kaart,
      20
    );
    expect(voorstel?.volgorde[1]).toBe("w-c"); // vast op positie 2
    // Vrije posities 1 en 3: vanaf loods is B (5) dichterbij dan A (30)
    expect(voorstel?.volgorde).toEqual(["w-b", "w-c", "w-a"]);
  });

  it("negeert een ongeldige handmatige tijd (stop telt als vrij)", () => {
    const voorstel = stelVolgordeVoor(
      LOODS,
      [stop("w-a", A, "kapot"), stop("w-b", B)],
      kaart,
      20
    );
    expect(voorstel?.volgorde).toEqual(["w-b", "w-a"]);
  });
});

// ─── No-op-gevallen ──────────────────────────────────────────────────────────

describe("stelVolgordeVoor — no-op", () => {
  it("geeft null bij nul of één stop", () => {
    expect(stelVolgordeVoor(LOODS, [], new Map(), 20)).toBeNull();
    expect(stelVolgordeVoor(LOODS, [stop("w-a", A)], new Map(), 20)).toBeNull();
  });

  it("geeft null als alle stops handmatig vaststaan", () => {
    expect(
      stelVolgordeVoor(
        LOODS,
        [stop("w-a", A, "08:00"), stop("w-b", B, "10:00")],
        new Map(),
        20
      )
    ).toBeNull();
  });

  it("muteert de invoer niet (preview only — geen schrijfacties)", () => {
    const stops = [stop("w-a", A), stop("w-b", B)];
    const kopie = JSON.parse(JSON.stringify(stops));
    stelVolgordeVoor(LOODS, stops, new Map(), 20);
    expect(stops).toEqual(kopie);
  });
});

// ─── Rolcheck: plannergereedschap is kantoor-only ────────────────────────────

describe("rollen — volgordevoorstel en overnemen zijn kantoor-only", () => {
  it("kantoor (directie/projectleider) mag; veldrollen niet", () => {
    expect(isKantoorRol("directie")).toBe(true);
    expect(isKantoorRol("projectleider")).toBe(true);
    expect(isKantoorRol("admin")).toBe(true); // legacy → directie
    expect(isKantoorRol("voorman")).toBe(false);
    expect(isKantoorRol("medewerker")).toBe(false);
    expect(isKantoorRol("klant")).toBe(false);
  });
});
