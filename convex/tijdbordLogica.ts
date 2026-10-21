/**
 * Tijdbord (HERO-nabouw fase 4, docs/hero-nabouw/planning/PLANNING-MODULE.md):
 * het planbord op een tijdas met een stap van 15 minuten. Pure functies,
 * gedeeld door de web-UI en de tests.
 *
 * Datamodel (bestaand, ongewijzigd): een werkitem heeft een datumbereik
 * (geplandeStart t/m geplandeEind) en één dagvenster (geplandeStartTijd →
 * geplandeEindTijd) dat op elke dag van het bereik geldt. Zo blijven de
 * dagkaart en de medewerker-app werken zoals nu.
 *
 * Slepen met dit model:
 * - Verplaatsen: nieuwe dag + begintijd; aantal dagen en vensterlengte blijven.
 * - Rand trekken binnen de eerste/laatste dag = begin-/eindtijd aanpassen;
 *   voorbij die dag = dagen erbij of eraf (de tijd blijft dan staan).
 */

import { addDagen, dagenTussen } from "./planbordLogica";

export const SNAP_MINUTEN = 15;
export const MIN_DUUR_MINUTEN = 15;

export interface Werkdag {
  /** Minuten na middernacht */
  start: number;
  eind: number;
  /** Uren per persoon per dag, voor het voorstel bij inplannen */
  urenPerDag: number;
}

export const STANDAARD_WERKDAG: Werkdag = { start: 7 * 60, eind: 18 * 60, urenPerDag: 8 };

export function tijdNaarMinuten(tijd: string): number {
  const [u, m] = tijd.split(":").map(Number);
  return u * 60 + m;
}

