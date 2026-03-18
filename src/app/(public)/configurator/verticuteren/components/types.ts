export type GazonConditie =
  | "uitstekend"
  | "goed"
  | "matig"
  | "slecht"
  | "zeer_slecht";

export interface KlantGegevens {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  poortbreedte: string;
}

export interface VerticuterenSpecs {
  oppervlakte: string;
  conditie: GazonConditie | "";
  bijzaaien: boolean;
  topdressing: boolean;
  bemesting: boolean;
}

export interface PrijsBerekening {
  basisprijs: number;
  conditioneelToeslag: number;
  conditioneelToeslagPercent: number;
  handmatigToeslag: boolean;
  handmatigToeslagBedrag: number;
  bijzaaienRegel: number | null;
  topdressingRegel: number | null;
  bemestingRegel: number | null;
  machineHuur: number;
  voorrijkosten: number;
  subtotaal: number;
  btw: number;
  totaal: number;
}
