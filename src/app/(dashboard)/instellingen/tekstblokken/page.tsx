"use client";

/**
 * Tekstblokkenbibliotheek — beheerscherm (PRD §2.5b).
 *
 * Kantoor-only scherm onder Instellingen (zelfde patroon als
 * /instellingen/catalogus): herbruikbare tekstblokken voor de vrije
 * offerte-builder, gegroepeerd per categorie (aanhef / voorwaarden /
 * standaardtekst / e-mail). Inhoud is platte tekst — bewust zonder
 * opmaak (principe 3: huisstijl zit in de template).
 * Verwijderen = deactiveren; heractiveren kan altijd.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Archive,
  ArchiveRestore,
  Edit,
  Loader2,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsKantoor } from "@/hooks/use-users";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  TEKSTBLOK_CATEGORIEEN,
  TEKSTBLOK_CATEGORIE_LABELS,
  type TekstblokCategorie,
} from "@/lib/tekstblokken";
import { LaadIndicator } from "@/components/ui/laad-indicator";

interface Tekstblok {
  _id: Id<"tekstblokken">;
  naam: string;
  categorie: TekstblokCategorie;
  inhoud: string;
  actief: boolean;
  volgorde: number;
}

interface FormState {
  naam: string;
  categorie: TekstblokCategorie;
  inhoud: string;
}

const LEEG_FORMULIER: FormState = {
  naam: "",
  categorie: "standaardtekst",
  inhoud: "",
};

export default function TekstblokkenPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const isKantoor = useIsKantoor();
  const magBeheren = Boolean(user?._id) && isKantoor;

  const blokken = useQuery(
    api.tekstblokken.list,
    magBeheren ? {} : "skip"
  ) as Tekstblok[] | undefined;

  const createBlok = useMutation(api.tekstblokken.create);
  const updateBlok = useMutation(api.tekstblokken.update);
  const setActief = useMutation(api.tekstblokken.setActief);

  const [showForm, setShowForm] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Tekstblok | null>(null);
  const [form, setForm] = useState<FormState>(LEEG_FORMULIER);
  const [isSaving, setIsSaving] = useState(false);

  const perCategorie = useMemo(() => {
    const groepen = new Map<TekstblokCategorie, Tekstblok[]>();
    for (const categorie of TEKSTBLOK_CATEGORIEEN) {
      groepen.set(categorie, []);
    }
    for (const blok of blokken ?? []) {
      groepen.get(blok.categorie)?.push(blok);
    }
    return groepen;
  }, [blokken]);

  const openNieuw = useCallback(() => {
    setGeselecteerd(null);
    setForm(LEEG_FORMULIER);
    setShowForm(true);
  }, []);

  const openBewerken = useCallback((blok: Tekstblok) => {
    setGeselecteerd(blok);
    setForm({ naam: blok.naam, categorie: blok.categorie, inhoud: blok.inhoud });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (form.naam.trim().length === 0 || form.inhoud.trim().length === 0) {
      toast.error("Naam en inhoud zijn verplicht");
      return;
    }
    setIsSaving(true);
    try {
      if (geselecteerd) {
        await updateBlok({ id: geselecteerd._id, ...form });
        toast.success(`Tekstblok "${form.naam}" bijgewerkt`);
      } else {
        await createBlok(form);
        toast.success(`Tekstblok "${form.naam}" toegevoegd`);
      }
      setShowForm(false);
      setGeselecteerd(null);
    } catch (error) {
      const bericht =
        error instanceof Error && "data" in error
          ? String((error as { data: unknown }).data)
          : "Fout bij opslaan tekstblok";
      toast.error(bericht);
      logger.error("Opslaan tekstblok mislukt", error, {
        module: "instellingen/tekstblokken",
      });
    } finally {
      setIsSaving(false);
    }
  }, [form, geselecteerd, createBlok, updateBlok]);

  const handleToggleActief = useCallback(
    async (blok: Tekstblok) => {
      try {
        await setActief({ id: blok._id, actief: !blok.actief });
        toast.success(
          blok.actief
            ? `"${blok.naam}" gedeactiveerd`
            : `"${blok.naam}" geactiveerd`
        );
      } catch (error) {
        toast.error("Fout bij wijzigen actief-status");
        logger.error("Wijzigen actief-status tekstblok mislukt", error, {
          module: "instellingen/tekstblokken",
        });
      }
    },
    [setActief]
  );

  const isLoading = isUserLoading || (magBeheren && blokken === undefined);

  if (!isUserLoading && !magBeheren) {
    return (
      <>
        <PageHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <p className="font-medium">Alleen voor kantoor</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            De tekstblokkenbibliotheek is alleen toegankelijk voor directie en
            projectleiders.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tekstblokken</h1>
            <p className="text-sm text-muted-foreground">
              Herbruikbare teksten voor het opstellen van offertes — platte
              tekst, de huisstijl zit in de template.
            </p>
          </div>
          <Button onClick={openNieuw}>
            <Plus className="size-4" />
            Nieuw tekstblok
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <LaadIndicator formaat="pagina" />
          </div>
        ) : (
          TEKSTBLOK_CATEGORIEEN.map((categorie) => {
            const groep = perCategorie.get(categorie) ?? [];
            return (
              <Card key={categorie}>
                <CardHeader>
                  <CardTitle>{TEKSTBLOK_CATEGORIE_LABELS[categorie]}</CardTitle>
                  <CardDescription>
                    {groep.length === 0
                      ? "Nog geen tekstblokken in deze categorie"
                      : `${groep.length} tekstblok${groep.length === 1 ? "" : "ken"}`}
                  </CardDescription>
                </CardHeader>
                {groep.length > 0 && (
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Naam</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Inhoud
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24 text-right">
                            Acties
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groep.map((blok) => (
                          <TableRow
                            key={blok._id}
                            className={blok.actief ? "" : "opacity-60"}
                          >
                            <TableCell className="font-medium">
                              {blok.naam}
                            </TableCell>
                            <TableCell className="hidden max-w-md truncate text-muted-foreground md:table-cell">
                              {blok.inhoud}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={blok.actief ? "secondary" : "outline"}
                              >
                                {blok.actief ? "Actief" : "Inactief"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Bewerk ${blok.naam}`}
                                  onClick={() => openBewerken(blok)}
                                >
                                  <Edit className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    blok.actief
                                      ? `Deactiveer ${blok.naam}`
                                      : `Activeer ${blok.naam}`
                                  }
                                  onClick={() => handleToggleActief(blok)}
                                >
                                  {blok.actief ? (
                                    <Archive className="size-4" />
                                  ) : (
                                    <ArchiveRestore className="size-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {geselecteerd ? "Tekstblok bewerken" : "Nieuw tekstblok"}
            </DialogTitle>
            <DialogDescription>
              Platte tekst zonder opmaak; de huisstijl komt uit de
              offerte-template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tekstblok-naam">Naam</Label>
              <Input
                id="tekstblok-naam"
                value={form.naam}
                onChange={(e) =>
                  setForm((f) => ({ ...f, naam: e.target.value }))
                }
                placeholder="Bijv. Standaard aanhef"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tekstblok-categorie">Categorie</Label>
              <Select
                value={form.categorie}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    categorie: value as TekstblokCategorie,
                  }))
                }
              >
                <SelectTrigger id="tekstblok-categorie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEKSTBLOK_CATEGORIEEN.map((categorie) => (
                    <SelectItem key={categorie} value={categorie}>
                      {TEKSTBLOK_CATEGORIE_LABELS[categorie]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tekstblok-inhoud">Inhoud</Label>
              <Textarea
                id="tekstblok-inhoud"
                value={form.inhoud}
                onChange={(e) =>
                  setForm((f) => ({ ...f, inhoud: e.target.value }))
                }
                rows={8}
                placeholder="De tekst zoals die op de offerte komt…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={isSaving}
            >
              Annuleren
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {geselecteerd ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
