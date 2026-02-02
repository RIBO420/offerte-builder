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
  Wrench,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Euro,
  Package,
  Hammer,
  Shield,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { UitrustingForm, Uitrusting } from "./uitrusting-form";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

// Categorie labels and icons
const categorieConfig: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  motorgereedschap: {
    label: "Motorgereedschap",
    icon: <Settings className="h-3.5 w-3.5" />,
  },
  handgereedschap: {
    label: "Handgereedschap",
    icon: <Hammer className="h-3.5 w-3.5" />,
  },
  veiligheid: {
    label: "Veiligheid",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  overig: {
    label: "Overig",
    icon: <Package className="h-3.5 w-3.5" />,
  },
};

// Status configuration
const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  aanwezig: {
    label: "Aanwezig",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
  },
  vermist: {
    label: "Vermist",
    variant: "destructive",
    icon: <HelpCircle className="h-3 w-3 mr-1" />,
  },
  defect: {
    label: "Defect",
    variant: "secondary",
    icon: <AlertTriangle className="h-3 w-3 mr-1" />,
  },
};

type FilterTab = "alle" | "motorgereedschap" | "handgereedschap" | "veiligheid" | "overig";
type StatusFilter = "alle" | "aanwezig" | "vermist" | "defect";

interface UitrustingRow {
  _id: Id<"voertuigUitrusting">;
  voertuigId: Id<"voertuigen">;
  userId: Id<"users">;
  naam: string;
  categorie: "motorgereedschap" | "handgereedschap" | "veiligheid" | "overig";
  hoeveelheid: number;
  serienummer?: string;
  aanschafDatum?: number;
  aanschafPrijs?: number;
  status: "aanwezig" | "vermist" | "defect";
  notities?: string;
  createdAt: number;
  updatedAt: number;
}

interface UitrustingLijstProps {
  voertuigId?: Id<"voertuigen">;
  voertuigKenteken?: string;
  showVoertuigColumn?: boolean;
}

