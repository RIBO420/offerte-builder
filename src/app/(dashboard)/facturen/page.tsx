"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { RequireAdmin } from "@/components/require-admin";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Loader2,
  Pencil,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Euro,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { EmptyState } from "@/components/ui/empty-state";

// Status configuration for facturen - WCAG AA compliant colors (4.5:1 contrast ratio)
const statusConfig = {
  concept: {
    label: "Concept",
    icon: Pencil,
    color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  definitief: {
    label: "Definitief",
    icon: FileText,
    color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  verzonden: {
    label: "Verzonden",
    icon: Send,
    color: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  betaald: {
    label: "Betaald",
    icon: CheckCircle2,
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  vervallen: {
    label: "Vervallen",
    icon: AlertCircle,
    color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

type FactuurStatus = keyof typeof statusConfig;

// Memoized formatter instances
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

function StatusBadge({ status }: { status: FactuurStatus }) {
  const config = statusConfig[status] || statusConfig.concept;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function FacturenPage() {
  return (
    <RequireAdmin>
      <Suspense fallback={<FacturenPageLoader />}>
        <FacturenPageContent />
      </Suspense>
    </RequireAdmin>
  );
}

function FacturenPageLoader() {
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
              <BreadcrumbPage>Facturen</BreadcrumbPage>
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

function FacturenPageContent() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const facturen = useQuery(api.facturen.list, user?._id ? {} : "skip");

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("alle");

  const isLoading = isUserLoading || facturen === undefined;

  // Calculate stats from facturen
  const stats = useMemo(() => {
    if (!facturen) {
      return {
        totaal: 0,
        concept: 0,
        definitief: 0,
        verzonden: 0,
        betaald: 0,
        vervallen: 0,
        totaalOmzet: 0,
        openstaand: 0,
      };
    }

    const counts = {
      totaal: facturen.length,
      concept: 0,
      definitief: 0,
      verzonden: 0,
      betaald: 0,
      vervallen: 0,
      totaalOmzet: 0,
      openstaand: 0,
    };

    facturen.forEach((factuur) => {
      counts[factuur.status as FactuurStatus]++;

      // Total revenue from paid invoices
      if (factuur.status === "betaald") {
        counts.totaalOmzet += factuur.totaalInclBtw;
      }

      // Outstanding amount (verzonden + vervallen)
      if (factuur.status === "verzonden" || factuur.status === "vervallen") {
        counts.openstaand += factuur.totaalInclBtw;
      }
    });

    return counts;
  }, [facturen]);

  // Filter facturen
  const filteredFacturen = useMemo(() => {
    if (!facturen) return [];

    return facturen.filter((factuur) => {
      const matchesSearch =
        searchQuery === "" ||
        factuur.factuurnummer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        factuur.klant.naam.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        activeTab === "alle" || factuur.status === activeTab;

      return matchesSearch && matchesStatus;
    });
  }, [facturen, searchQuery, activeTab]);

  const handleNavigate = useCallback(
    (projectId: string) => {
      router.push(`/projecten/${projectId}/factuur`);
    },
    [router]
  );

  // Check if vervaldatum is in the past
  const isOverdue = useCallback((vervaldatum: number, status: string) => {
    return status === "verzonden" && vervaldatum < Date.now();
  }, []);

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
              <BreadcrumbPage>Facturen</BreadcrumbPage>
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
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Facturen
            </h1>
            <p className="text-muted-foreground">
              Overzicht van al je facturen en betalingen
            </p>
          </div>
        </motion.div>

        {/* Stats Summary */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.15,
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.totaal}</p>
                  <p className="text-xs text-muted-foreground">
                    Totaal facturen
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.totaalOmzet)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Totale omzet (betaald)
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.openstaand)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Openstaand bedrag
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Euro className="h-5 w-5 text-amber-600 dark:text-amber-400" />
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
              placeholder="Zoek facturen..."
              className="pl-8 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>

        {/* Facturen list */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.25,
          }}
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList>
              <TabsTrigger value="alle">
                Alle
                <Badge variant="secondary" className="ml-2">
                  {stats.totaal}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="concept">
                Concept
                {stats.concept > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.concept}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="definitief">
                Definitief
                {stats.definitief > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.definitief}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="verzonden">
                Verzonden
                {stats.verzonden > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.verzonden}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="betaald">
                Betaald
                {stats.betaald > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.betaald}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="vervallen">
                Vervallen
                {stats.vervallen > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.vervallen}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
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
                ) : filteredFacturen.length > 0 ? (
                  <motion.div
                    key="content"
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: reducedMotion ? 0 : 0.4 }}
                  >
                    <Card className="overflow-hidden">
                      <ScrollableTable>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Factuurnummer</TableHead>
                              <TableHead>Klant</TableHead>
                              <TableHead>Bedrag</TableHead>
                              <TableHead>Factuurdatum</TableHead>
                              <TableHead>Vervaldatum</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredFacturen.map((factuur) => (
                              <TableRow
                                key={factuur._id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleNavigate(factuur.projectId)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <FileText className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {factuur.factuurnummer}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{factuur.klant.naam}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {factuur.klant.plaats}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(factuur.totaalInclBtw)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(factuur.factuurdatum)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className={isOverdue(factuur.vervaldatum, factuur.status) ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}>
                                      {formatDate(factuur.vervaldatum)}
                                    </span>
                                    {isOverdue(factuur.vervaldatum, factuur.status) && (
                                      <Clock className="h-4 w-4 text-red-500" />
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge
                                    status={factuur.status as FactuurStatus}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTable>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion ? undefined : { opacity: 0, scale: 0.95 }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                  >
                    <Card>
                      <CardContent className="py-8">
                        <EmptyState
                          icon={<FileText />}
                          title={
                            searchQuery
                              ? "Geen facturen gevonden"
                              : "Nog geen facturen"
                          }
                          description={
                            searchQuery
                              ? "Probeer een andere zoekopdracht"
                              : "Facturen worden automatisch aangemaakt vanuit projecten na de nacalculatie. Start een project om facturen te genereren."
                          }
                          action={
                            !searchQuery
                              ? {
                                  label: "Bekijk Projecten",
                                  onClick: () => router.push("/projecten"),
                                }
                              : {
                                  label: "Zoekopdracht wissen",
                                  onClick: () => setSearchQuery(""),
                                  variant: "outline",
                                }
                          }
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </>
  );
}
