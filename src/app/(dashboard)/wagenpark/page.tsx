"use client";

import { useState, useCallback, useMemo, Suspense } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTabState } from "@/hooks/use-tab-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  ResponsiveTable,
  ResponsiveColumn,
} from "@/components/ui/responsive-table";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Car,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Wrench,
  Gauge,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Fuel,
  Calendar,
  Eye,
} from "lucide-react";
import { ListSkeleton } from "@/components/ui/skeleton-card";
import { toast } from "sonner";
import { useVoertuigen, VoertuigStatus } from "@/hooks/use-voertuigen";
import { useUpcomingOnderhoud } from "@/hooks/use-voertuig-details";
import { Id } from "../../../../convex/_generated/dataModel";
import { KentekenPlaat } from "@/components/wagenpark/kenteken-plaat";
import { VoertuigForm, Voertuig } from "@/components/wagenpark/voertuig-form";
import {
  ComplianceWarningBadge,
  getComplianceWarningCount,
} from "@/components/wagenpark/compliance-badges";

// Vehicle type labels
const typeLabels: Record<string, string> = {
  bus: "Bus",
  bestelwagen: "Bestelwagen",
  pickup: "Pickup",
  aanhanger: "Aanhanger",
  overig: "Overig",
};

// Status configuration
const statusConfig: Record<
  VoertuigStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  actief: {
    label: "Actief",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
  },
  onderhoud: {
    label: "In onderhoud",
    variant: "secondary",
    icon: <Wrench className="h-3 w-3 mr-1" />,
  },
  inactief: {
    label: "Inactief",
    variant: "outline",
    icon: <XCircle className="h-3 w-3 mr-1" />,
  },
};

type FilterTab = "alle" | VoertuigStatus;

function formatKmStand(km: number | undefined): string {
  if (km === undefined) return "-";
  return new Intl.NumberFormat("nl-NL").format(km) + " km";
}

