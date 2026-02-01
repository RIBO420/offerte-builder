"use client";

import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";
import { toast } from "sonner";
import { useMedewerkers } from "@/hooks/use-medewerkers";
import { Id } from "../../../../convex/_generated/dataModel";

type Medewerker = {
  _id: Id<"medewerkers">;
  naam: string;
  email?: string;
  telefoon?: string;
  functie?: string;
  uurtarief?: number;
  isActief: boolean;
  notities?: string;
  createdAt: number;
  updatedAt: number;
};

const FUNCTIE_OPTIONS = [
  "Hovenier",
  "Voorman",
  "Leerling",
  "Tuinontwerper",
  "Machinist",
  "Administratie",
  "Eigenaar",
  "Overig",
];

export default function MedewerkersPage() {
  const { medewerkers, isLoading, create, update, remove } = useMedewerkers();
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMedewerker, setSelectedMedewerker] = useState<Medewerker | null>(null);

  const [formData, setFormData] = useState({
    naam: "",
    email: "",
    telefoon: "",
    functie: "",
    uurtarief: "",
    notities: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter medewerkers based on search and active status
  const displayedMedewerkers = useMemo(() => {
    let filtered = medewerkers as Medewerker[];

    // Filter by active status
    if (showOnlyActive) {
      filtered = filtered.filter((m) => m.isActief);
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
  }, [medewerkers, searchTerm, showOnlyActive]);

  const resetForm = useCallback(() => {
    setFormData({
      naam: "",
      email: "",
      telefoon: "",
      functie: "",
      uurtarief: "",
      notities: "",
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formData.naam.trim()) {
      toast.error("Vul de naam in");
      return;
    }

    setIsSubmitting(true);
    try {
      await create({
        naam: formData.naam,
        email: formData.email || undefined,
        telefoon: formData.telefoon || undefined,
        functie: formData.functie || undefined,
        uurtarief: formData.uurtarief ? parseFloat(formData.uurtarief) : undefined,
        notities: formData.notities || undefined,
      });
      toast.success("Medewerker toegevoegd");
      setShowAddDialog(false);
      resetForm();
    } catch {
      toast.error("Fout bij toevoegen medewerker");
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, create, resetForm]);

  const handleEdit = useCallback((medewerker: Medewerker | null) => {
    if (!medewerker) return;
    setSelectedMedewerker(medewerker);
    setFormData({
      naam: medewerker.naam,
      email: medewerker.email || "",
      telefoon: medewerker.telefoon || "",
      functie: medewerker.functie || "",
      uurtarief: medewerker.uurtarief?.toString() || "",
      notities: medewerker.notities || "",
    });
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!selectedMedewerker) return;

    setIsSubmitting(true);
    try {
      await update(selectedMedewerker._id, {
        naam: formData.naam,
        email: formData.email || undefined,
        telefoon: formData.telefoon || undefined,
        functie: formData.functie || undefined,
        uurtarief: formData.uurtarief ? parseFloat(formData.uurtarief) : undefined,
        notities: formData.notities || undefined,
      });
      toast.success("Medewerker bijgewerkt");
      setShowEditDialog(false);
      setSelectedMedewerker(null);
      resetForm();
    } catch {
      toast.error("Fout bij bijwerken medewerker");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedMedewerker, formData, update, resetForm]);

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
      toast.success("Medewerker op inactief gezet");
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
          <span className="font-medium">{medewerker.naam}</span>
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
        key: "email",
        header: "E-mail",
        mobileLabel: "Email",
        showInCard: true,
        render: (medewerker) =>
          medewerker.email ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span className="truncate max-w-[150px]">{medewerker.email}</span>
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
        render: (medewerker) =>
          medewerker.telefoon ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span>{medewerker.telefoon}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
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
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(medewerker);
              }}
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
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [handleEdit, handleToggleActive, handleDeleteClick]
  );

  const MedewerkerForm = () => (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="naam">Naam *</Label>
          <Input
            id="naam"
            placeholder="Jan Jansen"
            value={formData.naam}
            onChange={(e) => setFormData({ ...formData, naam: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="functie">Functie</Label>
          <Select
            value={formData.functie}
            onValueChange={(value) => setFormData({ ...formData, functie: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecteer functie" />
            </SelectTrigger>
            <SelectContent>
              {FUNCTIE_OPTIONS.map((functie) => (
                <SelectItem key={functie} value={functie}>
                  {functie}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="jan@voorbeeld.nl"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefoon">Telefoon</Label>
          <Input
            id="telefoon"
            placeholder="06-12345678"
            value={formData.telefoon}
            onChange={(e) =>
              setFormData({ ...formData, telefoon: e.target.value })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="uurtarief">Uurtarief (optioneel)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            EUR
          </span>
          <Input
            id="uurtarief"
            type="number"
            step="0.01"
            min="0"
            placeholder="45.00"
            className="pl-12"
            value={formData.uurtarief}
            onChange={(e) =>
              setFormData({ ...formData, uurtarief: e.target.value })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Laat leeg om het standaard uurtarief te gebruiken
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notities">Notities</Label>
        <Textarea
          id="notities"
          placeholder="Extra informatie over de medewerker..."
          value={formData.notities}
          onChange={(e) =>
            setFormData({ ...formData, notities: e.target.value })
          }
          rows={3}
        />
      </div>
    </div>
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

  const totalCount = (medewerkers as Medewerker[]).length;
  const activeCount = (medewerkers as Medewerker[]).filter((m) => m.isActief).length;

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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Medewerkers
            </h1>
            <p className="text-muted-foreground">
              Beheer je team en personeel
            </p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe Medewerker
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nieuwe Medewerker</DialogTitle>
                <DialogDescription>
                  Voeg een nieuwe medewerker toe aan je team.
                </DialogDescription>
              </DialogHeader>
              <MedewerkerForm />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Annuleren
                </Button>
                <Button onClick={handleAdd} disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Toevoegen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Medewerkerslijst
                </CardTitle>
                <CardDescription>
                  {activeCount} actief{activeCount !== 1 ? "e" : ""} medewerker
                  {activeCount !== 1 ? "s" : ""} van {totalCount} totaal
                </CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-active"
                    checked={showOnlyActive}
                    onCheckedChange={setShowOnlyActive}
                  />
                  <Label htmlFor="show-active" className="text-sm whitespace-nowrap">
                    Alleen actief
                  </Label>
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
            </div>
          </CardHeader>
          <CardContent>
            {displayedMedewerkers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {searchTerm
                    ? "Geen medewerkers gevonden"
                    : showOnlyActive
                    ? "Geen actieve medewerkers"
                    : "Nog geen medewerkers"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : showOnlyActive
                    ? "Zet 'Alleen actief' uit om alle medewerkers te zien."
                    : "Voeg je eerste medewerker toe om te beginnen."}
                </p>
                {!searchTerm && !showOnlyActive && (
                  <Button
                    className="mt-4"
                    onClick={() => {
                      resetForm();
                      setShowAddDialog(true);
                    }}
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Medewerker Bewerken</DialogTitle>
            <DialogDescription>
              Pas de gegevens van {selectedMedewerker?.naam} aan.
            </DialogDescription>
          </DialogHeader>
          <MedewerkerForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annuleren
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
