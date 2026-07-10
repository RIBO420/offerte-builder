/**
 * Debiteurenladder — pure logica (PRD §3.2, fase 2).
 *
 * HERO-lessen (bijlage B deel C) verwerkt:
 * - 3–4 heldere Nederlandse treden i.p.v. zes half-Duitse;
 * - automatisch dagelijks (cron) i.p.v. een handmatige run-knop;
 * - ouderdomsoverzicht met "verschuldigd sinds" op de facturenlijst zelf.
 *
 * Ankerdatum: de VERZENDDATUM van de factuur (verzonden = dag 0), conform
 * het PRD-ritme "verzonden dag 0 → herinnering dag 14 → tweede herinnering
 * dag 21 → dag 28 interne taak (bellen/aanmaning)".
 *
 * Dit bestand bevat uitsluitend pure functies + domeinconstanten zodat de
 * treden-timing, dedupe en bucket-indeling unit-testbaar zijn zonder ctx.
 * De cron/mutations leven in convex/debiteuren.ts.
 */

import { ConvexError } from "convex/values";

export const DAG_MS = 24 * 60 * 60 * 1000;

export const MAX_TREDEN = 4;

export type LadderEscalatie = "mail" | "interne_taak";

export interface LadderTrede {
  /** Tredenummer 1..4 (oplopend) */
  trede: number;
  /** Dagen na de verzenddatum van de factuur (dag 0 = verzonden) */
  dagenNaVerzending: number;
  /** mail → concept-wachtrij (§2.7); interne_taak → kantoor-taak op het cases-bord */
  escalatie: LadderEscalatie;
  actief?: boolean;
}

export interface LadderInstellingen {
  actief?: boolean;
  taakEigenaarId?: string;
  treden?: LadderTrede[];
}

/**
 * Default-ladder (PRD §3.2): dag 14 herinnering, dag 21 tweede herinnering,
 * dag 28 interne taak "bellen/aanmaning" voor kantoor.
 */
export const DEBITEUREN_LADDER_DEFAULTS: LadderTrede[] = [
  { trede: 1, dagenNaVerzending: 14, escalatie: "mail", actief: true },
  { trede: 2, dagenNaVerzending: 21, escalatie: "mail", actief: true },
  { trede: 3, dagenNaVerzending: 28, escalatie: "interne_taak", actief: true },
];

/** Effectieve treden: instelling of defaults; alleen actieve, gesorteerd. */
export function effectieveTreden(
  instelling: LadderInstellingen | undefined | null
): LadderTrede[] {
  const treden =
    instelling?.treden && instelling.treden.length > 0
      ? instelling.treden
      : DEBITEUREN_LADDER_DEFAULTS;
  return treden
    .filter((t) => t.actief !== false)
    .slice()
    .sort((a, b) => a.trede - b.trede);
}

/** Valideer een treden-configuratie (kantoor-instellingen, max 4 treden). */
export function valideerTreden(treden: LadderTrede[]): void {
  if (treden.length === 0) {
    throw new ConvexError("De ladder heeft minimaal één trede nodig");
  }
  if (treden.length > MAX_TREDEN) {
    throw new ConvexError(
      `Maximaal ${MAX_TREDEN} treden — houd de ladder helder (HERO-les)`
    );
  }
  const nummers = treden.map((t) => t.trede);
  if (new Set(nummers).size !== nummers.length) {
    throw new ConvexError("Elke trede moet een uniek nummer hebben");
  }
  for (const t of treden) {
    if (!Number.isInteger(t.trede) || t.trede < 1 || t.trede > MAX_TREDEN) {
      throw new ConvexError("Tredenummers lopen van 1 t/m 4");
    }
    if (!Number.isInteger(t.dagenNaVerzending) || t.dagenNaVerzending < 1) {
      throw new ConvexError(
        "Interval moet een geheel aantal dagen (≥ 1) na verzending zijn"
      );
    }
  }
  const gesorteerd = treden.slice().sort((a, b) => a.trede - b.trede);
  for (let i = 1; i < gesorteerd.length; i++) {
    if (
      gesorteerd[i].dagenNaVerzending <= gesorteerd[i - 1].dagenNaVerzending
    ) {
      throw new ConvexError(
        "Elke volgende trede moet later vallen dan de vorige"
      );
    }
  }
}

/**
 * Komt een factuur in aanmerking voor de ladder?
 * Alleen VERZONDEN documenten met betaalstatus open/gedeeltelijk_betaald;
 * concepten, creditnota's en betaalde/geannuleerde/vervallen facturen nooit.
 */
export function ladderVanToepassing(factuur: {
  documentStatus: "concept" | "definitief" | "verzonden";
  betaalStatus:
    | "open"
    | "gedeeltelijk_betaald"
    | "betaald"
    | "vervallen"
    | "geannuleerd";
  isCreditnota?: boolean;
}): boolean {
  if (factuur.isCreditnota) return false;
  if (factuur.documentStatus !== "verzonden") return false;
  return (
    factuur.betaalStatus === "open" ||
    factuur.betaalStatus === "gedeeltelijk_betaald"
  );
}

