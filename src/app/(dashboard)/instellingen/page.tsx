"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { PaginaReveal } from "@/components/pagina-reveal";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, CalendarClock, Clock, Sliders, Link2, FileStack, Bell, Mail, Paintbrush } from "lucide-react";
import { toast } from "sonner";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNormuren } from "@/hooks/use-normuren";
import { useCorrectiefactoren } from "@/hooks/use-correctiefactoren";
import { Id } from "@convex/_generated/dataModel";
import type { Normuur, Correctiefactor, NormuurFormData, TarievenState, ScopeMargesState } from "./components/types";
import { TarievenTab } from "./components/tarieven-tab";
import { NormurenTab } from "./components/normuren-tab";
import { FactorenTab } from "./components/factoren-tab";
import { KoppelingenTab } from "./components/koppelingen-tab";
import { NormuurDialog } from "./components/normuur-dialog";
import { DeleteNormuurDialog } from "./components/delete-normuur-dialog";
import { DeelfactuurTemplatesTab } from "./components/deelfactuur-templates-tab";
import { HerinneringenTab } from "./components/herinneringen-tab";
import { EmailTemplatesTab } from "./components/email-templates-tab";
import { HuisstijlTab } from "./components/huisstijl-tab";
import { DagkaartTab } from "./components/dagkaart-tab";
import { LaadIndicator } from "@/components/ui/laad-indicator";

