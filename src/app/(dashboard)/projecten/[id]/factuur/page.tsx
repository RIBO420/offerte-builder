"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Doc, Id } from "../../../../../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Receipt } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useReducedMotion } from "@/hooks/use-accessibility";
import {
  WorkflowStepIndicator,
  ProjectCompletedCelebration,
  InvoiceSentSuccess,
  FactuurPageSkeleton,
  statusColors,
  statusLabels,
  getWorkflowStep,
  useFactuurHandlers,
  FactuurActionButtons,
  FactuurNextStepHint,
  FactuurQuickStats,
  FactuurGegevens,
  FactuurRegels,
  FactuurTotalen,
  FactuurStatusInfo,
  FactuurNotities,
  AanmaningStatusCard,
  HerinneringenHistorie,
  CreditnotaInfo,
  BoekhoudSyncStatusCard,
  NoFactuurState,
  AanmaningDialog,
} from "./components";

// ---------------------------------------------------------------------------
// Breadcrumb Header (local helper using PageHeader)
// ---------------------------------------------------------------------------

function FactuurBreadcrumb({
  projectId,
  projectNaam,
}: {
  label: string;
  projectId?: string;
  projectNaam?: string;
}) {
  const customLabels: Record<string, string> = {};
  if (projectId && projectNaam) {
    customLabels[`/projecten/${projectId}`] = projectNaam;
  }
  return <PageHeader customLabels={customLabels} />;
}

// ---------------------------------------------------------------------------
// Factuur Content (when factuur exists)
// ---------------------------------------------------------------------------

