"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useKlanten, useKlantenSearch } from "@/hooks/use-klanten";
import { Id } from "../../../../convex/_generated/dataModel";

type Klant = {
  _id: Id<"klanten">;
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
  notities?: string;
  createdAt: number;
  updatedAt: number;
};

export default function KlantenPage() {
  const { klanten, isLoading, create, update, remove } = useKlanten();
  const [searchTerm, setSearchTerm] = useState("");
  const { results: searchResults } = useKlantenSearch(searchTerm);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedKlant, setSelectedKlant] = useState<{
    _id: Id<"klanten">;
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
    notities?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    naam: "",
    adres: "",
    postcode: "",
    plaats: "",
    email: "",
    telefoon: "",
    notities: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayedKlanten: Klant[] = (searchTerm ? searchResults : klanten) as Klant[];

  const resetForm = useCallback(() => {
    setFormData({
      naam: "",
      adres: "",
      postcode: "",
      plaats: "",
      email: "",
      telefoon: "",
      notities: "",
    });
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formData.naam || !formData.adres || !formData.postcode || !formData.plaats) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setIsSubmitting(true);
    try {
      await create({
        naam: formData.naam,
        adres: formData.adres,
        postcode: formData.postcode,
        plaats: formData.plaats,
        email: formData.email || undefined,
        telefoon: formData.telefoon || undefined,
        notities: formData.notities || undefined,
      });
      toast.success("Klant toegevoegd");
      setShowAddDialog(false);
      resetForm();
    } catch {
      toast.error("Fout bij toevoegen klant");
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, create, resetForm]);

  const handleEdit = useCallback((klant: Klant | null) => {
    if (!klant) return;
    setSelectedKlant(klant);
    setFormData({
      naam: klant.naam,
      adres: klant.adres,
      postcode: klant.postcode,
      plaats: klant.plaats,
      email: klant.email || "",
      telefoon: klant.telefoon || "",
      notities: klant.notities || "",
    });
    setShowEditDialog(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!selectedKlant) return;

    setIsSubmitting(true);
    try {
      await update(selectedKlant._id, {
        naam: formData.naam,
        adres: formData.adres,
        postcode: formData.postcode,
        plaats: formData.plaats,
        email: formData.email || undefined,
        telefoon: formData.telefoon || undefined,
        notities: formData.notities || undefined,
      });
      toast.success("Klant bijgewerkt");
      setShowEditDialog(false);
      setSelectedKlant(null);
      resetForm();
    } catch {
      toast.error("Fout bij bijwerken klant");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedKlant, formData, update, resetForm]);

  const handleDelete = useCallback(async () => {
    if (!selectedKlant) return;

    setIsSubmitting(true);
    try {
      await remove(selectedKlant._id);
      toast.success("Klant verwijderd");
      setShowDeleteDialog(false);
      setSelectedKlant(null);
    } catch (error) {
      if (error instanceof Error && error.message.includes("gekoppelde offertes")) {
        toast.error(error.message);
      } else {
        toast.error("Fout bij verwijderen klant");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedKlant, remove]);

  const handleDeleteClick = useCallback((klant: Klant) => {
    setSelectedKlant(klant);
    setShowDeleteDialog(true);
  }, []);

  // Column configuration for ResponsiveTable
  const columns: ResponsiveColumn<Klant>[] = useMemo(
    () => [
      {
        key: "naam",
        header: "Naam",
        isPrimary: true,
        render: (klant) => (
          <Link
            href={`/klanten/${klant._id}`}
            className="font-medium hover:underline"
          >
            {klant.naam}
          </Link>
        ),
      },
      {
        key: "adres",
        header: "Adres",
        isSecondary: true,
        render: (klant) => (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 hidden sm:inline" />
            <span className="truncate max-w-[200px] sm:max-w-none">
              {klant.adres}, {klant.postcode} {klant.plaats}
            </span>
          </div>
        ),
      },
      {
        key: "telefoon",
        header: "Telefoon",
        mobileLabel: "Tel",
        showInCard: true,
        render: (klant) =>
          klant.telefoon ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span>{klant.telefoon}</span>
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
        render: (klant) =>
          klant.email ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
              <span className="truncate max-w-[150px]">{klant.email}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        key: "acties",
        header: "Acties",
        align: "right",
        showInCard: true,
        mobileLabel: "",
        render: (klant) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/klanten/${klant._id}`}>
                <FileText className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(klant);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(klant);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    [handleEdit, handleDeleteClick]
  );

  const KlantForm = () => (
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
        <Label htmlFor="adres">Adres *</Label>
        <Input
          id="adres"
          placeholder="Hoofdstraat 1"
          value={formData.adres}
          onChange={(e) => setFormData({ ...formData, adres: e.target.value })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode *</Label>
          <Input
            id="postcode"
            placeholder="1234 AB"
            value={formData.postcode}
            onChange={(e) =>
              setFormData({ ...formData, postcode: e.target.value })
            }
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="plaats">Plaats *</Label>
          <Input
            id="plaats"
            placeholder="Amsterdam"
            value={formData.plaats}
            onChange={(e) => setFormData({ ...formData, plaats: e.target.value })}
          />
        </div>
      </div>

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
        <Label htmlFor="notities">Notities</Label>
        <Textarea
          id="notities"
          placeholder="Extra informatie over de klant..."
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
                <BreadcrumbPage>Klanten</BreadcrumbPage>
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
              <BreadcrumbPage>Klanten</BreadcrumbPage>
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
              Klanten
            </h1>
            <p className="text-muted-foreground">
              Beheer je klantenbestand
            </p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe Klant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nieuwe Klant</DialogTitle>
                <DialogDescription>
                  Voeg een nieuwe klant toe aan je klantenbestand.
                </DialogDescription>
              </DialogHeader>
              <KlantForm />
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Klantenlijst
                </CardTitle>
                <CardDescription>
                  {klanten.length} klant{klanten.length !== 1 ? "en" : ""} in je bestand
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek klanten..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {displayedKlanten.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">
                  {searchTerm
                    ? "Geen klanten gevonden"
                    : "Nog geen klanten"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : "Voeg je eerste klant toe om te beginnen."}
                </p>
              </div>
            ) : (
              <ResponsiveTable
                data={displayedKlanten}
                columns={columns}
                keyExtractor={(klant) => klant._id}
                emptyMessage={
                  searchTerm
                    ? `Geen resultaten voor "${searchTerm}"`
                    : "Voeg je eerste klant toe om te beginnen."
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
            <DialogTitle>Klant Bewerken</DialogTitle>
            <DialogDescription>
              Pas de gegevens van {selectedKlant?.naam} aan.
            </DialogDescription>
          </DialogHeader>
          <KlantForm />
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
            <AlertDialogTitle>Klant Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedKlant?.naam} wilt verwijderen? Deze
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
