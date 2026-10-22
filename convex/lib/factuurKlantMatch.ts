/**
 * Welke klant hoort bij deze factuur? — één pure regel voor de HERO-import
 * (fase 5) en een latere "nog te koppelen"-lijst.
 *
 * ## Waarom dit bestand er is
 *
 * Facturen die in de app ontstaan krijgen hun `klantId` van het project, de
 * offerte of het contract en kloppen (dev, okt 2026: 19 van 19). Facturen die
 * uit HERO komen hebben alleen een klantblok met tekst: naam, adres, e-mail,
 * soms een relatienummer of KvK. Die moeten aan een bestaande klant hangen
 * zonder dat iemand ze één voor één aanklikt — maar ook zonder gok, want een
 * factuur bij de verkeerde klant is erger dan een factuur zonder klant (zie
 * `facturen.listVoorKlant`).
 *
 * ## De regel
 *
 * Per kandidaat-klant (alleen uit dezelfde org) worden signalen verzameld en
 * komt er een niveau uit:
 *
 *   - **zeker** → mag automatisch gekoppeld worden:
 *       offerte/project wijst de klant aan · relatienummer gelijk en naam
 *       niet tegenstrijdig · KvK gelijk · btw-nummer gelijk · naam gelijk én
 *       postcode + huisnummer gelijk · naam gelijk én e-mail gelijk (dezelfde
 *       combinatie waarop `klanten.importKlanten` een bestaande klant herkent).
 *   - **waarschijnlijk** → voorstel, een mens bevestigt:
 *       relatienummer gelijk maar naam anders · adres gelijk en naam lijkt ·
 *       postcode gelijk en naam lijkt · e-mail gelijk · naam gelijk.
 *   - **geen** → lijst "nog te koppelen".
 *
 * Bewust NIET zeker:
 *   - e-mail zonder dezelfde naam — relaties delen mailboxen (`beheer@hetonvve.nl` staat
 *     bij twee VvE's; zie ook `klanten.importKlanten`);
 *   - adres alleen — in dev delen 11 paren klanten postcode + huisnummer
 *     (bedrijf en eigenaar op één adres, VvE en beheerder).
 *
 * Is meer dan één klant "zeker", dan zakt de uitkomst naar "waarschijnlijk"
 * met alle kandidaten: twee zekerheden die elkaar tegenspreken zijn er geen.
 *
 * Pure functie zonder database: de aanroeper haalt de klanten van de org op
 * (`by_org`) en schrijft zelf. `orgId` wordt hier nog een keer gecontroleerd
 * zodat een klant van een andere tenant nooit kandidaat kan zijn.
 */
import { vergelijkbareRelatienaam } from "../validators";

export type MatchNiveau = "zeker" | "waarschijnlijk" | "geen";

/** Het klantdeel van een factuur zoals een import of snapshot het levert. */
export interface FactuurKlantGegevens {
  orgId: string;
  naam: string;
  adres?: string;
  postcode?: string;
  email?: string;
  /** Relatie-/debiteurnummer uit het bronsysteem (HERO). */
  klantnummer?: string;
  kvkNummer?: string;
  btwNummer?: string;
  /** Klant van de gekoppelde offerte, als die er is. */
  offerteKlantId?: string;
  /** Klant van het gekoppelde project/werkitem, als die er is. */
  projectKlantId?: string;
}

/** De velden van `klanten` die de regel leest. */
export interface KlantKandidaat {
  _id: string;
  orgId: string;
  naam: string;
  adres?: string;
  postcode?: string;
  email?: string;
  klantnummer?: string;
  kvkNummer?: string;
  btwNummer?: string;
  isArchived?: boolean;
  gdprAnonymized?: boolean;
}

export interface KandidaatMatch {
  klantId: string;
  niveau: Exclude<MatchNiveau, "geen">;
  score: number;
  /** Nederlandse redenen voor in de bevestigingslijst. */
  redenen: string[];
}

export interface FactuurKlantMatch {
  niveau: MatchNiveau;
  /** Alleen gevuld bij "zeker": de klant om automatisch te koppelen. */
  klantId?: string;
  /** Gesorteerd op score, hoogste eerst; maximaal `MAX_KANDIDATEN`. */
  kandidaten: KandidaatMatch[];
  toelichting: string;
}

const MAX_KANDIDATEN = 5;

// ── Normalisatie ─────────────────────────────────────────────────────────

function leeg(waarde: string | undefined | null): boolean {
  return !waarde || waarde.trim() === "";
}

