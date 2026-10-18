import { scopeLabel } from "@/lib/rapportage-labels";
/**
 * Leesbare scopenaam. Dezelfde bron als kwaliteit en de rapportages, zodat
 * "gras" overal "Gras" heet (hier stond eerst een eigen lijst met "Gazon").
 */
export function scopeNaam(scope: string): string {
  return scopeLabel(scope);
}
