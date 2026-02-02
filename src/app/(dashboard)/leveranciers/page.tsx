"use client";

import { useState, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useTableSort } from "@/hooks/use-table-sort";
import { motion } from "framer-motion";
import { RequireAdmin } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Search,
  Loader2,
  Mail,
  Phone,
  User,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useLeveranciers, useLeveranciersSearch, useLeveranciersMutations } from "@/hooks/use-leveranciers";
import { LeverancierForm, LeverancierFormData } from "@/components/leveranciers/leverancier-form";
import { Id } from "../../../../convex/_generated/dataModel";

type Leverancier = {
  _id: Id<"leveranciers">;
  naam: string;
  contactpersoon?: string;
  email?: string;
  telefoon?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  kvkNummer?: string;
  btwNummer?: string;
  iban?: string;
  betalingstermijn?: number;
  notities?: string;
  isActief: boolean;
  createdAt: number;
  updatedAt: number;
};

type StatusFilter = "alle" | "actief" | "inactief";

function LeveranciersPageContent() {
  const { leveranciers, stats, isLoading } = useLeveranciers();
  const { create, update, remove } = useLeveranciersMutations();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { results: searchResults } = useLeveranciersSearch(debouncedSearchTerm);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLeverancier, setSelectedLeverancier] = useState<Leverancier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter leveranciers based on search and status
  const filteredLeveranciers: Leverancier[] = useMemo(() => {
    let result = (debouncedSearchTerm ? searchResults : leveranciers) as Leverancier[];

    // Apply status filter
    if (statusFilter === "actief") {
      result = result.filter((l) => l.isActief);
    } else if (statusFilter === "inactief") {
      result = result.filter((l) => !l.isActief);
    }

    return result;
  }, [debouncedSearchTerm, searchResults, leveranciers, statusFilter]);

  // Apply sorting
  const { sortedData: sortedLeveranciers, sortConfig, toggleSort } = useTableSort<Leverancier>(
    filteredLeveranciers,
    "naam"
  );

  const handleAdd = useCallback(
    async (data: LeverancierFormData) => {
      try {
        await create({
          naam: data.naam,
          contactpersoon: data.contactpersoon || undefined,
          email: data.email || undefined,
          telefoon: data.telefoon || undefined,
          adres: data.adres || undefined,
          postcode: data.postcode || undefined,
          plaats: data.plaats || undefined,
          kvkNummer: data.kvkNummer || undefined,
          btwNummer: data.btwNummer || undefined,
          iban: data.iban || undefined,
          betalingstermijn: data.betalingstermijn ? parseInt(data.betalingstermijn) : undefined,
          notities: data.notities || undefined,
        });
        toast.success("Leverancier toegevoegd");
      } catch {
        toast.error("Fout bij toevoegen leverancier");
        throw new Error("Fout bij toevoegen");
      }
    },
    [create]
  );

  const handleEdit = useCallback((leverancier: Leverancier) => {
    setSelectedLeverancier(leverancier);
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(
    async (data: LeverancierFormData, id?: Id<"leveranciers">) => {
      if (!id) return;

      try {
        await update(id, {
          naam: data.naam,
          contactpersoon: data.contactpersoon || undefined,
          email: data.email || undefined,
          telefoon: data.telefoon || undefined,
          adres: data.adres || undefined,
          postcode: data.postcode || undefined,
          plaats: data.plaats || undefined,
          kvkNummer: data.kvkNummer || undefined,
          btwNummer: data.btwNummer || undefined,
          iban: data.iban || undefined,
          betalingstermijn: data.betalingstermijn ? parseInt(data.betalingstermijn) : undefined,
          notities: data.notities || undefined,
        });
        toast.success("Leverancier bijgewerkt");
        setSelectedLeverancier(null);
      } catch {
        toast.error("Fout bij bijwerken leverancier");
        throw new Error("Fout bij bijwerken");
      }
    },
    [update]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedLeverancier) return;

    setIsSubmitting(true);
    try {
      await remove(selectedLeverancier._id);
      toast.success("Leverancier verwijderd");
      setShowDeleteDialog(false);
      setSelectedLeverancier(null);
    } catch (error) {
      if (error instanceof Error && error.message.includes("inkooporders")) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij verwijderen leverancier");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedLeverancier, remove]);

  const handleDeleteClick = useCallback((leverancier: Leverancier) => {
    setSelectedLeverancier(leverancier);
    setShowDeleteDialog(true);
  }, []);

  const handleToggleStatus = useCallback(
    async (leverancier: Leverancier) => {
      try {
        await update(leverancier._id, { isActief: !leverancier.isActief });
        toast.success(
          leverancier.isActief
            ? "Leverancier gedeactiveerd"
            : "Leverancier geactiveerd"
        );
      } catch {
        toast.error("Fout bij wijzigen status");
      }
    },
    [update]
  );

  // Column configuration for ResponsiveTable
  const columns: ResponsiveColumn<Leverancier, keyof Leverancier>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        sortable: true,
        sortKey: "naam",
        render: (leverancier) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{leverancier.naam}</span>
            {!leverancier.isActief && (
              <Badge variant="secondary" className="text-xs">
                Inactief
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "contactpersoon",
        header: "Contactpersoon",
        isSecondary: true,
        sortable: true,
        sortKey: "contactpersoon",
        render: (leverancier) =>
          leverancier.contactpersoon ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 hidden sm:inline" />
              <span>{leverancier.contactpersoon}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "telefoon",
        header: "Telefoon",
        mobileLabel: "Tel",
        showInCard: true,
        sortable: true,
        sortKey: "telefoon",
        render: (leverancier) =>
          leverancier.telefoon ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span>{leverancier.telefoon}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "email",
        header: "E-mail",
        mobileLabel: "Email",
        showInCard: true,
        sortable: true,
        sortKey: "email",
        render: (leverancier) =>
          leverancier.email ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span className="truncate max-w-[150px]" title={leverancier.email}>
                {leverancier.email}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "isActief",
        header: "Status",
        showInCard: true,
        sortable: true,
        sortKey: "isActief",
        render: (leverancier) => (
          <Badge
            variant={leverancier.isActief ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleStatus(leverancier);
            }}
          >
            {leverancier.isActief ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Actief
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
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
        render: (leverancier) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              aria-label="Bewerken"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(leverancier);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-8 sm:w-8"
              aria-label="Verwijderen"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(leverancier);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick, handleToggleStatus]
  );

  if (isLoading) {
    return (
      <>
        <PageHeader />
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
      <PageHeader />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Leveranciers
            </h1>
            <p className="text-muted-foreground">
              Beheer je leveranciersbestand
            </p>
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nieuwe Leverancier
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totaal Leveranciers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totaal}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actieve Leveranciers</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.actief}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactieve Leveranciers</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.inactief}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Leverancierslijst
                </CardTitle>
                <CardDescription>
                  {filteredLeveranciers.length} leverancier
                  {filteredLeveranciers.length !== 1 ? "s" : ""} gevonden
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alle">Alle</SelectItem>
                    <SelectItem value="actief">Actief</SelectItem>
                    <SelectItem value="inactief">Inactief</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek leveranciers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedLeveranciers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {searchTerm || statusFilter !== "alle"
                    ? "Geen leveranciers gevonden"
                    : "Nog geen leveranciers"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : statusFilter !== "alle"
                    ? `Geen ${statusFilter}e leveranciers gevonden`
                    : "Voeg je eerste leverancier toe om te beginnen."}
                </p>
              </div>
            ) : (
              <ResponsiveTable
                data={sortedLeveranciers}
                columns={columns}
                keyExtractor={(leverancier) => leverancier._id}
                emptyMessage={
                  searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : "Voeg je eerste leverancier toe om te beginnen."
                }
                mobileBreakpoint="md"
                sortConfig={sortConfig}
                onSort={toggleSort}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Dialog */}
      <LeverancierForm
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        mode="add"
        onSubmit={handleAdd}
      />

      {/* Edit Dialog */}
      <LeverancierForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        mode="edit"
        initialData={selectedLeverancier}
        onSubmit={handleUpdate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leverancier Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedLeverancier?.naam} wilt verwijderen?
              Als deze leverancier gekoppelde inkooporders heeft, wordt de
              leverancier gedeactiveerd in plaats van verwijderd.
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

export default function LeveranciersPage() {
  return (
    <RequireAdmin>
      <LeveranciersPageContent />
    </RequireAdmin>
  );
}
