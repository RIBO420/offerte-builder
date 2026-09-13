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
  const adres = tekst(lead.klantAdres);
  const huisnummer = tekst(lead.klantHuisnummer);
  // Het websiteformulier levert het huisnummer soms al in het adresveld mee
  // ("Prins Bernhardstraat 64" + huisnummer "64"): dan niet nog eens plakken.
  const straat = [
    adres,
    huisnummer && !(adres && adres.toLowerCase().endsWith(` ${huisnummer.toLowerCase()}`))
      ? huisnummer
      : null,
  ]
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
      ].filter((r): r is string => r !== null);
    case "verticuteren":
      return [
        regel("Oppervlakte", s.oppervlakte != null ? `${s.oppervlakte} m²` : null),
        regel("Conditie gazon", s.conditie),
        s.bijzaaien != null ? `Bijzaaien: ${JA_NEE(s.bijzaaien)}` : null,
        s.topdressing != null ? `Topdressing: ${JA_NEE(s.topdressing)}` : null,
        s.bemesting != null ? `Bemesting: ${JA_NEE(s.bemesting)}` : null,
        regel("Gewenste datum", s.gewensteDatum),
      ].filter((r): r is string => r !== null);
    default:
      return [];
  }
}

/** Label + inhoud van de vrije tekst van de aanvraag (bericht of opmerkingen). */
export const VRIJE_TEKST_LABELS = ["Bericht", "Opmerkingen"] as const;

function vrijeTekst(
  lead: LeadVoorAanvraagTekst
): { label: (typeof VRIJE_TEKST_LABELS)[number]; inhoud: string } | null {
  const s = lead.specificaties ?? {};
  const bericht = tekst(s.bericht);
  if (bericht) return { label: "Bericht", inhoud: bericht };
  const opmerkingen = tekst(s.opmerkingen);
  if (opmerkingen) return { label: "Opmerkingen", inhoud: opmerkingen };
  return null;
}

/**
 * De lead-omschrijving is bij websiteleads afgeleid van het bericht
 * ("[Tuinonderhoud] Beste, …"). Dan is hij dubbel en blijft hij weg; alleen
 * een omschrijving die iets anders zegt dan de vrije tekst wordt getoond.
 */
function eigenOmschrijving(
  lead: LeadVoorAanvraagTekst,
  vrij: { inhoud: string } | null
): string | null {
  const omschrijving = tekst(lead.omschrijving);
  if (!omschrijving) return null;
  if (!vrij) return omschrijving;
  const kaal = (t: string) => t.replace(/^\[[^\]]*\]\s*/, "").trim().toLowerCase();
  const a = kaal(omschrijving);
  const b = kaal(vrij.inhoud);
  if (a.length === 0 || a.includes(b) || b.includes(a)) return null;
  return omschrijving;
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
  const vrij = vrijeTekst(lead);
  const omschrijving = eigenOmschrijving(lead, vrij);
  if (omschrijving) regels.push(omschrijving);
  regels.push(...specificatieRegels(lead));

  const adres = aanvraagAdres(lead);
  if (adres) regels.push(`Adres aanvraag: ${adres}`);

  if (typeof lead.indicatiePrijs === "number" && lead.indicatiePrijs > 0) {
    regels.push(`Indicatieprijs: ${euro(lead.indicatiePrijs)}`);
  }

  // De vrije tekst staat als laatste: alles ná "Bericht:" hoort bij het
  // bericht, ook regels met een dubbele punt erin (parseAanvraagTekst).
  // Foto's staan niet in de tekst; die reizen als bijlagen op het event.
  if (vrij) regels.push(`${vrij.label}: ${vrij.inhoud}`);

  const volledig = regels.join("\n");
  if (volledig.length <= AANVRAAG_TEKST_MAX) return volledig;
  return `${volledig.slice(0, AANVRAAG_TEKST_MAX - 1).trimEnd()}…`;
}

export type AanvraagOnderdelen = {
  /** Eerste regel: "Aanvraag via … (referentie)". */
  kop: string;
  /** Vrije tekst van de klant (bericht/opmerkingen), zonder label. */
  bericht: string | null;
  /** "Label: waarde"-regels in volgorde van de tekst. */
  kenmerken: { label: string; waarde: string }[];
  /** Regels zonder label vóór het bericht (bijv. een eigen omschrijving). */
  overig: string[];
};

const KENMERK_REGEL = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,30}): (.+)$/;

/**
 * Splitst een opgeslagen aanvraagtekst weer in onderdelen zodat de tijdlijn
 * hem gestructureerd kan tonen. Verwacht de vorm van aanvraagTekst (bericht
 * als laatste); oudere events worden met de migratie `vernieuwTekst`
 * herschreven naar deze vorm.
 */
export function parseAanvraagTekst(tekstInhoud: string): AanvraagOnderdelen {
  const regels = tekstInhoud.split("\n");
  const kop = regels[0]?.trim() ?? "";
  const kenmerken: AanvraagOnderdelen["kenmerken"] = [];
  const overig: string[] = [];
  let bericht: string[] | null = null;
  for (const rauw of regels.slice(1)) {
    const r = rauw.trimEnd();
    if (bericht) {
      // Alles ná "Bericht:" is bericht — ook regels met een dubbele punt.
      bericht.push(r);
      continue;
    }
    if (r.trim().length === 0) continue;
    const m = KENMERK_REGEL.exec(r);
    if (m && (VRIJE_TEKST_LABELS as readonly string[]).includes(m[1])) {
      bericht = [m[2]];
      continue;
    }
    if (m) {
      kenmerken.push({ label: m[1], waarde: m[2] });
      continue;
    }
    if (/^\d+ foto('s)? bijgevoegd$/.test(r.trim())) continue;
    overig.push(r.trim());
  }
  return {
    kop,
    bericht: bericht ? bericht.join("\n").trim() || null : null,
    kenmerken,
    overig,
  };
}
