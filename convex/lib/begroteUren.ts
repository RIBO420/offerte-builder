/**
 * Begrote manuren van een offerte (HERO-nabouw fase 1b). Voedt de klus in de
 * opdrachtenbak en "begroot / gepland" op het tijdbord.
 *
 * - `begroteUren` op de offerte is leidend (met de hand ingevuld; HERO kent
 *   geen tijd op de regels van Top Tuinen).
 * - Anders de uren uit de calculatie (wizard: normuren; vrije builder: de
 *   arbeidsregels).
 * - Krijgt een werkitem maar een deel van de regels, dan het deel van de uren
 *   naar rato van het regelbedrag.
 */

export function begroteUrenVanOfferte(offerte: {
  begroteUren?: number;
  totalen?: { totaalUren: number };
}): number | undefined {
  if (offerte.begroteUren !== undefined && offerte.begroteUren > 0) return offerte.begroteUren;
  const uren = offerte.totalen?.totaalUren ?? 0;
  return uren > 0 ? uren : undefined;
}

export function begroteUrenVoorRegels(
  offerte: {
    begroteUren?: number;
    totalen?: { totaalUren: number };
    regels: ReadonlyArray<{ id: string; totaal: number }>;
  },
  regelIds: ReadonlyArray<string> | undefined
): number | undefined {
  const totaal = begroteUrenVanOfferte(offerte);
  if (totaal === undefined) return undefined;
  if (!regelIds || regelIds.length === 0) return totaal;
  const alle = offerte.regels.reduce((t, r) => t + Math.max(0, r.totaal), 0);
  if (alle <= 0) return totaal;
  const deel = offerte.regels
    .filter((r) => regelIds.includes(r.id))
    .reduce((t, r) => t + Math.max(0, r.totaal), 0);
  return Math.round(((totaal * deel) / alle) * 4) / 4; // op het kwartier
}
