"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { RequireAdmin } from "@/components/require-admin";
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
} from "lucide-react";
import { toast } from "sonner";
import { useMedewerkers } from "@/hooks/use-medewerkers";
import { MedewerkerForm, Medewerker } from "@/components/medewerkers/medewerker-form";
import { MedewerkerDetailDialog, MedewerkerExtended } from "@/components/medewerkers/medewerker-detail-dialog";
import { SpecialisatieBadges } from "@/components/medewerkers/skills-selector";
import { CertificaatBadges, getCertificaatStatus } from "@/components/medewerkers/certificaat-form";

type FilterTab = "alle" | "actief" | "inactief";

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
  const { user } = useCurrentUser();
  const { medewerkers, isLoading, update, remove } = useMedewerkers();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("alle");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedMedewerker, setSelectedMedewerker] = useState<Medewerker | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query for certificate expiry warnings (skip when not authenticated)
  const certificaatWaarschuwingen = useQuery(
    api.medewerkers.checkVervaldataCertificaten,
    user?._id ? { dagenVoorwaarschuwing: 90 } : "skip"
  );

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
  const displayedMedewerkers = useMemo(() => {
    let filtered = medewerkers as Medewerker[];

    // Filter by tab
    if (activeTab === "actief") {
      filtered = filtered.filter((m) => m.isActief);
    } else if (activeTab === "inactief") {
      filtered = filtered.filter((m) => !m.isActief);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.naam.toLowerCase().includes(term) ||
          m.email?.toLowerCase().includes(term) ||
          m.functie?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [medewerkers, searchTerm, activeTab]);

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
        render: (medewerker) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{medewerker.naam}</span>
          </div>
        ),
      },
      {
        key: "functie",
        header: "Functie",
        isSecondary: true,
        render: (medewerker) =>
          medewerker.functie ? (
            <Badge variant="secondary">{medewerker.functie}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "specialisaties",
        header: "Specialisaties",
        showInCard: true,
        mobileLabel: "Skills",
        render: (medewerker) => (
          <SpecialisatieBadges specialisaties={medewerker.specialisaties} />
        ),
      },
      {
        key: "certificaten",
        header: "Certificaten",
        showInCard: true,
        mobileLabel: "Certs",
        render: (medewerker) => (
          <CertificaatBadges certificaten={medewerker.certificaten} />
        ),
      },
      {
        key: "contact",
        header: "Contact",
        showInCard: true,
        mobileLabel: "Contact",
        render: (medewerker) => (
          <div className="flex flex-col gap-0.5">
            {medewerker.email && (
              <div className="flex items-center gap-1.5 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{medewerker.email}</span>
              </div>
            )}
            {medewerker.telefoon && (
              <div className="flex items-center gap-1.5 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{medewerker.telefoon}</span>
              </div>
            )}
            {!medewerker.email && !medewerker.telefoon && (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        mobileLabel: "Status",
        showInCard: true,
        render: (medewerker) => (
          <Badge variant={medewerker.isActief ? "default" : "secondary"}>
            {medewerker.isActief ? (
              <>
                <UserCheck className="h-3 w-3 mr-1" />
                Actief
              </>
            ) : (
              <>
                <UserX className="h-3 w-3 mr-1" />
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
        render: (medewerker) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetail(medewerker);
              }}
              title="Bekijken"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(medewerker);
              }}
              title="Bewerken"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleActive(medewerker);
              }}
              title={medewerker.isActief ? "Op inactief zetten" : "Activeren"}
            >
              {medewerker.isActief ? (
                <UserX className="h-4 w-4 text-muted-foreground" />
              ) : (
                <UserCheck className="h-4 w-4 text-green-600" />
              )}
            </Button>
            {!medewerker.isActief && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick(medewerker);
                }}
                title="Verwijderen"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleEdit, handleViewDetail, handleToggleActive, handleDeleteClick]
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
                <BreadcrumbPage>Medewerkers</BreadcrumbPage>
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
              <BreadcrumbPage>Medewerkers</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <motion.div variants={itemVariants} className="flex items-center justify-between">
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
        </motion.div>

        {/* Stats Cards */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-4">
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
        </motion.div>

        {/* Filter Tabs and Table */}
        <motion.div variants={itemVariants}>
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
                onValueChange={(value) => setActiveTab(value as FilterTab)}
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
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

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
    <RequireAdmin>
      <MedewerkersPageContent />
    </RequireAdmin>
  );
}
