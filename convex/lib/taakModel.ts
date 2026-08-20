/**
 * Pure logica van taakmodel v2 (klantdossier v13 + werkbord "Mijn dag").
 *
 * Alles wat hier staat is functie-in-functie-uit: geen database, geen ctx. Dat
 * is opzet — de afleidingen die het werkbord kleuren (stilstand, "te laat",
 * initialen) moeten in een test vast te leggen zijn zonder mock-harnas, en de
 * dossier-tellingen in `convex/klanten.ts` gebruiken dezelfde definities als
 * `convex/klantTaken.ts`. Eén plek, één waarheid.
 */

import { v } from "convex/values";

// ─── Status ──────────────────────────────────────────────────────────────────

/** De vier v2-statussen. "check" = "Wacht op check" (harde klanteis 7). */
export const TAAK_STATUSSEN = ["todo", "bezig", "check", "klaar"] as const;
export type TaakStatus = (typeof TAAK_STATUSSEN)[number];

/** Validator voor mutation-args: alléén de vier v2-waarden mogen binnenkomen. */
export const taakStatusValidator = v.union(
  v.literal("todo"),
  v.literal("bezig"),
  v.literal("check"),
  v.literal("klaar")
);

export const taakPrioriteitValidator = v.union(
  v.literal("laag"),
  v.literal("normaal"),
  v.literal("hoog")
);

/**
 * Leeswaarde van een status. Tolerant voor de twee legacy-waarden zolang
 * `migrations/taakmodelV2:migreer` nog niet op elke deployment gedraaid is;
 * daarna is dit een no-op die niets kwaad doet.
 */
export function normaliseerStatus(status: string): TaakStatus {
  if (status === "open") return "todo";
  if (status === "afgerond") return "klaar";
  if ((TAAK_STATUSSEN as readonly string[]).includes(status)) {
    return status as TaakStatus;
  }
  return "todo";
}

/** Is deze taak af? Ook waar (nog) een legacy-status staat. */
export function isKlaar(status: string): boolean {
  return normaliseerStatus(status) === "klaar";
}

/** Het tegenovergestelde: telt mee als "open werk". */
export function isOpenTaak(status: string): boolean {
  return !isKlaar(status);
}

// ─── Datum & stilstand ───────────────────────────────────────────────────────

const DAG_MS = 24 * 60 * 60 * 1000;

/**
 * Vandaag als YYYY-MM-DD in Europe/Amsterdam.
 *
 * Convex draait in UTC; zonder omrekening staat een deadline tussen 00:00 en
 * 02:00 Nederlandse tijd ten onrechte op "te laat". Zelfde patroon als
 * `gesprekAnalyse.ts` en `facturatieLogica.ts`.
 */
export function vandaagAmsterdam(nu: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nu));
}

/**
 * Hele dagen sinds de laatste beweging op de taak.
 *
 * `laatsteBewegingOp` is optioneel tot de migratie geweest is; dan geldt de
 * aanmaaktijd, want dát is dan de laatste bekende beweging. Nooit negatief:
 * een klokverschil mag geen "-1 dag stil" opleveren.
 */
export function stilDagen(
  laatsteBewegingOp: number | undefined,
  creationTime: number,
  nu: number = Date.now()
): number {
  const sinds = laatsteBewegingOp ?? creationTime;
  return Math.max(0, Math.floor((nu - sinds) / DAG_MS));
}

/** Deadline verstreken en de taak is niet klaar. */
export function isOver(
  deadline: string | undefined,
  status: string,
  vandaag: string
): boolean {
  if (!deadline) return false;
  if (isKlaar(status)) return false;
  return deadline < vandaag;
}

// ─── Personen ────────────────────────────────────────────────────────────────

/**
 * Initialen voor de avatar: eerste letter van de eerste twee woorden.
 * "Ricardo Bos" → "RB", "kantoor" → "K", "" → "?".
 */
export function initialenVan(naam: string): string {
  const delen = naam
    .split(/\s+/)
    .map((deel) => deel.trim())
    .filter(Boolean);
  if (delen.length === 0) return "?";
  return delen
    .slice(0, 2)
    .map((deel) => deel[0]!.toUpperCase())
    .join("");
}

/** Voornaam voor knopteksten ("Klaar, moet gecheckt door Ricardo"). */
export function voornaamVan(naam: string): string {
  const eerste = naam.trim().split(/\s+/)[0];
  return eerste || naam.trim();
}

/**
 * "(admin)" achter de naam in de toewijs-selects: directie en kantoor
 * (projectleider). Niet om rechten mee te bepalen — puur een label zodat je in
 * een lijst van twintig namen ziet wie het kantoor is.
 */
export function isAdminRol(rol: string | undefined): boolean {
  return rol === "directie" || rol === "admin" || rol === "projectleider";
}

// ─── Subtaken ────────────────────────────────────────────────────────────────

export function telSubtaken(
  subtaken: ReadonlyArray<{ klaar: boolean }> | undefined
): { subtakenKlaar: number; subtakenTotaal: number } {
  if (!subtaken || subtaken.length === 0) {
    return { subtakenKlaar: 0, subtakenTotaal: 0 };
  }
  return {
    subtakenKlaar: subtaken.filter((s) => s.klaar).length,
    subtakenTotaal: subtaken.length,
  };
}
