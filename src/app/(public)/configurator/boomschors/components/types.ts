// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type BoomschorsType =
  | "grove_schors"
  | "fijne_schors"
  | "cacaodoppen"
  | "houtsnippers";

export type LaagDikte = "5cm" | "7cm" | "10cm";

export interface KlantGegevens {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
}

export interface BoomschorsSpecificaties {
  soort: BoomschorsType;
  oppervlakte: string;
  laagDikte: LaagDikte;
  bezorging: "ophalen" | "bezorgen";
  bezorgPostcode: string;
}

export interface Samenvatting {
  leveringsDatum: Date | undefined;
  opmerkingen: string;
  akkoordVoorwaarden: boolean;
}

export interface FormErrors {
  [key: string]: string;
}

export type BezorgInfo =
  | { type: "prijs"; prijs: number; label: string }
  | { type: "contact"; label: string };

export interface PrijsBerekening {
  soort: BoomschorsType;
  laagDikte: LaagDikte;
  oppervlakte: number;
  m3Nodig: number;
  prijs_per_m3: number;
  schors_totaal: number;
  bezorgkosten: number;
  subtotaal: number;
  btw: number;
  totaal: number;
  bezorgLabel: string;
  heeftBezorgMaatwerk: boolean;
}
