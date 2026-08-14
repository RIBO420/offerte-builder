/**
 * Eén statusbron voor de hele app (WS4, kleurplan Stap B).
 *
 * Alle status-, pipeline- en typekleuren komen uit de "Loof & Leem"-tokens in
 * globals.css (`--status-*`, `--lead-*`, `--melding-*`). Nergens anders mag een
 * lokale statusConfig-map met rauwe Tailwind-palletklassen bestaan: zelfde
 * status = zelfde kleur, overal.
 *
 * Semantiek (kleurplan §2): neutraal/concept 150 · informatie/gepland 245
 * (steenblauw) · onderweg/wachten 85 (oker) · actief/uitvoering 70 (amber) ·
 * succes 152 (merkgroen) · financieel afgerond 160 (diepgroen) · analyse 175
 * (mosteal) · negatief 30 (terracottarood).
 *
 * Let op: klassen staan hier als volledige literals, anders ziet de Tailwind
 * JIT ze niet.
 */

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Calculator,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  FileText,
  Hourglass,
  Inbox,
  Leaf,
  Pencil,
  Phone,
  Play,
  Receipt,
  Send,
  ShoppingCart,
  Sparkles,
  ThumbsUp,
  Trophy,
  Truck,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type OfferteStatus = "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen";

export interface StatusConfig {
  label: string;
  description: string;
  icon: LucideIcon;
  color: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
}

/** `bg + text + border` in één string, voor een Badge/chip op statuskleur. */
export function statusClasses(config: StatusConfig): string {
  return `${config.color.bg} ${config.color.text} ${config.color.border}`;
}

// ---------------------------------------------------------------------------
// Offertes
// ---------------------------------------------------------------------------

