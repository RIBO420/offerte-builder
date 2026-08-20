"use client";

import type { ReactNode } from "react";
import {
  CalendarClock,
  CheckSquare,
  Clock,
  FileText,
  FolderKanban,
  Receipt,
  Settings2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Het submenu van het klantdossier.
 *
 * Eén verticale kolom in plaats van een rij tabs: acht onderdelen passen niet
 * op één regel zonder in te korten of te scrollen, en de groepskopjes
 * (Historie / Werk / Financieel / Klant) vertellen waar je bent zonder dat er
 * een woord bij hoeft. Op smalle schermen vouwen dezelfde items tot chips
 * bóven de inhoud — het prototype liet ze daar zijwaarts scrollen, en dat mag
 * hier niet (huisregel: nooit horizontaal scrollen).
 *
 * De statuspil per item komt uit één query (`klanten.dossierTellingen`), zodat
 * de acht getallen samen aankomen in plaats van los in te druppelen. De pil
 * kent drie tonen en één lege staat:
 *
 * - **leeg** — een streepje in gedempt grijs. "Nog niets" is een antwoord, een
 *   0 in een gevulde pil trekt onnodig de aandacht.
 * - **neutraal** — een gewone telling (tijdlijn, projecten, offertes).
 * - **amber** — er staat iets open dat op jou wacht (taken, facturen).
 * - **rood** — een factuur staat langer dan een maand open.
 */

export type DossierTab =
  | "actueel"
  | "tijdlijn"
  | "taken"
  | "projecten"
  | "onderhoud"
  | "offertes"
  | "facturen"
  | "instellingen";

export const DOSSIER_TABS: readonly DossierTab[] = [
  "actueel",
  "tijdlijn",
  "taken",
  "projecten",
  "onderhoud",
  "offertes",
  "facturen",
  "instellingen",
] as const;

/** Valt terug op "actueel" zodra `?tab=` iets onbekends bevat. */
export function isDossierTab(waarde: string): waarde is DossierTab {
  return (DOSSIER_TABS as readonly string[]).includes(waarde);
}

export const DOSSIER_TAB_LABELS: Record<DossierTab, string> = {
  actueel: "Actueel",
  tijdlijn: "Tijdlijn",
  taken: "Taken",
  projecten: "Projecten",
  onderhoud: "Onderhoud",
  offertes: "Offertes",
  facturen: "Facturen",
  instellingen: "Instellingen",
};

/** Wat `klanten.dossierTellingen` teruggeeft; `null` = geen toegang/onbekend. */
export interface DossierTellingen {
  openTaken: number;
  /** Eerstvolgende deadline van een openstaande taak (YYYY-MM-DD). */
  eerstvolgendeDeadline: string | null;
  contactmomenten: number;
  tijdlijn: number;
  laatsteContactOp: number | null;
  laatsteContactTimestamp: number | null;
  klantSinds: number;
  projecten: number;
  onderhoud: number;
  offertes: number;
  offertesTotaal: number;
  offertesConcept: number;
  facturen: number;
  bestanden: number;
  openFacturen: number;
  openstaandBedrag: number;
  /** Vervaldatum voorbij — dezelfde definitie als de factuurlijst. */
  factuurTeLaat: boolean;
  /** Een open factuur staat langer dan 30 dagen open (v13 §A2: rood). */
  factuurOuderDan30: boolean;
}

type PilToon = "leeg" | "neutraal" | "amber" | "rood";

const PIL_TOON: Record<PilToon, string> = {
  // Geen vlak: een lege pil hoort geen blokje te zijn.
  leeg: "text-muted-foreground/70",
  neutraal: "bg-muted text-muted-foreground",
  // De AA-geverifieerde tokenparen; oker = wachten, terracotta = negatief.
  amber: "bg-status-herinnering text-status-herinnering-text",
  rood: "bg-status-vervallen text-status-vervallen-text",
};

function Pil({ waarde, toon }: { waarde: number; toon: PilToon }) {
  const leeg = toon === "leeg";
  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto shrink-0 rounded-full text-[11px] font-semibold tabular-nums",
        leeg ? "px-0.5" : "px-1.5 py-px",
        PIL_TOON[toon]
      )}
    >
      {leeg ? "—" : waarde}
    </span>
  );
}

interface NavItem {
  tab: DossierTab;
  icoon: ReactNode;
  waarde: number;
  toon: PilToon;
  /** Voorgelezen toevoeging bij de pil, want die staat op `aria-hidden`. */
  pilLabel?: string;
}

interface NavGroep {
  label?: string;
  items: NavItem[];
}

/** Neutraal zolang er iets te tellen valt, anders leeg. */
function telling(waarde: number): PilToon {
  return waarde > 0 ? "neutraal" : "leeg";
}

