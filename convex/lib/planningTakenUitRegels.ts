/**
 * Planningstaken uit offerteregels — één taak per regel (klantbesluit okt 2026).
 *
 * Bij akkoord op de offerte (of een werkitem met toegewezen regels) krijgt het
 * project per niet-optionele regel een taak: scope = hoofdstuk, taakNaam =
 * regelomschrijving, volgorde = offertevolgorde (per hoofdstuk gegroepeerd,
 * zoals de PDF de regels toont).
 *
 * normUren: de hoeveelheid van een arbeidsregel in uren (eenheid "uur");
 * materiaal, machine en arbeid per stuk/vast tellen 0 — een hoeveelheid
 * "3 bomen" is geen 3 uur. geschatteDagen = normUren ÷ (teamgrootte ×
 * effectieve uren per dag), dezelfde afleiding als generateFromVoorcalculatie
 * en de planningpagina (standaard 2 man × 6 uur zonder voorcalculatie).
 *
 * Puur: geen Convex-ctx, zodat de regels zonder database testbaar zijn.
 */

export const STANDAARD_TEAMGROOTTE = 2;
export const STANDAARD_EFFECTIEVE_UREN_PER_DAG = 6;

export type RegelVoorTaak = {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  type: "materiaal" | "arbeid" | "machine";
  optioneel?: boolean;
};

export type NieuweTaak = {
  scope: string;
  taakNaam: string;
  normUren: number;
  geschatteDagen: number;
  volgorde: number;
};

const UUR_EENHEDEN = new Set(["uur", "uren", "u", "manuur", "manuren", "mu", "hr", "h"]);

/** Is dit een tijdseenheid ("uur", "uren", "u.")? */
export function isUurEenheid(eenheid: string): boolean {
  return UUR_EENHEDEN.has(eenheid.trim().toLowerCase().replace(/\.$/, ""));
}

/** Normuren van één regel: alleen arbeid in uren telt. */
export function normUrenVanRegel(regel: Pick<RegelVoorTaak, "type" | "eenheid" | "hoeveelheid">): number {
  if (regel.type !== "arbeid" || !isUurEenheid(regel.eenheid)) return 0;
  return Number.isFinite(regel.hoeveelheid) && regel.hoeveelheid > 0
    ? Math.round(regel.hoeveelheid * 100) / 100
    : 0;
}

/** Arbeidsuren van een set regels (som van de normuren). */
export function arbeidsUrenVanRegels(
  regels: ReadonlyArray<Pick<RegelVoorTaak, "type" | "eenheid" | "hoeveelheid">>
): number {
  return Math.round(regels.reduce((som, r) => som + normUrenVanRegel(r), 0) * 100) / 100;
}

/**
 * Welke regels worden taken: de toegewezen regels van het werkitem
 * (offerteRegelIds, zoals kantoor ze koppelde), anders alle niet-optionele.
 */
export function regelsVoorTaken<R extends RegelVoorTaak>(
  regels: ReadonlyArray<R>,
  regelIds?: ReadonlyArray<string>
): R[] {
  if (regelIds && regelIds.length > 0) {
    const gekozen = new Set(regelIds);
    return regels.filter((r) => gekozen.has(r.id));
  }
  return regels.filter((r) => !r.optioneel);
}

/** Eén taak per regel, gegroepeerd per hoofdstuk in volgorde van voorkomen. */
export function takenUitOfferteRegels(
  regels: ReadonlyArray<RegelVoorTaak>,
  opties: {
    regelIds?: ReadonlyArray<string>;
    teamGrootte?: number;
    effectieveUrenPerDag?: number;
  } = {}
): NieuweTaak[] {
  const teamGrootte =
    opties.teamGrootte && opties.teamGrootte > 0 ? opties.teamGrootte : STANDAARD_TEAMGROOTTE;
  const urenPerDag =
    opties.effectieveUrenPerDag && opties.effectieveUrenPerDag > 0
      ? opties.effectieveUrenPerDag
      : STANDAARD_EFFECTIEVE_UREN_PER_DAG;
  const teamUrenPerDag = teamGrootte * urenPerDag;

  const gekozen = regelsVoorTaken(regels, opties.regelIds).filter(
    (r) => r.omschrijving.trim().length > 0
  );

  // Stabiel groeperen per hoofdstuk: de volgorde waarin de klant ze ziet.
  const hoofdstukken: string[] = [];
  const perHoofdstuk = new Map<string, RegelVoorTaak[]>();
  for (const regel of gekozen) {
    const scope = regel.scope.trim() || "overig";
    if (!perHoofdstuk.has(scope)) {
      hoofdstukken.push(scope);
      perHoofdstuk.set(scope, []);
    }
    perHoofdstuk.get(scope)!.push(regel);
  }

  const taken: NieuweTaak[] = [];
  for (const scope of hoofdstukken) {
    for (const regel of perHoofdstuk.get(scope)!) {
      const normUren = normUrenVanRegel(regel);
      taken.push({
        scope,
        taakNaam: regel.omschrijving.replace(/\s+/g, " ").trim(),
        normUren,
        geschatteDagen: Math.round((normUren / teamUrenPerDag) * 100) / 100,
        volgorde: taken.length,
      });
    }
  }
  return taken;
}
