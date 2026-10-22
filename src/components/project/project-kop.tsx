"use client";

/**
 * De kop van elke projectpagina (okt 2026): naam, status, offerte en klant,
 * en de fasen van het project als tabs.
 *
 * Vervangt de losse koppen per pagina en de `ProjectProgressStepper`-kaart.
 * Die stepper stond op elke pagina anders, toonde "Afgerond" als stap die
 * naar het overzicht linkte, en de kruimel toonde een id ("#8fsm66") in
 * plaats van de projectnaam. Nu staat op elke projectpagina dezelfde kop op
 * dezelfde plek, en zijn de fasen zelf de navigatie.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Calculator, Check, Euro, Lock, ShieldCheck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { klantNaam } from "@convex/lib/offerteKlant";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProjectTitelKnop } from "@/components/project/project-titel-dialog";

export type ProjectTab =
  | "overzicht"
  | "planning"
  | "uitvoering"
  | "nacalculatie"
  | "factuur"
  | "voorcalculatie"
  | "kosten"
  | "kwaliteit";

/** De volgorde van de projectstatus; "voorcalculatie" is legacy en telt als gepland. */
const STATUS_VOLGORDE = [
  "gepland",
  "in_uitvoering",
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
] as const;

function statusIndex(status: string): number {
  const i = STATUS_VOLGORDE.indexOf(
    (status === "voorcalculatie" ? "gepland" : status) as (typeof STATUS_VOLGORDE)[number]
  );
  return i === -1 ? 0 : i;
}

export interface Fase {
  tab: ProjectTab;
  label: string;
  stap: number;
  /** Bereikbaar: de status is ver genoeg. Anders staat de tab op slot. */
  open: boolean;
  /** Afgerond: vinkje. */
  klaar: boolean;
  /** De fase waar het project nu staat ("nu"). */
  nu: boolean;
  /** Waarom op slot — voor `title` en schermlezers. */
  slotReden?: string;
}

/**
 * Welke fasen open, klaar en "nu" zijn bij een projectstatus. Pure functie,
 * zodat de regels testbaar zijn zonder de kop te renderen.
 *
 * - Planning is altijd open; klaar zodra het project in uitvoering is.
 * - Uitvoering opent bij in_uitvoering; klaar zodra het project is afgerond.
 * - Nacalculatie opent bij afgerond (dat is dan "nu"); klaar bij nacalculatie_compleet.
 * - Factuur opent bij nacalculatie_compleet; klaar bij gefactureerd.
 */
export function projectFasen(status: string): Fase[] {
  const i = statusIndex(status);
  return [
    { tab: "planning", label: "Planning", stap: 1, open: true, klaar: i >= 1, nu: i === 0 },
    {
      tab: "uitvoering",
      label: "Uitvoering",
      stap: 2,
      open: i >= 1,
      klaar: i >= 2,
      nu: i === 1,
      slotReden: "Beschikbaar zodra het project in uitvoering is",
    },
    {
      tab: "nacalculatie",
      label: "Nacalculatie",
      stap: 3,
      open: i >= 2,
      klaar: i >= 3,
      nu: i === 2,
      slotReden: "Beschikbaar na het afronden van de uitvoering",
    },
    {
      tab: "factuur",
      label: "Factuur",
      stap: 4,
      open: i >= 3,
      klaar: i >= 4,
      nu: i === 3,
      slotReden: "Beschikbaar na de nacalculatie",
    },
  ];
}

const NEVEN: { tab: ProjectTab; label: string; pad: string; icoon: typeof Calculator }[] = [
  { tab: "voorcalculatie", label: "Voorcalculatie", pad: "voorcalculatie", icoon: Calculator },
  { tab: "kosten", label: "Kosten", pad: "kosten", icoon: Euro },
  { tab: "kwaliteit", label: "Kwaliteit", pad: "kwaliteit", icoon: ShieldCheck },
];

