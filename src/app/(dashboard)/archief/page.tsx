"use client";

import { useState, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { RequireAdmin } from "@/components/require-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Archive,
  FileText,
  Calculator,
  Receipt,
  ChevronDown,
  ChevronUp,
  Search,
  Loader2,
  Euro,
  FolderKanban,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";

// Currency formatter
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

// Type for archived project data from API (matches convex/archief.ts listArchivedProjects response)
interface ArchivedProject {
  _id: string;
  naam: string;
  status: string;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
  offerte: {
    _id: string;
    offerteNummer: string;
    klantNaam: string;
    type: "aanleg" | "onderhoud";
    totalen: {
      totaalExBtw: number;
      totaalInclBtw: number;
      totaalUren: number;
    };
  } | null;
  voorcalculatie: {
    _id: string;
    normUrenTotaal: number;
    geschatteDagen: number;
    teamGrootte: 2 | 3 | 4;
  } | null;
  nacalculatie: {
    _id: string;
    werkelijkeUren: number;
    werkelijkeDagen: number;
    afwijkingUren: number;
    afwijkingPercentage: number;
  } | null;
  factuur: {
    _id: string;
    factuurnummer: string;
    status: "concept" | "definitief" | "verzonden" | "betaald" | "vervallen";
    totaalInclBtw: number;
    betaaldAt?: number;
  } | null;
}

function DeviationBadge({ percentage }: { percentage: number }) {
  if (percentage > 5) {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
        <TrendingUp className="h-3 w-3 mr-1" />
        +{percentage.toFixed(1)}%
      </Badge>
    );
  }
  if (percentage < -5) {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
        <TrendingDown className="h-3 w-3 mr-1" />
        {percentage.toFixed(1)}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
      <Minus className="h-3 w-3 mr-1" />
      {percentage.toFixed(1)}%
    </Badge>
  );
}

function FactuurStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    concept: {
      label: "Concept",
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    },
    definitief: {
      label: "Definitief",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    },
    verzonden: {
      label: "Verzonden",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    betaald: {
      label: "Betaald",
      className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
    },
    vervallen: {
      label: "Vervallen",
      className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    },
  };

  const config = statusConfig[status] || statusConfig.concept;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function ArchivedProjectCard({ project }: { project: ArchivedProject }) {
  const [isOpen, setIsOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  // Get the total amount (prefer factuur, fallback to offerte)
  const totalAmount = project.factuur
    ? project.factuur.totaalInclBtw
    : project.offerte?.totalen.totaalInclBtw ?? 0;

  // Get klant naam
  const klantNaam = project.offerte?.klantNaam ?? "Onbekende klant";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Archive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{project.naam}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <User className="h-3 w-3" />
                    {klantNaam}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">
                    {formatCurrency(totalAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Voltooid op {project.archivedAt ? formatDate(project.archivedAt) : "onbekend"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
              >
                <Separator />
                <CardContent className="pt-4 space-y-4">
                  {/* Offerte Details */}
                  {project.offerte && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Offerte Details
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">Offertenummer</p>
                          <p className="text-sm font-medium">{project.offerte.offerteNummer}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <p className="text-sm font-medium capitalize">{project.offerte.type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Totaal excl. BTW</p>
                          <p className="text-sm font-medium">{formatCurrency(project.offerte.totalen.totaalExBtw)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Totaal incl. BTW</p>
                          <p className="text-sm font-medium">{formatCurrency(project.offerte.totalen.totaalInclBtw)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Voorcalculatie vs Nacalculatie Comparison */}
                  {(project.voorcalculatie || project.nacalculatie) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calculator className="h-4 w-4 text-orange-600" />
                        Voorcalculatie vs Nacalculatie
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Voorcalculatie */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">
                            Voorcalculatie
                          </p>
                          {project.voorcalculatie ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Uren:</span>
                                <span className="font-medium">{project.voorcalculatie.normUrenTotaal}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Dagen:</span>
                                <span className="font-medium">{project.voorcalculatie.geschatteDagen}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Team:</span>
                                <span className="font-medium">{project.voorcalculatie.teamGrootte} personen</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Niet beschikbaar</p>
                          )}
                        </div>

                        {/* Nacalculatie */}
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                          <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-2">
                            Nacalculatie
                          </p>
                          {project.nacalculatie ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Uren:</span>
                                <span className="font-medium">{project.nacalculatie.werkelijkeUren}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Dagen:</span>
                                <span className="font-medium">{project.nacalculatie.werkelijkeDagen}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Niet beschikbaar</p>
                          )}
                        </div>

                        {/* Afwijking */}
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                          <p className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-2">
                            Afwijking
                          </p>
                          {project.nacalculatie ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm items-center">
                                <span className="text-muted-foreground">Uren:</span>
                                <span className={`font-medium ${project.nacalculatie.afwijkingUren > 0 ? "text-red-600" : project.nacalculatie.afwijkingUren < 0 ? "text-green-600" : ""}`}>
                                  {project.nacalculatie.afwijkingUren > 0 ? "+" : ""}
                                  {project.nacalculatie.afwijkingUren}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm items-center">
                                <span className="text-muted-foreground">Percentage:</span>
                                <DeviationBadge percentage={project.nacalculatie.afwijkingPercentage} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Niet beschikbaar</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Factuur Details */}
                  {project.factuur && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Receipt className="h-4 w-4 text-green-600" />
                        Factuur Details
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Factuurnummer</p>
                              <p className="text-sm font-medium">{project.factuur.factuurnummer}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Status</p>
                              <FactuurStatusBadge status={project.factuur.status} />
                            </div>
                            {project.factuur.betaaldAt && (
                              <div>
                                <p className="text-xs text-muted-foreground">Betaald op</p>
                                <p className="text-sm font-medium">{formatDate(project.factuur.betaaldAt)}</p>
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Totaal</p>
                            <p className="text-lg font-bold">{formatCurrency(project.factuur.totaalInclBtw)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function EmptyArchive() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
          <Archive className="h-8 w-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Geen gearchiveerde projecten</h3>
        <p className="text-muted-foreground text-center max-w-sm">
          Voltooide projecten met nacalculatie worden hier automatisch gearchiveerd na facturatie.
        </p>
      </CardContent>
    </Card>
  );
}

export default function ArchiefPage() {
  return (
    <RequireAdmin>
      <Suspense fallback={<ArchiefPageLoader />}>
        <ArchiefPageContent />
      </Suspense>
    </RequireAdmin>
  );
}

function ArchiefPageLoader() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Archief</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </>
  );
}

function ArchiefPageContent() {
  const reducedMotion = useReducedMotion();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const archivedProjects = useQuery(
    api.archief.listArchivedProjects,
    user?._id ? {} : "skip"
  ) as ArchivedProject[] | undefined;

  const [searchQuery, setSearchQuery] = useState("");

  const isLoading = isUserLoading || archivedProjects === undefined;

  // Calculate stats
  const stats = useMemo(() => {
    if (!archivedProjects) return { totaalProjecten: 0, totaleOmzet: 0 };

    const totaleOmzet = archivedProjects.reduce((sum, project) => {
      // Use factuur total if available, otherwise use offerte total
      const amount = project.factuur
        ? project.factuur.totaalInclBtw
        : project.offerte?.totalen.totaalInclBtw ?? 0;
      return sum + amount;
    }, 0);

    return {
      totaalProjecten: archivedProjects.length,
      totaleOmzet,
    };
  }, [archivedProjects]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!archivedProjects) return [];
    if (!searchQuery) return archivedProjects;

    const query = searchQuery.toLowerCase();
    return archivedProjects.filter(
      (project) =>
        project.naam.toLowerCase().includes(query) ||
        (project.offerte?.klantNaam?.toLowerCase().includes(query) ?? false) ||
        (project.offerte?.offerteNummer?.toLowerCase().includes(query) ?? false) ||
        (project.factuur?.factuurnummer?.toLowerCase().includes(query) ?? false)
    );
  }, [archivedProjects, searchQuery]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Archief</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.1,
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Archief
          </h1>
          <p className="text-muted-foreground">
            Voltooide projecten en hun documenten
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.15,
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {/* Total Projects */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "-" : stats.totaalProjecten}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Totaal voltooide projecten
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <FolderKanban className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Revenue */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "-" : formatCurrency(stats.totaleOmzet)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Totale omzet
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Euro className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.2,
          }}
        >
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek projecten, klanten, offertes..."
              className="pl-8 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Projects List */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.25,
          }}
          className="space-y-4"
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="flex items-center justify-center py-20"
              >
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </motion.div>
            ) : filteredProjects.length > 0 ? (
              <motion.div
                key="content"
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: reducedMotion ? 0 : 0.4 }}
                className="space-y-4"
              >
                {filteredProjects.map((project, index) => (
                  <motion.div
                    key={project._id}
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: reducedMotion ? 0 : 0.3,
                      delay: reducedMotion ? 0 : index * 0.05,
                    }}
                  >
                    <ArchivedProjectCard project={project} />
                  </motion.div>
                ))}
              </motion.div>
            ) : searchQuery ? (
              <motion.div
                key="no-results"
                initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{ duration: reducedMotion ? 0 : 0.3 }}
              >
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Geen resultaten gevonden</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-4">
                      We konden geen gearchiveerde projecten vinden voor &quot;{searchQuery}&quot;
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSearchQuery("")}
                    >
                      Zoekopdracht wissen
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
                transition={{ duration: reducedMotion ? 0 : 0.3 }}
              >
                <EmptyArchive />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}
