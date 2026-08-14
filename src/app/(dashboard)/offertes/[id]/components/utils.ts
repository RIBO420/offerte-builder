export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

// Gelijk gehouden met de centrale labelmaps (o.a.
// src/components/analytics/scope-profitability-chart.tsx) — labelmap-drift
// liet hier de rauwe key `water_elektra` op het offertedetail lekken.
export const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  parkeerplaats: "Parkeerplaats",
  beregening: "Beregening",
  borders: "Borders",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Grasonderhoud",
  borders_onderhoud: "Borders Onderhoud",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  gras: "Gras",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

export const bereikbaarheidLabels: Record<string, string> = {
  goed: "Goed",
  beperkt: "Beperkt",
  slecht: "Slecht",
};
