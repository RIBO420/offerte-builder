"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { api } from "../../../../../../convex/_generated/api";
import { Doc, Id } from "../../../../../../convex/_generated/dataModel";
import { klantNaam } from "@convex/lib/offerteKlant";
import { usePdfTheme } from "@/hooks/use-pdf-theme";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ProjectKop } from "@/components/project/project-kop";
import {
  ProjectCompletedCelebration,
  InvoiceSentSuccess,
  FactuurPageSkeleton,
  useFactuurHandlers,
  FactuurActionButtons,
  FactuurStappen,
  huidigeFactuurStap,
  FactuurPapier,
  UitDeOfferte,
  FactuurInfo,
  Daarna,
  AanmaningStatusCard,
  HerinneringenHistorie,
  CreditnotaInfo,
  BoekhoudSyncStatusCard,
  AanmaningDialog,
} from "./components";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";
import { FactuurTeksten } from "./components/factuur-teksten";
import { BtwVerlegdKaart, ProjectFacturenWissel } from "./components/factuur-keten";
import { btwVerlegdRegel, weergaveCorrecties } from "@convex/lib/termijnFacturatie";

/** Klantgerichte naam op het papier — nooit "Top Tuinen OS". */
const KLANT_MERKNAAM = "Top Tuinen";

// ---------------------------------------------------------------------------
// Type aliases voor queryresultaten
// ---------------------------------------------------------------------------

type AanmaningStatusType = {
  heeftEerste?: boolean;
  heeftTweede?: boolean;
  heeftIngebrekestelling?: boolean;
  totaalVerstuurd: number;
  volgendNiveau?: string | null;
};

type HerinneringenType = Array<{
  _id: string;
  type: string;
  volgnummer: number;
  emailVerstuurd?: boolean;
  verstuurdAt: number;
  dagenVervallen: number;
  notities?: string;
}>;

type BoekhoudSyncStatusType = {
  syncStatus: string;
  externalId?: string;
  lastSyncAt?: number;
  syncEntry?: {
    _id: string;
    syncStatus: string;
    errorMessage?: string;
    externalUrl?: string;
    provider: string;
    lastSyncAt?: number;
    retryCount?: number;
  } | null;
};

/**
 * Btw-label uit de offertetotalen. Alleen een percentage noemen als het
 * eenduidig 21% of 9% is; bij gemengde tarieven gewoon "Btw".
 */
function btwLabel(exBtw: number, btw: number): string {
  if (!(exBtw > 0) || btw === 0) return btw === 0 ? "Btw 0%" : "Btw";
  const procent = (btw / exBtw) * 100;
  if (Math.abs(procent - 21) < 0.2) return "Btw 21%";
  if (Math.abs(procent - 9) < 0.2) return "Btw 9%";
  return "Btw";
}

/** Btw-regels van een gegenereerde factuur: per tarief als de uitsplitsing er is. */
function factuurBtw(factuur: Doc<"facturen">): { label: string; bedrag: number }[] {
  if (factuur.btwUitsplitsing && factuur.btwUitsplitsing.length > 0) {
    return factuur.btwUitsplitsing.map((b) => ({ label: `Btw ${b.percentage}%`, bedrag: b.bedrag }));
  }
  return [{ label: `Btw ${factuur.btwPercentage}%`, bedrag: factuur.btwBedrag }];
}

// ---------------------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------------------