export function UitrustingLijst({
  voertuigId,
  voertuigKenteken,
  showVoertuigColumn = false,
}: UitrustingLijstProps) {
  const uitrusting = useQuery(api.voertuigUitrusting.list, {
    voertuigId,
  });
  const stats = useQuery(api.voertuigUitrusting.getStats, { voertuigId });
  const voertuigen = useQuery(api.voertuigen.list, {});
  const updateStatus = useMutation(api.voertuigUitrusting.updateStatus);
  const removeUitrusting = useMutation(api.voertuigUitrusting.remove);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("alle");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUitrusting, setSelectedUitrusting] = useState<Uitrusting | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLoading = uitrusting === undefined;

  // Get voertuig info by ID
  const getVoertuigInfo = useCallback(
    (vId: Id<"voertuigen">) => {
      const v = voertuigen?.find((v) => v._id === vId);
      return v ? `${v.kenteken} - ${v.merk} ${v.model}` : "Onbekend";
    },
    [voertuigen]
  );

  // Filter uitrusting
  const displayedUitrusting = useMemo(() => {
    let filtered = (uitrusting ?? []) as UitrustingRow[];

    // Filter by category tab
    if (activeTab !== "alle") {
      filtered = filtered.filter((u) => u.categorie === activeTab);
    }

    // Filter by status
    if (statusFilter !== "alle") {
      filtered = filtered.filter((u) => u.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.naam.toLowerCase().includes(term) ||
          (u.serienummer && u.serienummer.toLowerCase().includes(term)) ||
          (u.notities && u.notities.toLowerCase().includes(term))
      );
    }

    // Sort by name
    return filtered.sort((a, b) => a.naam.localeCompare(b.naam));
  }, [uitrusting, searchTerm, activeTab, statusFilter]);

  const handleEdit = useCallback((item: UitrustingRow) => {
    setSelectedUitrusting(item as Uitrusting);
    setShowEditDialog(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedUitrusting) return;

    setIsSubmitting(true);
    try {
      await removeUitrusting({ id: selectedUitrusting._id });
      toast.success("Uitrusting verwijderd");
      setShowDeleteDialog(false);
      setSelectedUitrusting(null);
    } catch {
      toast.error("Fout bij verwijderen uitrusting");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUitrusting, removeUitrusting]);

  const handleDeleteClick = useCallback((item: UitrustingRow) => {
    setSelectedUitrusting(item as Uitrusting);
    setShowDeleteDialog(true);
  }, []);

  const handleStatusChange = useCallback(
    async (item: UitrustingRow, newStatus: "aanwezig" | "vermist" | "defect") => {
      try {
        await updateStatus({ id: item._id, status: newStatus });
        toast.success(
          newStatus === "aanwezig"
            ? "Uitrusting als aanwezig gemarkeerd"
            : newStatus === "vermist"
            ? "Uitrusting als vermist gemarkeerd"
            : "Uitrusting als defect gemarkeerd"
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

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const items = (uitrusting ?? []) as UitrustingRow[];
    return {
      alle: items.reduce((sum, u) => sum + u.hoeveelheid, 0),
      motorgereedschap: items
        .filter((u) => u.categorie === "motorgereedschap")
        .reduce((sum, u) => sum + u.hoeveelheid, 0),
      handgereedschap: items
        .filter((u) => u.categorie === "handgereedschap")
        .reduce((sum, u) => sum + u.hoeveelheid, 0),
      veiligheid: items
        .filter((u) => u.categorie === "veiligheid")
        .reduce((sum, u) => sum + u.hoeveelheid, 0),
      overig: items
        .filter((u) => u.categorie === "overig")
        .reduce((sum, u) => sum + u.hoeveelheid, 0),
    };
  }, [uitrusting]);

  // Column configuration
  const columns: ResponsiveColumn<UitrustingRow>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        render: (item) => (
          <div>
            <span className="font-medium">{item.naam}</span>
            {item.serienummer && (
              <span className="text-xs text-muted-foreground ml-2">
                #{item.serienummer}
              </span>
            )}
          </div>
        ),
      },
      ...(showVoertuigColumn
        ? [
            {
              key: "voertuig",
              header: "Voertuig",
              isSecondary: true,
              render: (item: UitrustingRow) => (
                <span className="text-sm">{getVoertuigInfo(item.voertuigId)}</span>
              ),
            } as ResponsiveColumn<UitrustingRow>,
          ]
        : []),
      {
        key: "categorie",
        header: "Categorie",
        showInCard: true,
        mobileLabel: "Categorie",
        render: (item) => {
          const config = categorieConfig[item.categorie];
          return (
            <Badge variant="outline" className="gap-1">
              {config.icon}
              {config.label}
            </Badge>
          );
        },
      },
      {
        key: "hoeveelheid",
        header: "Aantal",
        showInCard: true,
        mobileLabel: "Aantal",
        render: (item) => (
          <span className="font-medium">{item.hoeveelheid}x</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        showInCard: true,
        mobileLabel: "Status",
        render: (item) => {
          const config = statusConfig[item.status];
          return (
            <Badge variant={config.variant}>
              {config.icon}
              {config.label}
            </Badge>
          );
        },
      },
      {
        key: "waarde",
        header: "Waarde",
        showInCard: true,
        mobileLabel: "Waarde",
        render: (item) => (
          <div className="flex items-center gap-1 text-sm">
            {item.aanschafPrijs !== undefined ? (
              <>
                <Euro className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
                <span>{formatCurrency(item.aanschafPrijs * item.hoeveelheid)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        key: "aanschafDatum",
        header: "Aangeschaft",
        showInCard: false,
        render: (item) => (
          <span className="text-sm text-muted-foreground">
            {item.aanschafDatum
              ? format(new Date(item.aanschafDatum), "d MMM yyyy", { locale: nl })
              : "-"}
          </span>
        ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        render: (item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(item)}>
                <Pencil className="h-4 w-4 mr-2" />
                Bewerken
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {item.status !== "aanwezig" && (
                <DropdownMenuItem
                  onClick={() => handleStatusChange(item, "aanwezig")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Markeer als aanwezig
                </DropdownMenuItem>
              )}
              {item.status !== "vermist" && (
                <DropdownMenuItem
                  onClick={() => handleStatusChange(item, "vermist")}
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Markeer als vermist
                </DropdownMenuItem>
              )}
              {item.status !== "defect" && (
                <DropdownMenuItem
                  onClick={() => handleStatusChange(item, "defect")}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Markeer als defect
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteClick(item)}
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
                <Wrench className="h-5 w-5" />
                Uitrusting & Gereedschap
                {voertuigKenteken && (
                  <span className="text-muted-foreground font-normal">
                    - {voertuigKenteken}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {stats?.totaalItems || 0} item{(stats?.totaalItems || 0) !== 1 ? "s" : ""} totaal
                {stats?.totaalWaarde ? ` - ${formatCurrency(stats.totaalWaarde)} totale waarde` : ""}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek uitrusting..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Toevoegen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Category tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as FilterTab)}
            className="mb-4"
          >
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="alle">
                Alle ({categoryCounts.alle})
              </TabsTrigger>
              <TabsTrigger value="motorgereedschap">
                Motor ({categoryCounts.motorgereedschap})
              </TabsTrigger>
              <TabsTrigger value="handgereedschap">
                Hand ({categoryCounts.handgereedschap})
              </TabsTrigger>
              <TabsTrigger value="veiligheid">
                Veiligheid ({categoryCounts.veiligheid})
              </TabsTrigger>
              <TabsTrigger value="overig">
                Overig ({categoryCounts.overig})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Status filter */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={statusFilter === "alle" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("alle")}
            >
              Alle
            </Button>
            <Button
              variant={statusFilter === "aanwezig" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("aanwezig")}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Aanwezig
            </Button>
            <Button
              variant={statusFilter === "vermist" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("vermist")}
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1" />
              Vermist ({stats?.perStatus?.vermist || 0})
            </Button>
            <Button
              variant={statusFilter === "defect" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("defect")}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Defect ({stats?.perStatus?.defect || 0})
            </Button>
          </div>

          {displayedUitrusting.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">
                {searchTerm
                  ? "Geen uitrusting gevonden"
                  : activeTab !== "alle" || statusFilter !== "alle"
                  ? "Geen uitrusting met deze filters"
                  : "Nog geen uitrusting"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : activeTab !== "alle" || statusFilter !== "alle"
                  ? "Wijzig de filters om andere uitrusting te zien."
                  : "Voeg gereedschap en uitrusting toe aan dit voertuig."}
              </p>
              {!searchTerm && activeTab === "alle" && statusFilter === "alle" && (
                <Button
                  className="mt-4"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Uitrusting toevoegen
                </Button>
              )}
            </div>
          ) : (
            <ResponsiveTable
              data={displayedUitrusting}
              columns={columns}
              keyExtractor={(item) => item._id}
              emptyMessage={
                searchTerm
                  ? `Geen resultaten voor "${searchTerm}"`
                  : "Voeg uitrusting toe om te beginnen."
              }
              mobileBreakpoint="md"
            />
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <UitrustingForm
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        voertuigId={voertuigId}
        onSuccess={() => setShowAddDialog(false)}
      />

      {/* Edit Dialog */}
      <UitrustingForm
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        voertuigId={voertuigId}
        initialData={selectedUitrusting}
        onSuccess={() => {
          setShowEditDialog(false);
          setSelectedUitrusting(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uitrusting Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>{selectedUitrusting?.naam}</strong>{" "}
              wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
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
