import type { ColorScheme } from '../../theme/colors';
import type { SegmentCategorie } from '../../types/veld';

/** Kleur van het tijdblokje per soort uren: werk groen, reis/loods aards, pauze stil. */
export function categorieKleur(kleuren: ColorScheme, categorie: SegmentCategorie): string {
  if (categorie === 'werken') return kleuren.primary;
  if (categorie === 'pauze') return kleuren.randSterk;
  if (categorie === 'reistijd') return kleuren.werkReis;
  return kleuren.werkLoods;
}
