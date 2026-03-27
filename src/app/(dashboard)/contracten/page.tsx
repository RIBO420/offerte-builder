"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ScrollText,
  Search,
  Plus,
  FileCheck,
  Euro,
  CalendarClock,
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
import { StatsGridSkeleton, CardTableSkeleton } from "@/components/ui/skeleton-card";

// Status configuration with WCAG AA colors
const statusConfig = {
  concept: {
    label: "Concept",
    color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  actief: {
    label: "Actief",
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  verlopen: {
    label: "Verlopen",
    color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  opgezegd: {
    label: "Opgezegd",
    color: "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
} as const;

type ContractStatus = keyof typeof statusConfig;

const frequentieLabels: Record<string, string> = {
  maandelijks: "Maandelijks",
  per_kwartaal: "Per kwartaal",
  halfjaarlijks: "Halfjaarlijks",
  jaarlijks: "Jaarlijks",
};

function StatusBadge({ status }: { status: ContractStatus }) {
  const config = statusConfig[status] || statusConfig.concept;
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ContractenPage() {
  return (
    <Suspense fallback={<ContractenPageLoader />}>
      <ContractenPageContent />
    </Suspense>
  );
}

function ContractenPageLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <StatsGridSkeleton count={3} columns={3} />
        <CardTableSkeleton rows={6} />
      </div>
    </>
  );
}

function ContractenPageContent() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState("alle");

  // Queries
  const contracts = useQuery(
    api.onderhoudscontracten.list,
    user?._id ? {} : "skip"
  );
  const stats = useQuery(
    api.onderhoudscontracten.getStats,
    user?._id ? {} : "skip"
  );

  const isLoading = isUserLoading || contracts === undefined;

  // Filter contracts by status tab and search query
  const filteredContracts = useMemo(() => {
    if (!contracts) return [];

    let filtered = contracts;

    // Filter by status tab
    if (activeTab !== "alle") {
      filtered = filtered.filter((c) => c.status === activeTab);
    }

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.naam.toLowerCase().includes(query) ||
          c.contractNummer.toLowerCase().includes(query) ||
          c.klantNaam.toLowerCase().includes(query) ||
          c.locatie.adres.toLowerCase().includes(query) ||
          c.locatie.plaats.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [contracts, activeTab, debouncedSearchQuery]);

  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
  }, []);

  const handleNavigate = useCallback(
    (contractId: string) => {
      router.push(`/contracten/${contractId}`);
    },
    [router]
  );

  return (
    <>
      <PageHeader />

      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <m.div
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
              Contracten
            </h1>
            <p className="text-muted-foreground">
              Beheer onderhoudscontracten en SLA-afspraken
            </p>
          </div>
          <Button asChild>
            <Link href="/contracten/nieuw">
              <Plus className="h-4 w-4 mr-2" />
              Nieuw contract
            </Link>
          </Button>
        </m.div>

        {/* Stats Cards */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.2,
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.totaalActief ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Actieve contracten
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {stats ? formatCurrency(stats.maandelijkseWaarde) : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maandelijkse waarde
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {stats?.verlopendBinnen30Dagen ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verlopend binnen 30 dagen
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                  <CalendarClock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </m.div>

        {/* Search */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.25,
          }}
        >
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op naam, nummer, klant..."
              className="pl-8 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </m.div>

        {/* Contracts list */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.3,
          }}
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            <TabsList>
              <TabsTrigger value="alle">
                Alle
                <Badge variant="secondary" className="ml-2">
                  {stats?.totaal || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="actief">
                Actief
                <Badge variant="secondary" className="ml-2">
                  {stats?.totaalActief || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="concept">Concept</TabsTrigger>
              <TabsTrigger value="verlopen">Verlopen</TabsTrigger>
              <TabsTrigger value="opgezegd">Opgezegd</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <m.div
                    key="loading"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.2 }}
                    className="py-4"
                  >
                    <CardTableSkeleton rows={5} />
                  </m.div>
                ) : filteredContracts.length > 0 ? (
                  <m.div
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
                              <TableHead>Contract</TableHead>
                              <TableHead>Klant</TableHead>
                              <TableHead>Looptijd</TableHead>
                              <TableHead>Tarief (jaar)</TableHead>
                              <TableHead>Frequentie</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredContracts.map((contract) => (
                              <TableRow
                                key={contract._id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleNavigate(contract._id)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <ScrollText className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {contract.naam}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {contract.contractNummer}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">
                                      {contract.klantNaam}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {contract.locatie.plaats}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {formatDate(contract.startDatum)} -{" "}
                                  {formatDate(contract.eindDatum)}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(contract.jaarlijksTarief)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {frequentieLabels[contract.betalingsfrequentie] ?? contract.betalingsfrequentie}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge
                                    status={contract.status as ContractStatus}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTable>
                    </Card>
                  </m.div>
                ) : searchQuery ? (
                  <m.div
                    key="no-results"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion ? undefined : { opacity: 0, scale: 0.95 }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                  >
                    <Card className="p-12 text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-1">
                        Geen resultaten
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Geen contracten gevonden voor &quot;{searchQuery}&quot;
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setSearchQuery("")}
                      >
                        Zoekopdracht wissen
                      </Button>
                    </Card>
                  </m.div>
                ) : (
                  <m.div
                    key="empty"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion ? undefined : { opacity: 0, scale: 0.95 }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                  >
                    <Card className="p-12 text-center">
                      <ScrollText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-1">
                        Nog geen contracten
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Maak je eerste onderhoudscontract aan om terugkerende
                        werkzaamheden te beheren.
                      </p>
                      <Button asChild>
                        <Link href="/contracten/nieuw">
                          <Plus className="h-4 w-4 mr-2" />
                          Nieuw contract
                        </Link>
                      </Button>
                    </Card>
                  </m.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </m.div>
      </m.div>
    </>
  );
}
