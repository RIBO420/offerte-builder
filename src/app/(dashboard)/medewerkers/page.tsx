"use client";

import { useState, useCallback, useMemo, Suspense } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchParams } from "next/navigation";
import { m } from "framer-motion";
import { useTabState } from "@/hooks/use-tab-state";
import { RequireRole } from "@/components/require-admin";
import { Pagination } from "@/components/ui/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Mail,
  Phone,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Award,
  AlertTriangle,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { MedewerkersPageSkeleton } from "@/components/ui/skeleton-card";
import { toast } from "sonner";
import { useMedewerkers } from "@/hooks/use-medewerkers";
import { MedewerkerForm, Medewerker } from "@/components/medewerkers/medewerker-form";
import { MedewerkerDetailDialog, MedewerkerExtended } from "@/components/medewerkers/medewerker-detail-dialog";
import { SpecialisatieBadges } from "@/components/medewerkers/skills-selector";
import { CertificaatBadges, getCertificaatStatus } from "@/components/medewerkers/certificaat-form";


// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
    },
  },
};

function MedewerkersPageContent() {
  const searchParams = useSearchParams();
  const { medewerkers, isLoading, update, remove } = useMedewerkers();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useTabState("alle");

  // Pagination state
  const [page, setPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const [limit, setLimit] = useState(() => {
    const limitParam = searchParams.get("limit");
    return limitParam ? parseInt(limitParam, 10) : 25;
  });

  // Update URL when pagination changes
  const updateUrl = useCallback((newPage: number, newLimit: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    params.set("limit", newLimit.toString());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    updateUrl(newPage, limit);
  }, [limit, updateUrl]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    updateUrl(1, newLimit);
  }, [updateUrl]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedMedewerker, setSelectedMedewerker] = useState<Medewerker | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);


  // Calculate stats
  const stats = useMemo(() => {
    const all = medewerkers as Medewerker[];
    const actief = all.filter((m) => m.isActief);
    const inactief = all.filter((m) => !m.isActief);

    // Count expired certificates
    let verlopenCertificaten = 0;
    for (const m of all) {
      if (m.certificaten) {
        for (const cert of m.certificaten) {
          if (getCertificaatStatus(cert.vervaldatum).status === "expired") {
            verlopenCertificaten++;
          }
        }
      }
    }

    return {
      totaal: all.length,
      actief: actief.length,
      inactief: inactief.length,
      verlopenCertificaten,
    };
  }, [medewerkers]);

  // Filter medewerkers based on search and tab
  const filteredMedewerkers = useMemo(() => {
    let filtered = medewerkers as Medewerker[];

    // Filter by tab
    if (activeTab === "actief") {
      filtered = filtered.filter((m) => m.isActief);
    } else if (activeTab === "inactief") {
      filtered = filtered.filter((m) => !m.isActief);
    }

    // Filter by search term (use debounced value)
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.naam.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.functie?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [medewerkers, debouncedSearchTerm, activeTab]);

  // Paginate the filtered results
  const totalCount = filteredMedewerkers.length;
  const displayedMedewerkers = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredMedewerkers.slice(startIndex, startIndex + limit);
  }, [filteredMedewerkers, page, limit]);

  // Reset to page 1 when filter changes
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    setPage(1);
    updateUrl(1, limit);
  }, [setActiveTab, limit, updateUrl]);

  const handleEdit = useCallback((medewerker: Medewerker) => {
    setSelectedMedewerker(medewerker);
    setShowEditDialog(true);
  }, []);

  const handleViewDetail = useCallback((medewerker: Medewerker) => {
    setSelectedMedewerker(medewerker);
    setShowDetailDialog(true);
  }, []);

  const handleToggleActive = useCallback(
    async (medewerker: Medewerker) => {
      try {
        await update(medewerker._id, { isActief: !medewerker.isActief });
        toast.success(
          medewerker.isActief
            ? "Medewerker op inactief gezet"
            : "Medewerker geactiveerd"
        );
      } catch {
        toast.error("Fout bij wijzigen status");
      }
    },
    [update]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedMedewerker) return;

    setIsSubmitting(true);
    try {
      await remove(selectedMedewerker._id);
      toast.success("Medewerker verwijderd");
      setShowDeleteDialog(false);
      setSelectedMedewerker(null);
    } catch {
      toast.error("Fout bij verwijderen medewerker");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedMedewerker, remove]);

  const handleDeleteClick = useCallback((medewerker: Medewerker) => {
    setSelectedMedewerker(medewerker);
    setShowDeleteDialog(true);
  }, []);

  // Column configuration for ResponsiveTable
  const columns: ResponsiveColumn<Medewerker>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        width: "w-[20%]",
        render: (medewerker) => (
          <span
            className="block truncate font-medium"
            title={medewerker.naam}
          >
            {medewerker.naam}
          </span>
        ),
      },
      {
        key: "functie",
        header: "Functie",
        isSecondary: true,
        width: "w-[13%]",
        render: (medewerker) =>
          medewerker.functie ? (
            <Badge
              variant="secondary"
              className="max-w-full"
              title={medewerker.functie}
            >
              <span className="truncate">{medewerker.functie}</span>
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "specialisaties",
        header: "Specialisaties",
        showInCard: true,
        mobileLabel: "Skills",
        width: "w-[17%]",
        render: (medewerker) => (
          <SpecialisatieBadges specialisaties={medewerker.specialisaties} />
        ),
      },
      {
        key: "certificaten",
        header: "Certificaten",
        showInCard: true,
        mobileLabel: "Certs",
        width: "w-[15%]",
        render: (medewerker) => (
          <CertificaatBadges certificaten={medewerker.certificaten} />
        ),
      },
      {
        key: "contact",
        header: "Contact",
        showInCard: true,
        mobileLabel: "Contact",
        width: "w-[18%]",
        render: (medewerker) => {
          // Zonder deze check toont de cel een lege regel als beide velden
          // ontbreken; nu staat er een leesbare tekst.
          if (!medewerker.email && !medewerker.telefoon) {
            return (
              <span className="text-sm text-muted-foreground">
                Geen contact bekend
              </span>
            );
          }

          return (
            <div className="flex flex-col gap-0.5">
              {medewerker.email && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate" title={medewerker.email}>
                    {medewerker.email}
                  </span>
                </div>
              )}
              {medewerker.telefoon && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate" title={medewerker.telefoon}>
                    {medewerker.telefoon}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        mobileLabel: "Status",
        showInCard: true,
        width: "w-[11%]",
        render: (medewerker) => (
          <Badge
            variant={medewerker.isActief ? "default" : "secondary"}
            className="whitespace-nowrap"
          >
            {medewerker.isActief ? (
              <>
                <UserCheck className="h-3 w-3 mr-1 shrink-0" />
                Actief
              </>
            ) : (
              <>
                <UserX className="h-3 w-3 mr-1 shrink-0" />
                Inactief
              </>
            )}
          </Badge>
        ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        // Twee besturingselementen (bewerken + menu) i.p.v. vier losse iconen.
        // In `table-fixed` is een px-breedte géén ondergrens: bij een smal
        // venster schaalt de browser alle kolommen proportioneel mee, waardoor
        // knoppen buiten de cel vallen. Zijwaarts scrollen is geen optie, dus
        // verhuizen de minder gebruikte acties naar een menu.
        width: "w-[88px]",
        allowOverflow: true,
        render: (medewerker) => (
          <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(medewerker);
              }}
              aria-label={`${medewerker.naam} bewerken`}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-8"
                  aria-label={`Meer acties voor ${medewerker.naam}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleViewDetail(medewerker)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Details bekijken
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => handleToggleActive(medewerker)}>
                  {medewerker.isActief ? (
                    <>
                      <UserX className="mr-2 h-4 w-4 text-muted-foreground" />
                      Op inactief zetten
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                      Activeren
                    </>
                  )}
                </DropdownMenuItem>

                {!medewerker.isActief && (
                  <>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => handleDeleteClick(medewerker)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [handleEdit, handleViewDetail, handleToggleActive, handleDeleteClick]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
          <MedewerkersPageSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />

      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <m.div variants={itemVariants} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Medewerkers
            </h1>
            <p className="text-muted-foreground">
              Beheer je team en personeel
            </p>
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe Medewerker
          </Button>
        </m.div>

        {/* Stats Cards */}
        <m.div variants={itemVariants} className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totaal</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totaal}</div>
              <p className="text-xs text-muted-foreground">medewerkers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actief</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.actief}</div>
              <p className="text-xs text-muted-foreground">beschikbaar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactief</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactief}</div>
              <p className="text-xs text-muted-foreground">niet beschikbaar</p>
            </CardContent>
          </Card>

          <Card className={stats.verlopenCertificaten > 0 ? "border-red-200 dark:border-red-900" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificaten</CardTitle>
              {stats.verlopenCertificaten > 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <Award className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.verlopenCertificaten}</div>
              <p className="text-xs text-muted-foreground">verlopen</p>
            </CardContent>
          </Card>
        </m.div>

        {/* Filter Tabs and Table */}
        <m.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Medewerkerslijst
                  </CardTitle>
                  <CardDescription>
                    {displayedMedewerkers.length} medewerker
                    {displayedMedewerkers.length !== 1 ? "s" : ""} weergegeven
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek medewerkers..."
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
                onValueChange={handleTabChange}
                className="mb-4"
              >
                <TabsList>
                  <TabsTrigger value="alle">
                    Alle ({stats.totaal})
                  </TabsTrigger>
                  <TabsTrigger value="actief">
                    Actief ({stats.actief})
                  </TabsTrigger>
                  <TabsTrigger value="inactief">
                    Inactief ({stats.inactief})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {displayedMedewerkers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">
                    {searchTerm
                      ? "Geen medewerkers gevonden"
                      : activeTab !== "alle"
                      ? `Geen ${activeTab === "actief" ? "actieve" : "inactieve"} medewerkers`
                      : "Nog geen medewerkers"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {searchTerm
                      ? `Geen resultaten voor "${searchTerm}"`
                      : activeTab !== "alle"
                      ? "Wijzig de filter om andere medewerkers te zien."
                      : "Voeg je eerste medewerker toe om te beginnen."}
                  </p>
                  {!searchTerm && activeTab === "alle" && (
                    <Button
                      className="mt-4"
                      onClick={() => setShowAddDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Medewerker toevoegen
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <ResponsiveTable
                    data={displayedMedewerkers}
                    columns={columns}
                    keyExtractor={(medewerker) => medewerker._id}
                    onRowClick={handleViewDetail}
                    emptyMessage={
                      searchTerm
                        ? `Geen resultaten voor "${searchTerm}"`
                        : "Voeg je eerste medewerker toe om te beginnen."
                    }
                    mobileBreakpoint="md"
                  />
                  {/* Pagination */}
                  {totalCount > 0 && (
                    <Pagination
                      page={page}
                      totalCount={totalCount}
                      limit={limit}
                      onPageChange={handlePageChange}
                      onLimitChange={handleLimitChange}
                      className="border-t mt-4"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </m.div>
      </m.div>

      {/* Add Dialog */}
      <MedewerkerForm
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => setShowAddDialog(false)}
      />

      {/* Edit Dialog */}
      <MedewerkerForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        initialData={selectedMedewerker}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedMedewerker(null);
        }}
      />

      {/* Detail Dialog */}
      <MedewerkerDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        medewerker={selectedMedewerker as MedewerkerExtended}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Medewerker Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedMedewerker?.naam} definitief wilt
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

export default function MedewerkersPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <Suspense fallback={null}>
        <MedewerkersPageContent />
      </Suspense>
    </RequireRole>
  );
}
