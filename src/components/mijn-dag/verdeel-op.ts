/**
 * De rekenkern van het werkbord "Mijn dag" (functionele inventaris §B1–§B3).
 *
 * Hier staat wat het bord *beslist*: welke taken je ziet (perspectief +
 * statuschips), in welke kolom ze vallen (vier indelingen) en wat er "blijft
 * liggen". Bewust een pure module zonder React en zonder Convex: dit zijn de
 * afspraken met de klant, en die horen toetsbaar te zijn zonder een muis.
 *
 * Twee principes die je in de code terugziet:
 *
 * - **Een te late taak hoort bij Vandaag.** Werk dat over de datum is, zakt
 *   niet weg in een historische kolom; het staat vooraan, want het moet nú.
 * - **De teller loopt bij stilstand, niet bij drukte.** "Blijft liggen" kijkt
 *   naar `stilDagen` (sinds de laatste beweging op de taak) en naar de
 *   deadline — niet naar hoeveel er op iemands bord staat.
 */

import type { Id } from "@convex/_generated/dataModel";
import {
  STATUS_LABELS,
  STATUS_VOLGORDE,
  parseISODatum,
  vandaagISO,
  voornaamVan,
  type TaakStatus,
  type ToewijsbaarPersoon,
} from "@/components/taken/types";

// ─── Bordtaal ────────────────────────────────────────────────────────────────

export type Perspectief = "mij" | "uitgezet" | "alles";
export type Indeling = "wanneer" | "wie" | "status" | "klant";
/** De chips naast het perspectief; "klaar" is er bewust géén (§B1). */
export type StatusChip = "alles" | "todo" | "bezig" | "check";
export type BlijftLiggenModus = "kolom" | "balk" | "uit";

export const PERSPECTIEF_LABELS: Record<Perspectief, string> = {
  mij: "Van mij",
  uitgezet: "Uitgezet door mij",
  alles: "Alles",
};

export const INDELING_LABELS: Record<Indeling, string> = {
  wanneer: "Wanneer",
  wie: "Wie",
  status: "Status",
  klant: "Klant",
};

export const STATUS_CHIP_LABELS: Record<StatusChip, string> = {
  alles: "Alles",
  todo: "Te doen",
  bezig: "Bezig",
  check: "Wacht op check",
};

export const BLIJFT_LIGGEN_LABELS: Record<BlijftLiggenModus, string> = {
  kolom: "Als kolom",
  balk: "Als balk",
  uit: "Verbergen",
};

/** Sleutel van de vangkolom in de Wie-indeling. */
export const NIET_TOEGEWEZEN = "__niet_toegewezen__";

/**
 * Wat de verdeling van een taak nodig heeft. `VerrijkteTaak` uit de backend
 * voldoet hieraan; door het minimale vorm-type te gebruiken kan een test een
 * taak in vijf regels neerzetten in plaats van een heel Convex-document na te
 * bouwen.
 */
export interface BordTaak {
  _id: Id<"klantTaken">;
  klantId: Id<"klanten">;
  klantNaam: string;
  titel: string;
  status: TaakStatus;
  prioriteit: "hoog" | "normaal" | "laag";
  deadline?: string;
  stilDagen: number;
  makerId?: Id<"users">;
  checkerId?: Id<"users">;
  uitgezetDoorId?: Id<"users">;
  maker: ToewijsbaarPersoon | null;
  checker: ToewijsbaarPersoon | null;
}

export interface BordKolom<T extends BordTaak = BordTaak> {
  key: string;
  titel: string;
  /** Eén regel eronder: wat betekent deze kolom, en wat doet slepen hier. */
  onder: string;
  /** Kort merkteken in de kolomkop (initialen of twee letters). */
  merk: string;
  items: T[];
  /** Klant-indeling is een leesweergave: daar betekent slepen niets (§B2). */
  sleepbaar: boolean;
  /** Alleen in de Wie-indeling gevuld; `null` = de vangkolom. */
  persoonId?: Id<"users"> | null;
}

export interface Reden {
  tekst: string;
  /** Hard = deadline of vastgelopen check; zacht = stilstand bij een ander. */
  hard: boolean;
}

export interface BlijftLiggenItem<T extends BordTaak = BordTaak> {
  taak: T;
  redenen: Reden[];
}

// ─── Datum ───────────────────────────────────────────────────────────────────

