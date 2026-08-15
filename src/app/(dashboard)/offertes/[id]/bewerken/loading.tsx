import { WerkbankSkelet } from "@/components/offerte/werkbank/werkbank-skelet";

/**
 * Bewerken ís het werkblad sinds de editors zijn samengevoegd; deze route
 * leent dus het silhouet van het werkblad in plaats van dat van de oude
 * regel-editor (regels links, totalen rechts) die hier niet meer staat.
 */
export default function OfferteBewerkenLoading() {
  return <WerkbankSkelet />;
}
