/**
 * Mensentaal voor /rapportages (masterplan R3).
 *
 * `convex/rapportage.ts` levert bewust rúwe sleutels: `water_elektra`,
 * `1_30_dagen`, `voorcalculatie`. Zou de server ze al vertalen, dan stonden er
 * twee vertaaltabellen in de codebase en dreef er onvermijdelijk één weg — dat
 * is precies hoe "borders, Bestrating, gras, water_elektra" ooit met wisselende
 * kapitalisatie op één as belandde (rapportage-schouw §Overzicht).
 *
 * Alles hier is puur: geen React, geen Convex. De unit-tests bewaken vooral de
 * randen — een onbekende sleutel mag nooit rauw in beeld komen, en een
 * ontbrekende vergelijking mag nooit "+100%" worden.
 */

// ── Scopes ───────────────────────────────────────────────────────────────

/**
 * Aanleg- en onderhoudsscopes. Gelijk gehouden met de labelmaps in
 * `instellingen/components/constants.ts` en `offertes/[id]/components/utils.ts`;
 * die twee dekken elk hun eigen scherm, deze dekt de rapportage.
 */
export const SCOPE_LABELS: Record<string, string> = {
  // Aanleg
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  parkeerplaats: "Parkeerplaats",
  beregening: "Beregening",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & elektra",
  specials: "Specials",
  // Onderhoud
  gras_onderhoud: "Grasonderhoud",
  borders_onderhoud: "Borderonderhoud",
  heggen_onderhoud: "Heggenonderhoud",
  bomen_onderhoud: "Bomenonderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  reiniging: "Reiniging",
  bemesting: "Bemesting",
  snoeien: "Snoeiwerk",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  // Kostensoorten die als "scope" in een nacalculatie kunnen staan
  arbeid: "Arbeid",
  materiaal: "Materiaal",
  machine: "Machines",
  overig: "Overig",
};

/**
 * Laatste redmiddel voor een sleutel die niemand heeft voorzien: onderstrepen
 * worden spaties en de eerste letter een hoofdletter. Beter een nette
 * "Nieuwe scope" dan `nieuwe_scope` op een as.
 */
export function menselijkeSleutel(sleutel: string): string {
  const schoon = sleutel.replace(/[_-]+/g, " ").trim();
  if (!schoon) return "Onbekend";
  return schoon.charAt(0).toUpperCase() + schoon.slice(1);
}

export function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope] ?? menselijkeSleutel(scope);
}

// ── Offertestatussen ─────────────────────────────────────────────────────

export const OFFERTE_STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  // Legacy-status; telt in de cijferlaag als voorcalculatie mee.
  definitief: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Getekend",
  afgewezen: "Afgewezen",
};

export function offerteStatusLabel(status: string): string {
  return OFFERTE_STATUS_LABELS[status] ?? menselijkeSleutel(status);
}

/** Naar welke filterwaarde op /offertes een status doorklikt. */
export function offerteStatusFilter(status: string): string {
  return status === "definitief" ? "voorcalculatie" : status;
}

// ── Ouderdomsbuckets (openstaande facturen) ──────────────────────────────

export const OUDERDOM_LABELS: Record<string, string> = {
  nog_niet_vervallen: "Nog niet vervallen",
  "1_30_dagen": "1 tot 30 dagen te laat",
  "31_60_dagen": "31 tot 60 dagen te laat",
  ouder_dan_60_dagen: "Langer dan 60 dagen te laat",
};

/** Korte variant voor een as- of legenda-label. */
export const OUDERDOM_LABELS_KORT: Record<string, string> = {
  nog_niet_vervallen: "Op tijd",
  "1_30_dagen": "1–30 dagen",
  "31_60_dagen": "31–60 dagen",
  ouder_dan_60_dagen: "60+ dagen",
};

export function ouderdomLabel(bucket: string): string {
  return OUDERDOM_LABELS[bucket] ?? menselijkeSleutel(bucket);
}

export function ouderdomLabelKort(bucket: string): string {
  return OUDERDOM_LABELS_KORT[bucket] ?? menselijkeSleutel(bucket);
}

/**
 * Vraagt deze bucket aandacht? Alleen dán mag terracotta in beeld komen (R4).
 * "Nog niet vervallen" is gewoon lopend werk en blijft dus groen — elke andere
 * bucket staat per definitie over de vervaldatum heen.
 */
export function ouderdomVraagtAandacht(bucket: string): boolean {
  return bucket !== "nog_niet_vervallen";
}

// ── Periodepresets ───────────────────────────────────────────────────────

/**
 * Exact de presets die `convex/lib/rapportagePeriode.ts` kent — geen enkele
 * meer (R5). De oude kiezer bood elf opties die de client op vier terugmapte;
 * "Vorig jaar" toonde daardoor bewijsbaar dezelfde cijfers als "Dit jaar".
 */
