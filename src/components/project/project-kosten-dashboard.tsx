"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast-utils";
import {
  Plus,
  Euro,
  Package,
  BarChart3,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { KostenEntryForm, type KostenEntryData } from "./kosten-entry-form";
import { KostenVergelijkingChart, KostenAfwijkingChart } from "./kosten-vergelijking-chart";
import { scopeDisplayNames, type KostenDisplayData } from "./kosten/helpers";
import { DashboardSkeleton } from "./kosten/summary-card";
import { KostenStatusBanner } from "./kosten/status-banner";
import { OverzichtTab } from "./kosten/overzicht-tab";
import { PostenTab } from "./kosten/posten-tab";

interface ProjectKostenDashboardProps {
  projectId: string;
}

export const ProjectKostenDashboard = memo(function ProjectKostenDashboard({
  projectId,
}: ProjectKostenDashboardProps) {
  const id = projectId as Id<"projecten">;

  // State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("overzicht");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<{ id: string; type: "materiaal" | "arbeid" | "machine" | "overig" } | null>(null);

  // Queries
  const overzicht = useQuery(api.projectKosten.getProjectOverzicht, { projectId: id });
  const budgetVergelijking = useQuery(api.projectKosten.getBudgetVergelijking, { projectId: id });
  const kosten = useQuery(api.projectKosten.list, {
    projectId: id,
    type: filterType !== "all" ? filterType as "materiaal" | "arbeid" | "machine" | "overig" : undefined,
    startDate: filterStartDate ? format(filterStartDate, "yyyy-MM-dd") : undefined,
    endDate: filterEndDate ? format(filterEndDate, "yyyy-MM-dd") : undefined,
  });
  const kostenPerScope = useQuery(api.projectKosten.getByScope, { projectId: id });

  // Mutations
  const deleteKost = useMutation(api.projectKosten.remove);

  // Get summary data from budget vergelijking
  const summary = useMemo<KostenDisplayData | null>(() => {
    if (!budgetVergelijking?.data) return null;
    const { gepland, werkelijk, afwijking } = budgetVergelijking.data;
    return {
      geplandeKosten: {
        materiaal: gepland.materiaal,
        arbeid: gepland.arbeid,
        machine: gepland.machine,
        totaal: gepland.totaal,
      },
      werkelijkeKosten: {
        materiaal: werkelijk.materiaal,
        arbeid: werkelijk.arbeid,
        machine: werkelijk.machine,
        overig: 0,
        totaal: werkelijk.totaal,
      },
      afwijking: {
        materiaal: afwijking.materiaal.absoluut,
        arbeid: afwijking.arbeid.absoluut,
        machine: afwijking.machine.absoluut,
        overig: 0,
        totaal: afwijking.totaal.absoluut,
      },
      afwijkingPercentage: {
        materiaal: afwijking.materiaal.percentage,
        arbeid: afwijking.arbeid.percentage,
        machine: afwijking.machine.percentage,
        totaal: afwijking.totaal.percentage,
      },
    };
  }, [budgetVergelijking]);

  // Handlers
  const handleSubmit = useCallback(async (data: KostenEntryData) => {
    setIsSubmitting(true);
    try {
      showInfoToast(
        "Kosten worden automatisch berekend uit uren-, machine- en materiaalregistraties. " +
        "Gebruik de bijbehorende modules om nieuwe kosten toe te voegen."
      );
      setIsFormOpen(false);
    } catch (error) {
      showErrorToast("Fout bij toevoegen kostenpost");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return;
    try {
      await deleteKost({
        id: deleteItem.id,
        type: deleteItem.type,
        projectId: id,
      });
      showSuccessToast("Kostenpost verwijderd");
      setDeleteItem(null);
    } catch (error) {
      showErrorToast("Fout bij verwijderen");
      console.error(error);
    }
  }, [deleteKost, deleteItem, id]);

  const clearFilters = useCallback(() => {
    setFilterType("all");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
  }, []);

  // Totals per scope
  const scopeTotals = useMemo(() => {
    if (!kostenPerScope || !budgetVergelijking?.data) return [];

    const geplandeUrenPerScope = budgetVergelijking.data.gepland.urenPerScope || {};

    return Object.entries(kostenPerScope)
      .map(([scope, data]) => {
        const geplandeUren = geplandeUrenPerScope[scope] || 0;
        const avgRate = data.uren > 0 ? data.arbeid / data.uren : 45;
        const geplandArbeid = geplandeUren * avgRate;

        return {
          scope,
          scopeLabel: scopeDisplayNames[scope] || scope,
          gepland: geplandArbeid,
          werkelijk: data.totaal,
          afwijking: data.totaal - geplandArbeid,
          afwijkingPercentage: geplandArbeid > 0
            ? Math.round(((data.totaal - geplandArbeid) / geplandArbeid) * 100 * 10) / 10
            : 0,
          uren: data.uren,
        };
      })
      .sort((a, b) => Math.abs(b.werkelijk) - Math.abs(a.werkelijk));
  }, [kostenPerScope, budgetVergelijking]);

  const hasActiveFilters = filterType !== "all" || filterStartDate || filterEndDate;

  // Loading state
  if (overzicht === undefined || kosten === undefined) {
    return <DashboardSkeleton />;
  }

  // Display data with fallback
  const displayData: KostenDisplayData | null = summary || (overzicht ? {
    geplandeKosten: { materiaal: 0, arbeid: 0, machine: 0, totaal: 0 },
    werkelijkeKosten: {
      materiaal: overzicht.totalen.materiaal,
      arbeid: overzicht.totalen.arbeid,
      machine: overzicht.totalen.machine,
      overig: 0,
      totaal: overzicht.totalen.totaal,
    },
    afwijking: {
      materiaal: overzicht.totalen.materiaal,
      arbeid: overzicht.totalen.arbeid,
      machine: overzicht.totalen.machine,
      overig: 0,
      totaal: overzicht.totalen.totaal,
    },
    afwijkingPercentage: { materiaal: 0, arbeid: 0, machine: 0, totaal: 0 },
  } : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Project Kosten</h2>
          <p className="text-sm text-muted-foreground">
            Real-time tracking van project kosten vs budget
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Kosten toevoegen
        </Button>
      </div>

      {/* Overall Status Banner */}
      {displayData && <KostenStatusBanner displayData={displayData} />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
          <TabsTrigger value="overzicht" className="gap-2">
            <Euro className="h-4 w-4" />
            <span className="hidden sm:inline">Overzicht</span>
          </TabsTrigger>
          <TabsTrigger value="posten" className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Posten</span>
            {kosten && kosten.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {kosten.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="grafieken" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Grafieken</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overzicht">
          <OverzichtTab
            displayData={displayData}
            scopeTotals={scopeTotals}
            overzicht={overzicht}
          />
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posten">
          <PostenTab
            kosten={kosten}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            filterStartDate={filterStartDate}
            onFilterStartDateChange={setFilterStartDate}
            filterEndDate={filterEndDate}
            onFilterEndDateChange={setFilterEndDate}
            hasActiveFilters={!!hasActiveFilters}
            onClearFilters={clearFilters}
            onDeleteItem={setDeleteItem}
            onConfirmDelete={handleDelete}
          />
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="grafieken" className="space-y-6">
          {displayData && (
            <>
              <KostenVergelijkingChart
                materiaal={{
                  gepland: displayData.geplandeKosten.materiaal,
                  werkelijk: displayData.werkelijkeKosten.materiaal,
                  afwijking: displayData.afwijking.materiaal,
                  afwijkingPercentage: displayData.afwijkingPercentage.materiaal,
                }}
                arbeid={{
                  gepland: displayData.geplandeKosten.arbeid,
                  werkelijk: displayData.werkelijkeKosten.arbeid,
                  afwijking: displayData.afwijking.arbeid,
                  afwijkingPercentage: displayData.afwijkingPercentage.arbeid,
                }}
                machine={{
                  gepland: displayData.geplandeKosten.machine,
                  werkelijk: displayData.werkelijkeKosten.machine,
                  afwijking: displayData.afwijking.machine,
                  afwijkingPercentage: displayData.afwijkingPercentage.machine,
                }}
                overig={{
                  gepland: 0,
                  werkelijk: displayData.werkelijkeKosten.overig,
                  afwijking: displayData.werkelijkeKosten.overig,
                  afwijkingPercentage: 0,
                }}
              />
              <KostenAfwijkingChart
                materiaal={{
                  gepland: displayData.geplandeKosten.materiaal,
                  werkelijk: displayData.werkelijkeKosten.materiaal,
                  afwijking: displayData.afwijking.materiaal,
                  afwijkingPercentage: displayData.afwijkingPercentage.materiaal,
                }}
                arbeid={{
                  gepland: displayData.geplandeKosten.arbeid,
                  werkelijk: displayData.werkelijkeKosten.arbeid,
                  afwijking: displayData.afwijking.arbeid,
                  afwijkingPercentage: displayData.afwijkingPercentage.arbeid,
                }}
                machine={{
                  gepland: displayData.geplandeKosten.machine,
                  werkelijk: displayData.werkelijkeKosten.machine,
                  afwijking: displayData.afwijking.machine,
                  afwijkingPercentage: displayData.afwijkingPercentage.machine,
                }}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Entry Form Dialog */}
      <KostenEntryForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>{"<= 5%"} afwijking</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
          <span>{"5-15%"} afwijking</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span>{"> 15%"} afwijking</span>
        </div>
      </div>
    </div>
  );
});

export default ProjectKostenDashboard;
