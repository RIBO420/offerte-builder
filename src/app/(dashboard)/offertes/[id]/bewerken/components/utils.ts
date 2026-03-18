import type { Regel, Totals } from "./types";

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

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return formatTime(timestamp);
  }
  return `${date.getDate()}/${date.getMonth() + 1} ${formatTime(timestamp)}`;
}

export function calculateTotals(
  regelsList: Regel[],
  instellingen?: {
    standaardMargePercentage?: number;
    btwPercentage?: number;
  }
): Totals {
  let materiaalkosten = 0;
  let arbeidskosten = 0;
  let totaalUren = 0;

  for (const regel of regelsList) {
    if (regel.type === "materiaal") {
      materiaalkosten += regel.totaal;
    } else if (regel.type === "arbeid") {
      arbeidskosten += regel.totaal;
      totaalUren += regel.hoeveelheid;
    } else if (regel.type === "machine") {
      arbeidskosten += regel.totaal;
    }
  }

  const subtotaal = materiaalkosten + arbeidskosten;
  const margePercentage = instellingen?.standaardMargePercentage || 15;
  const marge = subtotaal * (margePercentage / 100);
  const totaalExBtw = subtotaal + marge;
  const btwPercentage = instellingen?.btwPercentage || 21;
  const btw = totaalExBtw * (btwPercentage / 100);
  const totaalInclBtw = totaalExBtw + btw;

  return {
    materiaalkosten,
    arbeidskosten,
    totaalUren,
    subtotaal,
    marge,
    margePercentage,
    totaalExBtw,
    btw,
    totaalInclBtw,
  };
}
