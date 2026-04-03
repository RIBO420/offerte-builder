import type { BemestingFormData } from "@/components/offerte/onderhoud-forms/bemesting-form";
import type { GazonanalyseData } from "@/components/offerte/onderhoud-forms/gazonanalyse-form";
import type { MollenbestrijdingData } from "@/components/offerte/onderhoud-forms/mollenbestrijding-form";
import type {
  Bereikbaarheid,
  Achterstalligheid,
  GrasOnderhoudData,
  BordersOnderhoudData,
  HeggenOnderhoudData,
  BomenOnderhoudData,
  OverigeOnderhoudData,
} from "@/types/offerte";

export type OnderhoudScope = "gras" | "borders" | "heggen" | "bomen" | "overig" | "reiniging" | "bemesting" | "gazonanalyse" | "mollenbestrijding";

export type OnderhoudScopeData = {
  gras: GrasOnderhoudData;
  borders: BordersOnderhoudData;
  heggen: HeggenOnderhoudData;
  bomen: BomenOnderhoudData;
  overig: OverigeOnderhoudData;
  reiniging: Record<string, unknown>;
  bemesting: BemestingFormData;
  gazonanalyse: GazonanalyseData;
  mollenbestrijding: MollenbestrijdingData;
};

// Type for wizard autosave data
export interface WizardData {
  selectedTemplateId: string | null;
  selectedKlantId: string | null;
  selectedLeadId: string | null;
  selectedScopes: OnderhoudScope[];
  bereikbaarheid: Bereikbaarheid;
  achterstalligheid: Achterstalligheid;
  tuinOppervlakte: string;
  klantData: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email: string;
    telefoon: string;
  };
  scopeData: OnderhoudScopeData;
}