const MS_PER_DAG = 86_400_000;

const DATUM_KORT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});

function isoVerschoven(iso: string, dagen: number): string {
  const datum = new Date(parseISODatum(iso).getTime() + dagen * MS_PER_DAG);
  const maand = `${datum.getMonth() + 1}`.padStart(2, "0");
  const dag = `${datum.getDate()}`.padStart(2, "0");
  return `${datum.getFullYear()}-${maand}-${dag}`;
}

/**
 * "Deze week" loopt t/m vrijdag (§B2) — de laatste werkdag, niet de
 * kalenderzondag. Val je in het weekend, dan is de eerstvolgende vrijdag die
 * van de week die begint: op zaterdag is "deze week" niet gisteren.
 */
export function eindVanWerkweek(vandaag: string): string {
  const dag = parseISODatum(vandaag).getDay(); // 0 = zondag
  const tot = dag === 0 ? 5 : dag <= 5 ? 5 - dag : 6;
  return isoVerschoven(vandaag, tot);
}

function formatKort(iso: string): string {
  return DATUM_KORT.format(parseISODatum(iso));
}

// ─── §B1 Wie ziet wat ────────────────────────────────────────────────────────

const gelijk = (
  a: Id<"users"> | undefined,
  b: Id<"users"> | undefined
): boolean => a !== undefined && b !== undefined && a.toString() === b.toString();

/** Van mij = maker óf checker; uitgezet = ik zette het uit bij een ánder. */
export function inPerspectief(
  taak: BordTaak,
  ikId: Id<"users"> | undefined,
  perspectief: Perspectief
): boolean {
  if (perspectief === "alles") return true;
  if (perspectief === "mij") {
    return gelijk(taak.makerId, ikId) || gelijk(taak.checkerId, ikId);
  }
  return gelijk(taak.uitgezetDoorId, ikId) && !gelijk(taak.makerId, ikId);
}

/** Ben ik hier hoe dan ook bij betrokken? Bepaalt wat er kán blijven liggen. */
export function ikBetrokken(
  taak: BordTaak,
  ikId: Id<"users"> | undefined
): boolean {
  return (
    gelijk(taak.makerId, ikId) ||
    gelijk(taak.checkerId, ikId) ||
    gelijk(taak.uitgezetDoorId, ikId)
  );
}

// ─── §B3 Dit blijft liggen ───────────────────────────────────────────────────

/**
 * De drie triggers, in volgorde van hoe hard ze zijn:
 *
 * 1. de deadline is voorbij — hard, want die datum is aan iemand beloofd;
 * 2. de taak staat op "wacht op check" en ligt ≥ 2 dagen stil — hard, want
 *    hier is het werk gedaan en houdt alleen de check het op;
 * 3. de taak ligt ≥ 3 dagen stil bij een ánder, of bij NIEMAND — zacht:
 *    misschien loopt het, misschien is het vergeten, maar het is het aankijken
 *    waard. De ongeadresseerde variant hoort er nadrukkelijk bij: een taak
 *    zonder maker is precies degene die niemand oppakt (review v13).
 *
 * 2 en 3 sluiten elkaar uit: een wachtende check is al gemeld, en twee regels
 * over dezelfde stilstand maken het kaartje alleen maar drukker.
 */
export function redenen(
  taak: BordTaak,
  ikId: Id<"users"> | undefined,
  vandaag: string = vandaagISO()
): Reden[] {
  const uit: Reden[] = [];
  if (taak.status === "klaar") return uit;

  if (taak.deadline && taak.deadline < vandaag) {
    uit.push({
      tekst: `deadline voorbij (${formatKort(taak.deadline)})`,
      hard: true,
    });
  }

  if (taak.status === "check" && taak.stilDagen >= 2) {
    const wie = taak.checker ? voornaamVan(taak.checker.naam) : "een check";
    uit.push({
      tekst: `ligt ${taak.stilDagen}d te wachten op ${wie}`,
      hard: true,
    });
  } else if (taak.stilDagen >= 3 && !gelijk(taak.makerId, ikId)) {
    // Twee gevallen, één trigger: stilstand bij een ánder, en stilstand op een
    // taak die aan niemand hangt. Alleen "bij mijzelf" valt af — dat is mijn
    // eigen werkvoorraad, niet iets wat blijft liggen.
    const tekst =
      taak.makerId === undefined
        ? `${taak.stilDagen}d geen beweging, niemand toegewezen`
        : `${taak.stilDagen}d geen beweging bij ${
            taak.maker ? voornaamVan(taak.maker.naam) : "iemand anders"
          }`;
    uit.push({ tekst, hard: false });
  }

  return uit;
}

