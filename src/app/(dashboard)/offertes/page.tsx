"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Shovel,
  Trees,
  Search,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  Download,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import {
  OfferteFiltersComponent,
  ActiveFilters,
  defaultFilters,
  type OfferteFilters,
} from "@/components/offerte/filters";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

const statusColors: Record<string, string> = {
  concept: "bg-gray-100 text-gray-800",
  definitief: "bg-blue-100 text-blue-800",
  verzonden: "bg-yellow-100 text-yellow-800",
  geaccepteerd: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
};

export default function OffertesPage() {
  return (
    <Suspense fallback={<OffertesPageSkeleton />}>
      <OffertesPageContent />
    </Suspense>
  );
}

function OffertesPageSkeleton() {
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
              <BreadcrumbPage>Offertes</BreadcrumbPage>
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

function OffertesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: isUserLoading } = useCurrentUser();
  const {
    offertes,
    stats,
    isLoading: isOffertesLoading,
    delete: deleteOfferte,
    duplicate,
    bulkUpdateStatus,
    bulkRemove,
  } = useOffertes();
  const { getNextNummer } = useInstellingen();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(searchParams.get("status") || "alle");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<Id<"offertes">>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("");

  // Initialize filters from URL params
  const [filters, setFilters] = useState<OfferteFilters>(() => ({
    type: (searchParams.get("type") as OfferteFilters["type"]) || "alle",
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
    amountMin: searchParams.get("amountMin") || "",
    amountMax: searchParams.get("amountMax") || "",
  }));

  const isLoading = isUserLoading || isOffertesLoading;

  // Update URL when filters change
  const updateUrlParams = (newFilters: OfferteFilters, newStatus: string) => {
    const params = new URLSearchParams();
    if (newStatus !== "alle") params.set("status", newStatus);
    if (newFilters.type !== "alle") params.set("type", newFilters.type);
    if (newFilters.dateFrom) params.set("dateFrom", newFilters.dateFrom.toISOString());
    if (newFilters.dateTo) params.set("dateTo", newFilters.dateTo.toISOString());
    if (newFilters.amountMin) params.set("amountMin", newFilters.amountMin);
    if (newFilters.amountMax) params.set("amountMax", newFilters.amountMax);

    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : "/offertes", { scroll: false });
  };

  const handleFiltersChange = (newFilters: OfferteFilters) => {
    setFilters(newFilters);
    updateUrlParams(newFilters, activeTab);
  };

  const handleFiltersReset = () => {
    setFilters(defaultFilters);
    updateUrlParams(defaultFilters, activeTab);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    updateUrlParams(filters, tab);
  };

  const filteredOffertes = useMemo(() => {
    return offertes?.filter((offerte) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        offerte.klant.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
        offerte.offerteNummer.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter (from tabs)
      const matchesStatus =
        activeTab === "alle" || offerte.status === activeTab;

      // Type filter
      const matchesType =
        filters.type === "alle" || offerte.type === filters.type;

      // Date range filter
      const offerteDate = new Date(offerte.updatedAt);
      const matchesDateFrom =
        !filters.dateFrom || offerteDate >= filters.dateFrom;
      const matchesDateTo =
        !filters.dateTo || offerteDate <= new Date(filters.dateTo.getTime() + 86400000); // Include end date

      // Amount range filter
      const amount = offerte.totalen.totaalInclBtw;
      const matchesAmountMin =
        !filters.amountMin || amount >= parseFloat(filters.amountMin);
      const matchesAmountMax =
        !filters.amountMax || amount <= parseFloat(filters.amountMax);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesAmountMin &&
        matchesAmountMax
      );
    });
  }, [offertes, searchQuery, activeTab, filters]);

  const handleDuplicate = async (offerteId: string) => {
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerteId as any, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch (error) {
      toast.error("Fout bij dupliceren offerte");
      console.error(error);
    }
  };

  const handleDelete = async (offerteId: string) => {
    if (!confirm("Weet je zeker dat je deze offerte wilt verwijderen?")) return;
    try {
      await deleteOfferte({ id: offerteId as any });
      toast.success("Offerte verwijderd");
    } catch (error) {
      toast.error("Fout bij verwijderen offerte");
      console.error(error);
    }
  };

  // Bulk action handlers
  const toggleSelectAll = () => {
    if (!filteredOffertes) return;
    if (selectedIds.size === filteredOffertes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOffertes.map((o) => o._id)));
    }
  };

  const toggleSelect = (id: Id<"offertes">) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkStatusValue("");
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdateStatus({
        ids: Array.from(selectedIds),
        status: status as "concept" | "definitief" | "verzonden" | "geaccepteerd" | "afgewezen",
      });
      toast.success(`${selectedIds.size} offerte(s) bijgewerkt naar ${status}`);
      clearSelection();
    } catch (error) {
      toast.error("Fout bij bijwerken status");
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkRemove({ ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} offerte(s) verwijderd`);
      clearSelection();
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast.error("Fout bij verwijderen offertes");
      console.error(error);
    }
  };

  const handleExportCSV = () => {
    if (!filteredOffertes) return;
    const exportData = selectedIds.size > 0
      ? filteredOffertes.filter((o) => selectedIds.has(o._id))
      : filteredOffertes;

    const headers = ["Nummer", "Type", "Klant", "Adres", "Plaats", "Status", "Bedrag (incl. BTW)", "Datum"];
    const rows = exportData.map((o) => [
      o.offerteNummer,
      o.type,
      o.klant.naam,
      o.klant.adres,
      o.klant.plaats,
      o.status,
      o.totalen.totaalInclBtw.toFixed(2),
      new Date(o.updatedAt).toLocaleDateString("nl-NL"),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `offertes-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success(`${exportData.length} offerte(s) geexporteerd`);
  };

  const isAllSelected = filteredOffertes && filteredOffertes.length > 0 && selectedIds.size === filteredOffertes.length;
  const isSomeSelected = selectedIds.size > 0;

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
              <BreadcrumbPage>Offertes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Offertes
            </h1>
            <p className="text-muted-foreground">
              Beheer al je aanleg- en onderhoudsoffertes
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/offertes/nieuw/onderhoud">
                <Trees className="mr-2 h-4 w-4" />
                Onderhoud
              </Link>
            </Button>
            <Button asChild>
              <Link href="/offertes/nieuw/aanleg">
                <Shovel className="mr-2 h-4 w-4" />
                Aanleg
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op klantnaam of offertenummer..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <OfferteFiltersComponent
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleFiltersReset}
            />
          </div>
          <ActiveFilters filters={filters} onChange={handleFiltersChange} />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="alle">
              Alle
              <Badge variant="secondary" className="ml-2">
                {stats?.totaal || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="concept">
              Concept
              {(stats?.concept || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.concept}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verzonden">
              Verzonden
              {(stats?.verzonden || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.verzonden}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="geaccepteerd">
              Geaccepteerd
              {(stats?.geaccepteerd || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.geaccepteerd}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="afgewezen">
              Afgewezen
              {(stats?.afgewezen || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.afgewezen}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {/* Bulk Actions Bar */}
            {isSomeSelected && (
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {selectedIds.size} geselecteerd
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <Select
                    value={bulkStatusValue}
                    onValueChange={(value) => {
                      setBulkStatusValue(value);
                      handleBulkStatusChange(value);
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Wijzig status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="definitief">Definitief</SelectItem>
                      <SelectItem value="verzonden">Verzonden</SelectItem>
                      <SelectItem value="geaccepteerd">Geaccepteerd</SelectItem>
                      <SelectItem value="afgewezen">Afgewezen</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exporteer
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Verwijderen
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : filteredOffertes && filteredOffertes.length > 0 ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecteer alle"
                        />
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nummer</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Plaats</TableHead>
                      <TableHead>Bedrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffertes.map((offerte) => (
                      <TableRow
                        key={offerte._id}
                        className={selectedIds.has(offerte._id) ? "bg-muted/50" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(offerte._id)}
                            onCheckedChange={() => toggleSelect(offerte._id)}
                            aria-label={`Selecteer ${offerte.offerteNummer}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              offerte.type === "aanleg"
                                ? "bg-primary/10"
                                : "bg-green-100"
                            }`}
                          >
                            {offerte.type === "aanleg" ? (
                              <Shovel className="h-4 w-4 text-primary" />
                            ) : (
                              <Trees className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/offertes/${offerte._id}`}
                            className="hover:underline"
                          >
                            {offerte.offerteNummer}
                          </Link>
                        </TableCell>
                        <TableCell>{offerte.klant.naam}</TableCell>
                        <TableCell>{offerte.klant.plaats}</TableCell>
                        <TableCell>
                          {formatCurrency(offerte.totalen.totaalInclBtw)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[offerte.status]}>
                            {offerte.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(offerte.updatedAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/offertes/${offerte._id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Bekijken
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDuplicate(offerte._id)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Dupliceren
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(offerte._id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Verwijderen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    {searchQuery ? "Geen resultaten" : "Geen offertes"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
                    {searchQuery
                      ? `Geen offertes gevonden voor "${searchQuery}"`
                      : "Je hebt nog geen offertes aangemaakt. Maak je eerste offerte aan om te beginnen."}
                  </p>
                  {!searchQuery && (
                    <div className="mt-6 flex gap-2">
                      <Button asChild>
                        <Link href="/offertes/nieuw/aanleg">
                          <Plus className="mr-2 h-4 w-4" />
                          Nieuwe Aanleg Offerte
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/offertes/nieuw/onderhoud">
                          <Plus className="mr-2 h-4 w-4" />
                          Nieuwe Onderhoud Offerte
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offertes verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedIds.size} offerte(s) wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
