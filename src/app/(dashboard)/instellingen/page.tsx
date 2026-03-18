"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Clock, Sliders, Loader2, Link2 } from "lucide-react";
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

export default function InstellingenPage() {
  const reducedMotion = useReducedMotion();
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
                <BreadcrumbPage>Instellingen</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            </div>
            <p className="text-muted-foreground animate-pulse">Laden...</p>
          </motion.div>
        </div>
      </>
    );
  }

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
              <BreadcrumbPage>Instellingen</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Instellingen
          </h1>
          <p className="text-muted-foreground">
            Beheer je tarieven, normuren en correctiefactoren
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
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
          </TabsList>

          <AnimatePresence mode="wait">
            {activeTab === "tarieven" && (
              <TarievenTab
                tarieven={tarieven}
                setTarieven={setTarieven}
                scopeMarges={scopeMarges}
                setScopeMarges={setScopeMarges}
                isSaving={isSaving}
                onSave={handleSaveTarieven}
                reducedMotion={reducedMotion}
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
                reducedMotion={reducedMotion}
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
                reducedMotion={reducedMotion}
              />
            )}

            {activeTab === "koppelingen" && (
              <KoppelingenTab reducedMotion={reducedMotion} />
            )}
          </AnimatePresence>
        </Tabs>
      </motion.div>

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
