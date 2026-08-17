/**
 * Het datacontract van de Controlekamer — lokale spiegel.
 *
 * Bron: `docs/design/plannen/uren-controlekamer-plan.md` §2. Dat contract staat
 * vast; WS-A bouwt `convex/urenControle.ts` er onafhankelijk tegenaan. Zolang
 * die functies er niet zijn, en zolang `convex/_generated/api.d.ts` de module
 * niet kent, is dit bestand de waarheid voor de UI.
 *
 * **Zodra WS-A live is** verandert er precies één ding: `controle-api.ts` pakt
 * de echte functiereferenties uit `api.urenControle` (dat doet hij nu al zodra
 * ze bestaan) en deze types mogen één voor één vervangen worden door
 * `FunctionReturnType<typeof api.urenControle.getControleWeek>`. De
 * componenten hoeven daar niets van te merken: ze typen op de interfaces
 * hieronder, niet op de query.
 *
 * Id's staan hier als `string` en niet als `Id<"medewerkers">`. Dat is bewust:
 * de UI geeft ze alleen door en een `Id` is aan de clientkant toch een string
 * met een merk eromheen. Zo blijft dit bestand leesbaar zonder de generated
 * dataModel-typen erbij te slepen.
 */

// ── Segmenten ───────────────────────────────────────────────────────────────

/** De zeven categorieën uit `convex/urenSegmenten.ts` (segmentCategorieValidator). */
export type SegmentCategorie =
  | "werken"
  | "pauze"
  | "reistijd"
  | "teammeeting"
  | "onderhoud_materiaal"
  | "afvalverwerker_bes"
  | "anders";

export interface DagSegment {
  beginTijd: string;
  eindTijd: string;
  categorie: SegmentCategorie;
  /** Klus, klant of toelichting — wat er in de balk-tooltip achter de tijd komt. */
  label?: string | null;
}

/** Nederlandse namen van de categorieën. Kleur is nooit de enige drager. */
export const CATEGORIE_LABEL: Record<SegmentCategorie, string> = {
  werken: "werken",
  pauze: "pauze",
  reistijd: "reistijd",
  teammeeting: "teammeeting",
  onderhoud_materiaal: "onderhoud materiaal",
  afvalverwerker_bes: "afvalverwerker (BES)",
  anders: "anders",
};

/**
 * De vijf kleurfamilies van de dagbalk. Zeven categorieën, vijf families: alles
 * wat geen werken, reizen of pauze is, is indirecte tijd — en het gat is geen
 * categorie maar de afwezigheid van een registratie.
 */
export type DagbalkFamilie =
  | "werken"
  | "reistijd"
  | "pauze"
  | "indirect"
  | "gat";

export function familieVanCategorie(
  categorie: SegmentCategorie
): Exclude<DagbalkFamilie, "gat"> {
  switch (categorie) {
    case "werken":
      return "werken";
    case "reistijd":
      return "reistijd";
    case "pauze":
      return "pauze";
    default:
      return "indirect";
  }
}

/** Legenda-regel: de familie, haar naam en welke categorieën eronder vallen. */
export const FAMILIE_LABEL: Record<DagbalkFamilie, string> = {
  werken: "werken",
  reistijd: "reistijd",
  pauze: "pauze",
  indirect: "loods / indirect",
  gat: "gat in de dag",
};

// ── Dagen ───────────────────────────────────────────────────────────────────

export interface DagSamenvatting {
  medewerkerId: string;
  naam: string;
  /** YYYY-MM-DD. */
  datum: string;
  totaalUren: number;
  status: "open" | "ingediend";
  segmenten: DagSegment[];
}

export type AfwijkingsReden =
  | { type: "lange_dag"; uren: number }
  | { type: "geen_pauze"; uren: number }
  | { type: "zonder_werkitem" }
  | { type: "gat"; vanTijd: string; totTijd: string; minuten: number }
  | { type: "handmatig_ipv_voorstel" }
  | { type: "heropend" };

export interface DagKaart extends DagSamenvatting {
  /** Altijd ≥1 — een dag zonder reden hoort in `stil`, niet in `afwijkend`. */
  redenen: AfwijkingsReden[];
}

export interface AchterloperRegel {
  medewerkerId: string;
  naam: string;
  ploegLabel: string | null;
  /** YYYY-MM-DD's zonder ingediende dag. */
  ontbrekendeDagen: string[];
}

/** Eén cel van de weekstaat; `afwijkend` = ingediend mét open redenen. */
export interface WeekstaatCel {
  datum: string;
  uren: number;
  status: "leeg" | "open" | "ingediend" | "afwijkend";
}

/**
 * Het volledige medewerkers × dagen-overzicht (aanvulling Ricardo 17 aug):
 * alle actieve medewerkers, ook met een lege week, gegroepeerd per ploeg.
 */
export interface WeekstaatRij {
  medewerkerId: string;
  naam: string;
  ploegLabel: string | null;
  dagen: WeekstaatCel[];
  totaalUren: number;
}

export interface ControleWeek {
  /** Maandag, YYYY-MM-DD. */
  weekStart: string;
  /** "Week 33 · 10 t/m 16 augustus". */
  weekLabel: string;
  achter: AchterloperRegel[];
  /** Gesorteerd: oudste eerst. */
  afwijkend: DagKaart[];
  /** Ingediend, geen afwijking, nog niet gekweten. */
  stil: DagSamenvatting[];
  /** Al akkoord bevonden binnen dit venster. */
  gekweten: number;
  weekstaat: WeekstaatRij[];
  totalen: {
    uren: number;
    indirect: number;
    ingediend: number;
    open: number;
  };
}

// ── Afwijkingen in het Nederlands ───────────────────────────────────────────

/**
 * Eén reden = één zin. Pure functie, zodat de formulering te testen is zonder
 * de kaart te renderen — precies zoals `dagstaatClausules` op het dashboard.
 *
 * De toon is neutraal en beschrijvend: dit is een werklijst, geen schandpaal
 * (onderzoek §6, "geen strafbank-esthetiek"). Nergens "fout", nergens "te".
 */
export function afwijkingsZin(reden: AfwijkingsReden): string {
  switch (reden.type) {
    case "lange_dag":
      return `${uur(reden.uren)} werken op één dag`;
    case "geen_pauze":
      return `${uur(reden.uren)} aan één stuk, geen pauze geregistreerd`;
    case "zonder_werkitem":
      return "Een segment werken hangt niet aan een klus";
    case "gat":
      return `Gat van ${uur(reden.minuten / 60)} tussen ${reden.vanTijd} en ${reden.totTijd}`;
    case "handmatig_ipv_voorstel":
      return "Handmatig ingevoerd terwijl er een voorstel klaarstond";
    case "heropend":
      return "Deze dag is eerder heropend";
  }
}

/** "10,8 uur" — Nederlandse komma, altijd één decimaal. */
function uur(waarde: number): string {
  return `${waarde.toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} uur`;
}

// ── Tijdrekenen ─────────────────────────────────────────────────────────────

/** "07:15" → 435. Ongeldige invoer geeft null in plaats van NaN. */
export function minutenVanTijd(tijd: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(tijd);
  if (!match) return null;
  const uren = Number(match[1]);
  const minuten = Number(match[2]);
  if (uren > 24 || minuten > 59) return null;
  return uren * 60 + minuten;
}

/** 435 → "07:15". Klemt op 00:00–24:00. */
export function tijdVanMinuten(minuten: number): string {
  const geklemd = Math.max(0, Math.min(24 * 60, Math.round(minuten)));
  const u = Math.floor(geklemd / 60);
  const m = geklemd % 60;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
