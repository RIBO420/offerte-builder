"use client";

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { useNacalculatie } from "@/hooks/use-nacalculatie";
import { useLeerfeedback } from "@/hooks/use-leerfeedback";
import { PageHeader } from "@/components/page-header";
import { ProjectKop } from "@/components/project/project-kop";
import { NormuurSuggestieCard } from "@/components/project/normuur-suggestie-card";
import { LeerfeedbackHistorie } from "@/components/project/leerfeedback-historie";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { LaadIndicator } from "@/components/ui/laad-indicator";
import { logger } from "@/lib/logger";
import { exportNacalculatieToExcel } from "./export";
import { nacalculatieSignaal } from "./signaal";
import { Uitkomst } from "./components/uitkomst";
import { PerScope } from "./components/per-scope";
import { UrenbronPaneel } from "./components/urenbron-paneel";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

export default function NacalculatiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id as Id<"projecten">;
  const router = useRouter();

  const {
    nacalculatie,
    clientCalculation,
    details,
    isLoading,
    isLoadingDetails,
    save,
    hasVoorcalculatie,
    hasUrenRegistraties,
  } = useNacalculatie(projectId);

  // Leerfeedback: suggesties voor normuren op basis van alle nacalculaties
  const {
    suggesties,
    historie,
    totaalAnalyseerdeProjecten,
    minimumVoorSuggestie,
    isLoading: isLoadingLeerfeedback,
    applyAanpassing,
    revertAanpassing,
  } = useLeerfeedback();

  // `null` = nog niet aangeraakt: dan geldt wat er al is opgeslagen.
  const [conclusiesConcept, setConclusies] = useState<string | null>(null);
  const conclusies = conclusiesConcept ?? nacalculatie?.conclusies ?? "";
  const [opslaanBezig, setOpslaanBezig] = useState<"alleen" | "factuur" | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleSave = useCallback(
    async (naarFactuur: boolean) => {
      if (!clientCalculation) return;

      setOpslaanBezig(naarFactuur ? "factuur" : "alleen");
      try {
        await save({
          werkelijkeUren: clientCalculation.werkelijkeUren,
          werkelijkeDagen: clientCalculation.werkelijkeDagen,
          werkelijkeMachineKosten: clientCalculation.werkelijkeMachineKosten,
          afwijkingUren: clientCalculation.afwijkingUren,
          afwijkingPercentage: clientCalculation.afwijkingPercentage,
          afwijkingenPerScope: clientCalculation.afwijkingenPerScopeMap,
          conclusies,
          // Een afgerond project gaat met het opslaan naar nacalculatie_compleet
          updateProjectStatus: details?.project?.status === "afgerond",
        });

        if (naarFactuur) {
          toast.success("Nacalculatie opgeslagen");
          router.push(`/projecten/${id}/factuur`);
        } else {
          toast.success("Nacalculatie opgeslagen", {
            action: {
              label: "Naar factuur",
              onClick: () => router.push(`/projecten/${id}/factuur`),
            },
          });
        }
      } catch (error) {
        toast.error("Fout bij opslaan nacalculatie");
        logger.error("Opslaan nacalculatie mislukt", error, {
          module: "projecten/nacalculatie",
        });
      } finally {
        setOpslaanBezig(null);
      }
    },
    [clientCalculation, conclusies, save, details?.project?.status, router, id]
  );

  const handleExport = useCallback(async () => {
    if (!clientCalculation || !details) return;

    setIsExporting(true);
    try {
      await exportNacalculatieToExcel({
        projectNaam: details.project?.naam || "Project",
        berekening: clientCalculation,
        voorcalculatie: details.voorcalculatie,
        conclusies,
      });
      toast.success("Excel-export gedownload");
    } catch (error) {
      toast.error("Fout bij exporteren");
      logger.error("Excel-export nacalculatie mislukt", error, {
        module: "projecten/nacalculatie",
      });
    } finally {
      setIsExporting(false);
    }
  }, [clientCalculation, details, conclusies]);

  const handleApplySuggestie = useCallback(
    async (normuurId: string, nieuweWaarde: number, reden: string, bronProjecten: string[]) => {
      try {
        await applyAanpassing({
          normuurId: normuurId as Id<"normuren">,
          nieuweWaarde,
          reden,
          bronProjecten: bronProjecten as Id<"projecten">[],
        });
        toast.success("Normuur aangepast");
      } catch (error) {
        toast.error("Fout bij aanpassen normuur");
        logger.error("Aanpassen normuur mislukt", error, {
          module: "projecten/nacalculatie",
        });
      }
    },
    [applyAanpassing]
  );

  const handleRevert = useCallback(
    async (historieId: Id<"leerfeedback_historie">) => {
      try {
        await revertAanpassing(historieId);
        toast.success("Aanpassing teruggedraaid");
      } catch (error) {
        toast.error("Fout bij terugdraaien");
        logger.error("Terugdraaien normuur-aanpassing mislukt", error, {
          module: "projecten/nacalculatie",
        });
      }
    },
    [revertAanpassing]
  );

  const signaal = useMemo(
    () => (clientCalculation ? nacalculatieSignaal(clientCalculation) : null),
    [clientCalculation]
  );

  const laden = Boolean(isLoading || isLoadingDetails);
  const urenBronConflict = details?.urenBronConflict === true;
  const bezig = opslaanBezig !== null;

  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${id}`]: details?.project?.naam || "Project" }} />

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-8">
        <ProjectKop
          projectId={id}
          actief="nacalculatie"
          acties={
            <>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!clientCalculation || isExporting}
              >
                {isExporting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Exporteren
              </Button>
              <Button onClick={() => handleSave(true)} disabled={!clientCalculation || bezig}>
                {opslaanBezig === "factuur" && <Loader2 className="mr-2 size-4 animate-spin" />}
                Opslaan en naar factuur
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </>
          }
        />

        {laden ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <LaadIndicator formaat="pagina" />
          </div>
        ) : (
          <div className={`${REVEAL_KLASSE} @container/werk`}>
            <div className="grid items-start gap-5 @4xl/werk:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
              <div className="flex min-w-0 flex-col gap-4">
                {clientCalculation ? (
                  <>
                    {!hasUrenRegistraties && (
                      <OntbrekendeGegevens
                        projectId={id}
                        urenBronConflict={urenBronConflict}
                        hasVoorcalculatie={hasVoorcalculatie}
                        hasUrenRegistraties={hasUrenRegistraties}
                      />
                    )}
                    <Uitkomst
                      data={clientCalculation}
                      teamGrootte={details?.voorcalculatie?.teamGrootte}
                    />

                    {signaal && (
                      <section
                        aria-label="Let op bij deze nacalculatie"
                        className="flex gap-3 rounded-lg border border-status-herinnering-border bg-surface-aandacht px-4 py-3.5"
                      >
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-status-herinnering-text"
                          aria-hidden="true"
                        />
                        <p className="text-pretty text-[13px]">
                          <span className="font-semibold">{signaal.kop}</span>{" "}
                          <span className="text-muted-foreground">{signaal.uitleg}</span>
                        </p>
                      </section>
                    )}

                    <PerScope afwijkingen={clientCalculation.afwijkingenPerScope} />

                    <SectiePaneel
                      titel="Normuren bijstellen"
                      kopbalk
                      telling={suggesties.length}
                      uitleg="Normuren worden alleen aangepast als jij een suggestie overneemt. Elke aanpassing wordt gelogd en kan worden teruggedraaid."
                      legeRegel={
                        !isLoadingLeerfeedback && suggesties.length === 0
                          ? {
                              tekst: "Geen suggesties.",
                              hint:
                                totaalAnalyseerdeProjecten < minimumVoorSuggestie
                                  ? `Nog ${minimumVoorSuggestie - totaalAnalyseerdeProjecten} projecten met nacalculatie nodig.`
                                  : "De normuren kloppen met de projectdata.",
                            }
                          : undefined
                      }
                    >
                      {isLoadingLeerfeedback ? (
                        <div className="flex items-center justify-center py-8">
                          <LaadIndicator formaat="sectie" />
                        </div>
                      ) : (
                        suggesties.length > 0 && (
                          <div className="flex flex-col gap-3 p-4">
                            <p className="text-xs text-muted-foreground">
                              Gebaseerd op {totaalAnalyseerdeProjecten} projecten (minimaal{" "}
                              {minimumVoorSuggestie} voor een suggestie).
                            </p>
                            <div className="grid gap-4 @3xl/sectie:grid-cols-2">
                              {suggesties.map((suggestie) => (
                                <NormuurSuggestieCard
                                  key={suggestie.id}
                                  suggestie={suggestie}
                                  onApply={handleApplySuggestie}
                                />
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </SectiePaneel>

                    {historie.length > 0 && (
                      <LeerfeedbackHistorie
                        historie={historie}
                        onRevert={handleRevert}
                        isLoading={isLoadingLeerfeedback ?? false}
                      />
                    )}
                  </>
                ) : (
                  <OntbrekendeGegevens
                    projectId={id}
                    urenBronConflict={urenBronConflict}
                    hasVoorcalculatie={hasVoorcalculatie}
                    hasUrenRegistraties={hasUrenRegistraties}
                  />
                )}
              </div>

              <aside aria-label="Afronden" className="flex min-w-0 flex-col gap-4">
                <UrenbronPaneel projectId={projectId} />

                <SectiePaneel titel="Leerpunten" kopbalk>
                  <div className="flex flex-col gap-2.5 p-4">
                    <label htmlFor="leerpunten" className="text-xs text-muted-foreground">
                      Wat neem je mee naar het volgende project? (optioneel)
                    </label>
                    <Textarea
                      id="leerpunten"
                      rows={5}
                      placeholder="Bijv. graszoden sneller gelegd dan begroot bij vlakke tuin…"
                      value={conclusies}
                      onChange={(e) => setConclusies(e.target.value)}
                      className="resize-y text-[13px]"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleSave(false)}
                      disabled={!clientCalculation || bezig}
                    >
                      {opslaanBezig === "alleen" && <Loader2 className="mr-2 size-4 animate-spin" />}
                      Alleen opslaan
                    </Button>
                  </div>
                </SectiePaneel>
              </aside>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Uitkomst kan nog niet: wat ontbreekt er en waar los je dat op. */
function OntbrekendeGegevens({
  projectId,
  urenBronConflict,
  hasVoorcalculatie,
  hasUrenRegistraties,
}: {
  projectId: string;
  urenBronConflict: boolean;
  hasVoorcalculatie: boolean;
  hasUrenRegistraties: boolean;
}) {
  const regels: { tekst: string; uitleg: string; href?: string; actie?: string }[] = [];
  if (urenBronConflict) {
    regels.push({
      tekst: "Kies eerst de urenbron.",
      uitleg: "Dit project heeft uren in twee bronnen. Kies rechts welke meetellen.",
    });
  }
  if (!hasVoorcalculatie) {
    regels.push({
      tekst: "Geen voorcalculatie.",
      uitleg: "Zonder geplande uren is er niets om tegen af te zetten.",
      href: `/projecten/${projectId}/voorcalculatie`,
      actie: "Naar voorcalculatie",
    });
  }
  if (!hasUrenRegistraties && !urenBronConflict) {
    regels.push({
      tekst: "Geen urenregistraties.",
      uitleg: "Registreer eerst de gewerkte uren in de uitvoering.",
      href: `/projecten/${projectId}/uitvoering`,
      actie: "Naar uitvoering",
    });
  }

  return (
    <SectiePaneel titel="Nog niet compleet">
      <ul className="flex flex-col divide-y">
        {regels.map((regel) => (
          <li key={regel.tekst} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <p className="min-w-0 text-[13px]">
              <span className="font-semibold">{regel.tekst}</span>{" "}
              <span className="text-muted-foreground">{regel.uitleg}</span>
            </p>
            {regel.href && (
              <Button variant="outline" size="sm" asChild>
                <Link href={regel.href}>
                  {regel.actie}
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </SectiePaneel>
  );
}
