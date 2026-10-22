/**
 * Pure statuslogica van het offertedetail (huisstijl variant A "Regels
 * centraal"): welke ÉÉN primaire knop de kop toont en hoe de fasestrip
 * eronder staat. Los van React gehouden zodat elke status te testen is —
 * `src/__tests__/unit/offerte-voortgang.test.ts`.
 *
 * Bron van de regels:
 * - statusovergangen: `convex/offertes.ts` → `updateStatus` (`validTransitions`)
 *   — concept → voorcalculatie → verzonden → geaccepteerd/afgewezen; vrije
 *   offertes (`bron === "vrij"`) mogen van concept direct naar verzonden;
 * - versturen is kantoor-only (PRD §1.2), dus anderen krijgen geen "Versturen";
 * - de volgende-stap-teksten van de vroegere `OfferteWorkflowStepper` en de
 *   start-/naar-projectlogica van de vroegere `ProjectCard`.
 */

export type OfferteStatus =
  | "concept"
  | "voorcalculatie"
  | "verzonden"
  | "geaccepteerd"
  | "afgewezen";

export interface ProjectRef {
  _id: string;
  naam?: string;
  status: string;
}

export type Actie =
  | {
      soort: "link";
      label: string;
      href: string;
      icoon: "voorcalculatie" | "project";
    }
  | {
      soort: "status";
      label: string;
      doelStatus: OfferteStatus;
      /**
       * Tussenstap die eerst gezet moet worden. Een wizard-offerte mag niet van
       * concept direct naar verzonden; met een ingevulde voorcalculatie zet de
       * knop "Versturen" daarom eerst de status voorcalculatie en dan verzonden.
       */
      via?: OfferteStatus;
      icoon: "versturen" | "akkoord" | "afwijzen" | "klaar";
    }
  | { soort: "nieuweVersie"; label: string };

export interface VolgendeStap {
  primair: Actie | null;
  /** Alleen bij verzonden: afwijzen naast het akkoord. */
  secundair: Actie | null;
}

export interface VoortgangInvoer {
  offerteId: string;
  status: OfferteStatus;
  heeftVoorcalculatie: boolean;
  isVrij: boolean;
  isKantoor: boolean;
  /** `undefined` = nog aan het laden, `null` = er is geen project. */
  project: ProjectRef | null | undefined;
}

export function bepaalVolgendeStap(invoer: VoortgangInvoer): VolgendeStap {
  const { offerteId, status, heeftVoorcalculatie, isVrij, isKantoor, project } =
    invoer;
  const geen: VolgendeStap = { primair: null, secundair: null };

  switch (status) {
    case "concept": {
      if (!isVrij && !heeftVoorcalculatie) {
        return {
          primair: {
            soort: "link",
            label: "Voorcalculatie invullen",
            href: `/offertes/${offerteId}/voorcalculatie`,
            icoon: "voorcalculatie",
          },
          secundair: null,
        };
      }
      if (isKantoor) {
        return {
          primair: {
            soort: "status",
            label: "Versturen",
            doelStatus: "verzonden",
            via: isVrij ? undefined : "voorcalculatie",
            icoon: "versturen",
          },
          secundair: null,
        };
      }
      // Niet-kantoor mag niet versturen; de wizard-offerte kan wel klaargezet
      // worden. Een vrije offerte kent die stap niet.
      if (isVrij) return geen;
      return {
        primair: {
          soort: "status",
          label: "Klaar voor verzending",
          doelStatus: "voorcalculatie",
          icoon: "klaar",
        },
        secundair: null,
      };
    }
    case "voorcalculatie":
      return isKantoor
        ? {
            primair: {
              soort: "status",
              label: "Versturen",
              doelStatus: "verzonden",
              icoon: "versturen",
            },
            secundair: null,
          }
        : geen;
    case "verzonden":
      return {
        primair: {
          soort: "status",
          label: "Akkoord vastleggen",
          doelStatus: "geaccepteerd",
          icoon: "akkoord",
        },
        secundair: {
          soort: "status",
          label: "Afwijzen",
          doelStatus: "afgewezen",
          icoon: "afwijzen",
        },
      };
    case "geaccepteerd":
      if (project === undefined) return geen;
      return {
        primair: project
          ? {
              soort: "link",
              label: "Naar project",
              href: `/projecten/${project._id}`,
              icoon: "project",
            }
          : {
              soort: "link",
              label: "Start project",
              href: `/projecten/nieuw?offerte=${offerteId}`,
              icoon: "project",
            },
        secundair: null,
      };
    case "afgewezen":
      return {
        primair: { soort: "nieuweVersie", label: "Nieuwe versie" },
        secundair: null,
      };
    default:
      return geen;
  }
}

