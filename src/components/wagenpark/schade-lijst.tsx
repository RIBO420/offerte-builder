"use client";

import { useState, useCallback, useMemo } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  Wrench,
  Clock,
  Euro,
  FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { SchadeForm, Schade } from "./schade-form";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// Ernst labels and styling
const ernstConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  klein: { label: "Klein", variant: "secondary" },
  gemiddeld: { label: "Gemiddeld", variant: "default" },
  groot: { label: "Groot", variant: "destructive" },
};

// Schade type labels
const schadeTypeLabels: Record<string, string> = {
  deuk: "Deuk",
  kras: "Kras",
  breuk: "Breuk",
  mechanisch: "Mechanisch",
  overig: "Overig",
};

// Status configuration
const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  nieuw: {
    label: "Nieuw",
    variant: "destructive",
    icon: <Clock className="h-3 w-3 mr-1" />,
  },
  in_reparatie: {
    label: "In reparatie",
    variant: "secondary",
    icon: <Wrench className="h-3 w-3 mr-1" />,
  },
  afgehandeld: {
    label: "Afgehandeld",
    variant: "outline",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
  },
};

type FilterTab = "alle" | "nieuw" | "in_reparatie" | "afgehandeld";

interface SchadeRow {
  _id: Id<"voertuigSchades">;
  voertuigId: Id<"voertuigen">;
  userId: Id<"users">;
  datum: number;
  beschrijving: string;
  ernst: "klein" | "gemiddeld" | "groot";
  schadeType: "deuk" | "kras" | "breuk" | "mechanisch" | "overig";
  fotoUrls?: string[];
  gerapporteerdDoor: string;
  status: "nieuw" | "in_reparatie" | "afgehandeld";
  reparatieKosten?: number;
  verzekeringsClaim?: boolean;
  claimNummer?: string;
  createdAt: number;
  updatedAt: number;
}

interface SchadeLijstProps {
  voertuigId?: Id<"voertuigen">;
  voertuigKenteken?: string;
  showVoertuigColumn?: boolean;
}

