/**
 * Het amber signaalblok van de nacalculatie: één zin over wat je moet
 * controleren voordat je de nacalculatie opslaat of normuren bijstelt.
 *
 * Pure functie (geen React), zodat de regels testbaar zijn. De drempels
 * volgen de inzichten van de nacalculatie-calculator (±15% = "significant").
 */

import type { NacalculatieResult } from "@/lib/nacalculatie-calculator";
import { scopeLabel } from "@/lib/rapportage-labels";
import { formatUrenKort } from "@/lib/format/uren-kort";

export interface NacalculatieSignaal {
  /** Vetgedrukte kernzin. */
  kop: string;
  /** Uitleg en wat je moet doen. */
  uitleg: string;
}

const CONTROLE =
  "Controleer de registraties voordat je normuren aanpast: een te lage of te hoge afwijking per scope kan een boekingsfout zijn.";

/** "a", "a en b", "a, b en c" */
function opsomming(delen: string[]): string {
  if (delen.length <= 1) return delen.join("");
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

function naam(scope: string): string {
  return scopeLabel(scope).toLowerCase();
}

export function nacalculatieSignaal(
  r: Pick<
    NacalculatieResult,
    "afwijkingenPerScope" | "werkelijkeUren" | "werkelijkeUrenPerScope" | "afwijkingPercentage"
  >
): NacalculatieSignaal | null {
  const gepland = r.afwijkingenPerScope.filter((s) => s.geplandeUren > 0);
  const geboekt = r.afwijkingenPerScope.filter((s) => s.werkelijkeUren > 0);
  const leeg = gepland.filter((s) => s.werkelijkeUren === 0);

  const metScope = Object.values(r.werkelijkeUrenPerScope).reduce((som, u) => som + u, 0);
  const zonderScope = Math.max(0, r.werkelijkeUren - metScope);
  const heeftZonderScope = zonderScope >= 0.05;

  if (geboekt.length === 1 && gepland.length > 1 && leeg.length > 0) {
    return {
      kop: heeftZonderScope
        ? `Alle uren met een scope staan op ${naam(geboekt[0].scope)}.`
        : `Alle uren staan op ${naam(geboekt[0].scope)}.`,
      uitleg: `Op ${opsomming(leeg.map((s) => naam(s.scope)))} is niets geboekt. ${CONTROLE}`,
    };
  }

  if (leeg.length > 0 && geboekt.length > 0) {
    return {
      kop: `Op ${opsomming(leeg.map((s) => naam(s.scope)))} is niets geboekt.`,
      uitleg: CONTROLE,
    };
  }

  if (heeftZonderScope && r.werkelijkeUren > 0) {
    return {
      kop: `${formatUrenKort(zonderScope)} uur zonder scope.`,
      uitleg:
        "Die uren tellen mee in het totaal, maar niet in de vergelijking per scope. Geef ze in de uitvoering een scope als je per scope wilt vergelijken.",
    };
  }

  if (r.afwijkingPercentage < -15) {
    return {
      kop: `${Math.round(Math.abs(r.afwijkingPercentage))}% minder uren dan gepland.`,
      uitleg: "Controleer of al het werk is geregistreerd voordat je de nacalculatie opslaat.",
    };
  }

  if (r.afwijkingPercentage > 15) {
    return {
      kop: `${Math.round(r.afwijkingPercentage)}% meer uren dan gepland.`,
      uitleg: "Bekijk per scope waar de extra uren zitten voordat je normuren aanpast.",
    };
  }

  return null;
}