/** Uren in Nederlandse notatie, hooguit 1 decimaal. */
function urenTekst(uren: number): string {
  return uren.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

function pad(projectId: string, tab: ProjectTab): string {
  return tab === "overzicht" ? `/projecten/${projectId}` : `/projecten/${projectId}/${tab}`;
}

function formatDatum(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TAB_KLASSE =
  "flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm transition-colors";

export function ProjectKop({
  projectId,
  actief,
  acties,
}: {
  projectId: string;
  actief: ProjectTab;
  /** Knoppen rechts in de kop; per pagina hooguit één gevulde hoofdknop. */
  acties?: ReactNode;
}) {
  // Zelfde query als het overzicht; Convex dedupliceert op query + args.
  const details = useQuery(api.projecten.getWithDetails, {
    id: projectId as Id<"projecten">,
  });
  // Kerngetallen voor de naslagknoppen. Dezelfde queries als de kosten- en
  // kwaliteitspagina zelf, dus daar kost dit niets extra (Convex dedupliceert).
  const budget = useQuery(api.projectKosten.getBudgetVergelijking, {
    projectId: projectId as Id<"projecten">,
  });
  const kwaliteit = useQuery(api.kwaliteitsControles.getProjectSummary, {
    projectId: projectId as Id<"projecten">,
  });

  if (details === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }
  if (!details) return null;

  const { project, offerte, klant } = details;
  const fasen = projectFasen(project.status);
  // Klant via het project (ook bij lead-projecten zonder offerte), anders
  // de klantgegevens op de offerte.
  const klantTekst = klant?.naam?.trim() || (offerte ? klantNaam(offerte.klant) : null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="font-display text-balance text-2xl font-semibold tracking-tight md:text-[28px]">
                {project.naam}
              </h1>
              <ProjectTitelKnop projectId={project._id} huidigeTitel={project.naam} />
            </div>
            <StatusBadge status={project.status} domain="project" size="sm" />
          </div>
          <p className="text-sm text-muted-foreground">
            {[
              offerte?.offerteNummer ? (
                <Link
                  key="offerte"
                  href={`/offertes/${offerte._id}`}
                  className="font-mono text-[13px] text-foreground/80 transition-colors hover:text-foreground"
                >
                  {offerte.offerteNummer}
                </Link>
              ) : null,
              klant ? (
                <Link
                  key="klant"
                  href={`/klanten/${klant._id}`}
                  className="text-foreground/80 transition-colors hover:text-foreground hover:underline"
                >
                  {klantTekst}
                </Link>
              ) : klantTekst ? (
                <span key="klant">{klantTekst}</span>
              ) : null,
              <span key="datum">aangemaakt {formatDatum(project.createdAt)}</span>,
            ]
              .filter(Boolean)
              .flatMap((deel, i) => (i === 0 ? [deel] : [<span key={`s${i}`}> · </span>, deel]))}
          </p>
        </div>
        {acties && <div className="flex flex-wrap items-center gap-2">{acties}</div>}
      </div>

      <nav
        aria-label="Projectfasen"
        className="flex flex-wrap items-center gap-x-6 border-b"
      >
        <Link
          href={pad(projectId, "overzicht")}
          aria-current={actief === "overzicht" ? "page" : undefined}
          className={cn(
            TAB_KLASSE,
            actief === "overzicht"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Overzicht
        </Link>

        {fasen.map((fase) => {
          const isActief = actief === fase.tab;
          const stapTeken = (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold tabular-nums",
                fase.klaar &&
                  "border-status-geaccepteerd-border bg-status-geaccepteerd text-status-geaccepteerd-text",
                !fase.klaar &&
                  fase.nu &&
                  "border-status-in-uitvoering-border bg-status-in-uitvoering text-status-in-uitvoering-text",
                !fase.klaar && !fase.nu && "border-border"
              )}
            >
              {fase.klaar ? <Check className="size-3" strokeWidth={3} /> : fase.stap}
            </span>
          );

          if (!fase.open) {
            return (
              <span
                key={fase.tab}
                aria-disabled="true"
                title={fase.slotReden}
                className={cn(TAB_KLASSE, "cursor-not-allowed border-transparent text-muted-foreground/60")}
              >
                {stapTeken}
                {fase.label}
                <Lock className="size-3" aria-hidden="true" />
                <span className="sr-only"> — {fase.slotReden}</span>
              </span>
            );
          }

          return (
            <Link
              key={fase.tab}
              href={pad(projectId, fase.tab)}
              aria-current={isActief ? "page" : undefined}
              className={cn(
                TAB_KLASSE,
                isActief
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {stapTeken}
              {fase.label}
              {fase.klaar && <span className="sr-only"> (klaar)</span>}
              {fase.nu && (
                <span className="text-xs font-normal text-status-in-uitvoering-text">nu</span>
              )}
            </Link>
          );
        })}

        {/* Naslag: geen fasen maar achtergrond bij het project. Knoppen met
            een kerngetal, zodat je zonder te klikken ziet hoe het ervoor staat. */}
        <div role="group" aria-label="Naslag" className="ml-auto flex flex-wrap items-center gap-1.5 py-1.5">
          {NEVEN.map((neven) => {
            const isActief = actief === neven.tab;
            const getal = naslagGetal(neven.tab, budget, kwaliteit);
            const Icoon = neven.icoon;
            return (
              <Link
                key={neven.tab}
                href={`/projecten/${projectId}/${neven.pad}`}
                aria-current={isActief ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px] transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96]",
                  isActief
                    ? "border-primary/50 bg-primary/10 font-semibold text-foreground"
                    : "bg-card font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icoon className="size-[15px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {neven.label}
                {getal && (
                  <span
                    title={getal.uitleg}
                    className={cn(
                      "rounded-[5px] px-1.5 text-xs leading-5 font-medium tabular-nums",
                      isActief ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {getal.tekst}
                    <span className="sr-only"> — {getal.uitleg}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

type BudgetVergelijking =
  | FunctionReturnType<typeof api.projectKosten.getBudgetVergelijking>
  | undefined;
type KwaliteitSamenvatting =
  | FunctionReturnType<typeof api.kwaliteitsControles.getProjectSummary>
  | undefined;

/** Het kerngetal op een naslagknop, of null als er (nog) niets zinnigs te tonen is. */
function naslagGetal(
  tab: ProjectTab,
  budget: BudgetVergelijking,
  kwaliteit: KwaliteitSamenvatting
): { tekst: string; uitleg: string } | null {
  const data = budget?.data;
  if (tab === "voorcalculatie") {
    if (!data || data.gepland.uren <= 0) return null;
    return { tekst: `${urenTekst(data.gepland.uren)} u`, uitleg: "begrote normuren" };
  }
  if (tab === "kosten") {
    // Uren in twee bronnen zonder keuze: geen percentage, wel een signaal.
    if (budget && "error" in budget && budget.error === "URENBRON_CONFLICT") {
      return { tekst: "Urenbron?", uitleg: "Kies eerst de urenbron in de nacalculatie" };
    }
    if (!data || data.gepland.totaal <= 0) return null;
    const pct = Math.round((data.werkelijk.totaal / data.gepland.totaal) * 100);
    return { tekst: `${pct}%`, uitleg: `${pct}% van de begroting besteed` };
  }
  if (tab === "kwaliteit") {
    const scopes = data ? Object.keys(data.gepland.urenPerScope).length : 0;
    const totaal = Math.max(scopes, kwaliteit?.totaal ?? 0);
    if (totaal === 0) return null;
    const goed = kwaliteit?.goedgekeurd ?? 0;
    return { tekst: `${goed}/${totaal}`, uitleg: `${goed} van ${totaal} scopes goedgekeurd` };
  }
  return null;
}