/**
 * Alles wat blijft liggen, harde redenen eerst. Bewust ongefilterd door
 * perspectief of statuschip: dit paneel is de vaste achterdeur van het bord —
 * wat vastloopt mag je niet kwijtraken door een filterknop.
 */
export function blijftLiggen<T extends BordTaak>(
  taken: T[],
  ikId: Id<"users"> | undefined,
  vandaag: string = vandaagISO()
): Array<BlijftLiggenItem<T>> {
  return taken
    .filter((taak) => ikBetrokken(taak, ikId))
    .map((taak) => ({ taak, redenen: redenen(taak, ikId, vandaag) }))
    .filter((item) => item.redenen.length > 0)
    .sort(
      (a, b) =>
        Number(b.redenen.some((r) => r.hard)) -
        Number(a.redenen.some((r) => r.hard))
    );
}

// ─── §B2 Kolommen ────────────────────────────────────────────────────────────

export type WanneerBucket = "vandaag" | "morgen" | "week" | "later";

/**
 * In welke wanneer-kolom valt deze taak? Te laat telt als vandaag; alles
 * zonder datum (en alles voorbij vrijdag) valt in "Later".
 */
export function wanneerBucket(
  taak: BordTaak,
  vandaag: string = vandaagISO()
): WanneerBucket {
  if (!taak.deadline) return "later";
  if (taak.deadline <= vandaag) return "vandaag";
  if (taak.deadline === isoVerschoven(vandaag, 1)) return "morgen";
  if (taak.deadline <= eindVanWerkweek(vandaag)) return "week";
  return "later";
}

/** Welke deadline zet je met een drop in deze kolom? `null` = deadline wissen. */
export function deadlineVoorBucket(
  bucket: WanneerBucket,
  vandaag: string = vandaagISO()
): string | null {
  if (bucket === "vandaag") return vandaag;
  if (bucket === "morgen") return isoVerschoven(vandaag, 1);
  if (bucket === "week") return eindVanWerkweek(vandaag);
  return null;
}

const WANNEER_KOLOMMEN: Array<{
  key: WanneerBucket;
  titel: string;
  onder: string;
  merk: string;
}> = [
  { key: "vandaag", titel: "Vandaag", onder: "wat er vandaag af moet", merk: "Va" },
  { key: "morgen", titel: "Morgen", onder: "alvast klaargezet", merk: "Mo" },
  { key: "week", titel: "Deze week", onder: "voor vrijdag", merk: "We" },
  { key: "later", titel: "Later", onder: "verder weg of nog geen datum", merk: "La" },
];

export interface VerdeelInvoer<T extends BordTaak> {
  taken: T[];
  ikId: Id<"users"> | undefined;
  personen: ToewijsbaarPersoon[];
  indeling: Indeling;
  perspectief: Perspectief;
  statusChip: StatusChip;
  blijftLiggenModus: BlijftLiggenModus;
  vandaag?: string;
}

export interface VerdeelUitkomst<T extends BordTaak> {
  kolommen: Array<BordKolom<T>>;
  blijftLiggen: Array<BlijftLiggenItem<T>>;
  /** Hoeveel taken er ná alle filters op het bord staan (kolommen + paneel). */
  zichtbaar: number;
}

/**
 * De hele bordverdeling in één keer: kolommen én het blijft-liggen-paneel,
 * zodat de "geen dubbeling"-regel op één plek staat en niet twee componenten
 * hoeft af te stemmen.
 */