/** Idempotentiesleutel per factuur + trede (concept-mails én taken). */
export function debiteurSleutel(factuurId: string, trede: number): string {
  return `debiteur:${factuurId}:${trede}`;
}

/**
 * Trede-niveau van een bestaand betalingsherinneringen-record.
 * Ladder-records dragen hun trede zelf; HANDMATIGE records (oude pad,
 * FAC-006/007) tellen mee via hun type zodat de ladder nooit dubbelt met
 * wat kantoor al verstuurde (één bron van waarheid, dedupe-eis §3.2).
 */
export function tredeNiveauVanRecord(record: {
  trede?: number;
  type: string;
}): number {
  if (typeof record.trede === "number") return record.trede;
  switch (record.type) {
    case "herinnering":
      return 1;
    case "tweede_herinnering":
    case "eerste_aanmaning":
      return 2;
    case "tweede_aanmaning":
    case "interne_taak":
      return 3;
    case "ingebrekestelling":
      return 4;
    default:
      return 0;
  }
}

/** Hoogste al afgedekte trede (records + overgeslagen treden). */
export function hoogsteAfgedekteTrede(
  records: Array<{ trede?: number; type: string }>,
  overgeslagenTreden: number[] | undefined
): number {
  let hoogste = 0;
  for (const r of records) {
    hoogste = Math.max(hoogste, tredeNiveauVanRecord(r));
  }
  for (const t of overgeslagenTreden ?? []) {
    hoogste = Math.max(hoogste, t);
  }
  return hoogste;
}

/**
 * De trede die de cron nu moet uitvoeren, of null.
 * Bij een oude factuur die meerdere treden tegelijk "verschuldigd" is,
 * wordt alleen de HOOGSTE vervallen trede uitgevoerd (geen mail-salvo van
 * drie herinneringen op één dag — HERO-les).
 */
export function bepaalVolgendeTrede(
  treden: LadderTrede[],
  dagenSindsVerzending: number,
  hoogsteAfgedekt: number
): LadderTrede | null {
  let kandidaat: LadderTrede | null = null;
  for (const trede of treden) {
    if (trede.trede <= hoogsteAfgedekt) continue;
    if (dagenSindsVerzending >= trede.dagenNaVerzending) {
      if (!kandidaat || trede.trede > kandidaat.trede) kandidaat = trede;
    }
  }
  return kandidaat;
}

/** Eerstvolgende (nog niet afgedekte) trede, ongeacht of hij al due is. */
export function eerstvolgendeTrede(
  treden: LadderTrede[],
  hoogsteAfgedekt: number
): LadderTrede | null {
  for (const trede of treden) {
    if (trede.trede > hoogsteAfgedekt) return trede;
  }
  return null;
}

// ─── Openstaande-postenoverzicht (§3.2: "de lijst ís het overzicht") ─────────

export type OuderdomsBucket = "0_14" | "14_30" | "30_60" | "60_plus";

/** Dagen sinds de vervaldatum (negatief = nog niet vervallen → 0). */
export function dagenVerschuldigd(vervaldatum: number, nu: number): number {
  return Math.max(0, Math.floor((nu - vervaldatum) / DAG_MS));
}

export function ouderdomsBucket(dagen: number): OuderdomsBucket {
  if (dagen < 14) return "0_14";
  if (dagen < 30) return "14_30";
  if (dagen < 60) return "30_60";
  return "60_plus";
}

export const OUDERDOMS_BUCKET_LABELS: Record<OuderdomsBucket, string> = {
  "0_14": "0–14 dagen",
  "14_30": "14–30 dagen",
  "30_60": "30–60 dagen",
  "60_plus": "60+ dagen",
};

/** Openstaand bedrag: totaal minus geregistreerde (deel)betalingen. */
export function openstaandBedrag(factuur: {
  totaalInclBtw: number;
  betaaldBedrag?: number;
}): number {
  return Math.max(0, factuur.totaalInclBtw - (factuur.betaaldBedrag ?? 0));
}

/** NL-weergavelabels voor ladder-recordtypen (deelt UI met FAC-006/007). */
export const TREDE_TYPE_PER_NUMMER: Record<
  number,
  "herinnering" | "tweede_herinnering" | "eerste_aanmaning" | "tweede_aanmaning"
> = {
  1: "herinnering",
  2: "tweede_herinnering",
  3: "eerste_aanmaning",
  4: "tweede_aanmaning",
};

/** Recordtype voor een uitgevoerde ladder-trede. */
export function tredeRecordType(
  trede: LadderTrede
): "herinnering" | "tweede_herinnering" | "eerste_aanmaning" | "tweede_aanmaning" | "interne_taak" {
  if (trede.escalatie === "interne_taak") return "interne_taak";
  return TREDE_TYPE_PER_NUMMER[trede.trede] ?? "herinnering";
}