function FactuurContent({
  factuur,
  project,
  projectId,
  handlers,
  prefersReducedMotion,
  aanmaningStatus,
  herinneringen,
  creditnota,
  boekhoudSyncStatus,
}: {
  factuur: Doc<"facturen">;
  project: { naam: string };
  projectId: string;
  handlers: ReturnType<typeof useFactuurHandlers>;
  prefersReducedMotion: boolean;
  aanmaningStatus: AanmaningStatusType | undefined;
  herinneringen: HerinneringenType | undefined;
  creditnota: CreditnotaType | undefined | null;
  boekhoudSyncStatus: BoekhoudSyncStatusType | null | undefined;
}) {
  const factuurStatus = factuur.status;
  const currentStep = useMemo(
    () => getWorkflowStep(factuurStatus),
    [factuurStatus]
  );

  // Show celebration for paid invoices (first time only)
  if (factuurStatus === "betaald" && handlers.showCelebration && !handlers.celebrationDismissed) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <ProjectCompletedCelebration
          projectNaam={project.naam}
          bedrag={factuur.totaalInclBtw}
          onDismiss={() => {
            handlers.setCelebrationDismissed(true);
            handlers.setShowCelebration(false);
          }}
        />
      </div>
    );
  }

  // Show success state after sending invoice
  if (handlers.showSentSuccess && factuurStatus === "verzonden") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <InvoiceSentSuccess
          factuurNummer={factuur.factuurnummer}
          klantEmail={factuur.klant.email}
          onContinue={() => handlers.setShowSentSuccess(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" asChild aria-label="Terug naar project">
            <Link href={`/projecten/${projectId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <Receipt className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Factuur {factuur.factuurnummer}
              </h1>
              <Badge className={statusColors[factuurStatus]}>
                {statusLabels[factuurStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {project.naam}
            </p>
          </div>
        </div>
        <FactuurActionButtons
          factuurStatus={factuurStatus}
          projectId={projectId}
          factuurnummer={factuur.factuurnummer}
          handlers={handlers}
          aanmaningStatus={aanmaningStatus}
          creditnota={creditnota}
        />
      </div>

      {/* Workflow Step Indicator */}
      <Card className="p-4 md:p-6">
        <WorkflowStepIndicator currentStep={currentStep} status={factuurStatus} />
      </Card>

      {/* Next Step Hint */}
      <FactuurNextStepHint
        factuurStatus={factuurStatus}
        prefersReducedMotion={prefersReducedMotion}
      />

      {/* Quick Stats */}
      <FactuurQuickStats
        totaalInclBtw={factuur.totaalInclBtw}
        factuurdatum={factuur.factuurdatum}
        vervaldatum={factuur.vervaldatum}
        betalingstermijnDagen={factuur.betalingstermijnDagen}
        klantNaam={factuur.klant.naam}
        klantPlaats={factuur.klant.plaats}
      />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Factuur Details */}
        <div className="lg:col-span-2 space-y-6">
          <FactuurGegevens
            klant={factuur.klant}
            bedrijf={factuur.bedrijf}
          />
          <FactuurRegels
            regels={factuur.regels}
            correcties={factuur.correcties}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <FactuurTotalen
            subtotaal={factuur.subtotaal}
            btwPercentage={factuur.btwPercentage}
            btwBedrag={factuur.btwBedrag}
            totaalInclBtw={factuur.totaalInclBtw}
          />

          <FactuurStatusInfo
            factuurStatus={factuurStatus}
            factuurdatum={factuur.factuurdatum}
            verzondenAt={factuur.verzondenAt}
            betaaldAt={factuur.betaaldAt}
            vervaldatum={factuur.vervaldatum}
          />

          {factuur.notities && (
            <FactuurNotities notities={factuur.notities} />
          )}

          {aanmaningStatus && aanmaningStatus.totaalVerstuurd > 0 && (
            <AanmaningStatusCard aanmaningStatus={aanmaningStatus} />
          )}

          {herinneringen && herinneringen.length > 0 && (
            <HerinneringenHistorie herinneringen={herinneringen} />
          )}

          {creditnota && (
            <CreditnotaInfo creditnota={creditnota} />
          )}

          {boekhoudSyncStatus && (
            <BoekhoudSyncStatusCard syncStatus={boekhoudSyncStatus} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type aliases for query results
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

type CreditnotaType = Doc<"facturen"> | null;

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

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function FactuurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const projectId = id as Id<"projecten">;
  const prefersReducedMotion = useReducedMotion();

  // Fetch project data
  const projectDetails = useQuery(
    api.projecten.getWithDetails,
    projectId ? { id: projectId } : "skip"
  );

  // Fetch factuur for this project
  const factuur = useQuery(
    api.facturen.getByProject,
    projectId ? { projectId } : "skip"
  );

  // Fetch nacalculatie for summary preview
  const nacalculatie = useQuery(
    api.nacalculaties.get,
    projectId ? { projectId } : "skip"
  );

  // Herinneringen for this factuur (FAC-006)
  const herinneringen = useQuery(
    api.betalingsherinneringen.listByFactuur,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // Aanmaning status for this factuur (FAC-007)
  const aanmaningStatus = useQuery(
    api.betalingsherinneringen.getAanmaningStatus,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // Creditnota for this factuur (FAC-008)
  const creditnota = useQuery(
    api.facturen.getCreditnota,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // Boekhouding sync status (MOD-014)
  const boekhoudSyncStatus = useQuery(
    api.boekhouding.getFactuurSyncStatus,
    factuur ? { factuurId: factuur._id } : "skip"
  );

  // All mutation handlers in a custom hook
  const handlers = useFactuurHandlers(projectId, factuur?._id);

  // Loading state
  if (projectDetails === undefined || factuur === undefined) {
    return (
      <>
        <FactuurBreadcrumb label="Factuur" />
        <FactuurPageSkeleton />
      </>
    );
  }

  // Project not found
  if (!projectDetails) {
    return (
      <>
        <FactuurBreadcrumb label="Niet gevonden" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" onClick={() => router.push("/projecten")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Terug naar projecten
          </Button>
        </div>
      </>
    );
  }

  const { project, offerte } = projectDetails;

  return (
    <>
      <FactuurBreadcrumb
        label="Factuur"
        projectId={id}
        projectNaam={project.naam}
      />

      {factuur ? (
        <FactuurContent
          factuur={factuur}
          project={project}
          projectId={id}
          handlers={handlers}
          prefersReducedMotion={prefersReducedMotion}
          aanmaningStatus={aanmaningStatus}
          herinneringen={herinneringen}
          creditnota={creditnota}
          boekhoudSyncStatus={boekhoudSyncStatus}
        />
      ) : (
        <NoFactuurState
          projectId={id}
          projectNaam={project.naam}
          offerte={offerte}
          nacalculatie={nacalculatie ?? null}
          project={project}
          onGenerate={handlers.handleGenerateFactuur}
          isGenerating={handlers.isGenerating}
        />
      )}

      {/* Aanmaning Bevestigingsdialoog (FAC-007) */}
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