export function normaliseerPostcode(postcode: string | undefined): string {
  return (postcode ?? "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Huisnummer + letter uit een adresregel: "Dijk 24 A" → "24A",
 * "Hoofdstraat 12-3" → "12". Het eerste getal telt; straatnamen met een
 * getal erin ("Laan 1940-1945") zijn zeldzaam genoeg om te negeren.
 */
export function huisnummerUitAdres(adres: string | undefined): string {
  const treffer = (adres ?? "").match(/\b(\d+)\s*([a-zA-Z](?![a-zA-Z]))?/);
  if (!treffer) return "";
  return `${treffer[1]}${(treffer[2] ?? "").toUpperCase()}`;
}

/** "01003" en "1003" zijn hetzelfde relatienummer. */
function normaliseerKlantnummer(nummer: string | undefined): string {
  const kaal = (nummer ?? "").trim();
  return /^\d+$/.test(kaal) ? kaal.replace(/^0+(?=\d)/, "") : kaal.toUpperCase();
}

function normaliseerKvk(kvk: string | undefined): string {
  return (kvk ?? "").replace(/\D/g, "");
}

function normaliseerBtw(btw: string | undefined): string {
  return (btw ?? "").replace(/[\s.\-]/g, "").toUpperCase();
}

function normaliseerEmail(email: string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// ── Naamvergelijking ─────────────────────────────────────────────────────

const AANHEF = new Set([
  "dhr", "hr", "heer", "de heer", "mevr", "mw", "mevrouw", "fam", "familie",
  "mr", "mrs", "ms",
]);
const TUSSENVOEGSELS = new Set([
  "van", "der", "den", "de", "het", "ten", "ter", "te", "in", "op", "vd",
]);

function naamTokens(naam: string): string[] {
  return vergelijkbareRelatienaam(naam)
    .replace(/[.,/&()'"]/g, " ")
    .split(/\s+/)
    // Een "?" of "-" als naam is geen naam om op te matchen.
    .filter((t) => /[\p{L}\d]/u.test(t) && !AANHEF.has(t));
}

/** Tokens die een naam dragen: geen voorletters, geen tussenvoegsels. */
function dragendeTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t.length >= 3 && !TUSSENVOEGSELS.has(t));
}

function levenshtein(a: string, b: string): number {
  const vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = vorige[0];
    vorige[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const boven = vorige[j];
      vorige[j] = Math.min(
        vorige[j] + 1,
        vorige[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = boven;
    }
  }
  return vorige[b.length];
}

/**
 * - "gelijk": dezelfde naam, op volgorde, hoofdletters, rechtsvorm en
 *   aanhef na ("Janssen, Harrie" = "Harrie Janssen", "Frissen B.V." = "Frissen").
 * - "lijkt": één tikfout ("Meijer"/"Meijers") of de dragende delen van de
 *   kortste naam staan allemaal in de langste ("H. Janssen" ⊂ "Harrie Janssen").
 * - "anders": de rest.
 */
export function naamOvereenkomst(a: string, b: string): "gelijk" | "lijkt" | "anders" {
  const ta = naamTokens(a);
  const tb = naamTokens(b);
  if (ta.length === 0 || tb.length === 0) return "anders";

  const sa = [...ta].sort().join(" ");
  const sb = [...tb].sort().join(" ");
  if (sa === sb) return "gelijk";

  const vlakA = ta.join(" ");
  const vlakB = tb.join(" ");
  if (Math.min(vlakA.length, vlakB.length) >= 5 && levenshtein(vlakA, vlakB) <= 1) {
    return "lijkt";
  }

  const [kort, lang] =
    dragendeTokens(ta).length <= dragendeTokens(tb).length ? [ta, tb] : [tb, ta];
  const dragend = dragendeTokens(kort);
  if (dragend.length > 0 && dragend.every((t) => lang.includes(t))) return "lijkt";

  return "anders";
}

// ── De regel ─────────────────────────────────────────────────────────────

function beoordeel(
  factuur: FactuurKlantGegevens,
  klant: KlantKandidaat
): KandidaatMatch | null {
  const redenen: string[] = [];
  const naam = naamOvereenkomst(factuur.naam, klant.naam);

  const nummer =
    !leeg(factuur.klantnummer) &&
    normaliseerKlantnummer(factuur.klantnummer) === normaliseerKlantnummer(klant.klantnummer);
  const kvk =
    normaliseerKvk(factuur.kvkNummer).length === 8 &&
    normaliseerKvk(factuur.kvkNummer) === normaliseerKvk(klant.kvkNummer);
  const btw =
    !leeg(factuur.btwNummer) &&
    normaliseerBtw(factuur.btwNummer) === normaliseerBtw(klant.btwNummer);
  const postcode =
    normaliseerPostcode(factuur.postcode) !== "" &&
    normaliseerPostcode(factuur.postcode) === normaliseerPostcode(klant.postcode);
  const huisnummer = huisnummerUitAdres(factuur.adres);
  const adres = postcode && huisnummer !== "" && huisnummer === huisnummerUitAdres(klant.adres);
  const email =
    !leeg(factuur.email) && normaliseerEmail(factuur.email) === normaliseerEmail(klant.email);

  if (nummer) redenen.push("relatienummer gelijk");
  if (kvk) redenen.push("KvK-nummer gelijk");
  if (btw) redenen.push("btw-nummer gelijk");
  if (adres) redenen.push("postcode en huisnummer gelijk");
  else if (postcode) redenen.push("postcode gelijk");
  if (email) redenen.push("e-mailadres gelijk");
  if (naam === "gelijk") redenen.push("naam gelijk");
  else if (naam === "lijkt") redenen.push("naam lijkt");
  else if (redenen.length > 0) redenen.push("naam wijkt af");

  const score =
    (nummer ? 50 : 0) +
    (kvk ? 50 : 0) +
    (btw ? 50 : 0) +
    (adres ? 30 : postcode ? 10 : 0) +
    (email ? 15 : 0) +
    (naam === "gelijk" ? 25 : naam === "lijkt" ? 12 : 0) -
    (klant.isArchived ? 5 : 0);

  const zeker =
    (nummer && naam !== "anders") ||
    kvk ||
    btw ||
    (adres && naam === "gelijk") ||
    (email && naam === "gelijk");
  const waarschijnlijk =
    nummer ||
    (adres && naam !== "anders") ||
    (postcode && naam !== "anders") ||
    email ||
    naam === "gelijk";

  if (!zeker && !waarschijnlijk) return null;
  return {
    klantId: klant._id,
    niveau: zeker ? "zeker" : "waarschijnlijk",
    score,
    redenen,
  };
}

export function matchFactuurKlant(
  factuur: FactuurKlantGegevens,
  klanten: readonly KlantKandidaat[]
): FactuurKlantMatch {
  const vanOrg = klanten.filter(
    (k) => k.orgId === factuur.orgId && k.gdprAnonymized !== true
  );
  const bestaat = (id: string | undefined) =>
    id !== undefined && vanOrg.some((k) => k._id === id);

  // 1. De keten wint: offerte/project wijst de klant direct aan.
  const offerte = bestaat(factuur.offerteKlantId) ? factuur.offerteKlantId : undefined;
  const project = bestaat(factuur.projectKlantId) ? factuur.projectKlantId : undefined;
  if (offerte && project && offerte !== project) {
    return {
      niveau: "waarschijnlijk",
      kandidaten: [
        { klantId: offerte, niveau: "waarschijnlijk", score: 100, redenen: ["klant van de offerte"] },
        { klantId: project, niveau: "waarschijnlijk", score: 100, redenen: ["klant van het project"] },
      ],
      toelichting: "Offerte en project wijzen naar verschillende klanten.",
    };
  }
  const viaKeten = offerte ?? project;
  if (viaKeten) {
    return {
      niveau: "zeker",
      klantId: viaKeten,
      kandidaten: [
        {
          klantId: viaKeten,
          niveau: "zeker",
          score: 100,
          redenen: [offerte ? "klant van de offerte" : "klant van het project"],
        },
      ],
      toelichting: offerte ? "Gekoppeld via de offerte." : "Gekoppeld via het project.",
    };
  }

  // 2. Signalen per klant.
  const kandidaten = vanOrg
    .map((k) => beoordeel(factuur, k))
    .filter((m): m is KandidaatMatch => m !== null)
    .sort((a, b) => b.score - a.score);

  const zeker = kandidaten.filter((k) => k.niveau === "zeker");
  if (zeker.length === 1) {
    return {
      niveau: "zeker",
      klantId: zeker[0].klantId,
      kandidaten: kandidaten.slice(0, MAX_KANDIDATEN),
      toelichting: `Zeker: ${zeker[0].redenen.join(", ")}.`,
    };
  }
  if (zeker.length > 1) {
    return {
      niveau: "waarschijnlijk",
      // Elkaar tegensprekende zekerheden: geen kandidaat is meer zeker.
      kandidaten: kandidaten
        .slice(0, MAX_KANDIDATEN)
        .map((k) => ({ ...k, niveau: "waarschijnlijk" as const })),
      toelichting: `${zeker.length} klanten passen even goed; kies er één.`,
    };
  }
  if (kandidaten.length > 0) {
    return {
      niveau: "waarschijnlijk",
      kandidaten: kandidaten.slice(0, MAX_KANDIDATEN),
      toelichting:
        kandidaten.length === 1
          ? `Voorstel: ${kandidaten[0].redenen.join(", ")}.`
          : `${kandidaten.length} mogelijke klanten; bevestig de juiste.`,
    };
  }
  return { niveau: "geen", kandidaten: [], toelichting: "Geen passende klant gevonden." };
}