export function minutenNaarTijd(minuten: number): string {
  const begrensd = Math.max(0, Math.min(24 * 60 - 1, Math.round(minuten)));
  const u = Math.floor(begrensd / 60);
  const m = begrensd % 60;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Afronden op de stap (15 min; in de grove weergaven 60). */
export function snap(minuten: number, stap = SNAP_MINUTEN): number {
  return Math.round(minuten / stap) * stap;
}

/** Stap per weergave: een kwartier, en grof (1 uur) zodra een kwartier te smal wordt. */
export function stapVoorKwartierBreedte(pxPerKwartier: number): number {
  // Vanaf ~2,5 px per kwartier (weekweergave op een laptop) blijft het een
  // kwartier; het live tijdlabel maakt precies loslaten mogelijk
  return pxPerKwartier >= 2.5 ? SNAP_MINUTEN : 60;
}

export function werkdagUit(instellingen?: {
  werkdagStart?: string;
  werkdagEind?: string;
  urenPerDag?: number;
} | null): Werkdag {
  return {
    start: instellingen?.werkdagStart ? tijdNaarMinuten(instellingen.werkdagStart) : STANDAARD_WERKDAG.start,
    eind: instellingen?.werkdagEind ? tijdNaarMinuten(instellingen.werkdagEind) : STANDAARD_WERKDAG.eind,
    urenPerDag: instellingen?.urenPerDag ?? STANDAARD_WERKDAG.urenPerDag,
  };
}

/** Planning van één werkitem in de vorm van de bestaande velden. */
export interface Plan {
  geplandeStart: string;
  geplandeEind: string;
  geplandeStartTijd: string;
  geplandeEindTijd: string;
}

/** Venster van een werkitem; zonder tijden: het standaardvenster vanaf werkdagstart. */
export function vensterVan(
  w: { geplandeStartTijd?: string; geplandeEindTijd?: string; geschatteUren?: number },
  werkdag: Werkdag
): { start: number; eind: number; vast: boolean } {
  if (w.geplandeStartTijd && w.geplandeEindTijd) {
    return {
      start: tijdNaarMinuten(w.geplandeStartTijd),
      eind: tijdNaarMinuten(w.geplandeEindTijd),
      vast: true,
    };
  }
  const start = w.geplandeStartTijd ? tijdNaarMinuten(w.geplandeStartTijd) : werkdag.start;
  return {
    start,
    eind: Math.min(werkdag.eind, start + werkdag.urenPerDag * 60),
    vast: false,
  };
}

/** Blok verplaatsen naar (dag, begintijd); dagen en vensterlengte blijven gelijk. */
export function verplaats(
  huidig: Plan,
  doelDatum: string,
  doelStartMinuten: number
): Plan {
  const dagen = dagenTussen(huidig.geplandeStart, huidig.geplandeEind);
  const lengte =
    tijdNaarMinuten(huidig.geplandeEindTijd) - tijdNaarMinuten(huidig.geplandeStartTijd);
  const start = Math.max(0, Math.min(24 * 60 - 1 - lengte, doelStartMinuten));
  const eind = start + lengte;
  return {
    geplandeStart: doelDatum,
    geplandeEind: addDagen(doelDatum, dagen),
    geplandeStartTijd: minutenNaarTijd(start),
    geplandeEindTijd: minutenNaarTijd(eind),
  };
}

/**
 * Rechterrand naar (dag, tijd). Op de laatste dag = eindtijd; op een andere
 * dag = de laatste dag verschuift (nooit vóór de eerste dag).
 */
export function trekEind(huidig: Plan, doelDatum: string, doelMinuten: number): Plan {
  if (doelDatum === huidig.geplandeEind) {
    const min = tijdNaarMinuten(huidig.geplandeStartTijd) + MIN_DUUR_MINUTEN;
    return { ...huidig, geplandeEindTijd: minutenNaarTijd(Math.max(min, doelMinuten)) };
  }
  const eind = doelDatum < huidig.geplandeStart ? huidig.geplandeStart : doelDatum;
  return { ...huidig, geplandeEind: eind };
}

/** Linkerrand naar (dag, tijd). Op de eerste dag = begintijd; anders schuift de eerste dag. */
export function trekStart(huidig: Plan, doelDatum: string, doelMinuten: number): Plan {
  if (doelDatum === huidig.geplandeStart) {
    const max = tijdNaarMinuten(huidig.geplandeEindTijd) - MIN_DUUR_MINUTEN;
    return { ...huidig, geplandeStartTijd: minutenNaarTijd(Math.min(max, doelMinuten)) };
  }
  const start = doelDatum > huidig.geplandeEind ? huidig.geplandeEind : doelDatum;
  return { ...huidig, geplandeStart: start };
}

/** Toetsenbord: pijltjes ±15 min, shift+pijl ±1 dag. */
export function schuif(huidig: Plan, minuten: number, dagen: number): Plan {
  const start = tijdNaarMinuten(huidig.geplandeStartTijd) + minuten;
  const eind = tijdNaarMinuten(huidig.geplandeEindTijd) + minuten;
  if (start < 0 || eind > 24 * 60 - 1) return huidig;
  return {
    geplandeStart: addDagen(huidig.geplandeStart, dagen),
    geplandeEind: addDagen(huidig.geplandeEind, dagen),
    geplandeStartTijd: minutenNaarTijd(start),
    geplandeEindTijd: minutenNaarTijd(eind),
  };
}

export const isWerkdag = (datum: string): boolean => {
  const dag = new Date(`${datum}T12:00:00Z`).getUTCDay();
  return dag !== 0 && dag !== 6;
};

/**
 * Voorstel bij slepen uit de bak: begintijd op de plek van loslaten, per dag
 * `urenPerDag` (tot het eind van de werkdag), zoveel werkdagen als de
 * begrote uren met deze bemanning nodig hebben.
 */
export function voorstelUitBak(
  doelDatum: string,
  startMinuten: number,
  begroteUren: number | null | undefined,
  bemanning: number,
  werkdag: Werkdag
): Plan {
  const start = Math.max(0, startMinuten);
  const eind = Math.min(werkdag.eind > start ? werkdag.eind : 24 * 60 - 1, start + werkdag.urenPerDag * 60);
  const urenPerDag = Math.max(0.25, (eind - start) / 60) * Math.max(1, bemanning);
  const dagen = begroteUren && begroteUren > 0 ? Math.max(1, Math.ceil(begroteUren / urenPerDag - 1e-9)) : 1;
  let eindDatum = doelDatum;
  let geteld = 1;
  while (geteld < dagen) {
    eindDatum = addDagen(eindDatum, 1);
    if (isWerkdag(eindDatum)) geteld++;
  }
  return {
    geplandeStart: doelDatum,
    geplandeEind: eindDatum,
    geplandeStartTijd: minutenNaarTijd(start),
    geplandeEindTijd: minutenNaarTijd(eind),
  };
}

/**
 * Geplande manuren: per werkdag in het bereik het venster × de bemanning van
 * die dag. `bemanningOp` geeft het aantal mensen (0 = onbemand).
 */
export function geplandeManuren(
  plan: Plan,
  bemanningOp: (datum: string) => number
): number {
  const venster =
    (tijdNaarMinuten(plan.geplandeEindTijd) - tijdNaarMinuten(plan.geplandeStartTijd)) / 60;
  let totaal = 0;
  for (let d = plan.geplandeStart; d <= plan.geplandeEind; d = addDagen(d, 1)) {
    if (isWerkdag(d)) totaal += venster * bemanningOp(d);
  }
  return Math.round(totaal * 100) / 100;
}

export function korteTijdLabel(plan: Plan): string {
  return `${plan.geplandeStartTijd}–${plan.geplandeEindTijd}`;
}

// ── Verlof en ziekte op het bord (ontwerpbeslissing 3) ─────────────────────

export type AfwezigStatus = "aangevraagd" | "goedgekeurd" | "ziek";

export interface BordAfwezigheid {
  medewerkerId: string;
  startDatum: string;
  /** Inclusief; ziek zonder herstel loopt door tot het eind van het bereik */
  eindDatum: string;
  status: AfwezigStatus;
  /** Alleen voor kantoor (privacy); anderen zien "afwezig" */
  soort?: string;
}

/** Aanvragen geven een waarschuwing; goedgekeurd verlof en ziekte blokkeren. */
export function blokkeertInplannen(status: AfwezigStatus): boolean {
  return status !== "aangevraagd";
}

export function afwezigOp(
  lijst: ReadonlyArray<BordAfwezigheid>,
  medewerkerId: string,
  datum: string
): BordAfwezigheid | undefined {
  const raak = lijst.filter(
    (a) => a.medewerkerId === medewerkerId && a.startDatum <= datum && datum <= a.eindDatum
  );
  return raak.find((a) => blokkeertInplannen(a.status)) ?? raak[0];
}

const SOORT_LABEL: Record<string, string> = {
  vakantie: "Vakantie",
  bijzonder: "Bijzonder verlof",
  onbetaald: "Onbetaald verlof",
  compensatie: "Compensatie",
};

export function afwezigLabel(a: BordAfwezigheid): string {
  if (a.status === "ziek") return a.soort ? "Ziek" : "Afwezig";
  const soort = a.soort ? (SOORT_LABEL[a.soort] ?? "Verlof") : "Afwezig";
  return a.status === "aangevraagd" && a.soort ? `${soort} aangevraagd` : soort;
}
