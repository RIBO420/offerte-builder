/**
 * Generieke vervallogica-engine — pure kern (PRD §3.3).
 *
 * Engine-familie "item + datum + termijn + ontvanger → idempotente bord-taak":
 * dezelfde familie als de planningsattendering (§2.1/§8.12) en de
 * debiteurenladder (§3.2). Dit bestand is de GEDEELDE, generieke kern:
 * - datumhelpers (addDagen/dagenTussen) — planningsattendering.ts importeert
 *   en her-exporteert ze (generaliseren zonder de attendering te breken);
 * - termijnBereikt(): het ene generieke criterium waar alle drie de crons
 *   op draaien (doeldatum − termijnDagen ≤ vandaag);
 * - verval-specifiek: sleutel (`verval:{id}:{datum}`), taaktekst en
 *   ontvanger-resolutie.
 *
 * BEWUST geen voertuig-/machine-specifieke velden in de kern: fase 3 hangt
 * hier de HR-certificeringen aan (§4.2) door alleen een objectType toe te
 * voegen. Alles hier is puur en unit-testbaar zonder ctx.
 *
 * Deze engine maakt TAKEN, nooit mails (kantoor↔klant-regel §1.2 is hier
 * niet eens aan de orde: vervalitems zijn intern).
 */

export const DAG_MS = 24 * 60 * 60 * 1000;

/** ISO-datum + n dagen (n mag negatief zijn). */
export function addDagen(datum: string, dagen: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + dagen * DAG_MS)
    .toISOString()
    .slice(0, 10);
}

/** Hele dagen van `van` tot `tot` (negatief als `tot` vóór `van` ligt). */
export function dagenTussen(van: string, tot: string): number {
  return Math.round(
    (Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) / DAG_MS
  );
}

/**
 * Generiek engine-criterium: is de waarschuwtermijn vóór de doeldatum
 * bereikt? True vanaf precies `doeldatum − termijnDagen` (en daarna, ook
 * ná de doeldatum: een verlopen APK blijft een taak waard tot het item
 * op inactief gaat of de vervaldatum wordt bijgewerkt).
 */
export function termijnBereikt(
  item: { doeldatum: string; termijnDagen: number },
  vandaag: string
): boolean {
  return vandaag >= addDagen(item.doeldatum, -Math.max(0, item.termijnDagen));
}

// ============================================
// Verval-specifiek
// ============================================

export type VervalType =
  | "apk"
  | "keuring"
  | "certificaat"
  | "verzekering"
  | "anders";

export const VERVAL_TYPE_LABEL: Record<VervalType, string> = {
  apk: "APK",
  keuring: "Keuring",
  certificaat: "Certificaat",
  verzekering: "Verzekering",
  anders: "Verloopt",
};

/**
 * Idempotentiesleutel van de onderhoudstaak voor één vervalitem-occurrence.
 * Zelfde patroon als `plantaak:{beurtId}:{datum}` en
 * `debiteur:{factuurId}:{trede}`. De vervaldatum zit in de sleutel: wordt
 * het item verlengd (nieuwe vervaldatum), dan is dat een nieuwe occurrence
 * en dus — terecht — een nieuwe taak.
 */
export function maakVervalSleutel(
  vervalItemId: string,
  vervaldatum: string
): string {
  return `verval:${vervalItemId}:${vervaldatum}`;
}

export interface VervalItemKern {
  naam: string;
  type: VervalType;
  vervaldatum: string; // YYYY-MM-DD
  waarschuwtermijnDagen: number;
  actief: boolean;
}

/**
 * Moet er vandaag een taak bestaan voor dit vervalitem?
 * actief=false schakelt het item volledig uit (geen taak, ook niet na de
 * vervaldatum); verder geldt het generieke termijn-criterium.
 */
export function vervalTaakNodig(
  item: VervalItemKern,
  vandaag: string
): boolean {
  if (!item.actief) return false;
  return termijnBereikt(
    { doeldatum: item.vervaldatum, termijnDagen: item.waarschuwtermijnDagen },
    vandaag
  );
}

/**
 * Taaktekst — PRD-voorbeeldgedrag §3.3: "Michel, over 20 dagen moet de bus
 * naar de APK." Hier zonder aanhef (de ontvanger staat op de taak zelf):
 * "APK: bus VW Crafter (12-ABC-3) — verloopt over 20 dagen (2026-07-30)".
 */
export function vervalTaakTekst(
  item: { naam: string; type: VervalType; vervaldatum: string },
  vandaag: string
): string {
  const dagen = dagenTussen(vandaag, item.vervaldatum);
  const wanneer =
    dagen > 1
      ? `verloopt over ${dagen} dagen`
      : dagen === 1
        ? "verloopt morgen"
        : dagen === 0
          ? "verloopt vandaag"
          : `is ${-dagen} ${dagen === -1 ? "dag" : "dagen"} geleden verlopen`;
  return `${VERVAL_TYPE_LABEL[item.type]}: ${item.naam} — ${wanneer} (${item.vervaldatum})`;
}

/**
 * Ontvanger-resolutie (puur): specifieke gebruiker > rol.
 * - ontvangerGebruikerId wint altijd (mits die gebruiker bestaat);
 * - rol "voorman": de eerste gebruiker met rol voorman;
 * - rol "kantoor" (default): de bedrijfseigenaar (directie).
 * Valt altijd terug op de eigenaar — een taak zonder eigenaar bestaat niet
 * (PRD §2.4: eigenaar is verplicht).
 */
export function resolveVervalOntvanger<
  T extends { _id: { toString(): string }; role?: string | null },
>(
  item: { ontvangerGebruikerId?: string; ontvangerRol?: "kantoor" | "voorman" },
  bedrijfsGebruikers: T[],
  eigenaar: T,
  normalizeRol: (role: string | undefined | null) => string
): T {
  if (item.ontvangerGebruikerId) {
    const specifiek = bedrijfsGebruikers.find(
      (u) => u._id.toString() === item.ontvangerGebruikerId
    );
    if (specifiek) return specifiek;
  }
  if (item.ontvangerRol === "voorman") {
    const voorman = bedrijfsGebruikers.find(
      (u) => normalizeRol(u.role) === "voorman"
    );
    if (voorman) return voorman;
  }
  return eigenaar;
}
