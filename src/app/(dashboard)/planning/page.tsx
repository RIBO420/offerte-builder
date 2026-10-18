"use client";

import { useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginaReveal } from "@/components/pagina-reveal";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { FolderKanban } from "lucide-react";
import {
  PlanningBanenSkeleton,
  PlanningPageSkeleton,
} from "@/components/ui/skeleton-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsAdmin, useIsKantoor } from "@/hooks/use-users";
import {
  LetOpStrook,
  MeerwerkBeoordeling,
} from "@/components/planning/wie-is-achter-widget";
import {
  PlanningBanen,
  verdeelOverBanen,
  type PlanningProject,
} from "@/components/planning/planning-banen";
import { MaandKalender } from "@/components/planning/maand-kalender";
import { KwartaalOverzicht } from "@/components/planning/kwartaal-overzicht";
import { JaarOverzicht } from "@/components/planning/jaar-overzicht";
import { PlanningTabs } from "@/components/planbord/planning-tabs";
import { kolomLabel, vandaagIso } from "@/components/planbord/periode";

type PlanningView = "projecten" | "maand" | "kwartaal" | "jaar";

const PERIODES: { id: PlanningView; label: string }[] = [
  { id: "projecten", label: "Projecten" },
  { id: "maand", label: "Maand" },
  { id: "kwartaal", label: "Kwartaal" },
  { id: "jaar", label: "Jaar" },
];

export default function PlanningPage() {
  return (
    <Suspense fallback={<PlanningPageLoader />}>
      <PlanningPageContent />
    </Suspense>
  );
}

function PlanningPageLoader() {
  return (
    <>
      <PageHeader />
      <div className="mx-auto flex w-full max-w-[86rem] flex-1 flex-col p-4 md:p-6">
        <PlanningPageSkeleton />
      </div>
    </>
  );
}

/** Geheel getal binnen [min, max] uit een URL-parameter, anders undefined. */
function geheelGetalParam(waarde: string | null, min: number, max: number): number | undefined {
  if (waarde === null || !/^\d+$/.test(waarde)) return undefined;
  const getal = Number(waarde);
  return getal >= min && getal <= max ? getal : undefined;
}

/** "13 okt – 15 okt" of "13 okt" — voor de Let op-regel van verlopen planning. */
function periodeTekst(start: string, eind: string | null): string {
  const s = kolomLabel(start).datum;
  return eind && eind !== start ? `${s} – ${kolomLabel(eind).datum}` : s;
}

