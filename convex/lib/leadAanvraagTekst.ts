/**
 * Pure tekstopbouw voor de tijdlijnregel "Aanvraag via …" in het klantdossier.
 *
 * Bij de overgang van lead naar klant (promoveerLead, koppelKlant,
 * maakKlantUitLead) gaat de oorspronkelijke aanvraag als één leesbare
 * tijdlijn-entry mee, gedateerd op het moment van de aanvraag. Deze helper
 * bepaalt alleen de tekst; foto's reizen als `bijlagen` op het event en als
 * verwijzingsrijen in klantBestanden (zie leadsKlantenHelpers.ts).
 *
 * Geen Convex-imports: importeerbaar door web én backend, testbaar zonder ctx.
 */

export const LEAD_BRON_LABELS: Record<string, string> = {
  configurator_gazon: "configurator (gazon)",
  configurator_boomschors: "configurator (boomschors)",
  configurator_verticuteren: "configurator (verticuteren)",
  website_contact: "website contactformulier",
  handmatig: "handmatige invoer",
  telefoon: "telefoon",
  email: "e-mail",
  doorverwijzing: "doorverwijzing",
};

/** Hoogstens zoveel tekens in één tijdlijnregel; het bericht wordt afgekapt. */
export const AANVRAAG_TEKST_MAX = 2000;

type Specificaties = Record<string, unknown>;

/** Minimale structurele vorm van een lead — géén Doc-import nodig. */
export type LeadVoorAanvraagTekst = {
  type: string;
  bron?: string;
  referentie: string;
  specificaties: Specificaties;
  klantAdres?: string;
  klantHuisnummer?: string;
  klantPostcode?: string;
  klantPlaats?: string;
  omschrijving?: string;
  indicatiePrijs?: number;
  fotoIds?: readonly unknown[];
};

const JA_NEE = (waarde: unknown) => (waarde ? "ja" : "nee");

function tekst(waarde: unknown): string | null {
  if (typeof waarde === "string") {
    const schoon = waarde.trim();
    return schoon.length > 0 ? schoon : null;
  }
  if (typeof waarde === "number" && Number.isFinite(waarde)) return String(waarde);
  return null;
}

function regel(label: string, waarde: unknown): string | null {
  const w = tekst(waarde);
  return w ? `${label}: ${w}` : null;
}

function euro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  })
    .format(bedrag)
    // Intl zet een vaste spatie tussen € en het bedrag; een gewone spatie leest
    // en zoekt beter in een tijdlijnregel.
    .replace(/\u00a0/g, " ");
}

function aanvraagAdres(lead: LeadVoorAanvraagTekst): string | null {
  const straat = [tekst(lead.klantAdres), tekst(lead.klantHuisnummer)]
    .filter(Boolean)
    .join(" ");
  const plaats = [tekst(lead.klantPostcode), tekst(lead.klantPlaats)]
    .filter(Boolean)
    .join(" ");
  const delen = [straat, plaats].filter((d) => d.length > 0);
  return delen.length > 0 ? delen.join(", ") : null;
}

function specificatieRegels(lead: LeadVoorAanvraagTekst): string[] {
  const s = lead.specificaties ?? {};
  switch (lead.type) {
    case "contact":
      return [
        regel("Onderwerp", s.onderwerp),
        regel("Bericht", s.bericht),
        regel("Tuinoppervlak", s.tuinoppervlak),
        regel("Ontwerp aanwezig", s.heeftOntwerp),
        regel("Onderhoudsfrequentie", s.onderhoudFrequentie),
        Array.isArray(s.reinigingOpties) && s.reinigingOpties.length > 0
          ? `Reinigingsopties: ${s.reinigingOpties.join(", ")}`
          : null,
        regel("Gevonden via", s.hoeGevonden),
      ].filter((r): r is string => r !== null);
    case "gazon":
      return [
        regel("Oppervlakte", s.oppervlakte != null ? `${s.oppervlakte} m²` : null),
        regel("Type gras", s.typeGras),
        regel("Ondergrond", s.ondergrond),
        s.drainage != null ? `Drainage: ${JA_NEE(s.drainage)}` : null,
        s.opsluitbanden
          ? `Opsluitbanden: ja${
              typeof s.opsluitbandenMeters === "number" && s.opsluitbandenMeters > 0
                ? ` (${s.opsluitbandenMeters} m)`
                : ""
            }`
          : null,
        regel("Gewenste startdatum", s.gewensteStartdatum),
      ].filter((r): r is string => r !== null);
    case "boomschors":
      return [
        regel("Soort", s.boomschorsType),
        regel("Oppervlakte", s.oppervlakte != null ? `${s.oppervlakte} m²` : null),
        regel("Laagdikte", s.laagDikte),
        regel("Benodigd", s.m3Nodig != null ? `${s.m3Nodig} m³` : null),
        s.bezorging != null ? `Bezorging: ${JA_NEE(s.bezorging)}` : null,
        regel("Leverdatum", s.leveringsDatum),
        regel("Opmerkingen", s.opmerkingen),
      ].filter((r): r is string => r !== null);
    case "verticuteren":
      return [
        regel("Oppervlakte", s.oppervlakte != null ? `${s.oppervlakte} m²` : null),
        regel("Conditie gazon", s.conditie),
        s.bijzaaien != null ? `Bijzaaien: ${JA_NEE(s.bijzaaien)}` : null,
        s.topdressing != null ? `Topdressing: ${JA_NEE(s.topdressing)}` : null,
        s.bemesting != null ? `Bemesting: ${JA_NEE(s.bemesting)}` : null,
        regel("Gewenste datum", s.gewensteDatum),
        regel("Opmerkingen", s.opmerkingen),
      ].filter((r): r is string => r !== null);
    default:
      return [];
  }
}

/**
 * Meerregelige Nederlandse samenvatting van de aanvraag. Lege velden worden
 * overgeslagen; het geheel wordt afgekapt op AANVRAAG_TEKST_MAX tekens.
 */
export function aanvraagTekst(lead: LeadVoorAanvraagTekst): string {
  const bronLabel = lead.bron ? LEAD_BRON_LABELS[lead.bron] ?? lead.bron : null;
  const kop = bronLabel
    ? `Aanvraag via ${bronLabel} (${lead.referentie})`
    : `Aanvraag ${lead.referentie}`;

  const regels: string[] = [kop];
  const omschrijving = tekst(lead.omschrijving);
  if (omschrijving) regels.push(omschrijving);
  regels.push(...specificatieRegels(lead));

  const adres = aanvraagAdres(lead);
  if (adres) regels.push(`Adres aanvraag: ${adres}`);

  if (typeof lead.indicatiePrijs === "number" && lead.indicatiePrijs > 0) {
    regels.push(`Indicatieprijs: ${euro(lead.indicatiePrijs)}`);
  }

  const aantalFotos = lead.fotoIds?.length ?? 0;
  if (aantalFotos > 0) {
    regels.push(`${aantalFotos} foto${aantalFotos === 1 ? "" : "'s"} bijgevoegd`);
  }

  const volledig = regels.join("\n");
  if (volledig.length <= AANVRAAG_TEKST_MAX) return volledig;
  return `${volledig.slice(0, AANVRAAG_TEKST_MAX - 1).trimEnd()}…`;
}