function formatSyncTime(timestamp: number | undefined): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Zojuist";
  if (diffMins < 60) return `${diffMins} min. geleden`;
  if (diffHours < 24) return `${diffHours} uur geleden`;
  if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? "en" : ""} geleden`;

  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

function getDaysUntilExpiry(expiryTimestamp: number | undefined): number | null {
  if (!expiryTimestamp) return null;
  const now = Date.now();
  const diffMs = expiryTimestamp - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

type VoertuigRow = {
  _id: Id<"voertuigen">;
  kenteken: string;
  merk: string;
  model: string;
  type: string;
  bouwjaar?: number;
  kleur?: string;
  kmStand?: number;
  status: VoertuigStatus;
  notities?: string;
  fleetgoId?: string;
  laatsteSyncAt?: number;
  apkVervaldatum?: number;
  verzekeringsVervaldatum?: number;
  createdAt: number;
  updatedAt: number;
};

function WagenparkPageContent() {
  const router = useRouter();
  const { voertuigen, isLoading, update, hardDelete } = useVoertuigen();
  const { count: upcomingOnderhoudCount } = useUpcomingOnderhoud();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useTabState("alle");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVoertuig, setSelectedVoertuig] = useState<Voertuig | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter voertuigen based on search and status tab
  const displayedVoertuigen = useMemo(() => {
    let filtered = voertuigen as VoertuigRow[];

    // Filter by status tab
    if (activeTab !== "alle") {
      filtered = filtered.filter((v) => v.status === activeTab);
    }

    // Filter by search term (use debounced value)
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.kenteken.toLowerCase().includes(term) ||
          v.merk.toLowerCase().includes(term) ||
          v.model.toLowerCase().includes(term) ||
          (typeLabels[v.type] || v.type).toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [voertuigen, debouncedSearchTerm, activeTab]);

  // Stats
  const totalCount = voertuigen.length;
  const activeCount = voertuigen.filter((v) => v.status === "actief").length;
  const maintenanceCount = voertuigen.filter((v) => v.status === "onderhoud").length;
  const inactiveCount = voertuigen.filter((v) => v.status === "inactief").length;

  // Compliance warnings
  const { apkWarnings, verzekeringWarnings } = useMemo(
    () => getComplianceWarningCount(voertuigen as VoertuigRow[]),
    [voertuigen]
  );

  const handleEdit = useCallback((voertuig: VoertuigRow) => {
    setSelectedVoertuig(voertuig as Voertuig);
    setShowEditDialog(true);
  }, []);

  const handleViewDetails = useCallback(
    (voertuig: VoertuigRow) => {
      router.push(`/wagenpark/${voertuig._id}`);
    },
    [router]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedVoertuig) return;

    setIsSubmitting(true);
    try {
      await hardDelete(selectedVoertuig._id);
      toast.success("Voertuig verwijderd");
      setShowDeleteDialog(false);
      setSelectedVoertuig(null);
    } catch {
      toast.error("Fout bij verwijderen voertuig");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedVoertuig, hardDelete]);

  const handleDeleteClick = useCallback((voertuig: VoertuigRow) => {
    setSelectedVoertuig(voertuig as Voertuig);
    setShowDeleteDialog(true);
  }, []);

  const handleToggleStatus = useCallback(
    async (voertuig: VoertuigRow, newStatus: VoertuigStatus) => {
      try {
        await update(voertuig._id, { status: newStatus });
        toast.success(
          newStatus === "actief"
            ? "Voertuig geactiveerd"
            : newStatus === "onderhoud"
            ? "Voertuig op onderhoud gezet"
            : "Voertuig op inactief gezet"
        );
      } catch {
        toast.error("Fout bij wijzigen status");
      }
    },
    [update]
  );

  // Column configuration for ResponsiveTable
  const columns: ResponsiveColumn<VoertuigRow>[] = useMemo(
    () => [
      {
        key: "kenteken",
        header: "Kenteken",
        isPrimary: true,
        render: (voertuig) => (
          <div className="flex items-center gap-2">
            <KentekenPlaat kenteken={voertuig.kenteken} size="sm" />
            <ComplianceWarningBadge
              apkDaysLeft={getDaysUntilExpiry(voertuig.apkVervaldatum)}
              verzekeringDaysLeft={getDaysUntilExpiry(voertuig.verzekeringsVervaldatum)}
            />
          </div>
        ),
      },
      {
        key: "voertuig",
        header: "Merk & Model",
        isSecondary: true,
        render: (voertuig) => (
          <div>
            <span className="font-medium">{voertuig.merk}</span>
            <span className="text-muted-foreground ml-1">{voertuig.model}</span>
            {voertuig.bouwjaar && (
              <span className="text-muted-foreground text-xs ml-1">
                ({voertuig.bouwjaar})
              </span>
            )}
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        showInCard: true,
        mobileLabel: "Type",
        render: (voertuig) => (
          <Badge variant="outline">{typeLabels[voertuig.type] || voertuig.type}</Badge>
        ),
      },
      {
        key: "status",
        header: "Status",
        showInCard: true,
        mobileLabel: "Status",
        render: (voertuig) => {
          const config = statusConfig[voertuig.status];
          return (
            <Badge variant={config.variant}>
              {config.icon}
              {config.label}
            </Badge>
          );
        },
      },
      {
        key: "kmStand",
        header: "KM Stand",
        showInCard: true,
        mobileLabel: "KM",
        render: (voertuig) => (
          <div className="flex items-center gap-1.5 text-sm">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
            <span>{formatKmStand(voertuig.kmStand)}</span>
          </div>
        ),
      },
      {
        key: "sync",
        header: "Laatste sync",
        showInCard: true,
        mobileLabel: "Sync",
        render: (voertuig) =>
          voertuig.fleetgoId ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 hidden sm:inline" />
              <span>{formatSyncTime(voertuig.laatsteSyncAt)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        render: (voertuig) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails(voertuig);
              }}
              title="Bekijk details"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(voertuig);
              }}
              title="Bewerken"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {voertuig.status === "actief" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(voertuig, "onderhoud");
                }}
                title="Op onderhoud zetten"
              >
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
            {voertuig.status === "onderhoud" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(voertuig, "actief");
                }}
                title="Activeren"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </Button>
            )}
            {voertuig.status === "inactief" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(voertuig, "actief");
                  }}
                  title="Activeren"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(voertuig);
                  }}
                  title="Verwijderen"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [handleEdit, handleViewDetails, handleToggleStatus, handleDeleteClick]
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
                <BreadcrumbPage>Wagenpark</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <ListSkeleton count={5} />
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
              <BreadcrumbPage>Wagenpark</BreadcrumbPage>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Wagenpark
            </h1>
            <p className="text-muted-foreground">
              Beheer je voertuigen en wagenpark
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/wagenpark?tab=onderhoud")}>
              <Wrench className="mr-2 h-4 w-4" />
              Onderhoud
              {upcomingOnderhoudCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {upcomingOnderhoudCount}
                </Badge>
              )}
            </Button>
            <Button variant="outline" onClick={() => {}}>
              <Fuel className="mr-2 h-4 w-4" />
              Brandstof
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Voertuig toevoegen
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totaal</CardTitle>
              <Car className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">voertuigen</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actief</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeCount}</div>
              <p className="text-xs text-muted-foreground">beschikbaar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Onderhoud</CardTitle>
              <Wrench className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{maintenanceCount}</div>
              <p className="text-xs text-muted-foreground">
                {upcomingOnderhoudCount > 0 && (
                  <span className="text-amber-600">
                    +{upcomingOnderhoudCount} gepland
                  </span>
                )}
                {upcomingOnderhoudCount === 0 && "niet beschikbaar"}
              </p>
            </CardContent>
          </Card>

          <Card className={apkWarnings > 0 ? "border-red-200 dark:border-red-900" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">APK Bijna Verlopen</CardTitle>
              <ShieldCheck className={`h-4 w-4 ${apkWarnings > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${apkWarnings > 0 ? "text-red-500" : ""}`}>
                {apkWarnings}
              </div>
              <p className="text-xs text-muted-foreground">binnen 30 dagen</p>
            </CardContent>
          </Card>

          <Card className={verzekeringWarnings > 0 ? "border-red-200 dark:border-red-900" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verzekering</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${verzekeringWarnings > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${verzekeringWarnings > 0 ? "text-red-500" : ""}`}>
                {verzekeringWarnings}
              </div>
              <p className="text-xs text-muted-foreground">binnen 30 dagen</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Voertuigenlijst
                </CardTitle>
                <CardDescription>
                  {displayedVoertuigen.length} voertuig
                  {displayedVoertuigen.length !== 1 ? "en" : ""} weergegeven
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek voertuigen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mb-4"
            >
              <TabsList>
                <TabsTrigger value="alle">
                  Alle ({totalCount})
                </TabsTrigger>
                <TabsTrigger value="actief">
                  Actief ({activeCount})
                </TabsTrigger>
                <TabsTrigger value="onderhoud">
                  Onderhoud ({maintenanceCount})
                </TabsTrigger>
                <TabsTrigger value="inactief">
                  Inactief ({inactiveCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {displayedVoertuigen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Car className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {searchTerm
                    ? "Geen voertuigen gevonden"
                    : activeTab !== "alle"
                    ? `Geen ${activeTab === "actief" ? "actieve" : activeTab === "onderhoud" ? "voertuigen in onderhoud" : "inactieve"} voertuigen`
                    : "Nog geen voertuigen"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : activeTab !== "alle"
                    ? "Wijzig de filter om andere voertuigen te zien."
                    : "Voeg je eerste voertuig toe om te beginnen."}
                </p>
                {!searchTerm && activeTab === "alle" && (
                  <Button
                    className="mt-4"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Voertuig toevoegen
                  </Button>
                )}
              </div>
            ) : (
              <ResponsiveTable
                data={displayedVoertuigen}
                columns={columns}
                keyExtractor={(voertuig) => voertuig._id}
                onRowClick={handleViewDetails}
                emptyMessage={
                  searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : "Voeg je eerste voertuig toe om te beginnen."
                }
                mobileBreakpoint="md"
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Dialog */}
      <VoertuigForm
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => setShowAddDialog(false)}
      />

      {/* Edit Dialog */}
      <VoertuigForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        initialData={selectedVoertuig}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedVoertuig(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voertuig Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je het voertuig met kenteken{" "}
              <strong>{selectedVoertuig?.kenteken}</strong> definitief wilt
              verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function WagenparkPage() {
  return (
    <Suspense fallback={null}>
      <WagenparkPageContent />
    </Suspense>
  );
}