function PlanningPageContent() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isAdmin = useIsAdmin();
  const isKantoor = useIsKantoor();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Weergave uit de URL. "week" was de oude naam van de projectweergave;
  // oude links blijven dus werken.
  const viewParam = searchParams.get("view");
  const currentView: PlanningView =
    viewParam === "maand" || viewParam === "kwartaal" || viewParam === "jaar"
      ? viewParam
      : "projecten";

  const setView = useCallback(
    (view: PlanningView) => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === "projecten") {
        params.delete("view");
      } else {
        params.set("view", view);
      }
      // Jaar/maand horen alleen bij de maandweergave; anders blijven ze
      // hangen en opent een latere klik op "Maand" een oude maand.
      if (view !== "maand") {
        params.delete("jaar");
        params.delete("maand");
      }
      const query = params.toString();
      router.push(`/planning${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Van de jaarweergave naar de maandweergave van de aangeklikte maand
  // (maand 1–12). Jaar en maand gaan via de URL, zodat terug-navigeren klopt.
  const handleNavigateToMonth = useCallback(
    (year: number, month: number) => {
      const params = new URLSearchParams();
      params.set("view", "maand");
      params.set("jaar", String(year));
      params.set("maand", String(month));
      router.push(`/planning?${params.toString()}`, { scroll: false });
    },
    [router]
  );
  // Alleen gehele getallen binnen bereik: "?maand=13" liet de maandkalender
  // crashen. Ongeldig = huidige maand/jaar.
  const maandJaar = geheelGetalParam(searchParams.get("jaar"), 2000, 2100);
  const maandNummer = geheelGetalParam(searchParams.get("maand"), 1, 12);

  const projectVoortgangData = useQuery(
    api.projectRapportages.getProjectVoortgang,
    user?._id && currentView === "projecten" ? { alleenActief: true } : "skip"
  );

  const medewerkerNaam = user?.name ?? null;

  // Alleen gepland en in uitvoering; medewerkers zien alleen hun eigen
  // projecten (op naam in het team).
  const projecten: PlanningProject[] = useMemo(() => {
    const lijst = projectVoortgangData?.projecten ?? [];
    return lijst.filter((p) => {
      const actief = p.status === "gepland" || p.status === "in_uitvoering";
      if (!actief) return false;
      if (isAdmin) return true;
      if (!medewerkerNaam) return false;
      return p.teamleden?.some(
        (naam) => naam.toLowerCase() === medewerkerNaam.toLowerCase()
      );
    });
  }, [projectVoortgangData, isAdmin, medewerkerNaam]);

  const indeling = useMemo(
    () => verdeelOverBanen(projecten, vandaagIso()),
    [projecten]
  );

  const isLoading =
    isUserLoading || (currentView === "projecten" && projectVoortgangData === undefined);

  return (
    <>
      <PageHeader />

      {/* Eén reveal op de buitenkant, geen gestapelde delays eronder: de blokken
          hieronder zijn gewone divs en staan er dus ook als er nul
          animatieframes vallen. → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="@container/planning mx-auto flex w-full max-w-[86rem] flex-1 flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-[28px]">
              Planning
            </h1>
            {/* Samenvatting als scanbare regel, zelfde vorm als de dagstaat. */}
            {currentView === "projecten" && !isLoading && (
              <p className="text-[15px] text-muted-foreground tabular-nums">
                {[
                  [projecten.length, projecten.length === 1 ? "actief project" : "actieve projecten"],
                  [indeling.inUitvoering.length, "in uitvoering"],
                  [indeling.ingepland.length, "ingepland"],
                  [indeling.zonderDatum.length, "nog zonder datum"],
                ].map(([getal, staart], i) => (
                  <span key={String(staart)}>
                    {i > 0 && " · "}
                    <span className="font-semibold text-foreground">{getal}</span> {staart}
                  </span>
                ))}
              </p>
            )}
          </div>
          <PlanningTabs actief="/planning" />
        </div>

        {/* Veld-rol §2.6 (kantoor): wat niet klopt, bovenaan en compact.
            Meerwerk wacht op een besluit, dus in elke weergave; de Let
            op-strook leunt op de projectlijst en staat alleen bij Projecten.
            empty:hidden: zonder meerwerk en buiten Projecten geen lege gap. */}
        {isKantoor && (
          <div className="flex flex-col gap-3 empty:hidden">
            {currentView === "projecten" && (
              <LetOpStrook
                verlopen={indeling.verlopen.map((p) => ({
                  projectId: p.projectId,
                  projectNaam: p.projectNaam,
                  periode: periodeTekst(p.geplandeStart!, p.geplandeEind),
                  geplandeStart: p.geplandeStart!,
                }))}
              />
            )}
            <MeerwerkBeoordeling />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="group" aria-label="Weergave" className="flex flex-wrap gap-0.5 rounded-lg bg-muted p-[3px]">
            {PERIODES.map((periode) => (
              <button
                key={periode.id}
                type="button"
                aria-pressed={currentView === periode.id}
                onClick={() => setView(periode.id)}
                className={`h-[30px] whitespace-nowrap rounded-md px-3 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  currentView === periode.id
                    ? "bg-card font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {periode.label}
              </button>
            ))}
          </div>
          {currentView === "projecten" && (
            <p className="text-[13px] text-muted-foreground">
              Van links naar rechts: van nog in te plannen tot in uitvoering.
            </p>
          )}
          {isAdmin && (
            <Link
              href="/projecten"
              className="ml-auto text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
            >
              Alle projecten &rarr;
            </Link>
          )}
        </div>

        {currentView === "projecten" &&
          (isLoading ? (
            <PlanningBanenSkeleton />
          ) : projecten.length === 0 ? (
            <EmptyState
              icon={<FolderKanban aria-hidden />}
              title={isAdmin ? "Geen actieve projecten" : "Geen projecten toegewezen"}
              description={
                isAdmin
                  ? "Er zijn geen projecten in planning of uitvoering. Start een project vanuit een geaccepteerde offerte."
                  : "Je bent nog niet aan een project toegewezen. Neem contact op met je leidinggevende."
              }
              action={{
                label: isAdmin ? "Geaccepteerde offertes" : "Naar het dashboard",
                onClick: () =>
                  router.push(isAdmin ? "/offertes?status=geaccepteerd" : "/dashboard"),
              }}
            />
          ) : (
            <PlanningBanen indeling={indeling} />
          ))}

        {currentView === "maand" && (
          <MaandKalender
            key={`${maandJaar ?? ""}-${maandNummer ?? ""}`}
            initialYear={maandJaar}
            initialMonth={maandNummer}
          />
        )}
        {currentView === "kwartaal" && <KwartaalOverzicht />}
        {currentView === "jaar" && <JaarOverzicht onNavigateToMonth={handleNavigateToMonth} />}
      </PaginaReveal>
    </>
  );
}
