"use client";

/**
 * Kostendashboard van een project (redesign okt 2026).
 *
 * Hoofdkolom: "Besteed tot nu toe" (heldcijfer tegen begroting, kosten- en
 * urenvoortgang, één duidende zin), een amber signaal voor begrote soorten
 * zonder boeking, en het paneel met Overzicht (per soort) / Posten /
 * Grafieken. Zijkolom: per scope en kengetallen.
 *
 * De knop "Kosten toevoegen" staat in de projectkop van de pagina; de pagina
 * en dit dashboard delen de toevoegflow via `useKostenToevoegen`.
 */

import { memo, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { getMutationErrorMessage } from "@/lib/error-handling";
import { logger } from "@/lib/logger";
import { KostenEntryForm } from "./kosten-entry-form";
import type { CreateArgs } from "./kosten/boeken";
import { KostenAfwijkingChart, KostenVergelijkingChart } from "./kosten-vergelijking-chart";
import { KostenStandPaneel, NietGeboektSignaal } from "./kosten/stand-paneel";
import { PerSoort } from "./kosten/per-soort";
import { PostenTab, type PostVerwijderen } from "./kosten/posten-tab";
import { Kengetallen, PerScope, type ScopeRegel } from "./kosten/zijkolom";
import { scopeNaam } from "./kosten/helpers";
import {
  duidStand,
  isProjectAfgerond,
  nietGeboekteSoorten,
  procentVan,
  standStatus,
  type BudgetStatus,
  type KostSoort,
  type SoortRegel,
} from "./kosten/stand";

// ---------------------------------------------------------------------------
// Toevoegflow — gedeeld tussen de knop in de projectkop en het amber signaal
// ---------------------------------------------------------------------------

export interface KostenToevoegen {
  open: boolean;
  /** Voorinstelling van de soort ("Materiaal boeken"); leeg = standaard. */
  soort?: KostSoort;
  /** Telt op bij elke opening: verse formulierwaarden per keer. */
  sleutel: number;
  openen: (soort?: KostSoort) => void;
  sluiten: () => void;
}

export function useKostenToevoegen(): KostenToevoegen {
  const [staat, setStaat] = useState<{ open: boolean; soort?: KostSoort; sleutel: number }>({
    open: false,
    sleutel: 0,
  });
  const openen = useCallback(
    (soort?: KostSoort) => setStaat((s) => ({ open: true, soort, sleutel: s.sleutel + 1 })),
    []
  );
  const sluiten = useCallback(() => setStaat((s) => ({ ...s, open: false })), []);
  return useMemo(() => ({ ...staat, openen, sluiten }), [staat, openen, sluiten]);
}

// ---------------------------------------------------------------------------

type Weergave = "overzicht" | "posten" | "grafieken";

const PANEELTITEL: Record<Weergave, string> = {
  overzicht: "Per soort",
  posten: "Kostenposten",
  grafieken: "Grafieken",
};

/**
 * Compacte segmentknop; bij een smalle sectie nog iets kleiner. Op touch houdt
 * de trigger zijn min-h-[44px] uit `TabsTrigger`.
 */
const SEGMENT =
  "h-7 flex-none px-2.5 text-[13px] font-normal data-[state=active]:font-semibold @max-sm/sectie:px-1.5 @max-sm/sectie:text-xs";

function DashboardSkelet() {
  return (
    <div className="grid items-start gap-4 @4xl/kosten:grid-cols-[minmax(0,1fr)_22rem] @4xl/kosten:gap-5">
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="h-[230px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Skeleton className="h-[140px] rounded-lg" />
        <Skeleton className="h-[170px] rounded-lg" />
      </div>
    </div>
  );
}

interface ProjectKostenDashboardProps {
  projectId: string;
  toevoegen: KostenToevoegen;
}

export const ProjectKostenDashboard = memo(function ProjectKostenDashboard({
  projectId,
  toevoegen,
}: ProjectKostenDashboardProps) {
  const id = projectId as Id<"projecten">;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weergave, setWeergave] = useState<Weergave>("overzicht");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);

  // Queries
  const overzicht = useQuery(api.projectKosten.getProjectOverzicht, { projectId: id });
  const budgetVergelijking = useQuery(api.projectKosten.getBudgetVergelijking, { projectId: id });
  const kostenPerScope = useQuery(api.projectKosten.getByScope, { projectId: id });
  const kosten = useQuery(api.projectKosten.list, {
    projectId: id,
    type: filterType !== "all" ? (filterType as KostSoort) : undefined,
    startDate: filterStartDate ? format(filterStartDate, "yyyy-MM-dd") : undefined,
    endDate: filterEndDate ? format(filterEndDate, "yyyy-MM-dd") : undefined,
  });

  const deleteKost = useMutation(api.projectKosten.remove);
  const createKost = useMutation(api.projectKosten.create);

  const budget = budgetVergelijking?.data ?? null;

  // Begroot (voorcalculatie/offerte) tegen besteed (registraties), per soort.
  const regels = useMemo<SoortRegel[]>(() => {
    const t = overzicht?.totalen;
    return [
      { soort: "materiaal", begroot: budget?.gepland.materiaal ?? 0, besteed: t?.materiaal ?? 0 },
      { soort: "arbeid", begroot: budget?.gepland.arbeid ?? 0, besteed: t?.arbeid ?? 0 },
      { soort: "machine", begroot: budget?.gepland.machine ?? 0, besteed: t?.machine ?? 0 },
      // Overig wordt (nog) niet begroot en niet uit registraties berekend.
      { soort: "overig", begroot: 0, besteed: 0 },
    ];
  }, [overzicht, budget]);

  // Geboekte scopes, plus scopes uit de voorcalculatie waar nog niets op staat.
  const scopeRegels = useMemo<ScopeRegel[]>(() => {
    if (!kostenPerScope) return [];
    const geboekt: ScopeRegel[] = Object.entries(kostenPerScope)
      .map(([scope, d]) => ({ scope, uren: d.uren, totaal: d.totaal, geboekt: true }))
      .sort((a, b) => b.totaal - a.totaal);
    const gepland = Object.entries(budget?.gepland.urenPerScope ?? {})
      .filter(([scope, uren]) => uren > 0 && !(scope in kostenPerScope))
      .map(([scope]) => ({ scope, uren: 0, totaal: 0, geboekt: false }))
      .sort((a, b) => scopeNaam(a.scope).localeCompare(scopeNaam(b.scope), "nl"));
    return [...geboekt, ...gepland];
  }, [kostenPerScope, budget]);

  const handleSubmit = useCallback(
    async (args: CreateArgs) => {
      setIsSubmitting(true);
      try {
        await createKost(args);
        showSuccessToast(args.type === "materiaal" ? "Materiaal geboekt" : "Machine-inzet geboekt");
        toevoegen.sluiten();
        return true;
      } catch (error) {
        showErrorToast(getMutationErrorMessage(error));
        logger.error("Kosten boeken mislukt", error, { module: "project/kosten" });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [createKost, toevoegen]
  );

  const handleVerwijder = useCallback(
    async (post: PostVerwijderen) => {
      try {
        await deleteKost({ id: post.id, type: post.type, projectId: id });
        showSuccessToast("Kostenpost verwijderd");
      } catch (error) {
        showErrorToast("Fout bij verwijderen");
        logger.error("Verwijderen kostenpost mislukt", error, { module: "project/kosten" });
      }
    },
    [deleteKost, id]
  );

  const clearFilters = useCallback(() => {
    setFilterType("all");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
  }, []);

  const hasActiveFilters = filterType !== "all" || !!filterStartDate || !!filterEndDate;

  if (overzicht === undefined || budgetVergelijking === undefined || kostenPerScope === undefined) {
    return (
      <div className="@container/kosten">
        <DashboardSkelet />
      </div>
    );
  }

  const afgerond = isProjectAfgerond(overzicht?.project.status);
  const besteed = overzicht?.totalen.totaal ?? 0;
  const begroot = budget?.gepland.totaal ?? 0;
  const urenProcent =
    budget && budget.gepland.uren > 0
      ? procentVan(overzicht?.totalen.uren ?? 0, budget.gepland.uren)
      : undefined;
  const status = standStatus({
    afgerond,
    begroot,
    budgetStatus: budget?.budgetStatus as BudgetStatus | undefined,
  });
  const duiding = duidStand({ besteed, begroot, regels, afgerond, urenProcent });
  const nietGeboekt = nietGeboekteSoorten(regels, afgerond);
  const aantalPosten = overzicht?.statistieken.aantalKostenposten ?? 0;

  return (
    <div className="@container/kosten">
      <div className="grid items-start gap-4 @4xl/kosten:grid-cols-[minmax(0,1fr)_22rem] @4xl/kosten:gap-5">
        <div className="flex min-w-0 flex-col gap-4">
          <KostenStandPaneel
            besteed={besteed}
            begroot={begroot}
            status={status}
            kostenProcent={procentVan(besteed, begroot)}
            urenProcent={urenProcent}
            duiding={duiding}
          />

          <NietGeboektSignaal regels={nietGeboekt} onBoeken={toevoegen.openen} />

          <Tabs
            value={weergave}
            onValueChange={(v) => setWeergave(v as Weergave)}
            className="gap-0"
          >
            <SectiePaneel
              titel={PANEELTITEL[weergave]}
              kopbalk
              acties={
                <TabsList aria-label="Weergave" className="h-auto p-[3px] group-data-[orientation=horizontal]/tabs:h-auto">
                  <TabsTrigger value="overzicht" className={SEGMENT}>
                    Overzicht
                  </TabsTrigger>
                  <TabsTrigger value="posten" className={SEGMENT}>
                    Posten<span className="tabular-nums"> · {aantalPosten}</span>
                  </TabsTrigger>
                  <TabsTrigger value="grafieken" className={SEGMENT}>
                    Grafieken
                  </TabsTrigger>
                </TabsList>
              }
            >
              <TabsContent value="overzicht">
                <PerSoort regels={regels} afgerond={afgerond} />
              </TabsContent>

              <TabsContent value="posten">
                {kosten === undefined ? (
                  <div className="flex flex-col gap-2 p-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ) : (
                  <PostenTab
                    kosten={kosten}
                    filterType={filterType}
                    onFilterTypeChange={setFilterType}
                    filterStartDate={filterStartDate}
                    onFilterStartDateChange={setFilterStartDate}
                    filterEndDate={filterEndDate}
                    onFilterEndDateChange={setFilterEndDate}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearFilters}
                    onVerwijder={handleVerwijder}
                  />
                )}
              </TabsContent>

              <TabsContent value="grafieken">
                <KostenVergelijkingChart regels={regels} />
                <KostenAfwijkingChart regels={regels} afgerond={afgerond} />
              </TabsContent>
            </SectiePaneel>
          </Tabs>
        </div>

        <aside aria-label="Per scope en kengetallen" className="flex min-w-0 flex-col gap-4">
          <PerScope regels={scopeRegels} />
          <Kengetallen
            werkdagen={overzicht?.statistieken.werkelijkeDagen ?? 0}
            medewerkers={overzicht?.statistieken.aantalMedewerkers ?? 0}
            uren={overzicht?.totalen.uren ?? 0}
            gemiddeldPerWerkdag={overzicht?.statistieken.gemiddeldeKostenPerDag ?? 0}
          />
        </aside>
      </div>

      {/* Remount per opening, zodat de soort-voorinstelling als beginwaarde landt. */}
      <KostenEntryForm
        key={toevoegen.sleutel}
        open={toevoegen.open}
        onOpenChange={(open) => {
          if (!open) toevoegen.sluiten();
        }}
        projectId={id}
        soort={toevoegen.soort}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </div>
  );
});

export default ProjectKostenDashboard;
