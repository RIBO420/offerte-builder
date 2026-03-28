"use client";

import { m } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { Check, Save } from "lucide-react";
import { RestoreDraftDialog } from "@/components/offerte/restore-draft-dialog";
import { WizardSteps, type WizardStep } from "@/components/offerte/wizard-steps";

import {
  LoadingState,
  StepSnelstart,
  StepKlantScopes,
  StepScopeDetails,
  StepBevestigen,
  SuccessDialog,
  useOnderhoudWizard,
  SCOPES,
} from "./components";

export default function NieuweOnderhoudOffertePage() {
  const wizard = useOnderhoudWizard();

  const {
    currentStep,
    totalSteps,
    isLoading,
    isSubmitting,
    showTemplates,
    showSuccessDialog,
    createdOfferteId,
    createdOfferteNummer,
    showRestoreDialog,
    draftAge,
    scopeValidationErrors,
    scopeValidationHandlers,
    selectedTemplateId,
    selectedScopes,
    bereikbaarheid,
    achterstalligheid,
    tuinOppervlakte,
    klantData,
    scopeData,
    hasVerplichtWarning,
    isStep1Valid,
    isStep2Valid,
    setShowTemplates,
    setShowSuccessDialog,
    setSelectedKlantId,
    setBereikbaarheid,
    setAchterstalligheid,
    setTuinOppervlakte,
    setKlantData,
    setScopeData,
    toggleScope,
    isScopeDataValid,
    handleStepNavigation,
    handleSubmit,
    nextStep,
    prevStep,
    handleTemplateSelect,
    handleTemplateSkip,
    handlePackageSelect,
    restoreDraft,
    discardDraft,
  } = wizard;

  // Wizard steps configuration with summaries
  const wizardSteps: WizardStep[] = [
    {
      id: 0,
      name: "Snelstart",
      shortName: "Start",
      summary: selectedTemplateId ? (
        selectedTemplateId.startsWith("package:") ? (
          <span>Pakket geselecteerd</span>
        ) : (
          <span>Template geselecteerd</span>
        )
      ) : (
        <span>Handmatige invoer</span>
      ),
    },
    {
      id: 1,
      name: "Klantgegevens & Werkzaamheden",
      shortName: "Klant & Scopes",
      isValid: !!isStep1Valid,
      summary: (
        <div className="space-y-1">
          <div><strong>Klant:</strong> {klantData.naam || "—"}{klantData.plaats && `, ${klantData.plaats}`}</div>
          <div><strong>Bereikbaarheid:</strong> <span className="capitalize">{bereikbaarheid}</span></div>
          <div><strong>Achterstalligheid:</strong> <span className="capitalize">{achterstalligheid}</span></div>
          <div><strong>Werkzaamheden:</strong> {selectedScopes.length > 0
            ? selectedScopes.map(s => SCOPES.find(sc => sc.id === s)?.naam).join(", ")
            : "Geen geselecteerd"}
          </div>
        </div>
      ),
    },
    {
      id: 2,
      name: "Details per Werkzaamheid",
      shortName: "Details",
      isValid: isStep2Valid,
      summary: (
        <div className="space-y-1">
          {selectedScopes.map(scopeId => {
            const scope = SCOPES.find(s => s.id === scopeId);
            const valid = isScopeDataValid(scopeId);
            return (
              <div key={scopeId} className="flex items-center gap-2">
                {valid ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <span className="h-3 w-3 rounded-full bg-orange-400" />
                )}
                <span>{scope?.naam}</span>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: 3,
      name: "Bevestigen",
      shortName: "Bevestigen",
    },
  ];

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <>
      {/* Restore Draft Dialog */}
      <RestoreDraftDialog
        open={showRestoreDialog}
        draftAge={draftAge}
        type="onderhoud"
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />

      <PageHeader />

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-3 p-3 md:gap-4 md:p-4 lg:gap-6 lg:p-6"
      >
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
                Nieuwe Onderhoud Offerte
              </h1>
              <p className="text-sm text-muted-foreground">
                Stap {currentStep + 1} van {totalSteps}:{" "}
                {wizardSteps[currentStep]?.name}
              </p>
            </div>
            {currentStep > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span className="hidden sm:inline">Auto-save aan</span>
              </div>
            )}
          </div>

          {/* Wizard Steps Navigation */}
          <WizardSteps
            steps={wizardSteps}
            currentStep={currentStep}
            onStepClick={handleStepNavigation}
            allowNavigation={true}
            showSummaries={currentStep > 0}
            className={currentStep === 0 ? "max-w-4xl mx-auto" : ""}
          />
        </m.div>

        {/* Step 0: Package/Template Selectie */}
        {currentStep === 0 && (
          <StepSnelstart
            showTemplates={showTemplates}
            onShowPackages={() => setShowTemplates(false)}
            onTemplateSelect={handleTemplateSelect}
            onTemplateSkip={handleTemplateSkip}
            onPackageSelect={handlePackageSelect}
            onShowTemplates={() => setShowTemplates(true)}
          />
        )}

        {/* Step 1: Klantgegevens & Scope Selectie */}
        {currentStep === 1 && (
          <StepKlantScopes
            klantData={klantData}
            setKlantData={setKlantData}
            setSelectedKlantId={setSelectedKlantId}
            tuinOppervlakte={tuinOppervlakte}
            setTuinOppervlakte={setTuinOppervlakte}
            bereikbaarheid={bereikbaarheid}
            setBereikbaarheid={setBereikbaarheid}
            achterstalligheid={achterstalligheid}
            setAchterstalligheid={setAchterstalligheid}
            selectedScopes={selectedScopes}
            toggleScope={toggleScope}
            hasVerplichtWarning={hasVerplichtWarning}
            isStep1Valid={isStep1Valid}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        )}

        {/* Step 2: Scope Details */}
        {currentStep === 2 && (
          <StepScopeDetails
            selectedScopes={selectedScopes}
            scopeData={scopeData}
            setScopeData={setScopeData}
            scopeValidationHandlers={scopeValidationHandlers}
            scopeValidationErrors={scopeValidationErrors}
            isScopeDataValid={isScopeDataValid}
            isStep2Valid={isStep2Valid}
            nextStep={nextStep}
            prevStep={prevStep}
          />
        )}

        {/* Step 3: Bevestigen */}
        {currentStep === 3 && (
          <StepBevestigen
            klantData={klantData}
            tuinOppervlakte={tuinOppervlakte}
            bereikbaarheid={bereikbaarheid}
            achterstalligheid={achterstalligheid}
            selectedScopes={selectedScopes}
            scopeData={scopeData}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            prevStep={prevStep}
          />
        )}
      </m.div>

      {/* Success Dialog */}
      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        createdOfferteId={createdOfferteId}
        createdOfferteNummer={createdOfferteNummer}
      />
    </>
  );
}