export const STATUS_CONFIG: Record<OfferteStatus, StatusConfig> = {
  concept: {
    label: "Concept",
    description: "Offerte is in bewerking en nog niet klaar voor voorcalculatie",
    icon: Pencil,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  voorcalculatie: {
    label: "Voorcalculatie",
    description: "Voorcalculatie is ingevuld en offerte is klaar om te verzenden",
    icon: Calculator,
    color: {
      bg: "bg-status-voorcalculatie",
      text: "text-status-voorcalculatie-text",
      border: "border-status-voorcalculatie-border",
      dot: "bg-status-voorcalculatie-dot",
    },
  },
  verzonden: {
    label: "Verzonden",
    description: "Offerte is naar de klant verzonden",
    icon: Send,
    color: {
      bg: "bg-status-verzonden",
      text: "text-status-verzonden-text",
      border: "border-status-verzonden-border",
      dot: "bg-status-verzonden-dot",
    },
  },
  geaccepteerd: {
    label: "Geaccepteerd",
    description: "Klant heeft de offerte geaccepteerd",
    icon: ThumbsUp,
    color: {
      bg: "bg-status-geaccepteerd",
      text: "text-status-geaccepteerd-text",
      border: "border-status-geaccepteerd-border",
      dot: "bg-status-geaccepteerd-dot",
    },
  },
  afgewezen: {
    label: "Afgewezen",
    description: "Klant heeft de offerte afgewezen",
    icon: XCircle,
    color: {
      bg: "bg-status-afgewezen",
      text: "text-status-afgewezen-text",
      border: "border-status-afgewezen-border",
      dot: "bg-status-afgewezen-dot",
    },
  },
};

export const ALL_STATUSES: OfferteStatus[] = [
  "concept",
  "voorcalculatie",
  "verzonden",
  "geaccepteerd",
  "afgewezen",
];

// ---------------------------------------------------------------------------
// Projecten / werkitems
// ---------------------------------------------------------------------------

export type ProjectStatus =
  | "voorcalculatie"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "nacalculatie_compleet"
  | "gefactureerd";

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, StatusConfig> = {
  voorcalculatie: {
    label: "Voorcalculatie",
    description: "Project zit nog in de voorcalculatiefase",
    icon: Calculator,
    color: {
      bg: "bg-status-voorcalculatie",
      text: "text-status-voorcalculatie-text",
      border: "border-status-voorcalculatie-border",
      dot: "bg-status-voorcalculatie-dot",
    },
  },
  gepland: {
    label: "Gepland",
    description: "Project is ingepland en wacht op de start",
    icon: Calendar,
    color: {
      bg: "bg-status-gepland",
      text: "text-status-gepland-text",
      border: "border-status-gepland-border",
      dot: "bg-status-gepland-dot",
    },
  },
  in_uitvoering: {
    label: "In uitvoering",
    description: "Er wordt op dit moment aan het project gewerkt",
    icon: Play,
    color: {
      bg: "bg-status-in-uitvoering",
      text: "text-status-in-uitvoering-text",
      border: "border-status-in-uitvoering-border",
      dot: "bg-status-in-uitvoering-dot",
    },
  },
  afgerond: {
    label: "Afgerond",
    description: "Het werk is afgerond",
    icon: CheckCircle2,
    color: {
      bg: "bg-status-afgerond",
      text: "text-status-afgerond-text",
      border: "border-status-afgerond-border",
      dot: "bg-status-afgerond-dot",
    },
  },
  nacalculatie_compleet: {
    label: "Nacalculatie",
    description: "Nacalculatie is compleet en gecontroleerd",
    icon: ClipboardCheck,
    color: {
      bg: "bg-status-nacalculatie",
      text: "text-status-nacalculatie-text",
      border: "border-status-nacalculatie-border",
      dot: "bg-status-nacalculatie-dot",
    },
  },
  gefactureerd: {
    label: "Gefactureerd",
    description: "Project is gefactureerd",
    icon: Receipt,
    color: {
      bg: "bg-status-gefactureerd",
      text: "text-status-gefactureerd-text",
      border: "border-status-gefactureerd-border",
      dot: "bg-status-gefactureerd-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Facturen (documentketen + betaalketen, §2.8) en contracttermijnen
// ---------------------------------------------------------------------------

export type FactuurStatus =
  | "concept"
  | "definitief"
  | "gepland"
  | "verzonden"
  | "gedeeltelijk_betaald"
  | "herinnering"
  | "betaald"
  | "vervallen";

export const FACTUUR_STATUS_CONFIG: Record<FactuurStatus, StatusConfig> = {
  concept: {
    label: "Concept",
    description: "Factuur is nog in bewerking",
    icon: Pencil,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  // Eigen tokengroep (WS10): leisteenblauw 215 — vastgesteld document,
  // informatie-familie maar duidelijk te onderscheiden van verzonden (245).
  definitief: {
    label: "Definitief",
    description: "Factuur is definitief gemaakt en klaar om te verzenden",
    icon: FileText,
    color: {
      bg: "bg-status-definitief",
      text: "text-status-definitief-text",
      border: "border-status-definitief-border",
      dot: "bg-status-definitief-dot",
    },
  },
  // Contracttermijn die nog gefactureerd moet worden.
  gepland: {
    label: "Gepland",
    description: "Termijn staat gepland en is nog niet gefactureerd",
    icon: Calendar,
    color: {
      bg: "bg-status-gepland",
      text: "text-status-gepland-text",
      border: "border-status-gepland-border",
      dot: "bg-status-gepland-dot",
    },
  },
  // Kleurplan §2: factuur verzonden = informatie (245 steenblauw).
  verzonden: {
    label: "Verzonden",
    description: "Factuur is verzonden en wacht op betaling",
    icon: Send,
    color: {
      bg: "bg-status-gepland",
      text: "text-status-gepland-text",
      border: "border-status-gepland-border",
      dot: "bg-status-gepland-dot",
    },
  },
  gedeeltelijk_betaald: {
    label: "Deels betaald",
    description: "Een deel van het factuurbedrag is betaald",
    icon: Clock,
    color: {
      bg: "bg-status-herinnering",
      text: "text-status-herinnering-text",
      border: "border-status-herinnering-border",
      dot: "bg-status-herinnering-dot",
    },
  },
  herinnering: {
    label: "Herinnering",
    description: "Er is een betalingsherinnering verstuurd",
    icon: Bell,
    color: {
      bg: "bg-status-herinnering",
      text: "text-status-herinnering-text",
      border: "border-status-herinnering-border",
      dot: "bg-status-herinnering-dot",
    },
  },
  betaald: {
    label: "Betaald",
    description: "Factuur is volledig betaald",
    icon: CheckCircle2,
    color: {
      bg: "bg-status-betaald",
      text: "text-status-betaald-text",
      border: "border-status-betaald-border",
      dot: "bg-status-betaald-dot",
    },
  },
  vervallen: {
    label: "Vervallen",
    description: "Factuur is vervallen of geannuleerd",
    icon: AlertCircle,
    color: {
      bg: "bg-status-vervallen",
      text: "text-status-vervallen-text",
      border: "border-status-vervallen-border",
      dot: "bg-status-vervallen-dot",
    },
  },
};

// Legacy alias voor contracttermijnen: "gefactureerd" toont de projectkleur.
export const TERMIJN_STATUS_CONFIG: Record<string, StatusConfig> = {
  gepland: FACTUUR_STATUS_CONFIG.gepland,
  gefactureerd: PROJECT_STATUS_CONFIG.gefactureerd,
  betaald: FACTUUR_STATUS_CONFIG.betaald,
};

// ---------------------------------------------------------------------------
// Leads (kanban-pipeline)
// ---------------------------------------------------------------------------

export type LeadStatus =
  | "nieuw"
  | "contact_gehad"
  | "offerte_verstuurd"
  | "gewonnen"
  | "verloren";

export const LEAD_STATUS_CONFIG: Record<LeadStatus, StatusConfig> = {
  nieuw: {
    label: "Nieuw",
    description: "Lead is binnengekomen en nog niet opgepakt",
    icon: Sparkles,
    color: {
      bg: "bg-lead-nieuw",
      text: "text-lead-nieuw-text",
      border: "border-lead-nieuw-border",
      dot: "bg-lead-nieuw-dot",
    },
  },
  contact_gehad: {
    label: "Contact gehad",
    description: "Er is contact geweest met de lead",
    icon: Phone,
    color: {
      bg: "bg-lead-contact",
      text: "text-lead-contact-text",
      border: "border-lead-contact-border",
      dot: "bg-lead-contact-dot",
    },
  },
  offerte_verstuurd: {
    label: "Offerte verstuurd",
    description: "De lead heeft een offerte ontvangen",
    icon: Send,
    color: {
      bg: "bg-lead-offerte",
      text: "text-lead-offerte-text",
      border: "border-lead-offerte-border",
      dot: "bg-lead-offerte-dot",
    },
  },
  gewonnen: {
    label: "Gewonnen",
    description: "Lead is klant geworden",
    icon: Trophy,
    color: {
      bg: "bg-lead-gewonnen",
      text: "text-lead-gewonnen-text",
      border: "border-lead-gewonnen-border",
      dot: "bg-lead-gewonnen-dot",
    },
  },
  verloren: {
    label: "Verloren",
    description: "Lead is afgehaakt",
    icon: XCircle,
    color: {
      bg: "bg-lead-verloren",
      text: "text-lead-verloren-text",
      border: "border-lead-verloren-border",
      dot: "bg-lead-verloren-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Meldingen / cases (statuskolommen + typebadges)
// ---------------------------------------------------------------------------

export type MeldingStatus =
  | "nieuw"
  | "in_behandeling"
  | "wacht_op_derden"
  | "opgelost";

export const MELDING_STATUS_CONFIG: Record<MeldingStatus, StatusConfig> = {
  nieuw: {
    label: "Nieuw",
    description: "Melding is binnengekomen en nog niet opgepakt",
    icon: Inbox,
    color: {
      bg: "bg-melding-nieuw",
      text: "text-melding-nieuw-text",
      border: "border-melding-nieuw-border",
      dot: "bg-melding-nieuw-dot",
    },
  },
  in_behandeling: {
    label: "In behandeling",
    description: "Melding wordt behandeld",
    icon: Clock,
    color: {
      bg: "bg-melding-in-behandeling",
      text: "text-melding-in-behandeling-text",
      border: "border-melding-in-behandeling-border",
      dot: "bg-melding-in-behandeling-dot",
    },
  },
  wacht_op_derden: {
    label: "Wacht op derden",
    description: "Melding wacht op een leverancier of andere partij",
    icon: Hourglass,
    color: {
      bg: "bg-melding-wacht-op-derden",
      text: "text-melding-wacht-op-derden-text",
      border: "border-melding-wacht-op-derden-border",
      dot: "bg-melding-wacht-op-derden-dot",
    },
  },
  opgelost: {
    label: "Opgelost",
    description: "Melding is opgelost",
    icon: CheckCircle2,
    color: {
      bg: "bg-melding-opgelost",
      text: "text-melding-opgelost-text",
      border: "border-melding-opgelost-border",
      dot: "bg-melding-opgelost-dot",
    },
  },
};

export type MeldingType = "serviceverzoek" | "klacht" | "schade";

export const MELDING_TYPE_CONFIG: Record<MeldingType, StatusConfig> = {
  serviceverzoek: {
    label: "Serviceverzoek",
    description: "Verzoek om service of klein onderhoud",
    icon: Wrench,
    color: {
      bg: "bg-melding-serviceverzoek",
      text: "text-melding-serviceverzoek-text",
      border: "border-melding-serviceverzoek-border",
      dot: "bg-melding-serviceverzoek-dot",
    },
  },
  klacht: {
    label: "Klacht",
    description: "Klacht van een klant — vraagt om aandacht",
    icon: AlertCircle,
    color: {
      bg: "bg-melding-klacht",
      text: "text-melding-klacht-text",
      border: "border-melding-klacht-border",
      dot: "bg-melding-klacht-dot",
    },
  },
  schade: {
    label: "Schade",
    description: "Schademelding — mogelijk verzekeringskwestie",
    icon: AlertTriangle,
    color: {
      bg: "bg-melding-schade",
      text: "text-melding-schade-text",
      border: "border-melding-schade-border",
      dot: "bg-melding-schade-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Klant-pipeline (klantenlijst + klantdossier)
// ---------------------------------------------------------------------------

export type KlantPipelineStatus =
  | "lead"
  | "offerte_verzonden"
  | "getekend"
  | "in_uitvoering"
  | "opgeleverd"
  | "onderhoud";

export const KLANT_PIPELINE_CONFIG: Record<KlantPipelineStatus, StatusConfig> = {
  lead: {
    label: "Lead",
    description: "Nog geen klant — staat op het leadsbord",
    icon: Sparkles,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  // Zelfde betekenis als offertestatus "verzonden" → zelfde kleur (85 oker).
  offerte_verzonden: {
    label: "Offerte verzonden",
    description: "Er ligt een offerte bij de klant",
    icon: Send,
    color: {
      bg: "bg-status-verzonden",
      text: "text-status-verzonden-text",
      border: "border-status-verzonden-border",
      dot: "bg-status-verzonden-dot",
    },
  },
  getekend: {
    label: "Getekend",
    description: "Offerte is geaccepteerd en getekend",
    icon: ThumbsUp,
    color: {
      bg: "bg-status-geaccepteerd",
      text: "text-status-geaccepteerd-text",
      border: "border-status-geaccepteerd-border",
      dot: "bg-status-geaccepteerd-dot",
    },
  },
  in_uitvoering: {
    label: "In uitvoering",
    description: "Het werk bij deze klant is in uitvoering",
    icon: Play,
    color: {
      bg: "bg-status-in-uitvoering",
      text: "text-status-in-uitvoering-text",
      border: "border-status-in-uitvoering-border",
      dot: "bg-status-in-uitvoering-dot",
    },
  },
  opgeleverd: {
    label: "Opgeleverd",
    description: "Het werk is opgeleverd",
    icon: CheckCircle2,
    color: {
      bg: "bg-status-afgerond",
      text: "text-status-afgerond-text",
      border: "border-status-afgerond-border",
      dot: "bg-status-afgerond-dot",
    },
  },
  // Doorlopend onderhoud: rustige mosteal (175) — paars vervalt.
  onderhoud: {
    label: "Onderhoud",
    description: "Klant heeft een lopend onderhoudscontract",
    icon: Leaf,
    color: {
      bg: "bg-status-nacalculatie",
      text: "text-status-nacalculatie-text",
      border: "border-status-nacalculatie-border",
      dot: "bg-status-nacalculatie-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Contracten
// ---------------------------------------------------------------------------

export type ContractStatus = "concept" | "actief" | "verlopen" | "opgezegd";

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, StatusConfig> = {
  concept: {
    label: "Concept",
    description: "Contract is nog in bewerking",
    icon: Pencil,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  actief: {
    label: "Actief",
    description: "Contract loopt",
    icon: CheckCircle2,
    color: {
      bg: "bg-status-afgerond",
      text: "text-status-afgerond-text",
      border: "border-status-afgerond-border",
      dot: "bg-status-afgerond-dot",
    },
  },
  verlopen: {
    label: "Verlopen",
    description: "Contract is verlopen",
    icon: AlertCircle,
    color: {
      bg: "bg-status-vervallen",
      text: "text-status-vervallen-text",
      border: "border-status-vervallen-border",
      dot: "bg-status-vervallen-dot",
    },
  },
  opgezegd: {
    label: "Opgezegd",
    description: "Contract is opgezegd",
    icon: XCircle,
    color: {
      bg: "bg-status-herinnering",
      text: "text-status-herinnering-text",
      border: "border-status-herinnering-border",
      dot: "bg-status-herinnering-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Inkooporders
// ---------------------------------------------------------------------------

export type InkoopStatus = "concept" | "besteld" | "geleverd" | "gefactureerd";

export const INKOOP_STATUS_CONFIG: Record<InkoopStatus, StatusConfig> = {
  concept: {
    label: "Concept",
    description: "Order is nog niet geplaatst",
    icon: FileText,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  besteld: {
    label: "Besteld",
    description: "Order is geplaatst bij de leverancier",
    icon: ShoppingCart,
    color: {
      bg: "bg-status-gepland",
      text: "text-status-gepland-text",
      border: "border-status-gepland-border",
      dot: "bg-status-gepland-dot",
    },
  },
  geleverd: {
    label: "Geleverd",
    description: "Materialen zijn ontvangen",
    icon: Truck,
    color: {
      bg: "bg-status-afgerond",
      text: "text-status-afgerond-text",
      border: "border-status-afgerond-border",
      dot: "bg-status-afgerond-dot",
    },
  },
  gefactureerd: {
    label: "Gefactureerd",
    description: "Factuur is verwerkt",
    icon: Receipt,
    color: {
      bg: "bg-status-gefactureerd",
      text: "text-status-gefactureerd-text",
      border: "border-status-gefactureerd-border",
      dot: "bg-status-gefactureerd-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Garanties
// ---------------------------------------------------------------------------

export type GarantieStatus = "nieuw" | "in_behandeling" | "ingepland" | "afgehandeld";

export const GARANTIE_STATUS_CONFIG: Record<GarantieStatus, StatusConfig> = {
  nieuw: MELDING_STATUS_CONFIG.nieuw,
  in_behandeling: MELDING_STATUS_CONFIG.in_behandeling,
  ingepland: {
    label: "Ingepland",
    description: "Garantiewerk staat in de agenda",
    icon: Calendar,
    color: {
      bg: "bg-status-in-uitvoering",
      text: "text-status-in-uitvoering-text",
      border: "border-status-in-uitvoering-border",
      dot: "bg-status-in-uitvoering-dot",
    },
  },
  afgehandeld: {
    label: "Afgehandeld",
    description: "Garantiemelding is afgehandeld",
    icon: CheckCircle2,
    color: {
      bg: "bg-melding-opgelost",
      text: "text-melding-opgelost-text",
      border: "border-melding-opgelost-border",
      dot: "bg-melding-opgelost-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Verlof
// ---------------------------------------------------------------------------

export type VerlofStatus = "aangevraagd" | "goedgekeurd" | "afgekeurd";

export const VERLOF_STATUS_CONFIG: Record<VerlofStatus, StatusConfig> = {
  aangevraagd: {
    label: "Aangevraagd",
    description: "Aanvraag wacht op een besluit",
    icon: Clock,
    color: {
      bg: "bg-status-verzonden",
      text: "text-status-verzonden-text",
      border: "border-status-verzonden-border",
      dot: "bg-status-verzonden-dot",
    },
  },
  goedgekeurd: {
    label: "Goedgekeurd",
    description: "Aanvraag is goedgekeurd",
    icon: ThumbsUp,
    color: {
      bg: "bg-status-geaccepteerd",
      text: "text-status-geaccepteerd-text",
      border: "border-status-geaccepteerd-border",
      dot: "bg-status-geaccepteerd-dot",
    },
  },
  afgekeurd: {
    label: "Afgekeurd",
    description: "Aanvraag is afgekeurd",
    icon: XCircle,
    color: {
      bg: "bg-status-afgewezen",
      text: "text-status-afgewezen-text",
      border: "border-status-afgewezen-border",
      dot: "bg-status-afgewezen-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Planningstaken
// ---------------------------------------------------------------------------

export type TaakStatus = "gepland" | "gestart" | "afgerond";

export const TAAK_STATUS_CONFIG: Record<TaakStatus, StatusConfig> = {
  gepland: PROJECT_STATUS_CONFIG.gepland,
  gestart: {
    label: "Gestart",
    description: "Taak is gestart",
    icon: Play,
    color: {
      bg: "bg-status-in-uitvoering",
      text: "text-status-in-uitvoering-text",
      border: "border-status-in-uitvoering-border",
      dot: "bg-status-in-uitvoering-dot",
    },
  },
  afgerond: PROJECT_STATUS_CONFIG.afgerond,
};

// ---------------------------------------------------------------------------
// QC-checklists
// ---------------------------------------------------------------------------

export type QCStatus = "open" | "in_uitvoering" | "goedgekeurd" | "afgekeurd";

export const QC_STATUS_CONFIG: Record<QCStatus, StatusConfig> = {
  open: {
    label: "Open",
    description: "Checklist is nog niet gestart",
    icon: Clock,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  in_uitvoering: {
    label: "In uitvoering",
    description: "Checklist wordt afgewerkt",
    icon: Play,
    color: {
      bg: "bg-status-in-uitvoering",
      text: "text-status-in-uitvoering-text",
      border: "border-status-in-uitvoering-border",
      dot: "bg-status-in-uitvoering-dot",
    },
  },
  goedgekeurd: {
    label: "Goedgekeurd",
    description: "Checklist is goedgekeurd",
    icon: CheckCircle2,
    color: {
      bg: "bg-status-geaccepteerd",
      text: "text-status-geaccepteerd-text",
      border: "border-status-geaccepteerd-border",
      dot: "bg-status-geaccepteerd-dot",
    },
  },
  afgekeurd: {
    label: "Afgekeurd",
    description: "Checklist is afgekeurd",
    icon: XCircle,
    color: {
      bg: "bg-status-afgewezen",
      text: "text-status-afgewezen-text",
      border: "border-status-afgewezen-border",
      dot: "bg-status-afgewezen-dot",
    },
  },
};

// ---------------------------------------------------------------------------
// Domein-lookup
// ---------------------------------------------------------------------------

export type StatusDomain =
  | "offerte"
  | "project"
  | "factuur"
  | "lead"
  | "melding"
  | "meldingType"
  | "klantPipeline"
  | "contract"
  | "inkoop"
  | "garantie"
  | "verlof"
  | "taak"
  | "qc";

const DOMAIN_CONFIGS: Record<StatusDomain, Record<string, StatusConfig>> = {
  offerte: STATUS_CONFIG,
  project: PROJECT_STATUS_CONFIG,
  factuur: FACTUUR_STATUS_CONFIG,
  lead: LEAD_STATUS_CONFIG,
  melding: MELDING_STATUS_CONFIG,
  meldingType: MELDING_TYPE_CONFIG,
  klantPipeline: KLANT_PIPELINE_CONFIG,
  contract: CONTRACT_STATUS_CONFIG,
  inkoop: INKOOP_STATUS_CONFIG,
  garantie: GARANTIE_STATUS_CONFIG,
  verlof: VERLOF_STATUS_CONFIG,
  taak: TAAK_STATUS_CONFIG,
  qc: QC_STATUS_CONFIG,
};

/** Neutrale terugval voor onbekende statussen (label = de rauwe status). */
function fallbackConfig(status: string): StatusConfig {
  return {
    label: status,
    description: "",
    icon: Circle,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  };
}

export function getStatusConfig(
  status: string,
  domain: StatusDomain = "offerte"
): StatusConfig {
  // Backwards compatible: offertes vielen altijd terug op "concept".
  if (domain === "offerte") {
    return STATUS_CONFIG[status as OfferteStatus] ?? STATUS_CONFIG.concept;
  }
  return DOMAIN_CONFIGS[domain][status] ?? fallbackConfig(status);
}
