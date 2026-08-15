"use client";

import { useState, useMemo, useCallback, Suspense, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PaginaReveal } from "@/components/pagina-reveal";
import { useDebounce } from "@/hooks/use-debounce";
import { RequireRole } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  Plus,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { ScrollableTable } from "@/components/ui/responsive-table";
import { toast } from "sonner";
import { InkoopTabs } from "@/components/inkoop/inkoop-tabs";
import { formatCurrency } from "@/lib/format/currency";
import {
  INKOOP_STATUS_CONFIG,
  statusClasses,
  type InkoopStatus,
} from "@/lib/constants/statuses";
import { LaadIndicator } from "@/components/ui/laad-indicator";

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

// Statuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
const STATUS_CONFIG = INKOOP_STATUS_CONFIG;

type InkooporderStatus = InkoopStatus;

// Status Badge Component
function InkoopStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as InkooporderStatus] || STATUS_CONFIG.concept;
  const Icon = config.icon;

  return (
    <Badge className={`${statusClasses(config)} gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// Memoized table row component
interface InkooporderRowProps {
  inkooporder: {
    _id: Id<"inkooporders">;
    orderNummer: string;
    leverancierId: Id<"leveranciers">;
    projectId?: Id<"projecten">;
    status: string;
    totaal: number;
    createdAt: number;
  };
  leverancierNaam: string;
  projectNaam?: string;
  onDelete: (id: Id<"inkooporders">) => void;
  onNavigate: (id: Id<"inkooporders">) => void;
}

const InkooporderRow = memo(function InkooporderRow({
  inkooporder,
  leverancierNaam,
  projectNaam,
  onDelete,
  onNavigate,
}: InkooporderRowProps) {
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('button')) {
      onNavigate(inkooporder._id);
    }
  }, [inkooporder._id, onNavigate]);

  const handleDelete = useCallback(() => {
    onDelete(inkooporder._id);
  }, [inkooporder._id, onDelete]);

  return (
    <TableRow
      key={inkooporder._id}
      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={handleRowClick}
    >
      <TableCell className="font-medium">
        <Link
          href={`/inkoop/${inkooporder._id}`}
          className="hover:underline"
        >
          {inkooporder.orderNummer}
        </Link>
      </TableCell>
      <TableCell>{leverancierNaam}</TableCell>
      <TableCell>
        <InkoopStatusBadge status={inkooporder.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(inkooporder.createdAt)}
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(inkooporder.totaal)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {projectNaam || "-"}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/inkoop/${inkooporder._id}`}>
                <Eye className="mr-2 h-4 w-4" />
                Bekijken
              </Link>
            </DropdownMenuItem>
            {inkooporder.status === "concept" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Verwijderen
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

export default function InkoopPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider", "materiaalman"]}>
      <Suspense fallback={<InkoopPageLoader />}>
        <InkoopPageContent />
      </Suspense>
    </RequireRole>
  );
}

function InkoopPageLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 items-center justify-center">
        <LaadIndicator formaat="pagina" />
      </div>
    </>
  );
}

