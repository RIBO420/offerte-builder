/**
 * De rekenregels achter het kostendashboard van een project (okt 2026):
 * stand per soort, het "nog niet geboekt"-signaal en de ene zin die het
 * verschil tussen kosten en uren duidt.
 *
 * Puur gehouden, zodat de formuleringen testbaar zijn zonder te renderen.
 * Leidend principe: bij een lopend project is minder besteed dan begroot
 * géén besparing maar "nog niet besteed". Pas een afgerond project kan onder
 * de begroting uitkomen.
 */

import { formatCurrency } from "@/lib/format/currency";

export type KostSoort = "materiaal" | "arbeid" | "machine" | "overig";

export const KOST_SOORTEN: readonly KostSoort[] = [
  "materiaal",
  "arbeid",
  "machine",
  "overig",
];

export const SOORT_LABEL: Record<KostSoort, string> = {
  materiaal: "Materiaal",
  arbeid: "Arbeid",
  machine: "Machine",
  overig: "Overig",
};

export interface SoortRegel {
  soort: KostSoort;
  begroot: number;
  besteed: number;
}

/** Projectstatussen waarin het werk klaar is: de kosten liggen dan vast. */
const AFGEROND = new Set(["afgerond", "nacalculatie_compleet", "gefactureerd"]);

export function isProjectAfgerond(status: string | undefined): boolean {
  return status !== undefined && AFGEROND.has(status);
}

/** Bedrag zonder centen: "€ 4.321". */
export function euro(bedrag: number): string {
  return formatCurrency(bedrag, "nl-NL", false);
}

/** Heel percentage; 0 als er geen geheel is. */
export function procentVan(deel: number, geheel: number): number {
  if (geheel <= 0) return 0;
  return Math.round((deel / geheel) * 100);
}

export type StandToon = "normaal" | "gedempt" | "aandacht" | "over";

/** De standtekst achter een soort: "47% besteed", "nog niets geboekt", … */
export function standVanSoort(
  regel: SoortRegel,
  afgerond: boolean
): { tekst: string; toon: StandToon } {
  if (regel.begroot <= 0) return { tekst: "niet begroot", toon: "gedempt" };
  if (regel.besteed <= 0) {
    return afgerond
      ? { tekst: "niets geboekt", toon: "gedempt" }
      : { tekst: "nog niets geboekt", toon: "aandacht" };
  }
  if (regel.besteed > regel.begroot) {
    const over = Math.max(1, procentVan(regel.besteed - regel.begroot, regel.begroot));
    return { tekst: `${over}% over`, toon: "over" };
  }
  return { tekst: `${procentVan(regel.besteed, regel.begroot)}% besteed`, toon: "normaal" };
}

/**
 * Soorten met een begroting waarop nog niets is geboekt, terwijl het project
 * loopt. Grootste begroting eerst. Bij een afgerond project is dit geen
 * signaal meer maar een feit (dat staat dan in de standtekst).
 */
export function nietGeboekteSoorten(regels: SoortRegel[], afgerond: boolean): SoortRegel[] {
  if (afgerond) return [];
  return regels
    .filter((r) => r.begroot > 0 && r.besteed <= 0)
    .sort((a, b) => b.begroot - a.begroot);
}

/** "materiaal", "materiaal en machine", "materiaal, machine en overig". */
export function opsomming(woorden: string[]): string {
  if (woorden.length <= 1) return woorden[0] ?? "";
  return `${woorden.slice(0, -1).join(", ")} en ${woorden[woorden.length - 1]}`;
}

export type BudgetStatus = "onder_budget" | "binnen_marge" | "over_budget";

export interface StandStatus {
  label: string;
  /** Welke statusreceptuur de pil krijgt. */
  toon: "loopt" | "goed" | "marge" | "over" | "neutraal";
}

/** De pil naast "Besteed tot nu toe". */
export function standStatus({
  afgerond,
  begroot,
  budgetStatus,
}: {
  afgerond: boolean;
  begroot: number;
  budgetStatus?: BudgetStatus;
}): StandStatus {
  if (!afgerond) return { label: "Project loopt nog", toon: "loopt" };
  if (begroot <= 0 || !budgetStatus) return { label: "Geen begroting", toon: "neutraal" };
  switch (budgetStatus) {
    case "onder_budget":
      return { label: "Onder budget", toon: "goed" };
    case "binnen_marge":
      return { label: "Binnen de marge", toon: "marge" };
    case "over_budget":
      return { label: "Over budget", toon: "over" };
  }
}