export function verdeelOp<T extends BordTaak>({
  taken,
  ikId,
  personen,
  indeling,
  perspectief,
  statusChip,
  blijftLiggenModus,
  vandaag = vandaagISO(),
}: VerdeelInvoer<T>): VerdeelUitkomst<T> {
  const paneel =
    blijftLiggenModus === "uit" ? [] : blijftLiggen(taken, ikId, vandaag);

  // In kolom-modus krijgt de rode kolom de taak, en dan hoort hij nergens
  // anders meer te staan: twee kaartjes voor één taak betekent dat je hem op
  // de ene plek afvinkt en op de andere blijft zien.
  const uitKolommen = new Set(
    blijftLiggenModus === "kolom"
      ? paneel.map((item) => item.taak._id.toString())
      : []
  );

  const zichtbaar = taken.filter((taak) => {
    if (!inPerspectief(taak, ikId, perspectief)) return false;
    if (uitKolommen.has(taak._id.toString())) return false;
    // Klaar is geen dagwerk meer; alleen de Status-indeling toont het, als
    // bewijs van wat er af is (§B1/§B2).
    if (taak.status === "klaar" && indeling !== "status") return false;
    if (statusChip !== "alles" && taak.status !== statusChip) return false;
    return true;
  });

  const kolommen =
    indeling === "wanneer"
      ? kolommenWanneer(zichtbaar, vandaag)
      : indeling === "wie"
        ? kolommenWie(zichtbaar, personen, ikId, perspectief)
        : indeling === "status"
          ? kolommenStatus(zichtbaar)
          : kolommenKlant(zichtbaar);

  return { kolommen, blijftLiggen: paneel, zichtbaar: zichtbaar.length };
}

function kolommenWanneer<T extends BordTaak>(
  taken: T[],
  vandaag: string
): Array<BordKolom<T>> {
  return WANNEER_KOLOMMEN.map(({ key, titel, onder, merk }) => ({
    key,
    titel,
    onder,
    merk,
    sleepbaar: true,
    items: taken.filter((taak) => wanneerBucket(taak, vandaag) === key),
  }));
}

function kolommenWie<T extends BordTaak>(
  taken: T[],
  personen: ToewijsbaarPersoon[],
  ikId: Id<"users"> | undefined,
  perspectief: Perspectief
): Array<BordKolom<T>> {
  const gesorteerd = [...personen].sort((a, b) =>
    a.naam.localeCompare(b.naam, "nl")
  );

  let kolommen: Array<BordKolom<T>> = gesorteerd.map((persoon) => ({
    key: persoon._id.toString(),
    titel: gelijk(persoon._id, ikId) ? `${persoon.naam} (jij)` : persoon.naam,
    onder: persoon.isAdmin ? "kantoor" : "sleep hierheen om over te dragen",
    merk: persoon.initialen,
    sleepbaar: true,
    persoonId: persoon._id,
    // Een taak staat bij iedereen die er iets mee moet: de maker én de
    // checker. Anders verdwijnt werk uit beeld zodra iemand anders het maakt.
    items: taken.filter(
      (taak) =>
        gelijk(taak.makerId, persoon._id) || gelijk(taak.checkerId, persoon._id)
    ),
  }));

  // Buiten "Alles" is een lege kolom van een collega alleen maar ruis; je
  // eigen kolom blijft staan, want daar sleep je werk naartoe.
  if (perspectief !== "alles") {
    kolommen = kolommen.filter(
      (kolom) => kolom.items.length > 0 || gelijk(kolom.persoonId ?? undefined, ikId)
    );
  }

  kolommen.push({
    key: NIET_TOEGEWEZEN,
    titel: "Niet toegewezen",
    onder: "sleep hierheen om vrij te geven",
    merk: "?",
    sleepbaar: true,
    persoonId: null,
    items: taken.filter((taak) => !taak.makerId && !taak.checkerId),
  });

  return kolommen;
}

function kolommenStatus<T extends BordTaak>(taken: T[]): Array<BordKolom<T>> {
  return STATUS_VOLGORDE.map((status) => ({
    key: status,
    titel: STATUS_LABELS[status],
    onder: "sleep hierheen om de status te zetten",
    merk: STATUS_LABELS[status].slice(0, 2),
    sleepbaar: true,
    items: taken.filter((taak) => taak.status === status),
  }));
}

function kolommenKlant<T extends BordTaak>(taken: T[]): Array<BordKolom<T>> {
  const namen = [...new Set(taken.map((taak) => taak.klantNaam))].sort((a, b) =>
    a.localeCompare(b, "nl")
  );
  return namen.map((naam) => ({
    key: naam,
    titel: naam,
    onder: "klant",
    merk: naam.slice(0, 2).toUpperCase(),
    sleepbaar: false,
    items: taken.filter((taak) => taak.klantNaam === naam),
  }));
}