function bouwGroepen(t: DossierTellingen | null | undefined): NavGroep[] {
  // Zonder tellingen (nog aan het laden, of geen toegang) staan alle pillen op
  // leeg. Dat is rustiger dan skeletons die één tel later wegspringen.
  const openTaken = t?.openTaken ?? 0;
  const openFacturen = t?.openFacturen ?? 0;
  const teLaat = t?.factuurTeLaat === true;
  const actueel = openTaken + openFacturen;

  // "1 projecten" leest als een tikfout — de voorgelezen labels vervoegen mee.
  const meervoud = (n: number, ev: string, mv: string) =>
    `${n} ${n === 1 ? ev : mv}`;

  const facturenToon: PilToon = teLaat
    ? "rood"
    : openFacturen > 0
      ? "amber"
      : telling(t?.facturen ?? 0);

  return [
    {
      items: [
        {
          tab: "actueel",
          icoon: <Zap />,
          waarde: actueel,
          toon: actueel > 0 ? (teLaat ? "rood" : "amber") : "leeg",
          pilLabel:
            actueel > 0
              ? `${actueel} openstaand${teLaat ? ", waarvan een factuur te laat" : ""}`
              : "niets openstaand",
        },
      ],
    },
    {
      label: "Historie",
      items: [
        {
          tab: "tijdlijn",
          icoon: <Clock />,
          waarde: t?.contactmomenten ?? 0,
          toon: telling(t?.contactmomenten ?? 0),
          pilLabel: meervoud(
            t?.contactmomenten ?? 0,
            "contactmoment",
            "contactmomenten"
          ),
        },
        {
          tab: "taken",
          icoon: <CheckSquare />,
          waarde: openTaken,
          toon: openTaken > 0 ? "amber" : "leeg",
          pilLabel:
            openTaken > 0 ? `${openTaken} open` : "geen openstaande taken",
        },
      ],
    },
    {
      label: "Werk",
      items: [
        {
          tab: "projecten",
          icoon: <FolderKanban />,
          waarde: t?.projecten ?? 0,
          toon: telling(t?.projecten ?? 0),
          pilLabel: meervoud(t?.projecten ?? 0, "project", "projecten"),
        },
        {
          tab: "onderhoud",
          icoon: <CalendarClock />,
          waarde: t?.onderhoud ?? 0,
          toon: telling(t?.onderhoud ?? 0),
          pilLabel: `${t?.onderhoud ?? 0} onder contract of als losse beurt`,
        },
      ],
    },
    {
      label: "Financieel",
      items: [
        {
          tab: "offertes",
          icoon: <FileText />,
          waarde: t?.offertes ?? 0,
          toon: telling(t?.offertes ?? 0),
          pilLabel: meervoud(t?.offertes ?? 0, "offerte", "offertes"),
        },
        {
          tab: "facturen",
          icoon: <Receipt />,
          waarde: openFacturen > 0 ? openFacturen : (t?.facturen ?? 0),
          toon: facturenToon,
          pilLabel:
            openFacturen > 0
              ? `${openFacturen} open${teLaat ? ", waarvan een langer dan 30 dagen" : ""}`
              : `${meervoud(t?.facturen ?? 0, "factuur", "facturen")}, geen openstaand`,
        },
      ],
    },
    {
      label: "Klant",
      items: [
        {
          tab: "instellingen",
          icoon: <Settings2 />,
          waarde: 0,
          toon: "leeg",
        },
      ],
    },
  ];
}

export function DossierNav({
  actief,
  onKies,
  tellingen,
  className,
}: {
  actief: DossierTab;
  onKies: (tab: DossierTab) => void;
  tellingen: DossierTellingen | null | undefined;
  className?: string;
}) {
  const groepen = bouwGroepen(tellingen);

  return (
    <nav
      aria-label="Klantdossier"
      className={cn(
        // Onder lg: chips die wrappen. Vanaf lg: een kolom die blijft staan
        // terwijl de tab eronder doorscrollt.
        "flex flex-wrap gap-1.5 lg:sticky lg:top-6 lg:block",
        className
      )}
    >
      {groepen.map((groep, index) => (
        // `contents` haalt de groep-div onder lg uit de opmaak, zodat álle
        // items in één flexrij wrappen in plaats van per groep op een eigen
        // regel te beginnen.
        <div
          key={groep.label ?? `groep-${index}`}
          className={cn("contents lg:block", index > 0 && "lg:mt-4")}
        >
          {groep.label && (
            <p className="hidden px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase lg:block">
              {groep.label}
            </p>
          )}
          {groep.items.map((item) => {
            const isActief = item.tab === actief;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => onKies(item.tab)}
                aria-current={isActief ? "page" : undefined}
                className={cn(
                  // De rand staat er altijd, desnoods doorzichtig: zo verspringt
                  // geen enkel item een pixel als het actief wordt, en zijn de
                  // chips onder lg allemaal even hoog.
                  "flex w-auto items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-left text-[13.5px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:mb-px lg:w-full",
                  isActief
                    ? // Zelfde actieve toon als de hoofdsidebar: primary-tint
                      // met een dunne primary-rand eromheen.
                      "border-primary/25 bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-muted max-lg:border-border"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 [&>svg]:size-4",
                    isActief ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.icoon}
                </span>
                <span className="truncate">
                  {DOSSIER_TAB_LABELS[item.tab]}
                </span>
                {item.tab !== "instellingen" && (
                  <>
                    <Pil waarde={item.waarde} toon={item.toon} />
                    {item.pilLabel && (
                      <span className="sr-only">{item.pilLabel}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