// ── Fasestrip ──────────────────────────────────────────────────────────

export type FaseStaat = "klaar" | "nu" | "open" | "afgewezen";

export interface Fase {
  id: "concept" | "voorcalculatie" | "verzonden" | "besluit" | "project";
  label: string;
  staat: FaseStaat;
  /** Moment waarop de fase gehaald is, als dat bekend is. */
  datum?: number;
  /** Korte toelichting achter het label (bv. de projectstatus). */
  detail?: string;
}

export interface FaseInvoer {
  status: OfferteStatus;
  heeftVoorcalculatie: boolean;
  isVrij: boolean;
  verzondenAt?: number;
  customerResponse?: { status: string; respondedAt?: number };
  project: ProjectRef | null | undefined;
  /** Leesbaar label voor de projectstatus (uit de centrale statusconfig). */
  projectStatusLabel?: string;
}

const NA_VERZENDEN: OfferteStatus[] = ["verzonden", "geaccepteerd", "afgewezen"];

export function bepaalFases(invoer: FaseInvoer): Fase[] {
  const { status, heeftVoorcalculatie, isVrij, verzondenAt, customerResponse, project } =
    invoer;
  const verzonden = NA_VERZENDEN.includes(status);
  const fases: Fase[] = [{ id: "concept", label: "Concept", staat: "klaar" }];

  // Vrije offertes kennen geen voorcalculatie-stap; toon hem alleen als hij er
  // toch is (record of status), anders staat er een stap die nooit komt.
  if (!isVrij || heeftVoorcalculatie || status === "voorcalculatie") {
    fases.push({
      id: "voorcalculatie",
      label: "Voorcalculatie",
      staat:
        heeftVoorcalculatie || status === "voorcalculatie" || verzonden
          ? "klaar"
          : "open",
    });
  }

  fases.push({
    id: "verzonden",
    label: "Verzonden",
    staat: verzonden ? "klaar" : "open",
    datum: verzonden ? verzondenAt : undefined,
  });

  if (status === "afgewezen") {
    fases.push({
      id: "besluit",
      label: "Afgewezen",
      staat: "afgewezen",
      datum:
        customerResponse?.status === "afgewezen"
          ? customerResponse.respondedAt
          : undefined,
    });
    // Na een afwijzing komt er geen project: de strip eindigt hier.
    return fases;
  }

  const geaccepteerd = status === "geaccepteerd";
  fases.push({
    id: "besluit",
    label: "Geaccepteerd",
    staat: geaccepteerd ? "klaar" : "open",
    datum:
      geaccepteerd && customerResponse?.status === "geaccepteerd"
        ? customerResponse.respondedAt
        : undefined,
  });

  if (project) {
    fases.push({
      id: "project",
      label: "Project",
      staat: "klaar",
      detail: invoer.projectStatusLabel,
    });
  } else {
    fases.push({
      id: "project",
      label: geaccepteerd && project === null ? "Project starten" : "Project",
      staat: "open",
    });
  }

  // De eerste fase die nog niet gehaald is, is de volgende stap. Zolang het
  // project nog laadt (undefined) markeren we het niet: anders springt de
  // markering heen en weer.
  const volgende = fases.find((f) => f.staat === "open");
  if (volgende && !(volgende.id === "project" && project === undefined)) {
    volgende.staat = "nu";
  }
  return fases;
}

/** De lijn vóór fase `i` is gevuld als die fase gehaald is. */
export function lijnVol(fases: Fase[], index: number): boolean {
  return fases[index]?.staat === "klaar";
}
