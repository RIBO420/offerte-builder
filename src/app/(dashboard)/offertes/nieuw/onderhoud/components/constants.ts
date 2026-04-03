import {
  Trees,
  Flower2,
  TreeDeciduous,
  Scissors,
  Leaf,
} from "lucide-react";
import { bemestingDefaultValues } from "@/components/offerte/onderhoud-forms/bemesting-form";
import { defaultGazonanalyseData } from "@/components/offerte/onderhoud-forms/gazonanalyse-form";
import type {
  GrasOnderhoudData,
  BordersOnderhoudData,
  HeggenOnderhoudData,
  BomenOnderhoudData,
  OverigeOnderhoudData,
} from "@/types/offerte";
import type { MollenbestrijdingData } from "@/components/offerte/onderhoud-forms/mollenbestrijding-form";
import type { OnderhoudScope, WizardData } from "./types";

export const SCOPES = [
  {
    id: "gras" as OnderhoudScope,
    naam: "Gras onderhoud",
    icon: Trees,
    beschrijving: "Maaien, kanten steken, verticuteren",
  },
  {
    id: "borders" as OnderhoudScope,
    naam: "Borders onderhoud",
    icon: Flower2,
    beschrijving: "Wieden, snoei, bodemonderhoud",
    verplicht: ["intensiteit"],
  },
  {
    id: "heggen" as OnderhoudScope,
    naam: "Heggen onderhoud",
    icon: Scissors,
    beschrijving: "Snoei, volumeberekening L\u00D7H\u00D7B",
    verplicht: ["lengte", "hoogte", "breedte"],
  },
  {
    id: "bomen" as OnderhoudScope,
    naam: "Bomen onderhoud",
    icon: TreeDeciduous,
    beschrijving: "Snoei, hoogteklasse",
  },
  {
    id: "overig" as OnderhoudScope,
    naam: "Overige werkzaamheden",
    icon: Leaf,
    beschrijving: "Bladruimen, terras, onkruid bestrating",
  },
  {
    id: "reiniging" as OnderhoudScope,
    naam: "Reiniging",
    icon: Leaf,
    beschrijving: "Terras, bestrating, bladruimen",
    color: "bg-cyan-500",
  },
  {
    id: "bemesting" as OnderhoudScope,
    naam: "Bemesting",
    icon: Flower2,
    beschrijving: "Gazon, borders, bomen \u2014 70% marge",
    color: "bg-lime-500",
  },
  {
    id: "gazonanalyse" as OnderhoudScope,
    naam: "Gazonanalyse",
    icon: Trees,
    beschrijving: "Beoordeling, herstelplan, advies",
    color: "bg-teal-500",
  },
  {
    id: "mollenbestrijding" as OnderhoudScope,
    naam: "Mollenbestrijding",
    icon: TreeDeciduous,
    beschrijving: "3-tier pakketten, preventie",
    color: "bg-yellow-600",
  },
];

// Default values for scope data
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

export const INITIAL_WIZARD_DATA: WizardData = {
  selectedTemplateId: null,
  selectedKlantId: null,
  selectedLeadId: null,
  selectedScopes: [],
  bereikbaarheid: "goed",
  achterstalligheid: "laag",
  tuinOppervlakte: "",
  klantData: {
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    telefoon: "",
  },
  scopeData: {
    gras: DEFAULT_GRAS_ONDERHOUD,
    borders: DEFAULT_BORDERS_ONDERHOUD,
    heggen: DEFAULT_HEGGEN,
    bomen: DEFAULT_BOMEN,
    overig: DEFAULT_OVERIG,
    reiniging: DEFAULT_REINIGING,
    bemesting: bemestingDefaultValues,
    gazonanalyse: defaultGazonanalyseData,
    mollenbestrijding: DEFAULT_MOLLENBESTRIJDING,
  },
};
