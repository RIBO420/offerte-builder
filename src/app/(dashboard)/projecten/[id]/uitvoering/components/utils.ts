import { format, parseISO } from "date-fns";
import { nl } from "@/lib/date-locale";
import { scopeLabel } from "@/lib/rapportage-labels";

export { formatCurrency } from "@/lib/format/currency";

/** Scopenaam voor op het scherm ("water_elektra" → "Water & elektra"). */
export { scopeLabel };

/** "dinsdag 6 oktober" — weekdag en datum, zonder jaar. */
export function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), "EEEE d MMMM", { locale: nl });
  } catch {
    return dateString;
  }
}

/** Kop boven een dag: "Dinsdag 6 oktober". */
export function dagKop(dateString: string): string {
  const tekst = formatDate(dateString);
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** "1 medewerker" / "2 medewerkers". */
export function aantalMedewerkersTekst(aantal: number): string {
  return `${aantal} ${aantal === 1 ? "medewerker" : "medewerkers"}`;
}