function InkoopPageContent() {
  const router = useRouter();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState("alle");
  const [leverancierFilter, setLeverancierFilter] = useState<string>("alle");
  const [projectFilter, setProjectFilter] = useState<string>("alle");
  const [deleteOrderId, setDeleteOrderId] = useState<Id<"inkooporders"> | null>(null);

  // Queries
  const inkooporders = useQuery(api.inkooporders.list, {});
  const stats = useQuery(api.inkooporders.getStats, {});
  const leveranciers = useQuery(api.leveranciers.list, {});
  const projecten = useQuery(api.projecten.list, {});

  // Mutations
  const removeInkooporder = useMutation(api.inkooporders.remove);

  const isLoading = inkooporders === undefined || stats === undefined;

  // Build leverancier lookup map
  const leverancierMap = useMemo(() => {
    const map = new Map<string, string>();
    if (leveranciers && Array.isArray(leveranciers)) {
      for (const lev of leveranciers) {
        map.set(lev._id.toString(), lev.naam);
      }
    }
    return map;
  }, [leveranciers]);

  // Build project lookup map
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    if (projecten) {
      for (const proj of projecten) {
        map.set(proj._id.toString(), proj.naam);
      }
    }
    return map;
  }, [projecten]);

  // Filter inkooporders
  const filteredOrders = useMemo(() => {
    if (!inkooporders) return [];

    return inkooporders.filter((order) => {
      // Search filter
      const leverancierNaam = leverancierMap.get(order.leverancierId.toString()) || "";
      const matchesSearch =
        debouncedSearchQuery === "" ||
        order.orderNummer.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        leverancierNaam.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      // Status filter
      const matchesStatus =
        activeTab === "alle" || order.status === activeTab;

      // Leverancier filter
      const matchesLeverancier =
        leverancierFilter === "alle" ||
        order.leverancierId.toString() === leverancierFilter;

      // Project filter
      const matchesProject =
        projectFilter === "alle" ||
        (projectFilter === "geen" && !order.projectId) ||
        order.projectId?.toString() === projectFilter;

      return matchesSearch && matchesStatus && matchesLeverancier && matchesProject;
    });
  }, [inkooporders, debouncedSearchQuery, activeTab, leverancierFilter, projectFilter, leverancierMap]);

  // Handlers
  const handleNavigate = useCallback((orderId: Id<"inkooporders">) => {
    router.push(`/inkoop/${orderId}`);
  }, [router]);

  const handleDelete = useCallback(async () => {
    if (!deleteOrderId) return;

    try {
      await removeInkooporder({ id: deleteOrderId });
      toast.success("Inkooporder verwijderd");
      setDeleteOrderId(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Fout bij verwijderen";
      toast.error(errorMessage);
    }
  }, [deleteOrderId, removeInkooporder]);

  // Calculate this month's total
  const thisMonthTotal = useMemo(() => {
    if (!stats?.perMaand) return 0;
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return stats.perMaand[key] || 0;
  }, [stats]);

  return (
    <>
      <PageHeader />

      {/* Eén reveal op de buitenkant, geen gestapelde delays eronder: de blokken
          hieronder zijn gewone divs en staan er dus ook als er nul
          animatieframes vallen. → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <InkoopTabs />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Inkooporders
            </h1>
            <p className="text-muted-foreground">
              Beheer inkooporders en leveringen
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild>
                <Link href="/inkoop/nieuw">
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuwe inkooporder
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Maak een nieuwe inkooporder aan</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concept</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.perStatus.concept || 0}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats?.bedragPerStatus.concept || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Besteld</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.perStatus.besteld || 0}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats?.bedragPerStatus.besteld || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Geleverd</CardTitle>
              <Truck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.perStatus.geleverd || 0}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats?.bedragPerStatus.geleverd || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deze maand</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(thisMonthTotal)}</div>
              <p className="text-xs text-muted-foreground">
                Totaal {stats?.totaalAantal || 0} orders
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op ordernummer of leverancier..."
              className="pl-8 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={leverancierFilter} onValueChange={setLeverancierFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Leverancier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle leveranciers</SelectItem>
              {leveranciers && Array.isArray(leveranciers) && leveranciers.map((lev) => (
                <SelectItem key={lev._id} value={lev._id.toString()}>
                  {lev.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle projecten</SelectItem>
              <SelectItem value="geen">Geen project</SelectItem>
              {projecten?.map((proj) => (
                <SelectItem key={proj._id} value={proj._id.toString()}>
                  {proj.naam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs and Table */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="alle">
                Alle
                <Badge variant="secondary" className="ml-2">
                  {stats?.totaalAantal || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="concept">
                Concept
                {(stats?.perStatus.concept || 0) > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats?.perStatus.concept}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="besteld">
                Besteld
                {(stats?.perStatus.besteld || 0) > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats?.perStatus.besteld}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="geleverd">
                Geleverd
                {(stats?.perStatus.geleverd || 0) > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats?.perStatus.geleverd}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="gefactureerd">
                Gefactureerd
                {(stats?.perStatus.gefactureerd || 0) > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats?.perStatus.gefactureerd}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
              {/* Geen `AnimatePresence` meer. Die hield met `mode="wait"` de
                  volgende staat tegen tot de vorige was uitgefaded — precies
                  het gat waarin de pagina leeg stond — en liet bovendien elk
                  blok op `opacity: 0` hangen zodra rAF stilstond. De takken
                  wisselen nu gewoon; de `key` op de reveal zorgt dat de
                  CSS-animatie opnieuw start, en zonder animatieframe staat de
                  inhoud er meteen. */}
              {isLoading ? (
                <div key="loading" className="flex items-center justify-center py-20">
                  <LaadIndicator formaat="sectie" className="min-h-0" />
                </div>
              ) : filteredOrders.length > 0 ? (
                <PaginaReveal key="content">
                    <Card className="overflow-hidden">
                      <ScrollableTable>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nummer</TableHead>
                              <TableHead>Leverancier</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Datum</TableHead>
                              <TableHead className="text-right">Totaal</TableHead>
                              <TableHead>Project</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredOrders.map((order) => (
                              <InkooporderRow
                                key={order._id}
                                inkooporder={order}
                                leverancierNaam={leverancierMap.get(order.leverancierId.toString()) || "Onbekend"}
                                projectNaam={order.projectId ? projectMap.get(order.projectId.toString()) : undefined}
                                onDelete={(id) => setDeleteOrderId(id)}
                                onNavigate={handleNavigate}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTable>
                    </Card>
                </PaginaReveal>
              ) : (
                <PaginaReveal key="empty">
                    <Card className="p-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                          <Package className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold">Geen inkooporders gevonden</h3>
                        <p className="text-muted-foreground mt-1 mb-4 max-w-sm">
                          {searchQuery || activeTab !== "alle" || leverancierFilter !== "alle" || projectFilter !== "alle"
                            ? "Pas je filters aan of maak een nieuwe inkooporder aan."
                            : "Maak je eerste inkooporder aan om materialen te bestellen bij leveranciers."}
                        </p>
                        <Button asChild>
                          <Link href="/inkoop/nieuw">
                            <Plus className="mr-2 h-4 w-4" />
                            Nieuwe inkooporder
                          </Link>
                        </Button>
                      </div>
                    </Card>
                </PaginaReveal>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </PaginaReveal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inkooporder verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze inkooporder wilt verwijderen?
              Dit kan alleen als de order nog in concept status is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