export default function InstellingenPage() {
  const [activeTab, setActiveTab] = useState("tarieven");
  const { isLoading: isUserLoading } = useCurrentUser();
  const { instellingen, isLoading: isSettingsLoading, update } = useInstellingen();
  const {
    normuren,
    scopes,
    isLoading: isNormurenLoading,
    create: createNormuur,
    update: updateNormuur,
    delete: deleteNormuur,
  } = useNormuren();
  const {
    factoren,
    types,
    isLoading: isFactorenLoading,
    upsert: upsertFactor,
    reset: resetFactor,
    initDefaults,
  } = useCorrectiefactoren();

  const [isSaving, setIsSaving] = useState(false);
  const [activeScope, setActiveScope] = useState<string>("alle");
  const [activeType, setActiveType] = useState<string>("alle");

  // Normuur dialog state
  const [showNormuurDialog, setShowNormuurDialog] = useState(false);
  const [editingNormuur, setEditingNormuur] = useState<Normuur | null>(null);
  const [normuurForm, setNormuurForm] = useState<NormuurFormData>({
    activiteit: "",
    scope: "grondwerk",
    normuurPerEenheid: 0,
    eenheid: "m²",
    omschrijving: "",
  });
  const [showDeleteNormuurDialog, setShowDeleteNormuurDialog] = useState(false);
  const [normuurToDelete, setNormuurToDelete] = useState<Normuur | null>(null);

  // Factor edit state
  const [editingFactor, setEditingFactor] = useState<Correctiefactor | null>(null);
  const [factorValue, setFactorValue] = useState<number>(1);

  // Tarieven state
  const [tarieven, setTarieven] = useState<TarievenState>({
    uurtarief: 45,
    standaardMargePercentage: 15,
    btwPercentage: 21,
  });

  // Scope marges state
  const [scopeMarges, setScopeMarges] = useState<ScopeMargesState>({});

  // Load settings into form when data arrives
  useEffect(() => {
    if (instellingen) {
      setTarieven({
        uurtarief: instellingen.uurtarief,
        standaardMargePercentage: instellingen.standaardMargePercentage,
        btwPercentage: instellingen.btwPercentage,
      });
      if (instellingen.scopeMarges) {
        setScopeMarges(instellingen.scopeMarges);
      }
    }
  }, [instellingen]);

  // Initialize system defaults if needed
  useEffect(() => {
    if (factoren && factoren.length === 0) {
      initDefaults({});
    }
  }, [factoren, initDefaults]);

  const isLoading = isUserLoading || isSettingsLoading;

  const handleSaveTarieven = useCallback(async () => {
    setIsSaving(true);
    try {
      await update({
        uurtarief: tarieven.uurtarief,
        standaardMargePercentage: tarieven.standaardMargePercentage,
        scopeMarges: scopeMarges,
        btwPercentage: tarieven.btwPercentage,
      });
      toast.success("Tarieven opgeslagen");
    } catch {
      toast.error("Fout bij opslaan tarieven");
    } finally {
      setIsSaving(false);
    }
  }, [tarieven, scopeMarges, update]);

  // Normuur handlers
  const handleOpenNormuurDialog = useCallback((normuur?: Normuur) => {
    if (normuur) {
      setEditingNormuur(normuur);
      setNormuurForm({
        activiteit: normuur.activiteit,
        scope: normuur.scope,
        normuurPerEenheid: normuur.normuurPerEenheid,
        eenheid: normuur.eenheid,
        omschrijving: normuur.omschrijving || "",
      });
    } else {
      setEditingNormuur(null);
      setNormuurForm({
        activiteit: "",
        scope: activeScope !== "alle" ? activeScope : "grondwerk",
        normuurPerEenheid: 0,
        eenheid: "m²",
        omschrijving: "",
      });
    }
    setShowNormuurDialog(true);
  }, [activeScope]);

  const handleSaveNormuur = useCallback(async () => {
    if (!normuurForm.activiteit) {
      toast.error("Vul een activiteit in");
      return;
    }

    setIsSaving(true);
    try {
      if (editingNormuur) {
        await updateNormuur({
          id: editingNormuur._id as Id<"normuren">,
          ...normuurForm,
        });
        toast.success("Normuur bijgewerkt");
      } else {
        await createNormuur(normuurForm);
        toast.success("Normuur toegevoegd");
      }
      setShowNormuurDialog(false);
    } catch {
      toast.error("Fout bij opslaan normuur");
    } finally {
      setIsSaving(false);
    }
  }, [editingNormuur, normuurForm, updateNormuur, createNormuur]);

  const handleDeleteNormuur = useCallback(async () => {
    if (!normuurToDelete) return;

    try {
      await deleteNormuur({ id: normuurToDelete._id as Id<"normuren"> });
      toast.success("Normuur verwijderd");
      setShowDeleteNormuurDialog(false);
      setNormuurToDelete(null);
    } catch {
      toast.error("Fout bij verwijderen normuur");
    }
  }, [normuurToDelete, deleteNormuur]);

  // Factor handlers
  const handleEditFactor = useCallback((factor: Correctiefactor) => {
    setEditingFactor(factor);
    setFactorValue(factor.factor);
  }, []);

  const handleSaveFactor = useCallback(async () => {
    if (!editingFactor) return;

    setIsSaving(true);
    try {
      await upsertFactor({
        type: editingFactor.type,
        waarde: editingFactor.waarde,
        factor: factorValue,
      });
      toast.success("Factor bijgewerkt");
      setEditingFactor(null);
    } catch {
      toast.error("Fout bij opslaan factor");
    } finally {
      setIsSaving(false);
    }
  }, [editingFactor, factorValue, upsertFactor]);

  const handleResetFactor = useCallback(async (factor: Correctiefactor) => {
    try {
      await resetFactor(factor.type, factor.waarde);
      toast.success("Factor gereset naar standaard");
    } catch {
      toast.error("Fout bij resetten factor");
    }
  }, [resetFactor]);

  // Memoized filtered data
  const filteredNormuren = useMemo(() =>
    activeScope === "alle"
      ? normuren
      : normuren.filter((n) => n.scope === activeScope),
    [normuren, activeScope]
  );

  const filteredFactoren = useMemo(() =>
    activeType === "alle"
      ? factoren
      : factoren.filter((f) => f.type === activeType),
    [factoren, activeType]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 items-center justify-center">
          <LaadIndicator formaat="pagina" tekst="Laden…" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />

      {/* Eén reveal op de buitenkant, geen gestapelde delays eronder: de
          tabs zijn gewone divs en staan er dus ook als er nul animatieframes
          vallen. → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Instellingen
          </h1>
          {/* Subtitel dekt alle tabs, niet alleen de eerste drie (WS6) */}
          <p className="text-muted-foreground">
            Beheer tarieven, templates, huisstijl en koppelingen
          </p>
          {/* Linkrij naar de instellingenpagina's die alleen in het
              profielmenu stonden (WS6): één vindplek voor het hele domein. */}
          <p className="mt-2 text-sm text-muted-foreground">
            Meer instellingen:{" "}
            <Link href="/instellingen/machines" className="text-foreground hover:underline">
              Machinebeheer
            </Link>
            {" · "}
            <Link href="/instellingen/catalogus" className="text-foreground hover:underline">
              Catalogus onderhoud
            </Link>
            {" · "}
            <Link href="/instellingen/tekstblokken" className="text-foreground hover:underline">
              Tekstblokken
            </Link>
            {" · "}
            <Link href="/instellingen/mailtriggers" className="text-foreground hover:underline">
              Mail-triggers
            </Link>
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* flex-wrap i.p.v. overflow-x-auto: de app scrolt nergens zijwaarts
              (CLAUDE.md regel 1); de 10 tabs wrappen op smalle schermen. */}
          <TabsList className="flex-wrap justify-start overflow-x-visible group-data-[orientation=horizontal]/tabs:h-auto group-data-[orientation=horizontal]/tabs:sm:h-auto">
            <TabsTrigger value="tarieven" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Tarieven
            </TabsTrigger>
            <TabsTrigger value="normuren" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Normuren
            </TabsTrigger>
            <TabsTrigger value="factoren" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Correctiefactoren
            </TabsTrigger>
            <TabsTrigger value="koppelingen" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Koppelingen
            </TabsTrigger>
            <TabsTrigger value="deelfacturen" className="flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              Deelfacturen
            </TabsTrigger>
            <TabsTrigger value="herinneringen" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Herinneringen
            </TabsTrigger>
            <TabsTrigger value="email-templates" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-mail Templates
            </TabsTrigger>
            <TabsTrigger value="huisstijl" className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4" />
              Huisstijl & PDF
            </TabsTrigger>
            <TabsTrigger value="dagkaart" className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Planning
            </TabsTrigger>
            {/* Beveiliging-tab vervallen (WS6): de twee infokaarten (2FA,
                sessietimeout) staan nu onder Koppelingen — er stond hier
                geen enkele instelling. */}
          </TabsList>

          {activeTab === "tarieven" && (
              <TarievenTab
                tarieven={tarieven}
                setTarieven={setTarieven}
                scopeMarges={scopeMarges}
                setScopeMarges={setScopeMarges}
                isSaving={isSaving}
                onSave={handleSaveTarieven}
              />
            )}

            {activeTab === "normuren" && (
              <NormurenTab
                filteredNormuren={filteredNormuren as Normuur[]}
                scopes={scopes}
                activeScope={activeScope}
                setActiveScope={setActiveScope}
                isNormurenLoading={isNormurenLoading}
                onOpenDialog={handleOpenNormuurDialog}
                onDeleteNormuur={(normuur) => {
                  setNormuurToDelete(normuur);
                  setShowDeleteNormuurDialog(true);
                }}
              />
            )}

            {activeTab === "factoren" && (
              <FactorenTab
                filteredFactoren={filteredFactoren as Correctiefactor[]}
                types={types}
                activeType={activeType}
                setActiveType={setActiveType}
                isFactorenLoading={isFactorenLoading}
                editingFactor={editingFactor}
                factorValue={factorValue}
                setFactorValue={setFactorValue}
                isSaving={isSaving}
                onEditFactor={handleEditFactor}
                onSaveFactor={handleSaveFactor}
                onCancelEdit={() => setEditingFactor(null)}
                onResetFactor={handleResetFactor}
              />
            )}

            {activeTab === "koppelingen" && <KoppelingenTab />}

            {activeTab === "deelfacturen" && <DeelfactuurTemplatesTab />}

            {activeTab === "herinneringen" && (
              <HerinneringenTab
                herinneringInstellingen={instellingen?.herinneringInstellingen ?? undefined}
              />
            )}

            {activeTab === "email-templates" && <EmailTemplatesTab />}

            {activeTab === "huisstijl" && (
              <HuisstijlTab instellingen={instellingen ?? null} />
            )}

            {activeTab === "dagkaart" && (
              <DagkaartTab
                dagkaartInstellingen={
                  instellingen?.dagkaartInstellingen ?? undefined
                }
              />
            )}
        </Tabs>
      </PaginaReveal>

      {/* Normuur Dialog */}
      <NormuurDialog
        open={showNormuurDialog}
        onOpenChange={setShowNormuurDialog}
        editingNormuur={editingNormuur}
        normuurForm={normuurForm}
        setNormuurForm={setNormuurForm}
        isSaving={isSaving}
        onSave={handleSaveNormuur}
      />

      {/* Delete Normuur Dialog */}
      <DeleteNormuurDialog
        open={showDeleteNormuurDialog}
        onOpenChange={setShowDeleteNormuurDialog}
        normuurToDelete={normuurToDelete}
        onConfirm={handleDeleteNormuur}
        onCancel={() => setNormuurToDelete(null)}
      />
    </>
  );
}
