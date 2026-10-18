"use client";

/**
 * Projectoverzicht (redesign okt 2026): waar staat het project? De vier
 * fasen als kaarten op een rij, daaronder het klantgesprek; rechts de
 * gegevens en de kosten. De kop (naam, status, fasen) is de gedeelde
 * `ProjectKop`; de oude kop, de stepper en de modulepills zijn vervallen.
 */

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { klantNaam } from "@convex/lib/offerteKlant";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  Clock,
  FileText,
  ListTodo,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProjectKop, projectFasen, type Fase } from "@/components/project/project-kop";
import {
  getal,
  heleWerkdagen,
  procent,
  VoortgangsBalk,
} from "@/components/project/project-cijfers";
import { WerklocatieCard } from "@/components/project/werklocatie-card";
import { KlantThreadPaneel } from "@/components/meldingen/klant-thread-paneel";
import { ProjectDetailSkeleton } from "@/components/skeletons";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import { getScopeDisplayName } from "@/lib/planning-templates";
import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

/** De logische volgende stap per projectstatus — de ene gevulde knop in de kop. */
const HOOFDSTAP: Record<string, { label: string; pad: string; icoon: LucideIcon; omlijnd?: boolean }> = {
  voorcalculatie: { label: "Naar de planning", pad: "planning", icoon: ListTodo },
  gepland: { label: "Naar de planning", pad: "planning", icoon: ListTodo },
  in_uitvoering: { label: "Uren registreren", pad: "uitvoering", icoon: Clock },
  afgerond: { label: "Nacalculatie maken", pad: "nacalculatie", icoon: Calculator },
  nacalculatie_compleet: { label: "Factuur maken", pad: "factuur", icoon: Receipt },
  gefactureerd: { label: "Factuur bekijken", pad: "factuur", icoon: Receipt, omlijnd: true },
};

/** Het stap-rondje uit de fase-tabs van `ProjectKop`, zelfde receptuur. */
function StapTeken({ fase }: { fase: Fase }) {
  return (
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
}

/**
 * Eén fasekaart. Open fasen zijn een link naar hun pagina; dichte fasen zijn
 * gestippeld, niet klikbaar, en zeggen waarom ze nog dicht zijn.
 */
function FaseKaart({
  fase,
  href,
  dichtTitel,
  dichtUitleg,
  children,
}: {
  fase: Fase;
  href: string;
  /** Waarom de fase nog dicht is; niet nodig voor Planning (altijd open). */
  dichtTitel?: string;
  dichtUitleg?: string;
  children: ReactNode;
}) {
  const label = (
    <span
      className={cn(
        "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
        fase.nu ? "text-status-in-uitvoering-text" : "text-muted-foreground"
      )}
    >
      <StapTeken fase={fase} />
      {fase.label}
      {fase.nu && <span className="font-medium normal-case tracking-normal">· nu</span>}
      {fase.klaar && <span className="sr-only">(klaar)</span>}
    </span>
  );

  if (!fase.open) {
    return (
      <div
        aria-disabled="true"
        className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-dashed p-4"
      >
        {label}
        <span className="text-sm text-muted-foreground">{dichtTitel}</span>
        <span className="text-xs text-muted-foreground/80">{dichtUitleg}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "card-interactive flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        fase.nu && "border-status-in-uitvoering-border"
      )}
    >
      {label}
      {children}
    </Link>
  );
}

