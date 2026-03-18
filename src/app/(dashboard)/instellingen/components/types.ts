export interface Normuur {
  _id: string;
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
  omschrijving?: string;
}

export interface Correctiefactor {
  _id: string;
  type: string;
  waarde: string;
  factor: number;
  userId?: string;
}

export interface NormuurFormData {
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
  omschrijving: string;
}

export interface TarievenState {
  uurtarief: number;
  standaardMargePercentage: number;
  btwPercentage: number;
}

export interface ScopeMargesState {
  grondwerk?: number;
  bestrating?: number;
  borders?: number;
  gras?: number;
  houtwerk?: number;
  water_elektra?: number;
  specials?: number;
  gras_onderhoud?: number;
  borders_onderhoud?: number;
  heggen?: number;
  bomen?: number;
  overig?: number;
}