export const PERIODE_PRESET_LABELS = {
  "deze-maand": "Deze maand",
  "vorige-maand": "Vorige maand",
  "dit-kwartaal": "Dit kwartaal",
  "vorig-kwartaal": "Vorig kwartaal",
  "dit-jaar": "Dit jaar",
  "vorig-jaar": "Vorig jaar",
  "dit-seizoen": "Dit seizoen",
  voorjaar: "Voorjaar",
  zomer: "Zomer",
  najaar: "Najaar",
  winter: "Winter",
  alles: "Alle tijd",
  aangepast: "Aangepaste periode",
} as const;

export type PeriodePreset = keyof typeof PERIODE_PRESET_LABELS;

export const PERIODE_PRESETS = Object.keys(
  PERIODE_PRESET_LABELS
) as PeriodePreset[];

export function isPeriodePreset(waarde: string | null): waarde is PeriodePreset {
  return waarde !== null && waarde in PERIODE_PRESET_LABELS;
}

export function periodePresetLabel(preset: PeriodePreset): string {
  return PERIODE_PRESET_LABELS[preset];
}

/**
 * De kiezer in drie groepen. Seizoenen staan apart omdat een hovenier daar
 * in denkt: een natte mei vergelijk je met vorig voorjaar, niet met april.
 */
export const PERIODE_GROEPEN: ReadonlyArray<{
  kop: string;
  presets: readonly PeriodePreset[];
}> = [
  {
    kop: "Lopend",
    presets: ["deze-maand", "dit-kwartaal", "dit-jaar", "dit-seizoen"],
  },
  {
    kop: "Afgesloten",
    presets: ["vorige-maand", "vorig-kwartaal", "vorig-jaar"],
  },
  {
    kop: "Seizoen",
    presets: ["voorjaar", "zomer", "najaar", "winter"],
  },
];

// ── Verschillen ──────────────────────────────────────────────────────────

export type VerschilToon = "vooruit" | "achteruit" | "gelijk" | "geen-basis";

export interface VerschilTekst {
  toon: VerschilToon;
  /** Klaar om te tonen: "12,4% meer" of "geen gegevens over die periode". */
  tekst: string;
  /** Alleen gevuld als er écht een percentage is. */
  percentage: number | null;
}

/**
 * Vertaal een `verschil`-veld uit de payload naar één zinsdeel.
 *
 * `null` betekent: er was geen basis om mee te vergelijken (de vorige periode
 * was leeg, of ligt vóór de eerste rij in de database). Dat is precies het
 * geval waarin de oude pagina "+100%" toonde. Hier wordt het een zin die zegt
 * wat er aan de hand is — de demodata heeft nog geen jaarhistorie, dus dit is
 * op dit moment de normále uitkomst voor "vorig jaar".
 */
export function verschilTekst(
  verschil: number | null | undefined
): VerschilTekst {
  if (verschil === null || verschil === undefined || Number.isNaN(verschil)) {
    return {
      toon: "geen-basis",
      tekst: "geen gegevens over die periode",
      percentage: null,
    };
  }
  if (Math.abs(verschil) < 0.05) {
    return { toon: "gelijk", tekst: "vrijwel gelijk", percentage: 0 };
  }
  const absoluut = formatPercentage(Math.abs(verschil));
  return verschil > 0
    ? { toon: "vooruit", tekst: `${absoluut} meer`, percentage: verschil }
    : { toon: "achteruit", tekst: `${absoluut} minder`, percentage: verschil };
}

/** Percentage in Nederlandse notatie, zonder overbodige decimaal. */
export function formatPercentage(waarde: number, decimalen = 1): string {
  const afgerond =
    Math.abs(waarde) >= 100 || Number.isInteger(waarde)
      ? Math.round(waarde)
      : Number(waarde.toFixed(decimalen));
  return `${afgerond.toLocaleString("nl-NL", {
    maximumFractionDigits: decimalen,
  })}%`;
}

// ── Tellingen in taal ────────────────────────────────────────────────────

/** "1 offerte" / "7 offertes" — zonder deze helper staat er "1 offertes". */
export function telwoord(
  aantal: number,
  enkelvoud: string,
  meervoud: string
): string {
  return `${aantal.toLocaleString("nl-NL")} ${aantal === 1 ? enkelvoud : meervoud}`;
}

export function dagenTekst(dagen: number): string {
  return telwoord(Math.round(dagen), "dag", "dagen");
}

/** "vandaag verstuurd" / "3 dagen stil" — leest als een mens, niet als een cel. */
export function stilTekst(dagenStil: number): string {
  if (dagenStil <= 0) return "vandaag";
  return `${dagenTekst(dagenStil)} stil`;
}

// ── Uren ─────────────────────────────────────────────────────────────────

export function urenTekst(uren: number): string {
  const afgerond = Math.round(uren * 10) / 10;
  return `${afgerond.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} uur`;
}
