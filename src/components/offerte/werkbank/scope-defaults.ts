/**
 * Startwaarden per scope voor het werkblad.
 *
 * Stond eerder in `useAanlegWizard.ts` en `onderhoud/components/constants.ts`.
 * Apart van `src/lib/werkbank.ts` gehouden omdat twee defaults (bemesting,
 * gazonanalyse) uit clientcomponenten komen — de pure logica blijft zo
 * importeerbaar zonder React.
 */

import { bemestingDefaultValues } from "@/components/offerte/onderhoud-forms/bemesting-form";
import { defaultGazonanalyseData } from "@/components/offerte/onderhoud-forms/gazonanalyse-form";
import type { MollenbestrijdingData } from "@/components/offerte/onderhoud-forms/mollenbestrijding-form";
import type {
  GrondwerkData,
  BestratingData,
  ParkeerplaatsData,
  BeregeningData,
  BordersData,
  GrasData,
  HoutwerkData,
  WaterElektraData,
  SpecialsData,
  GrasOnderhoudData,
  BordersOnderhoudData,
  HeggenOnderhoudData,
  BomenOnderhoudData,
  OverigeOnderhoudData,
} from "@/types/offerte";
import type { WerkbankType } from "@/lib/werkbank";

export const DEFAULT_GRONDWERK: GrondwerkData = {
  oppervlakte: 0,
  diepte: "standaard",
  afvoerGrond: false,
};

export const DEFAULT_BESTRATING: BestratingData = {
  oppervlakte: 0,
  typeBestrating: "tegel",
  snijwerk: "laag",
  onderbouw: {
    type: "zandbed",
    dikteOnderlaag: 5,
    opsluitbanden: false,
  },
};

export const DEFAULT_PARKEERPLAATS: ParkeerplaatsData = {
  oppervlakte: 0,
  verharding: "betonklinker",
  draagkracht: "personenauto",
  ontgraven: true,
  opsluitbanden: true,
  afwatering: "geen",
  belijning: true,
};

export const DEFAULT_BEREGENING: BeregeningData = {
  oppervlakte: 0,
  aantalZones: 2,
  sproeierType: "popup",
  waterbron: "waterleiding",
  regelkast: true,
  wintervast: true,
};

export const DEFAULT_BORDERS: BordersData = {
  oppervlakte: 0,
  beplantingsintensiteit: "gemiddeld",
  bodemverbetering: false,
  afwerking: "geen",
};

export const DEFAULT_GRAS: GrasData = {
  oppervlakte: 0,
  type: "graszoden",
  ondergrond: "bestaand",
  afwateringNodig: false,
};

export const DEFAULT_HOUTWERK: HoutwerkData = {
  typeHoutwerk: "schutting",
  afmeting: 0,
  fundering: "standaard",
};

export const DEFAULT_WATER_ELEKTRA: WaterElektraData = {
  verlichting: "geen",
  aantalPunten: 0,
  sleuvenNodig: true,
};

export const DEFAULT_SPECIALS: SpecialsData = {
  items: [],
};

export const DEFAULT_GRAS_ONDERHOUD: GrasOnderhoudData = {
  grasAanwezig: true,
  grasOppervlakte: 0,
  maaien: true,
  kantenSteken: false,
  verticuteren: false,
  afvoerGras: false,
};

export const DEFAULT_BORDERS_ONDERHOUD: BordersOnderhoudData = {
  borderOppervlakte: 0,
  onderhoudsintensiteit: "gemiddeld",
  onkruidVerwijderen: true,
  snoeiInBorders: "geen",
  bodem: "open",
  afvoerGroenafval: false,
};

export const DEFAULT_HEGGEN: HeggenOnderhoudData = {
  lengte: 0,
  hoogte: 0,
  breedte: 0,
  snoei: "beide",
  afvoerSnoeisel: false,
};

export const DEFAULT_BOMEN: BomenOnderhoudData = {
  aantalBomen: 0,
  snoei: "licht",
  hoogteklasse: "laag",
  afvoer: false,
};

export const DEFAULT_OVERIG: OverigeOnderhoudData = {
  bladruimen: false,
  terrasReinigen: false,
  terrasOppervlakte: 0,
  onkruidBestrating: false,
  bestratingOppervlakte: 0,
  afwateringControleren: false,
  aantalAfwateringspunten: 0,
  overigNotities: "",
  overigUren: 0,
};

export const DEFAULT_REINIGING: Record<string, unknown> = {
  terrasreinigingAan: false,
  hogedrukAkkoord: false,
  bladruimenAan: false,
  bladafvoerAan: false,
  onkruidBestratingAan: false,
  algereinigingAan: false,
};

export const DEFAULT_MOLLENBESTRIJDING: MollenbestrijdingData = {
  aantalMolshopen: 0,
  tuinOppervlakte: 1,
  tuinType: "gazon",
  ernst: 1,
  gekozenPakket: "basis",
  gazonherstel: false,
  preventiefGaas: false,
  terugkeerCheck: false,
};

const AANLEG_DEFAULTS: Record<string, unknown> = {
  grondwerk: DEFAULT_GRONDWERK,
  bestrating: DEFAULT_BESTRATING,
  parkeerplaats: DEFAULT_PARKEERPLAATS,
  beregening: DEFAULT_BEREGENING,
  borders: DEFAULT_BORDERS,
  gras: DEFAULT_GRAS,
  houtwerk: DEFAULT_HOUTWERK,
  water_elektra: DEFAULT_WATER_ELEKTRA,
  specials: DEFAULT_SPECIALS,
};

const ONDERHOUD_DEFAULTS: Record<string, unknown> = {
  gras: DEFAULT_GRAS_ONDERHOUD,
  borders: DEFAULT_BORDERS_ONDERHOUD,
  heggen: DEFAULT_HEGGEN,
  bomen: DEFAULT_BOMEN,
  overig: DEFAULT_OVERIG,
  reiniging: DEFAULT_REINIGING,
  bemesting: bemestingDefaultValues,
  gazonanalyse: defaultGazonanalyseData,
  mollenbestrijding: DEFAULT_MOLLENBESTRIJDING,
};

/** Verse kopie: het werkblad muteert deze objecten. */
export function legeScopeData(type: WerkbankType): Record<string, unknown> {
  const bron = type === "aanleg" ? AANLEG_DEFAULTS : ONDERHOUD_DEFAULTS;
  return structuredClone(bron);
}