/** De soort die het meest boven zijn begroting zit (absoluut), of null. */
function grootsteOverschrijding(regels: SoortRegel[]): SoortRegel | null {
  let beste: SoortRegel | null = null;
  for (const r of regels) {
    const over = r.besteed - r.begroot;
    if (over > 0 && (!beste || over > beste.besteed - beste.begroot)) beste = r;
  }
  return beste;
}

/**
 * De soort die het verschil tussen uren en kosten grotendeels verklaart: wat
 * er bij dit urenpercentage "verwacht" besteed zou zijn, min wat er staat.
 * Alleen als die soort minstens de helft van het totale gat draagt.
 */
function grootsteAchterstand(regels: SoortRegel[], urenProcent: number): SoortRegel | null {
  const gaten = regels
    .map((r) => ({ r, gat: r.begroot * (urenProcent / 100) - r.besteed }))
    .filter((g) => g.gat > 0);
  const totaal = gaten.reduce((s, g) => s + g.gat, 0);
  if (totaal <= 0) return null;
  const top = gaten.reduce((a, b) => (b.gat > a.gat ? b : a));
  return top.gat >= totaal / 2 ? top.r : null;
}

/** Marge (procentpunten) waarbinnen kosten en uren "gelijk op" lopen. */
const GELIJK_OP = 10;

/** Eén zin die duidt hoe de kosten ervoor staan. */
export function duidStand({
  besteed,
  begroot,
  regels,
  afgerond,
  urenProcent,
}: {
  besteed: number;
  begroot: number;
  regels: SoortRegel[];
  afgerond: boolean;
  /** Gewerkte uren als % van de begrote uren; undefined als die er niet zijn. */
  urenProcent?: number;
}): string {
  if (begroot <= 0) {
    return besteed > 0
      ? "Er is geen begroting gekoppeld, dus er is niets om deze kosten tegen af te zetten."
      : "Er is nog niets geboekt en er is geen begroting gekoppeld.";
  }

  const verschil = besteed - begroot;
  const kostenProcent = procentVan(besteed, begroot);

  if (afgerond) {
    if (Math.abs(verschil) < 0.5) return "Het project kwam precies op de begroting uit.";
    if (verschil < 0) return `Het project is ${euro(-verschil)} onder de begroting gebleven.`;
    const top = grootsteOverschrijding(regels);
    const waar = top ? ` Vooral ${SOORT_LABEL[top.soort].toLowerCase()} liep uit.` : "";
    return `Het project kwam ${euro(verschil)} (${procentVan(verschil, begroot)}%) boven de begroting uit.${waar}`;
  }

  if (verschil > 0) {
    const top = grootsteOverschrijding(regels);
    const waar = top ? ` Vooral ${SOORT_LABEL[top.soort].toLowerCase()} loopt uit.` : "";
    return `De kosten liggen nu al ${euro(verschil)} boven de begroting, terwijl het project nog loopt.${waar}`;
  }

  if (besteed <= 0) {
    return "Er is nog niets geboekt: de hele begroting is nog niet besteed.";
  }

  if (urenProcent === undefined) {
    return `${euro(-verschil)} van de begroting is nog niet besteed. Zolang het project loopt is dat geen besparing.`;
  }

  if (urenProcent - kostenProcent > GELIJK_OP) {
    const top = grootsteAchterstand(regels, urenProcent);
    const waar = top ? ` Dat verschil zit vooral in ${SOORT_LABEL[top.soort].toLowerCase()}.` : "";
    return `Er is ${urenProcent}% van de begrote uren gewerkt, maar pas ${kostenProcent}% van de kosten geboekt.${waar}`;
  }

  if (kostenProcent - urenProcent > GELIJK_OP) {
    return `De kosten lopen voor op het werk: ${kostenProcent}% van de begroting is besteed bij ${urenProcent}% van de begrote uren.`;
  }

  return `Kosten en uren lopen gelijk op: ${kostenProcent}% van de begroting besteed bij ${urenProcent}% van de begrote uren.`;
}