export function SchadeLijst({
  voertuigId,
  voertuigKenteken,
  showVoertuigColumn = false,
}: SchadeLijstProps) {
  const schades = useQuery(api.voertuigSchades.list, {
    voertuigId,
  });
  const stats = useQuery(api.voertuigSchades.getStats, { voertuigId });
  const voertuigen = useQuery(api.voertuigen.list, {});
  const updateStatus = useMutation(api.voertuigSchades.updateStatus);
  const removeSchade = useMutation(api.voertuigSchades.remove);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("alle");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSchade, setSelectedSchade] = useState<Schade | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading = schades === undefined;

  // Get voertuig info by ID
  const getVoertuigInfo = useCallback(
    (vId: Id<"voertuigen">) => {
      const v = voertuigen?.find((v) => v._id === vId);
      return v ? `${v.kenteken} - ${v.merk} ${v.model}` : "Onbekend";
    },
    [voertuigen]
  );

  // Filter schades
  const displayedSchades = useMemo(() => {
    let filtered = (schades ?? []) as SchadeRow[];

    // Filter by status tab
    if (activeTab !== "alle") {
      filtered = filtered.filter((s) => s.status === activeTab);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.beschrijving.toLowerCase().includes(term) ||
          s.gerapporteerdDoor.toLowerCase().includes(term) ||
          schadeTypeLabels[s.schadeType].toLowerCase().includes(term) ||
          (s.claimNummer && s.claimNummer.toLowerCase().includes(term))
      );
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => b.datum - a.datum);
  }, [schades, searchTerm, activeTab]);

  const handleEdit = useCallback((schade: SchadeRow) => {
    setSelectedSchade(schade as Schade);
    setShowEditDialog(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedSchade) return;

    setIsSubmitting(true);
    try {
      await removeSchade({ id: selectedSchade._id });
      toast.success("Schademelding verwijderd");
      setShowDeleteDialog(false);
      setSelectedSchade(null);
    } catch {
      toast.error("Fout bij verwijderen schademelding");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedSchade, removeSchade]);

  const handleDeleteClick = useCallback((schade: SchadeRow) => {
    setSelectedSchade(schade as Schade);
    setShowDeleteDialog(true);
  }, []);

  const handleStatusChange = useCallback(
    async (schade: SchadeRow, newStatus: "nieuw" | "in_reparatie" | "afgehandeld") => {
      try {
        await updateStatus({ id: schade._id, status: newStatus });
        toast.success(
          newStatus === "afgehandeld"
            ? "Schade afgehandeld"
            : newStatus === "in_reparatie"
            ? "Schade in reparatie gezet"
            : "Status bijgewerkt"
        );
      } catch {
        toast.error("Fout bij wijzigen status");
      }
    },
    [updateStatus]
  );

  // Format currency
  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return "-";
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  // Column configuration
  const columns: ResponsiveColumn<SchadeRow>[] = useMemo(
    () => [
      {
        key: "datum",
        header: "Datum",
        isPrimary: true,
        render: (schade) => (
          <span className="font-medium">
            {format(new Date(schade.datum), "d MMM yyyy", { locale: nl })}
          </span>
        ),
      },
      ...(showVoertuigColumn
        ? [
            {
              key: "voertuig",
              header: "Voertuig",
              isSecondary: true,
              render: (schade: SchadeRow) => (
                <span className="text-sm">{getVoertuigInfo(schade.voertuigId)}</span>
              ),
            } as ResponsiveColumn<SchadeRow>,
          ]
        : []),
      {
        key: "type",
        header: "Type",
        showInCard: true,
        mobileLabel: "Type",
        render: (schade) => (
          <Badge variant="outline">{schadeTypeLabels[schade.schadeType]}</Badge>
        ),
      },
      {
        key: "ernst",
        header: "Ernst",
        showInCard: true,
        mobileLabel: "Ernst",
        render: (schade) => {
          const config = ernstConfig[schade.ernst];
          return <Badge variant={config.variant}>{config.label}</Badge>;
        },
      },
      {
        key: "beschrijving",
        header: "Beschrijving",
        isSecondary: !showVoertuigColumn,
        render: (schade) => (
          <span className="text-sm line-clamp-2">{schade.beschrijving}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        showInCard: true,
        mobileLabel: "Status",
        render: (schade) => {
          const config = statusConfig[schade.status];
          return (
            <Badge variant={config.variant}>
              {config.icon}
              {config.label}
            </Badge>
          );
        },
      },
      {
        key: "kosten",
        header: "Kosten",
        showInCard: true,
        mobileLabel: "Kosten",
        render: (schade) => (
          <div className="flex items-center gap-1 text-sm">
            {schade.reparatieKosten !== undefined && (
              <>
                <Euro className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
                <span>{formatCurrency(schade.reparatieKosten)}</span>
              </>
            )}
            {schade.reparatieKosten === undefined && (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        render: (schade) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(schade)}>
                <Pencil className="h-4 w-4 mr-2" />
                Bewerken
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {schade.status === "nieuw" && (
                <DropdownMenuItem
                  onClick={() => handleStatusChange(schade, "in_reparatie")}
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  In reparatie zetten
                </DropdownMenuItem>
              )}
              {schade.status === "in_reparatie" && (
                <DropdownMenuItem
                  onClick={() => handleStatusChange(schade, "afgehandeld")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Afhandelen
                </DropdownMenuItem>
              )}
              {schade.status !== "nieuw" && (
                <DropdownMenuItem
                  onClick={() => handleStatusChange(schade, "nieuw")}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Terugzetten naar nieuw
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteClick(schade)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [showVoertuigColumn, getVoertuigInfo, handleEdit, handleStatusChange, handleDeleteClick]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Schademeldingen
                {voertuigKenteken && (
                  <span className="text-muted-foreground font-normal">
                    - {voertuigKenteken}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {stats?.totaal || 0} melding{(stats?.totaal || 0) !== 1 ? "en" : ""} totaal
                {stats?.totaleKosten ? ` - ${formatCurrency(stats.totaleKosten)} reparatiekosten` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek schades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe melding
              </Button>
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
                Alle ({stats?.totaal || 0})
              </TabsTrigger>
              <TabsTrigger value="nieuw">
                Nieuw ({stats?.nieuw || 0})
              </TabsTrigger>
              <TabsTrigger value="in_reparatie">
                In reparatie ({stats?.inReparatie || 0})
              </TabsTrigger>
              <TabsTrigger value="afgehandeld">
                Afgehandeld ({stats?.afgehandeld || 0})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {displayedSchades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileWarning className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">
                {searchTerm
                  ? "Geen schademeldingen gevonden"
                  : activeTab !== "alle"
                  ? `Geen ${statusConfig[activeTab]?.label.toLowerCase()} schademeldingen`
                  : "Nog geen schademeldingen"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : activeTab !== "alle"
                  ? "Wijzig de filter om andere schademeldingen te zien."
                  : "Registreer een schademelding wanneer er schade aan een voertuig is."}
              </p>
              {!searchTerm && activeTab === "alle" && (
                <Button
                  className="mt-4"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nieuwe melding
                </Button>
              )}
            </div>
          ) : (
            <ResponsiveTable
              data={displayedSchades}
              columns={columns}
              keyExtractor={(schade) => schade._id}
              emptyMessage={
                searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : "Registreer een schademelding om te beginnen."
              }
              mobileBreakpoint="md"
            />
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <SchadeForm
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        voertuigId={voertuigId}
        onSuccess={() => setShowAddDialog(false)}
      />

      {/* Edit Dialog */}
      <SchadeForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        voertuigId={voertuigId}
        initialData={selectedSchade}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedSchade(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schademelding Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze schademelding wilt verwijderen? Deze
              actie kan niet ongedaan worden gemaakt.
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
