"use client";

import { use } from "react";
import Link from "next/link";
import { PaginaReveal } from "@/components/pagina-reveal";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FolderKanban, FileText, ExternalLink, Info } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { getal, heleWerkdagen, procent, scopeStip } from "@/components/project/project-cijfers";
import { getScopeDisplayName } from "@/lib/planning-templates";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { useProjectVoorcalculatie } from "@/hooks/use-voorcalculatie";
import { ProjectKop } from "@/components/project/project-kop";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { LaadIndicator } from "@/components/ui/laad-indicator";

/**
 * VoorcalculatiePage - Read-only reference view
 *
 * In the new workflow, voorcalculatie is created at the offerte level.
 * This page shows the voorcalculatie data as a reference for the project.
 */
export default function VoorcalculatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const {
    project,
    offerte,
    voorcalculatie,
    calculation,
    isLoading,
  } = useProjectVoorcalculatie(id as Id<"projecten">);
  // Voor de vergelijking met de taakuren; dezelfde query als de projectkop.
  const details = useQuery(api.projecten.getWithDetails, { id: id as Id<"projecten"> });

  if (isLoading) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}/voorcalculatie`]: "Laden..." }} />
        <div className="flex flex-1 items-center justify-center">
          <LaadIndicator formaat="pagina" />
        </div>
      </>
    );
  }

  if (!project || !offerte) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}/voorcalculatie`]: "Niet gevonden" }} />

        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                Project niet gevonden
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Het project bestaat niet of je hebt geen toegang.
              </p>
              <Button asChild className="mt-4">
                <Link href="/projecten">Terug naar Projecten</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Afgeleide cijfers. Uit de berekening als die er is (met factoren), anders
  // uit de opgeslagen voorcalculatie.
  const normUren = calculation?.normUrenTotaal ?? voorcalculatie?.normUrenTotaal ?? 0;
  const scopes = Object.entries(
    calculation?.normUrenPerScope ?? voorcalculatie?.normUrenPerScope ?? {}
  )
    .filter(([, uren]) => uren > 0)
    .sort(([, a], [, b]) => b - a);
  const urenPerDag = voorcalculatie
    ? voorcalculatie.teamGrootte * voorcalculatie.effectieveUrenPerDag
    : 0;
  const werkdagen = heleWerkdagen(voorcalculatie?.geschatteDagen ?? 0);
  const factoren = [
    { label: "Bereikbaarheid", waarde: calculation?.bereikbaarheidFactor ?? 1 },
    { label: "Achterstalligheid", waarde: calculation?.achterstallijkheidFactor ?? 1 },
  ].filter((factor) => Math.abs(factor.waarde - 1) > 0.001);
  const taakUren = (details?.planningTaken ?? []).reduce(
    (som, taak) => som + (taak.normUren ?? 0),
    0
  );

  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${id}`]: project.naam }} />

      {/* Eén reveal op de buitenkant; de blokken eronder zijn gewone divs en
          staan er dus ook als er nul animatieframes vallen.
          → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-5 p-4 md:p-8">
        <ProjectKop
          projectId={id}
          actief="voorcalculatie"
          acties={
            <Button asChild variant="outline">
              <Link href={`/offertes/${offerte._id}`}>
                <FileText className="mr-2 h-4 w-4" />
                Bekijk offerte
                <ExternalLink className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          }
        />

        {/* Uitleg: deze pagina is naslag, de bron is de offerte. */}
        <p className="flex items-start gap-2.5 rounded-lg border border-status-voorcalculatie-border bg-status-voorcalculatie px-4 py-2.5 text-[13px]">
          <Info className="mt-0.5 size-4 shrink-0 text-status-voorcalculatie-text" aria-hidden="true" />
          <span>
            <span className="font-semibold">Naslag uit de offerte.</span>{" "}
            <span className="text-status-voorcalculatie-text">
              Deze cijfers zijn de begroting van het project. Wijzigen doe je in de offerte.
            </span>
          </span>
        </p>

        {voorcalculatie ? (
          <div className="@container/voorcalc">
            <div className="grid items-start gap-5 @4xl/voorcalc:grid-cols-[minmax(0,1fr)_minmax(18rem,23rem)]">
              <div className="flex min-w-0 flex-col gap-4">
                {/* Het antwoord eerst: hoeveel uur, hoeveel dagen. */}
                <section
                  aria-labelledby="begrote-normuren"
                  className="flex flex-col gap-5 rounded-lg border bg-card px-5 py-4"
                >
                  <h2
                    id="begrote-normuren"
                    className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    Begrote normuren
                  </h2>
                  <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                    <span className="font-display text-[44px] leading-none font-semibold tracking-tight tabular-nums">
                      {getal(normUren)} uur
                    </span>
                    <span className="text-base text-muted-foreground tabular-nums">
                      ≈ {werkdagen} {werkdagen === 1 ? "werkdag" : "werkdagen"} met een ploeg van{" "}
                      {voorcalculatie.teamGrootte}
                    </span>
                  </p>

                  {scopes.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      <div
                        role="img"
                        aria-label={scopes
                          .map(([scope, uren]) => `${getScopeDisplayName(scope)} ${getal(uren)} uur`)
                          .join(", ")}
                        className="flex h-3 gap-[3px] overflow-hidden rounded-full"
                      >
                        {scopes.map(([scope, uren]) => (
                          <span
                            key={scope}
                            className={cn("h-full rounded-[3px]", scopeStip(scope))}
                            style={{ flexGrow: uren, flexBasis: 0 }}
                          />
                        ))}
                      </div>
                      <ul className="divide-y divide-border/60">
                        {scopes.map(([scope, uren]) => (
                          <li
                            key={scope}
                            className="grid grid-cols-[12px_minmax(0,1fr)_auto_3.5rem] items-center gap-3 px-1 py-2.5 text-sm"
                          >
                            <span aria-hidden="true" className={cn("size-2.5 rounded-full", scopeStip(scope))} />
                            <span className="truncate font-medium">{getScopeDisplayName(scope)}</span>
                            <span className="text-right font-semibold tabular-nums">{getal(uren)} uur</span>
                            <span className="text-right text-muted-foreground tabular-nums">
                              {procent(uren, normUren)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Geen uitsplitsing per scope beschikbaar.
                    </p>
                  )}
                </section>

                {/* Planning en begroting moeten hetzelfde verhaal vertellen. */}
                {taakUren > 0 && Math.abs(taakUren - normUren) >= 0.5 && (
                  <section
                    aria-label="Afwijking met de planning"
                    className="flex flex-wrap items-start gap-3 rounded-lg border border-[color-mix(in_oklch,var(--accent-warm)_35%,var(--border))] bg-surface-aandacht px-4 py-3.5"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-warm" aria-hidden="true" />
                    <p className="min-w-0 flex-1 text-[13px] text-pretty">
                      <span className="font-semibold tabular-nums">
                        De planning telt {getal(taakUren)} taakuren,{" "}
                        {getal(Math.abs(taakUren - normUren))} {taakUren > normUren ? "meer" : "minder"} dan
                        deze begroting.
                      </span>{" "}
                      <span className="text-muted-foreground">
                        Uitvoering en nacalculatie rekenen met deze {getal(normUren)} uur.
                      </span>
                    </p>
                    <Link
                      href={`/projecten/${id}/planning`}
                      className="text-[13px] font-medium whitespace-nowrap text-primary transition-colors hover:text-primary/80"
                    >
                      Naar planning &rarr;
                    </Link>
                  </section>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                {factoren.length > 0 && (
                  <SectiePaneel titel="Correctiefactoren" kopbalk>
                    <div className="flex flex-col gap-3 px-3 py-3">
                      <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 gap-y-2.5 text-[13px]">
                        {factoren.map((factor) => (
                          <div key={factor.label} className="contents">
                            <dt>{factor.label}</dt>
                            <dd className="font-semibold tabular-nums">
                              × {factor.waarde.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
                            </dd>
                            <dd className="text-accent-warm tabular-nums">
                              {factor.waarde >= 1 ? "+" : "−"}
                              {Math.abs(Math.round((factor.waarde - 1) * 100))}%
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="text-xs text-muted-foreground">
                        De normuren hierboven zijn inclusief deze factoren.
                      </p>
                    </div>
                  </SectiePaneel>
                )}

                <SectiePaneel titel="Zo komen de dagen tot stand" kopbalk>
                  <div className="flex flex-col gap-3 px-3 py-3">
                    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-[13px]">
                      <dt className="text-muted-foreground">Ploeggrootte</dt>
                      <dd className="font-semibold tabular-nums">{voorcalculatie.teamGrootte} personen</dd>
                      <dt className="text-muted-foreground">Effectief per persoon</dt>
                      <dd className="font-semibold tabular-nums">
                        {getal(voorcalculatie.effectieveUrenPerDag)} uur per dag
                      </dd>
                      <dt className="text-muted-foreground">Geschatte duur</dt>
                      <dd className="font-semibold tabular-nums">
                        {werkdagen} {werkdagen === 1 ? "werkdag" : "werkdagen"}
                      </dd>
                    </dl>
                    {urenPerDag > 0 && (
                      <p className="border-t pt-2.5 text-xs text-muted-foreground tabular-nums">
                        {getal(normUren)} uur ÷ ({voorcalculatie.teamGrootte} ×{" "}
                        {getal(voorcalculatie.effectieveUrenPerDag)} uur) ={" "}
                        {getal(normUren / urenPerDag)} → afgerond op {werkdagen}{" "}
                        {werkdagen === 1 ? "werkdag" : "werkdagen"}
                      </p>
                    )}
                  </div>
                </SectiePaneel>
              </div>
            </div>
          </div>
        ) : (
          <SectiePaneel
            titel="Voorcalculatie"
            kopbalk
            legeRegel={{
              tekst: "Geen voorcalculatie",
              hint: "De offerte van dit project heeft er geen; voeg hem toe in de offerte.",
            }}
            acties={
              <Link
                href={`/offertes/${offerte._id}`}
                className="text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                Naar offerte &rarr;
              </Link>
            }
          />
        )}
      </PaginaReveal>
    </>
  );
}
