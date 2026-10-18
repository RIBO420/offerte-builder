/**
 * De rekenregels achter de herbouwde projectpagina's Uitvoering, Nacalculatie
 * en Factuur (okt 2026): urennotatie, budgetstatus, het signaalblok van de
 * nacalculatie en de factuurstap.
 */
import { describe, it, expect } from "vitest";
import { formatAfwijkingProcent, formatUrenKort } from "@/lib/format/uren-kort";
import {
  nacalculatieBudgetStatus,
  uitvoeringBudgetStatus,
} from "@/components/project/budget-status-pil";
import { nacalculatieSignaal } from "@/app/(dashboard)/projecten/[id]/nacalculatie/signaal";
import { huidigeFactuurStap } from "@/app/(dashboard)/projecten/[id]/factuur/components/factuur-stappen";
import type { ScopeAfwijking } from "@/lib/nacalculatie-calculator";

describe("formatUrenKort", () => {
  it("rondt optelfouten af op één decimaal in Nederlandse notatie", () => {
    expect(formatUrenKort(35.150000000000006)).toBe("35,2");
    expect(formatUrenKort(17.6)).toBe("17,6");
  });
  it("laat ronde waarden als heel getal staan", () => {
    expect(formatUrenKort(36)).toBe("36");
    expect(formatUrenKort(1234.5)).toBe("1.234,5");
  });
  it("geeft nooit -0", () => {
    expect(formatUrenKort(-0.01)).toBe("0");
  });
});

describe("formatAfwijkingProcent", () => {
  it("toont een teken en hele procenten", () => {
    expect(formatAfwijkingProcent(-32.4)).toBe("−32%");
    expect(formatAfwijkingProcent(76)).toBe("+76%");
    expect(formatAfwijkingProcent(0.3)).toBe("0%");
  });
});

describe("budgetstatus", () => {
  it("uitvoering: op schema tot en met de begroting, daarna over", () => {
    expect(uitvoeringBudgetStatus(17.6, 36)).toBe("op_schema");
    expect(uitvoeringBudgetStatus(36, 36)).toBe("op_schema");
    expect(uitvoeringBudgetStatus(40, 36)).toBe("over_begroting");
    expect(uitvoeringBudgetStatus(10, 0)).toBe("geen_begroting");
  });
  it("nacalculatie: binnen ±5% is binnen budget", () => {
    expect(nacalculatieBudgetStatus(-32)).toBe("onder_budget");
    expect(nacalculatieBudgetStatus(4.9)).toBe("binnen_budget");
    expect(nacalculatieBudgetStatus(-5)).toBe("binnen_budget");
    expect(nacalculatieBudgetStatus(12)).toBe("over_budget");
  });
});

function scope(naam: string, gepland: number, werkelijk: number): ScopeAfwijking {
  return {
    scope: naam,
    geplandeUren: gepland,
    werkelijkeUren: werkelijk,
    afwijkingUren: werkelijk - gepland,
    afwijkingPercentage: gepland > 0 ? ((werkelijk - gepland) / gepland) * 100 : 100,
    status: "good",
  };
}

describe("nacalculatieSignaal", () => {
  it("alle uren op één scope en andere scopes leeg", () => {
    const signaal = nacalculatieSignaal({
      afwijkingenPerScope: [scope("gras", 20, 35.2), scope("houtwerk", 20, 0), scope("water_elektra", 12, 0)],
      werkelijkeUren: 35.2,
      werkelijkeUrenPerScope: { gras: 35.2 },
      afwijkingPercentage: -32,
    });
    expect(signaal?.kop).toBe("Alle uren staan op gras.");
    expect(signaal?.uitleg).toMatch(/^Op houtwerk en water & elektra is niets geboekt\./);
  });

  it("scopes zonder boekingen naast meerdere geboekte scopes", () => {
    const signaal = nacalculatieSignaal({
      afwijkingenPerScope: [scope("gras", 20, 18), scope("bestrating", 10, 11), scope("houtwerk", 8, 0)],
      werkelijkeUren: 29,
      werkelijkeUrenPerScope: { gras: 18, bestrating: 11 },
      afwijkingPercentage: -23,
    });
    expect(signaal?.kop).toBe("Op houtwerk is niets geboekt.");
  });

  it("uren zonder scope", () => {
    const signaal = nacalculatieSignaal({
      afwijkingenPerScope: [scope("gras", 20, 18)],
      werkelijkeUren: 22.5,
      werkelijkeUrenPerScope: { gras: 18 },
      afwijkingPercentage: 12.5,
    });
    expect(signaal?.kop).toBe("4,5 uur zonder scope.");
  });

  it("geen signaal als alles klopt", () => {
    expect(
      nacalculatieSignaal({
        afwijkingenPerScope: [scope("gras", 20, 21)],
        werkelijkeUren: 21,
        werkelijkeUrenPerScope: { gras: 21 },
        afwijkingPercentage: 5,
      })
    ).toBeNull();
  });
});

describe("huidigeFactuurStap", () => {
  it("volgt wat je nu moet doen", () => {
    expect(huidigeFactuurStap(null)).toBe(0);
    expect(huidigeFactuurStap("concept")).toBe(1);
    expect(huidigeFactuurStap("definitief")).toBe(2);
    expect(huidigeFactuurStap("verzonden")).toBe(3);
    expect(huidigeFactuurStap("vervallen")).toBe(3);
    expect(huidigeFactuurStap("betaald")).toBe(4);
  });
});
