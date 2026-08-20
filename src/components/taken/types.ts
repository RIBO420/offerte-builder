/**
 * Gedeelde taal van de taken-UI-kit (klantdossier v13 + werkbord "Mijn dag").
 *
 * De typen leiden we af uit de Convex-functies zelf — `VerrijkteTaak` en
 * `ToewijsbaarPersoon` zijn dus per definitie hetzelfde als wat de backend
 * teruggeeft. Loopt het contract uit elkaar, dan valt dat om in de typecheck en
 * niet pas in beeld.
 *
 * De kleuren komen uit onze eigen statustokens (Loof & Leem), niet uit de
 * prototype-hexwaarden. De betekenislaag uit de inventaris §C:
 * groen = werk/afgerond · amber-oker = geld/aandacht/wachten ·
 * rood = te laat/vastgelopen · kleibruin = documenten.
 */

import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/** Precies wat `klantTaken.listVoorKlant`/`mijnDag`/`mijnTaken` teruggeven. */
export type VerrijkteTaak = FunctionReturnType<
  typeof api.klantTaken.listVoorKlant
>[number];

/** Precies wat `users.takenToewijsbaar` teruggeeft. */
export type ToewijsbaarPersoon = FunctionReturnType<
  typeof api.users.takenToewijsbaar
>[number];

export type TaakStatus = "todo" | "bezig" | "check" | "klaar";
export type TaakPrioriteit = "laag" | "normaal" | "hoog";

/** Radix' Select accepteert geen lege string als item-value. */
export const NIEMAND = "__niemand__";

export const STATUS_LABELS: Record<TaakStatus, string> = {
  todo: "Te doen",
  bezig: "Bezig",
  check: "Wacht op check",
  klaar: "Klaar",
};

/**
 * Labels op de statusknoppen. "Klaar, moet gecheckt" is bewust een zin en geen
 * label: de knop vertelt wat er gebeurt als je hem indrukt (inventaris §A6).
 */
export const STATUS_KNOP_LABELS: Record<TaakStatus, string> = {
  todo: "Te doen",
  bezig: "Bezig",
  check: "Klaar, moet gecheckt",
  klaar: "Helemaal klaar",
};

/**
 * Statusbadge-klassen op onze tokens:
 * - `todo` neutraal (concept) — er is nog niets gebeurd;
 * - `bezig` amber (in-uitvoering) — er wordt aan gewerkt;
 * - `check` oker (verzonden = "onderweg/wachten") — ligt bij de checker;
 * - `klaar` merkgroen (afgerond).
 */
export const STATUS_TOON: Record<TaakStatus, string> = {
  todo: "bg-status-concept text-status-concept-text border-status-concept-border",
  bezig:
    "bg-status-in-uitvoering text-status-in-uitvoering-text border-status-in-uitvoering-border",
  check:
    "bg-status-verzonden text-status-verzonden-text border-status-verzonden-border",
  klaar:
    "bg-status-afgerond text-status-afgerond-text border-status-afgerond-border",
};

export const PRIORITEIT_LABELS: Record<TaakPrioriteit, string> = {
  hoog: "Hoog",
  normaal: "Normaal",
  laag: "Laag",
};

export const PRIORITEIT_VOLGORDE: TaakPrioriteit[] = ["hoog", "normaal", "laag"];

export const STATUS_VOLGORDE: TaakStatus[] = ["todo", "bezig", "check", "klaar"];

/** Voornaam voor knopteksten ("Klaar, moet gecheckt door Ricardo"). */
export function voornaamVan(naam: string): string {
  const eerste = naam.trim().split(/\s+/)[0];
  return eerste || naam.trim();
}

/**
 * Naam in de toewijs-selects. Admins krijgen "(admin)" erachter — puur een
 * label zodat je in een lijst van twintig namen ziet wie het kantoor is
 * (inventaris §A6, klant-eis "iedereen is toewijsbaar, ook admins").
 */
export function persoonLabel(persoon: ToewijsbaarPersoon): string {
  return persoon.isAdmin ? `${persoon.naam} (admin)` : persoon.naam;
}

// ─── Datum ───────────────────────────────────────────────────────────────────

const MS_PER_DAG = 86_400_000;

const DATUM_KORT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});
const DATUM_KORT_WEEKDAG = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const DATUM_VOLLEDIG = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Lokale datum; `toISOString()` schuift 's avonds een dag terug. */
export function vandaagISO(): string {
  const nu = new Date();
  const maand = `${nu.getMonth() + 1}`.padStart(2, "0");
  const dag = `${nu.getDate()}`.padStart(2, "0");
  return `${nu.getFullYear()}-${maand}-${dag}`;
}

/** ISO-datum → lokale middernacht, zodat dagverschillen geen tijdzone raken. */
export function parseISODatum(iso: string): Date {
  const [jaar, maand, dag] = iso.split("-").map(Number);
  return new Date(jaar, maand - 1, dag);
}

export function dagenVerschil(vanISO: string, totISO: string): number {
  return Math.round(
    (parseISODatum(totISO).getTime() - parseISODatum(vanISO).getTime()) /
      MS_PER_DAG
  );
}

export function formatDeadlineVolledig(deadline: string): string {
  return DATUM_VOLLEDIG.format(parseISODatum(deadline));
}

export interface DeadlineWeergave {
  tekst: string;
  teLaat: boolean;
}

/**
 * "3 dagen te laat" leest sneller dan "11 aug" in het rood: het getal doet het
 * werk, de kleur bevestigt het alleen.
 */
export function deadlineWeergave(
  deadline: string,
  vandaag: string
): DeadlineWeergave {
  const dagen = dagenVerschil(vandaag, deadline);
  if (dagen < 0) {
    const aantal = Math.abs(dagen);
    return {
      tekst: `${aantal} ${aantal === 1 ? "dag" : "dagen"} te laat`,
      teLaat: true,
    };
  }
  if (dagen === 0) return { tekst: "Vandaag", teLaat: false };
  if (dagen === 1) return { tekst: "Morgen", teLaat: false };

  const datum = parseISODatum(deadline);
  if (dagen <= 7) {
    return { tekst: DATUM_KORT_WEEKDAG.format(datum), teLaat: false };
  }
  return { tekst: DATUM_KORT.format(datum), teLaat: false };
}
