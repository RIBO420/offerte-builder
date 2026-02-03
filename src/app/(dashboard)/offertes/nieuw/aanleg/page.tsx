"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChevronLeft, Loader2, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useOfferteCalculation } from "@/hooks/use-offerte-calculation";
import { TemplateSelector } from "@/components/offerte/template-selector";
import { PackageSelector } from "@/components/offerte/package-selector";
import { RestoreDraftDialog } from "@/components/offerte/restore-draft-dialog";
import { WizardSteps, type WizardStep } from "@/components/offerte/wizard-steps";
import { useKlanten } from "@/hooks/use-klanten";
import { Id } from "../../../../../../convex/_generated/dataModel";
import type { OffertePackage } from "@/lib/constants/packages";

// Import extracted components and hook
import {
  AanlegKlantScopesStep,
  AanlegScopeDetailsStep,
  AanlegReviewSection,
  AanlegSuccessDialog,
} from "./components";
import {
  useAanlegWizard,
  SCOPES,
  INITIAL_WIZARD_DATA,
  type AanlegScope,
  type ScopeData,
} from "./hooks/useAanlegWizard";

export default function NieuweAanlegOffertePage() {
  const { isLoading: isUserLoading } = useCurrentUser();
  const { create, updateRegels } = useOffertes();
  const { getNextNummer, isLoading: isSettingsLoading, instellingen } = useInstellingen();
  const { calculate } = useOfferteCalculation();
  const { createFromOfferte: createKlantFromOfferte } = useKlanten();

  // Use the custom wizard hook
  const wizard = useAanlegWizard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdOfferteId, setCreatedOfferteId] = useState<string | null>(null);
  const [createdOfferteNummer, setCreatedOfferteNummer] = useState<string | null>(null);

  const isLoading = isUserLoading || isSettingsLoading;

  // Scroll naar top bij stap wisseling
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [wizard.currentStep]);

  // Wizard steps configuration with summaries
  const wizardSteps: WizardStep[] = [
    {
      id: 0,
      name: "Snelstart",
      shortName: "Start",
      summary: wizard.selectedTemplateId ? (
        wizard.selectedTemplateId.startsWith("package:") ? (
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
      name: "Klantgegevens & Scopes",
      shortName: "Klant & Scopes",
      isValid: wizard.isStep1Valid,
      summary: (
        <div className="space-y-1">
          <div><strong>Klant:</strong> {wizard.klantData.naam || "—"}{wizard.klantData.plaats && `, ${wizard.klantData.plaats}`}</div>
          <div><strong>Bereikbaarheid:</strong> <span className="capitalize">{wizard.bereikbaarheid}</span></div>
          <div><strong>Scopes:</strong> {wizard.selectedScopes.length > 0
            ? wizard.selectedScopes.map(s => SCOPES.find(sc => sc.id === s)?.naam).join(", ")
            : "Geen geselecteerd"}
          </div>
        </div>
      ),
    },
    {
      id: 2,
      name: "Scope Details",
      shortName: "Details",
      isValid: wizard.isStep2Valid,
      summary: (
        <div className="space-y-1">
          {wizard.selectedScopes.map(scopeId => {
            const scope = SCOPES.find(s => s.id === scopeId);
            const valid = wizard.isScopeDataValid(scopeId);
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

  const handleSubmit = async () => {
    if (!wizard.isStep1Valid || !wizard.isStep2Valid) return;

    setIsSubmitting(true);
    try {
      const offerteNummer = await getNextNummer();

      // Build scope data object with only selected scopes
      const filteredScopeData: Record<string, unknown> = {};
      wizard.selectedScopes.forEach((scope) => {
        filteredScopeData[scope] = wizard.scopeData[scope];
      });

      // Create or get klant ID
      let klantId: Id<"klanten"> | undefined;
      if (wizard.selectedKlantId) {
        klantId = wizard.selectedKlantId as Id<"klanten">;
      } else if (wizard.klantData.naam && wizard.klantData.adres) {
        klantId = await createKlantFromOfferte({
          naam: wizard.klantData.naam,
          adres: wizard.klantData.adres,
          postcode: wizard.klantData.postcode,
          plaats: wizard.klantData.plaats,
          email: wizard.klantData.email || undefined,
          telefoon: wizard.klantData.telefoon || undefined,
        });
      }

      const offerteId = await create({
        type: "aanleg",
        offerteNummer,
        klant: {
          naam: wizard.klantData.naam,
          adres: wizard.klantData.adres,
          postcode: wizard.klantData.postcode,
          plaats: wizard.klantData.plaats,
          email: wizard.klantData.email || undefined,
          telefoon: wizard.klantData.telefoon || undefined,
        },
        algemeenParams: {
          bereikbaarheid: wizard.bereikbaarheid,
        },
        scopes: wizard.selectedScopes,
        scopeData: filteredScopeData,
        klantId,
      });

      // Calculate and save regels
      const calculationResult = calculate({
        type: "aanleg",
        scopes: wizard.selectedScopes,
        scopeData: filteredScopeData,
        bereikbaarheid: wizard.bereikbaarheid,
      });

      if (calculationResult && calculationResult.regels.length > 0) {
        await updateRegels({
          id: offerteId,
          regels: calculationResult.regels,
          margePercentage: instellingen?.standaardMargePercentage || 15,
          btwPercentage: instellingen?.btwPercentage || 21,
          uurtarief: instellingen?.uurtarief || 45,
        });
      }

      wizard.clearDraft();
      setCreatedOfferteId(offerteId);
      setCreatedOfferteNummer(offerteNummer);
      setShowSuccessDialog(true);
      toast.success(`Offerte ${offerteNummer} aangemaakt`);
    } catch {
      toast.error("Fout bij aanmaken offerte");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (
    templateId: Id<"standaardtuinen"> | null,
    templateData?: { scopes: string[]; scopeData: Record<string, unknown> }
  ) => {
    if (templateId && templateData) {
      const validScopes = templateData.scopes.filter((s): s is AanlegScope =>
        SCOPES.some((scope) => scope.id === s)
      );

      const newScopeData = { ...wizard.scopeData };
      if (templateData.scopeData) {
        Object.entries(templateData.scopeData).forEach(([key, value]) => {
          if (key in newScopeData && value) {
            (newScopeData as Record<string, unknown>)[key] = value;
          }
        });
      }

      wizard.setWizardData({
        ...wizard.wizardData,
        selectedTemplateId: templateId,
        selectedScopes: validScopes,
        scopeData: newScopeData as ScopeData,
      });
    } else {
      wizard.setSelectedTemplateId(templateId ? templateId : null);
    }
    wizard.setCurrentStep(1);
  };

  const handleTemplateSkip = () => {
    wizard.setCurrentStep(1);
  };

  // Handle package selection
  const handlePackageSelect = (pkg: OffertePackage) => {
    const validScopes = pkg.scopes.filter((s): s is AanlegScope =>
      SCOPES.some((scope) => scope.id === s)
    );

    const newScopeData = { ...INITIAL_WIZARD_DATA.scopeData };
    if (pkg.defaultWaarden) {
      Object.entries(pkg.defaultWaarden).forEach(([key, value]) => {
        if (key in newScopeData && value) {
          (newScopeData as Record<string, unknown>)[key] = value;
        }
      });
    }

    wizard.setWizardData({
      ...wizard.wizardData,
      selectedTemplateId: `package:${pkg.id}`,
      selectedScopes: validScopes,
      scopeData: newScopeData as ScopeData,
    });
    wizard.setCurrentStep(1);
  };

  if (isLoading) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Nieuwe Aanleg Offerte</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex flex-1 items-center justify-center"
        >
          <div className="relative flex flex-col items-center gap-4">
            <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-amber-100/40 dark:from-primary/10 dark:via-primary/5 dark:to-amber-900/20 blur-2xl" />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute h-16 w-16 rounded-full bg-gradient-to-br from-primary/40 to-amber-400/40 dark:from-primary/30 dark:to-amber-500/30 blur-xl"
            />
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-amber-50 dark:from-primary/20 dark:to-amber-950/50 border border-primary/20 dark:border-primary/30 shadow-lg shadow-primary/10"
            >
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                <Loader2 className="h-8 w-8 text-primary" />
              </motion.div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="relative text-center"
            >
              <p className="text-sm font-medium text-primary">Wizard laden...</p>
              <p className="text-xs text-muted-foreground mt-1">Even geduld alstublieft</p>
            </motion.div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      {/* Restore Draft Dialog */}
      <RestoreDraftDialog
        open={wizard.showRestoreDialog}
        draftAge={wizard.draftAge}
        type="aanleg"
        onRestore={wizard.restoreDraft}
        onDiscard={wizard.discardDraft}
      />

      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/offertes">Offertes</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Nieuwe Aanleg Offerte</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-3 p-3 md:gap-4 md:p-4 lg:gap-6 lg:p-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight md:text-2xl lg:text-3xl">
                Nieuwe Aanleg Offerte
              </h1>
              <p className="text-sm text-muted-foreground">
                Stap {wizard.currentStep + 1} van {wizard.totalSteps}:{" "}
                {wizardSteps[wizard.currentStep]?.name}
              </p>
            </div>
            {wizard.currentStep > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span className="hidden sm:inline">Auto-save aan</span>
              </div>
            )}
          </div>

          <WizardSteps
            steps={wizardSteps}
            currentStep={wizard.currentStep}
            onStepClick={wizard.handleStepNavigation}
            allowNavigation={true}
            showSummaries={wizard.currentStep > 0}
            className={wizard.currentStep === 0 ? "max-w-4xl mx-auto" : ""}
          />
        </motion.div>

        {/* Step 0: Package/Template Selection */}
        {wizard.currentStep === 0 && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
            {showTemplates ? (
              <div className="space-y-4">
                <Button variant="ghost" onClick={() => setShowTemplates(false)} className="mb-2">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Terug naar Snelstart Pakketten
                </Button>
                <TemplateSelector type="aanleg" onSelect={handleTemplateSelect} onSkip={handleTemplateSkip} />
              </div>
            ) : (
              <PackageSelector
                type="aanleg"
                onSelectPackage={handlePackageSelect}
                onSkip={handleTemplateSkip}
                onSelectTemplate={() => setShowTemplates(true)}
              />
            )}
          </div>
        )}

        {/* Step 1: Klantgegevens & Scope Selectie */}
        {wizard.currentStep === 1 && (
          <AanlegKlantScopesStep
            klantData={wizard.klantData}
            bereikbaarheid={wizard.bereikbaarheid}
            selectedScopes={wizard.selectedScopes}
            hasVerplichtWarning={wizard.hasVerplichtWarning}
            isStep1Valid={wizard.isStep1Valid}
            isStep2Valid={wizard.isStep2Valid}
            totalSteps={wizard.totalSteps}
            onKlantDataChange={wizard.setKlantData}
            onKlantSelect={wizard.setSelectedKlantId}
            onBereikbaarheidChange={wizard.setBereikbaarheid}
            onToggleScope={wizard.toggleScope}
            onNext={wizard.nextStep}
            onPrev={wizard.prevStep}
          />
        )}

        {/* Step 2: Scope Details */}
        {wizard.currentStep === 2 && (
          <AanlegScopeDetailsStep
            selectedScopes={wizard.selectedScopes}
            scopeData={wizard.scopeData}
            scopeValidationErrors={wizard.scopeValidationErrors}
            scopeValidationHandlers={wizard.scopeValidationHandlers}
            isStep1Valid={wizard.isStep1Valid}
            isStep2Valid={wizard.isStep2Valid}
            totalSteps={wizard.totalSteps}
            isScopeDataValid={wizard.isScopeDataValid}
            onScopeDataChange={wizard.setScopeData}
            onNext={wizard.nextStep}
            onPrev={wizard.prevStep}
          />
        )}

        {/* Step 3: Review/Confirm */}
        {wizard.currentStep === 3 && (
          <AanlegReviewSection
            klantData={wizard.klantData}
            bereikbaarheid={wizard.bereikbaarheid}
            selectedScopes={wizard.selectedScopes}
            scopeData={wizard.scopeData}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onPrev={wizard.prevStep}
          />
        )}
      </motion.div>

      {/* Success Dialog */}
      <AanlegSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        offerteId={createdOfferteId}
        offerteNummer={createdOfferteNummer}
      />
    </>
  );
}