export default function FactuurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;

  const projectDetails = useQuery(api.projecten.getWithDetails, projectId ? { id: projectId } : "skip");
  // Termijnen: meerdere facturen per project, gekozen via ?factuur=
  const gekozenFactuurId = useSearchParams().get("factuur") as Id<"facturen"> | null;
  const factuur = useQuery(
    api.facturen.getByProject,
    projectId ? { projectId, ...(gekozenFactuurId ? { factuurId: gekozenFactuurId } : {}) } : "skip"
  );
  const projectFacturen = useQuery(api.facturen.listByProject, projectId ? { projectId } : "skip");
  // Nacalculatie zit al in `getWithDetails`; geen aparte query.
  const nacalculatie = projectDetails?.nacalculatie;

  // Herinneringen (FAC-006), aanmaningen (FAC-007), creditnota (FAC-008), boekhoudsync (MOD-014)
  const herinneringen = useQuery(
    api.betalingsherinneringen.listByFactuur,
    factuur ? { factuurId: factuur._id } : "skip"
  ) as HerinneringenType | undefined;
  const aanmaningStatus = useQuery(
    api.betalingsherinneringen.getAanmaningStatus,
    factuur ? { factuurId: factuur._id } : "skip"
  ) as AanmaningStatusType | undefined;
  const creditnota = useQuery(api.facturen.getCreditnota, factuur ? { factuurId: factuur._id } : "skip");
  const boekhoudSyncStatus = useQuery(
    api.boekhouding.getFactuurSyncStatus,
    factuur ? { factuurId: factuur._id } : "skip"
  ) as BoekhoudSyncStatusType | null | undefined;

  const { theme: pdfTheme, voorwaarden: pdfVoorwaarden } = usePdfTheme();

  const handlers = useFactuurHandlers(projectId, factuur?._id, {
    factuur,
    bedrijfsgegevens: factuur?.bedrijf as import("@/types/offerte").Bedrijfsgegevens | undefined,
    theme: pdfTheme,
    voorwaarden: pdfVoorwaarden?.factuur,
  });

  const projectNaam = projectDetails?.project?.naam;
  const kruimel = <PageHeader customLabels={projectNaam ? { [`/projecten/${id}`]: projectNaam } : {}} />;

  if (projectDetails === undefined || factuur === undefined) {
    return (
      <>
        {kruimel}
        <FactuurPageSkeleton />
      </>
    );
  }

  if (!projectDetails) {
    return (
      <>
        {kruimel}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <FileText className="size-12 text-muted-foreground/50" aria-hidden="true" />
          <h2 className="text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/projecten")}>
            <ArrowLeft className="mr-2 size-4" />
            Terug naar projecten
          </Button>
        </div>
      </>
    );
  }

  const { project, offerte } = projectDetails;
  const huidige = huidigeFactuurStap(factuur?.status);

  const acties = factuur ? (
    <FactuurActionButtons
      factuurStatus={factuur.status}
      projectId={id}
      factuurnummer={factuur.factuurnummer}
      handlers={handlers}
      aanmaningStatus={aanmaningStatus}
      creditnota={creditnota}
    />
  ) : offerte?.termijnschema?.length ? (
    // Met een termijnschema lopen de facturen via de offerte (termijnen + eindfactuur)
    <Button asChild>
      <Link href={`/offertes/${offerte._id}`}>Termijnen factureren</Link>
    </Button>
  ) : (
    <Button onClick={handlers.handleGenerateFactuur} disabled={handlers.isGenerating}>
      {handlers.isGenerating && <Loader2 className="mr-2 size-4 animate-spin" />}
      {handlers.isGenerating ? "Factuur wordt gegenereerd…" : "Factuur genereren"}
    </Button>
  );

  // Betaald (eerste keer) en net verzonden krijgen hun eigen bevestigingsscherm.
  const viering =
    factuur?.status === "betaald" && handlers.showCelebration && !handlers.celebrationDismissed;
  const netVerzonden = factuur?.status === "verzonden" && handlers.showSentSuccess;

  const klantVoorPapier = factuur
    ? factuur.klant
    : offerte?.klant
      ? {
          naam: klantNaam(offerte.klant),
          adres: offerte.klant.adres,
          postcode: offerte.klant.postcode,
          plaats: offerte.klant.plaats,
        }
      : undefined;
  const klantNaamTekst = klantVoorPapier?.naam;

  return (
    <>
      {kruimel}

      <div className={`${REVEAL_KLASSE} flex flex-1 flex-col gap-5 p-4 md:p-8`}>
        <ProjectKop projectId={id} actief="factuur" acties={acties} />

        {viering && factuur ? (
          <ProjectCompletedCelebration
            projectNaam={project.naam}
            bedrag={factuur.totaalInclBtw}
            onDismiss={() => {
              handlers.setCelebrationDismissed(true);
              handlers.setShowCelebration(false);
            }}
          />
        ) : netVerzonden && factuur ? (
          <InvoiceSentSuccess
            factuurNummer={factuur.factuurnummer}
            klantEmail={factuur.klant.email}
            onContinue={() => handlers.setShowSentSuccess(false)}
          />
        ) : (
          <>
            <FactuurStappen huidige={huidige} />

            <div className="@container/werk">
              <div className="grid items-start gap-5 @4xl/werk:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
                <section
                  aria-label="Voorvertoning factuur"
                  className="@container/vel flex min-w-0 flex-col gap-2.5"
                >
                  <p className="text-xs text-muted-foreground">
                    {klantNaamTekst
                      ? `Voorvertoning — zo ziet ${klantNaamTekst} de factuur`
                      : "Voorvertoning — zo ziet de klant de factuur"}
                  </p>
                  {factuur ? (
                    <FactuurPapier
                      bedrijfNaam={factuur.bedrijf.naam || KLANT_MERKNAAM}
                      nummer={factuur.factuurnummer}
                      factuurdatum={factuur.factuurdatum}
                      vervaldatum={factuur.vervaldatum}
                      klant={factuur.klant}
                      projectNaam={project.naam}
                      regels={factuur.regels}
                      correcties={weergaveCorrecties(factuur)}
                      vermelding={btwVerlegdRegel(factuur)}
                      bedragen={{
                        subtotaal: factuur.subtotaal,
                        btw: factuurBtw(factuur),
                        totaal: factuur.totaalInclBtw,
                      }}
                      notities={factuur.notities}
                    />
                  ) : (
                    <FactuurPapier
                      bedrijfNaam={KLANT_MERKNAAM}
                      klant={klantVoorPapier}
                      projectNaam={project.naam}
                      bedragen={
                        offerte
                          ? {
                              subtotaal: offerte.totalen.totaalExBtw,
                              btw: [
                                {
                                  label: btwLabel(offerte.totalen.totaalExBtw, offerte.totalen.btw),
                                  bedrag: offerte.totalen.btw,
                                },
                              ],
                              totaal: offerte.totalen.totaalInclBtw,
                            }
                          : undefined
                      }
                    />
                  )}
                </section>

                <aside aria-label="Factuurgegevens" className="flex min-w-0 flex-col gap-4">
                  {factuur ? (
                    <FactuurInfo
                      status={factuur.status}
                      nummer={factuur.factuurnummer}
                      factuurdatum={factuur.factuurdatum}
                      vervaldatum={factuur.vervaldatum}
                      betalingstermijnDagen={factuur.betalingstermijnDagen}
                      verzondenAt={factuur.verzondenAt}
                      betaaldAt={factuur.betaaldAt}
                      email={factuur.klant.email}
                    />
                  ) : null}
                  {projectFacturen && projectFacturen.length > 1 && (
                    <ProjectFacturenWissel
                      projectId={id}
                      huidigId={factuur?._id}
                      facturen={projectFacturen}
                    />
                  )}
                  {factuur && <BtwVerlegdKaart factuur={factuur} />}
                  {factuur && <FactuurTeksten factuur={factuur} />}
                  {!factuur && offerte ? (
                    <UitDeOfferte
                      klantNaam={klantNaam(offerte.klant)}
                      email={offerte.klant?.email}
                      totaal={offerte.totalen.totaalInclBtw}
                    />
                  ) : null}

                  {!factuur && nacalculatie && Math.abs(nacalculatie.afwijkingPercentage) > 10 && (
                    <p className="rounded-lg border border-status-herinnering-border bg-surface-aandacht px-4 py-3 text-[13px]">
                      <span className="font-semibold">
                        Uren wijken {nacalculatie.afwijkingPercentage > 0 ? "+" : "−"}
                        {Math.round(Math.abs(nacalculatie.afwijkingPercentage))}% af van de
                        voorcalculatie.
                      </span>{" "}
                      <span className="text-muted-foreground">
                        Overweeg na genereren correctieregels toe te voegen.
                      </span>
                    </p>
                  )}

                  <Daarna huidige={huidige} />

                  {aanmaningStatus && aanmaningStatus.totaalVerstuurd > 0 && (
                    <AanmaningStatusCard aanmaningStatus={aanmaningStatus} />
                  )}
                  {herinneringen && herinneringen.length > 0 && (
                    <HerinneringenHistorie herinneringen={herinneringen} />
                  )}
                  {creditnota && <CreditnotaInfo creditnota={creditnota} />}
                  {boekhoudSyncStatus && <BoekhoudSyncStatusCard syncStatus={boekhoudSyncStatus} />}
                </aside>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Aanmaning-bevestigingsdialoog (FAC-007) */}
      <AanmaningDialog
        selectedType={handlers.selectedAanmaningType}
        notities={handlers.aanmaningNotities}
        onNotitiesChange={handlers.setAanmaningNotities}
        onClose={() => {
          handlers.setSelectedAanmaningType(null);
          handlers.setAanmaningNotities("");
        }}
        onSend={handlers.handleSendAanmaning}
        isSending={handlers.isSendingAanmaning}
      />
    </>
  );
}
