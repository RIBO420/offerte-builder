"use client";

import { memo, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Euro,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarIcon,
  Filter,
  X,
  Trash2,
  Package,
  Users,
  Wrench,
  MoreHorizontal,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { KostenEntryForm, type KostenEntryData } from "./kosten-entry-form";
import { KostenVergelijkingChart, KostenAfwijkingChart } from "./kosten-vergelijking-chart";

// Cost type configuration
const kostenTypeConfig = {
  materiaal: { label: "Materiaal", icon: Package, color: "bg-blue-500" },
  arbeid: { label: "Arbeid", icon: Users, color: "bg-green-500" },
  machine: { label: "Machine", icon: Wrench, color: "bg-orange-500" },
  overig: { label: "Overig", icon: MoreHorizontal, color: "bg-gray-500" },
} as const;

// Scope display names
const scopeDisplayNames: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gazon",
  houtwerk: "Houtwerk",
  water_elektra: "Water/Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
  algemeen: "Algemeen",
  machines: "Machines",
  materialen: "Materialen",
};

interface ProjectKostenDashboardProps {
  projectId: string;
}

// Summary Card Component
const SummaryCard = memo(function SummaryCard({
  title,
  gepland,
  werkelijk,
  afwijking,
  afwijkingPercentage,
  icon: Icon,
  iconColor,
}: {
  title: string;
  gepland: number;
  werkelijk: number;
  afwijking: number;
  afwijkingPercentage: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  const status = getDeviationStatus(afwijkingPercentage);
  const colors = getDeviationColors(status);
  const TrendIcon = afwijking > 0 ? TrendingUp : afwijking < 0 ? TrendingDown : Minus;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-1 h-full ${colors.border}`} />
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <div className={`h-6 w-6 rounded-full ${iconColor} flex items-center justify-center`}>
                <Icon className="h-3 w-3 text-white" />
              </div>
              {title}
            </CardTitle>
            <Badge variant="outline" className={`${colors.text} ${colors.bg} border-0`}>
              <TrendIcon className="h-3 w-3 mr-1" />
              {afwijkingPercentage > 0 ? "+" : ""}{afwijkingPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gepland</p>
              <p className="text-lg font-semibold">{formatCurrency(gepland)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Werkelijk</p>
              <p className={`text-lg font-semibold ${colors.text}`}>
                {formatCurrency(werkelijk)}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Afwijking</span>
              <span className={`text-sm font-medium ${colors.text}`}>
                {afwijking > 0 ? "+" : ""}{formatCurrency(afwijking)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

// Loading skeleton
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[180px]" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
      <Skeleton className="h-[300px]" />
    </div>
  );
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

  // Queries - using the new API functions
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
  const summary = useMemo(() => {
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
      // For now, show info that kosten are aggregated from other sources
      toast.info(
        "Kosten worden automatisch berekend uit uren-, machine- en materiaalregistraties. " +
        "Gebruik de bijbehorende modules om nieuwe kosten toe te voegen."
      );
      setIsFormOpen(false);
    } catch (error) {
      toast.error("Fout bij toevoegen kostenpost");
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
      toast.success("Kostenpost verwijderd");
      setDeleteItem(null);
    } catch (error) {
      toast.error("Fout bij verwijderen");
      console.error(error);
    }
  }, [deleteKost, deleteItem, id]);

  const clearFilters = useCallback(() => {
    setFilterType("all");
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
  }, []);

  // Totals per scope from kostenPerScope query
  const scopeTotals = useMemo(() => {
    if (!kostenPerScope || !budgetVergelijking?.data) return [];

    const geplandeUrenPerScope = budgetVergelijking.data.gepland.urenPerScope || {};

    return Object.entries(kostenPerScope)
      .map(([scope, data]) => {
        // Estimate planned costs from hours (using average rate)
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

  // Check if filters are active
  const hasActiveFilters = filterType !== "all" || filterStartDate || filterEndDate;

  // Loading state
  if (overzicht === undefined || kosten === undefined) {
    return <DashboardSkeleton />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  // Use overzicht for display when budget vergelijking is not available
  const displayData = summary || (overzicht ? {
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

  const totalAfwijkingPercentage = displayData?.afwijkingPercentage.totaal || 0;

  return (
    <div className="space-y-6">
      {/* Header with action button */}
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
      {displayData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className={`border-2 ${
            getDeviationStatus(totalAfwijkingPercentage) === "good"
              ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
              : getDeviationStatus(totalAfwijkingPercentage) === "warning"
              ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20"
              : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
          }`}>
            <CardContent className="py-4 px-4 md:px-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center ${
                    getDeviationStatus(totalAfwijkingPercentage) === "good"
                      ? "bg-green-100 dark:bg-green-900/50"
                      : getDeviationStatus(totalAfwijkingPercentage) === "warning"
                      ? "bg-yellow-100 dark:bg-yellow-900/50"
                      : "bg-red-100 dark:bg-red-900/50"
                  }`}>
                    {displayData.afwijking.totaal > 0 ? (
                      <TrendingUp className={`h-6 w-6 md:h-7 md:w-7 ${
                        getDeviationColors(getDeviationStatus(totalAfwijkingPercentage)).text
                      }`} />
                    ) : displayData.afwijking.totaal < 0 ? (
                      <TrendingDown className={`h-6 w-6 md:h-7 md:w-7 ${
                        getDeviationColors(getDeviationStatus(totalAfwijkingPercentage)).text
                      }`} />
                    ) : (
                      <CheckCircle className="h-6 w-6 md:h-7 md:w-7 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Totale Kosten Afwijking</p>
                    <p className={`text-2xl md:text-3xl font-bold ${
                      getDeviationColors(getDeviationStatus(totalAfwijkingPercentage)).text
                    }`}>
                      {totalAfwijkingPercentage > 0 ? "+" : ""}{totalAfwijkingPercentage}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {displayData.afwijking.totaal > 0
                        ? `${formatCurrency(displayData.afwijking.totaal)} meer dan gepland`
                        : displayData.afwijking.totaal < 0
                        ? `${formatCurrency(Math.abs(displayData.afwijking.totaal))} minder dan gepland`
                        : "Precies op budget"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4 md:w-auto">
                  <div className="bg-background/60 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Gepland</p>
                    <p className="text-lg md:text-xl font-semibold">
                      {formatCurrency(displayData.geplandeKosten.totaal)}
                    </p>
                  </div>
                  <div className="bg-background/60 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Werkelijk</p>
                    <p className={`text-lg md:text-xl font-semibold ${
                      getDeviationColors(getDeviationStatus(totalAfwijkingPercentage)).text
                    }`}>
                      {formatCurrency(displayData.werkelijkeKosten.totaal)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
        <TabsContent value="overzicht" className="space-y-6">
          {/* Summary Cards */}
          {displayData && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Materiaal"
                gepland={displayData.geplandeKosten.materiaal}
                werkelijk={displayData.werkelijkeKosten.materiaal}
                afwijking={displayData.afwijking.materiaal}
                afwijkingPercentage={displayData.afwijkingPercentage.materiaal}
                icon={Package}
                iconColor="bg-blue-500"
              />
              <SummaryCard
                title="Arbeid"
                gepland={displayData.geplandeKosten.arbeid}
                werkelijk={displayData.werkelijkeKosten.arbeid}
                afwijking={displayData.afwijking.arbeid}
                afwijkingPercentage={displayData.afwijkingPercentage.arbeid}
                icon={Users}
                iconColor="bg-green-500"
              />
              <SummaryCard
                title="Machine"
                gepland={displayData.geplandeKosten.machine}
                werkelijk={displayData.werkelijkeKosten.machine}
                afwijking={displayData.afwijking.machine}
                afwijkingPercentage={displayData.afwijkingPercentage.machine}
                icon={Wrench}
                iconColor="bg-orange-500"
              />
              <SummaryCard
                title="Overig"
                gepland={0}
                werkelijk={displayData.werkelijkeKosten.overig}
                afwijking={displayData.werkelijkeKosten.overig}
                afwijkingPercentage={0}
                icon={MoreHorizontal}
                iconColor="bg-gray-500"
              />
            </div>
          )}

          {/* Scope Totals */}
          {scopeTotals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Kosten per Scope</CardTitle>
                <CardDescription>
                  Overzicht van kosten per werkgebied
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Uren</TableHead>
                        <TableHead className="text-right">Werkelijk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scopeTotals.map((scope) => (
                        <TableRow key={scope.scope}>
                          <TableCell className="font-medium">{scope.scopeLabel}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {scope.uren.toFixed(1)} uur
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {formatCurrency(scope.werkelijk)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics from overzicht */}
          {overzicht && (
            <Card>
              <CardHeader>
                <CardTitle>Statistieken</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{overzicht.statistieken.werkelijkeDagen}</p>
                    <p className="text-xs text-muted-foreground">Werkdagen</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{overzicht.statistieken.aantalMedewerkers}</p>
                    <p className="text-xs text-muted-foreground">Medewerkers</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{overzicht.totalen.uren.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Totaal uren</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{formatCurrency(overzicht.statistieken.gemiddeldeKostenPerDag)}</p>
                    <p className="text-xs text-muted-foreground">Gem. per dag</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Posts Tab */}
        <TabsContent value="posten" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter op type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle types</SelectItem>
                      <SelectItem value="materiaal">Materiaal</SelectItem>
                      <SelectItem value="arbeid">Arbeid</SelectItem>
                      <SelectItem value="machine">Machine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterStartDate ? format(filterStartDate, "d MMM", { locale: nl }) : "Van"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filterStartDate}
                        onSelect={setFilterStartDate}
                        locale={nl}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[140px] justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterEndDate ? format(filterEndDate, "d MMM", { locale: nl }) : "Tot"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filterEndDate}
                        onSelect={setFilterEndDate}
                        locale={nl}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="icon" onClick={clearFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost entries table */}
          <Card>
            <CardHeader>
              <CardTitle>Kostenposten</CardTitle>
              <CardDescription>
                {kosten?.length || 0} {kosten?.length === 1 ? "post" : "posten"}
                {hasActiveFilters && " (gefilterd)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!kosten || kosten.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Euro className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Geen kostenposten gevonden</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Filters wissen
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Omschrijving</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Bedrag</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {kosten.map((kost, index) => {
                          const typeConfig = kostenTypeConfig[kost.type];
                          const TypeIcon = typeConfig.icon;
                          return (
                            <motion.tr
                              key={kost.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.02 }}
                              className="border-b"
                            >
                              <TableCell className="font-medium">
                                {format(new Date(kost.datum), "d MMM yyyy", { locale: nl })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="gap-1">
                                  <TypeIcon className="h-3 w-3" />
                                  {typeConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {kost.omschrijving}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {scopeDisplayNames[kost.scope] || kost.scope}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {formatCurrency(kost.totaal)}
                              </TableCell>
                              <TableCell>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => setDeleteItem({ id: kost.id, type: kost.type })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Kostenpost verwijderen?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Weet je zeker dat je deze kostenpost wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={() => setDeleteItem(null)}>
                                        Annuleren
                                      </AlertDialogCancel>
                                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                                        Verwijderen
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
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

// Helper functions
function getDeviationStatus(percentage: number): "good" | "warning" | "critical" {
  const absPercentage = Math.abs(percentage);
  if (absPercentage <= 5) return "good";
  if (absPercentage <= 15) return "warning";
  return "critical";
}

function getDeviationColors(status: "good" | "warning" | "critical") {
  switch (status) {
    case "good":
      return {
        text: "text-green-600 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-900/30",
        border: "border-green-500",
      };
    case "warning":
      return {
        text: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        border: "border-yellow-500",
      };
    case "critical":
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-900/30",
        border: "border-red-500",
      };
  }
}

export default ProjectKostenDashboard;