/** Het grote getal van een fasekaart met zijn eenheid erachter. */
function KaartGetal({ groot, klein }: { groot: string; klein: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-display text-[26px] leading-none font-semibold tabular-nums">
        {groot}
      </span>
      <span className="text-[13px] tabular-nums text-muted-foreground">{klein}</span>
    </span>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;
  const [werklocatieOpen, setWerklocatieOpen] = useState(false);

  const budgetStatus = useQuery(api.projectKosten.getBudgetStatus, { projectId });
  const projectDetails = useQuery(api.projecten.getWithDetails, { id: projectId });
  // Zelfde query als WerklocatieCard in de sheet; Convex dedupliceert.
  const werklocatie = useQuery(api.werklocaties.getByProject, { projectId });
  const teamId = projectDetails?.project.teamId;
  const team = useQuery(api.teams.get, teamId ? { id: teamId } : "skip");

  if (projectDetails === undefined) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}`]: "Project" }} />
        <ProjectDetailSkeleton />
      </>
    );
  }

  if (!projectDetails) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}`]: "Niet gevonden" }} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <FileText className="size-12 text-muted-foreground/50" aria-hidden="true" />
          <h2 className="font-display text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/projecten")}>
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            Terug naar projecten
          </Button>
        </div>
      </>
    );
  }

  const { project, offerte, voorcalculatie, planningTaken, nacalculatie } = projectDetails;
  const [planning, uitvoering, nacalculatieFase, factuur] = projectFasen(project.status);
  const basis = `/projecten/${id}`;

  // — Planning —
  const takenTotaal = planningTaken.length;
  const takenKlaar = planningTaken.filter((t) => t.status === "afgerond").length;
  const werkdagen = heleWerkdagen(planningTaken.reduce((som, t) => som + t.geschatteDagen, 0));

  // — Uitvoering — (null = de urenbronnen spreken elkaar tegen)
  const gelogd = projectDetails.totaalGeregistreerdeUren;
  const begroot = voorcalculatie?.normUrenTotaal ?? 0;
  const urenPct = gelogd !== null ? procent(gelogd, begroot) : 0;

  // — Gegevens —
  const klant = offerte ? klantNaam(offerte.klant) : null;
  const scopes = (offerte?.scopes ?? []).map(getScopeDisplayName);
  const teamleden = voorcalculatie?.teamleden ?? [];
  const teamTekst =
    teamleden.length > 0
      ? `${teamleden.slice(0, 2).join(", ")}${teamleden.length > 2 ? ` +${teamleden.length - 2}` : ""}`
      : (team?.naam ?? null);

  const hoofdstap = HOOFDSTAP[project.status];
  const HoofdIcoon = hoofdstap?.icoon;

  return (
    <>
      <PageHeader customLabels={{ [basis]: project.naam }} />

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-8">
        <ProjectKop
          projectId={id}
          actief="overzicht"
          acties={
            hoofdstap && HoofdIcoon ? (
              <Button asChild variant={hoofdstap.omlijnd ? "outline" : "default"}>
                <Link href={`${basis}/${hoofdstap.pad}`}>
                  <HoofdIcoon className="mr-2 size-4" aria-hidden="true" />
                  {hoofdstap.label}
                </Link>
              </Button>
            ) : undefined
          }
        />

        <div className="@container/overzicht">
          <div className="grid items-start gap-5 @4xl/overzicht:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <div className="flex min-w-0 flex-col gap-5">
              {/* Waar staat het project: de fasen als kaarten, in volgorde */}
              <section
                aria-label="Stand per fase"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12.5rem),1fr))] gap-3"
              >
                <FaseKaart fase={planning} href={`${basis}/planning`}>
                  {takenTotaal > 0 ? (
                    <>
                      <KaartGetal groot={`${takenKlaar} / ${takenTotaal}`} klein="taken klaar" />
                      <VoortgangsBalk waarde={procent(takenKlaar, takenTotaal)} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {takenTotaal - takenKlaar} open · {werkdagen}{" "}
                        {werkdagen === 1 ? "werkdag" : "werkdagen"} doorlooptijd
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground">Nog geen taken</span>
                      <span className="text-xs text-muted-foreground">
                        Genereer de taken uit de voorcalculatie.
                      </span>
                    </>
                  )}
                </FaseKaart>

                <FaseKaart
                  fase={uitvoering}
                  href={`${basis}/${gelogd === null ? "nacalculatie" : "uitvoering"}`}
                  dichtTitel="Zodra het project in uitvoering is"
                  dichtUitleg="Gelogde uren lopen hier mee tegen de begroting."
                >
                  {gelogd === null ? (
                    <>
                      <span className="text-sm font-medium">Urenbron kiezen</span>
                      <span className="text-xs text-muted-foreground">
                        Twee urenbronnen spreken elkaar tegen; kies welke meetelt.
                      </span>
                    </>
                  ) : (
                    <>
                      <KaartGetal
                        groot={getal(gelogd)}
                        klein={begroot > 0 ? `van ${getal(begroot)} uur` : "uur gelogd"}
                      />
                      {begroot > 0 && (
                        <>
                          <VoortgangsBalk
                            waarde={urenPct}
                            vulling="bg-accent-warm"
                            spoor="bg-accent-warm/15"
                          />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {urenPct}% ·{" "}
                            {gelogd > begroot
                              ? `${getal(gelogd - begroot)} uur over de begroting`
                              : "op schema"}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </FaseKaart>

                <FaseKaart
                  fase={nacalculatieFase}
                  href={`${basis}/nacalculatie`}
                  dichtTitel="Na afronden van de uitvoering"
                  dichtUitleg="Vergelijkt gelogde uren met de begroting."
                >
                  {nacalculatie ? (
                    <>
                      <KaartGetal
                        groot={`${nacalculatie.afwijkingPercentage > 0 ? "+" : ""}${getal(nacalculatie.afwijkingPercentage)}%`}
                        klein="afwijking"
                      />
                      <span className="text-xs text-muted-foreground">
                        Gelogde uren tegenover de begroting.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium">Nog niet gemaakt</span>
                      <span className="text-xs text-muted-foreground">
                        Vergelijk gelogde uren met de begroting.
                      </span>
                    </>
                  )}
                </FaseKaart>

                <FaseKaart
                  fase={factuur}
                  href={`${basis}/factuur`}
                  dichtTitel="Na de nacalculatie"
                  dichtUitleg="Op basis van de offerte."
                >
                  <span className="text-sm font-medium">
                    {project.status === "gefactureerd" ? "Gefactureerd" : "Klaar om te factureren"}
                  </span>
                  <span className="text-xs text-muted-foreground">Op basis van de offerte.</span>
                </FaseKaart>
              </section>

              {/* Klantgesprek bij dit werkitem (§3.1) */}
              {project.klantId && (
                <section aria-labelledby="h-gesprek" className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                    <h2 id="h-gesprek" className="font-display text-[15px] font-semibold">
                      Klantgesprek
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      berichten aan de klant staan in het klantportaal
                    </span>
                  </div>
                  <KlantThreadPaneel klantId={project.klantId} werkitemId={projectId} />
                </section>
              )}
            </div>

            <aside aria-label="Projectgegevens" className="flex min-w-0 flex-col gap-4">
              <SectiePaneel titel="Gegevens" kopbalk>
                <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 p-4 text-[13px]">
                  {klant && (
                    <>
                      <dt className="text-muted-foreground">Klant</dt>
                      <dd className="min-w-0 truncate">
                        {project.klantId ? (
                          <Link
                            href={`/klanten/${project.klantId}`}
                            className="text-primary hover:underline"
                          >
                            {klant}
                          </Link>
                        ) : (
                          klant
                        )}
                      </dd>
                    </>
                  )}
                  {offerte && (
                    <>
                      <dt className="text-muted-foreground">Offerte</dt>
                      <dd className="min-w-0 truncate">
                        <Link
                          href={`/offertes/${offerte._id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {offerte.offerteNummer}
                        </Link>
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Werklocatie</dt>
                  <dd className="min-w-0">
                    {werklocatie === undefined ? (
                      <Skeleton className="h-4 w-40 max-w-full" />
                    ) : werklocatie ? (
                      <>
                        {werklocatie.adres}, {werklocatie.plaats} ·{" "}
                        <button
                          type="button"
                          onClick={() => setWerklocatieOpen(true)}
                          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          bekijk
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground">Nog niet ingevuld · </span>
                        <button
                          type="button"
                          onClick={() => setWerklocatieOpen(true)}
                          className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          toevoegen
                        </button>
                      </>
                    )}
                  </dd>
                  {scopes.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">Scopes</dt>
                      <dd className="min-w-0">{scopes.join(", ")}</dd>
                    </>
                  )}
                  {teamTekst && (
                    <>
                      <dt className="text-muted-foreground">Team</dt>
                      <dd className="min-w-0" title={teamleden.length > 2 ? teamleden.join(", ") : undefined}>
                        {teamTekst}
                      </dd>
                    </>
                  )}
                </dl>
              </SectiePaneel>

              <SectiePaneel
                titel="Kosten"
                kopbalk
                acties={
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-status-afgerond-text">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-status-afgerond-dot" />
                      live
                    </span>
                    <Link
                      href={`${basis}/kosten`}
                      className="text-[13px] font-medium text-primary hover:underline"
                    >
                      Bekijk →
                    </Link>
                  </span>
                }
              >
                <div className="flex flex-col gap-2 p-4">
                  {budgetStatus === undefined ? (
                    <Skeleton className="h-4 w-48 max-w-full" />
                  ) : budgetStatus && budgetStatus.budget > 0 ? (
                    <>
                      <p className="text-[13px] tabular-nums">
                        <span className="font-medium">
                          {formatCurrency(budgetStatus.werkelijkeKosten)}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          van {formatCurrency(budgetStatus.budget)} budget
                        </span>
                      </p>
                      <VoortgangsBalk
                        waarde={budgetStatus.percentage}
                        vulling={
                          budgetStatus.drempel100
                            ? "bg-destructive"
                            : budgetStatus.drempel80
                              ? "bg-accent-warm"
                              : "bg-status-afgerond-dot"
                        }
                      />
                      <p
                        className={cn(
                          "flex items-center gap-1.5 text-xs tabular-nums",
                          budgetStatus.drempel100
                            ? "font-medium text-destructive"
                            : budgetStatus.drempel80
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {budgetStatus.drempel80 && (
                          <AlertTriangle
                            className={cn(
                              "size-3.5 shrink-0",
                              budgetStatus.drempel100 ? "text-destructive" : "text-accent-warm"
                            )}
                            aria-hidden="true"
                          />
                        )}
                        {budgetStatus.drempel100
                          ? `Budget overschreden: ${budgetStatus.percentage}% verbruikt`
                          : budgetStatus.drempel80
                            ? `Let op: ${budgetStatus.percentage}% van het budget verbruikt`
                            : `${budgetStatus.percentage}% van het budget verbruikt`}
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      Uren, materiaal en machines lopen hier mee terwijl het project loopt.
                    </p>
                  )}
                </div>
              </SectiePaneel>
            </aside>
          </div>
        </div>
      </div>

      <Sheet open={werklocatieOpen} onOpenChange={setWerklocatieOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Werklocatie</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <WerklocatieCard projectId={projectId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
