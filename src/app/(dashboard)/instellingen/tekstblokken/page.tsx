"use client";

/**
 * Tekstblokkenbibliotheek — beheerscherm (PRD §2.5b, HERO-nabouw fase 2).
 *
 * Hier beheert de klant zelf de vaste teksten op zijn documenten: per
 * documentsoort (offerte aanleg, factuur, creditfactuur, …) een inleiding en
 * een afsluiting, waarvan er één de standaard is. Velden als {{klant.naam}}
 * vult de app bij het versturen in (convex/lib/documentTekst.ts). Daarnaast
 * de losse standaardteksten en e-mailteksten.
 *
 * Kantoor-only. Platte tekst, geen opmaak: de huisstijl zit in de template.
 * Verwijderen = deactiveren; heractiveren kan altijd.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Archive,
  ArchiveRestore,
  Download,
  Edit,
  Loader2,
  Plus,
  ShieldAlert,
  Star,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  DOCUMENT_SOORTEN,
  DOCUMENT_SOORT_LABELS,
  onbekendePlaceholders,
  type DocumentSoort,
} from "@convex/lib/documentTekst";
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
import { Switch } from "@/components/ui/switch";
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
import { DocumentTekstEditor } from "@/components/teksten/document-tekst-editor";

interface Tekstblok {
  _id: Id<"tekstblokken">;
  naam: string;
  categorie: TekstblokCategorie;
  inhoud: string;
  actief: boolean;
  volgorde: number;
  documentSoort?: DocumentSoort;
  standaard?: boolean;
}

const ALLE_SOORTEN = "__alle__";

interface FormState {
  naam: string;
  categorie: TekstblokCategorie;
  inhoud: string;
  documentSoort: DocumentSoort | undefined;
  standaard: boolean;
}

const LEEG_FORMULIER: FormState = {
  naam: "",
  categorie: "aanhef",
  inhoud: "",
  documentSoort: "offerte_aanleg",
  standaard: false,
};

const isDocumentTekst = (c: TekstblokCategorie) =>
  c === "aanhef" || c === "voorwaarden";

function foutTekst(error: unknown, standaard: string): string {
  return error instanceof Error && "data" in error
    ? String((error as { data: unknown }).data)
    : standaard;
}

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
  const laadStandaard = useMutation(api.tekstblokken.laadStandaardteksten);

  const [showForm, setShowForm] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState<Tekstblok | null>(null);
  const [form, setForm] = useState<FormState>(LEEG_FORMULIER);
  const [isSaving, setIsSaving] = useState(false);
  const [isLaden, setIsLaden] = useState(false);

  const perSoort = useMemo(() => {
    const groepen = new Map<DocumentSoort | typeof ALLE_SOORTEN, Tekstblok[]>();
    for (const blok of blokken ?? []) {
      if (!isDocumentTekst(blok.categorie)) continue;
      const sleutel = blok.documentSoort ?? ALLE_SOORTEN;
      groepen.set(sleutel, [...(groepen.get(sleutel) ?? []), blok]);
    }
    return groepen;
  }, [blokken]);

  const overige = useMemo(
    () => (blokken ?? []).filter((b) => !isDocumentTekst(b.categorie)),
    [blokken]
  );

  const ontbrekendeSoorten = DOCUMENT_SOORTEN.filter(
    (soort) => !(perSoort.get(soort) ?? []).some((b) => b.actief)
  );

  const openNieuw = useCallback(
    (voorzet?: Partial<FormState>) => {
      setGeselecteerd(null);
      setForm({ ...LEEG_FORMULIER, ...voorzet });
      setShowForm(true);
    },
    []
  );

  const openBewerken = useCallback((blok: Tekstblok) => {
    setGeselecteerd(blok);
    setForm({
      naam: blok.naam,
      categorie: blok.categorie,
      inhoud: blok.inhoud,
      documentSoort: blok.documentSoort,
      standaard: blok.standaard ?? false,
    });
    setShowForm(true);
  }, []);

  const formDocumentTekst = isDocumentTekst(form.categorie);
  const formOnbekend = formDocumentTekst
    ? onbekendePlaceholders(form.inhoud, form.documentSoort)
    : [];

  const handleSubmit = useCallback(async () => {
    if (form.naam.trim().length === 0 || form.inhoud.trim().length === 0) {
      toast.error("Naam en inhoud zijn verplicht");
      return;
    }
    const docVelden = isDocumentTekst(form.categorie)
      ? {
          documentSoort: form.documentSoort,
          standaard: form.documentSoort ? form.standaard : false,
        }
      : { standaard: false };
    setIsSaving(true);
    try {
      if (geselecteerd) {
        await updateBlok({
          id: geselecteerd._id,
          naam: form.naam,
          categorie: form.categorie,
          inhoud: form.inhoud,
          ...docVelden,
          documentSoort: isDocumentTekst(form.categorie)
            ? (form.documentSoort ?? null)
            : null,
        });
        toast.success(`"${form.naam}" bijgewerkt`);
      } else {
        await createBlok({
          naam: form.naam,
          categorie: form.categorie,
          inhoud: form.inhoud,
          ...docVelden,
        });
        toast.success(`"${form.naam}" toegevoegd`);
      }
      setShowForm(false);
      setGeselecteerd(null);
    } catch (error) {
      toast.error(foutTekst(error, "Fout bij opslaan tekstblok"));
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
          blok.actief ? `"${blok.naam}" uitgezet` : `"${blok.naam}" aangezet`
        );
      } catch (error) {
        toast.error("Fout bij wijzigen status");
        logger.error("Wijzigen actief-status tekstblok mislukt", error, {
          module: "instellingen/tekstblokken",
        });
      }
    },
    [setActief]
  );

  const handleMaakStandaard = useCallback(
    async (blok: Tekstblok) => {
      try {
        await updateBlok({ id: blok._id, standaard: true });
        toast.success(`"${blok.naam}" is nu de standaard`);
      } catch (error) {
        toast.error(foutTekst(error, "Standaard maken mislukt"));
      }
    },
    [updateBlok]
  );

  const handleLaadStandaard = useCallback(async () => {
    setIsLaden(true);
    try {
      const { toegevoegd } = await laadStandaard({});
      toast.success(
        toegevoegd === 0
          ? "Alle standaardteksten staan er al"
          : `${toegevoegd} standaardtekst${toegevoegd === 1 ? "" : "en"} toegevoegd`
      );
    } catch (error) {
      toast.error(foutTekst(error, "Laden mislukt"));
    } finally {
      setIsLaden(false);
    }
  }, [laadStandaard]);

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

  const blokRij = (blok: Tekstblok) => (
    <li
      key={blok._id}
      className={`flex items-start gap-3 py-3 ${blok.actief ? "" : "opacity-60"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{blok.naam}</span>
          {isDocumentTekst(blok.categorie) && (
            <Badge variant="outline">{TEKSTBLOK_CATEGORIE_LABELS[blok.categorie]}</Badge>
          )}
          {blok.standaard && blok.actief && <Badge>Standaard</Badge>}
          {!blok.actief && <Badge variant="outline">Uit</Badge>}
        </div>
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
          {blok.inhoud}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        {isDocumentTekst(blok.categorie) &&
          blok.documentSoort &&
          blok.actief &&
          !blok.standaard && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Maak ${blok.naam} de standaard`}
              title="Maak standaard"
              onClick={() => handleMaakStandaard(blok)}
            >
              <Star className="size-4" />
            </Button>
          )}
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
          aria-label={blok.actief ? `Zet ${blok.naam} uit` : `Zet ${blok.naam} aan`}
          onClick={() => handleToggleActief(blok)}
        >
          {blok.actief ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
        </Button>
      </div>
    </li>
  );

  const sorteer = (a: Tekstblok, b: Tekstblok) =>
    a.categorie.localeCompare(b.categorie) || a.volgorde - b.volgorde;

  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Tekstblokken</h1>
            <p className="text-sm text-muted-foreground">
              De vaste teksten boven en onder uw offertes en facturen. Velden
              als <code className="text-xs">{"{{klant.naam}}"}</code> vult de app
              zelf in. Een wijziging geldt voor nieuwe documenten; verstuurde
              documenten blijven zoals ze zijn.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ontbrekendeSoorten.length > 0 && (
              <Button variant="outline" onClick={handleLaadStandaard} disabled={isLaden}>
                {isLaden ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Standaardteksten laden
              </Button>
            )}
            <Button onClick={() => openNieuw()}>
              <Plus className="size-4" />
              Nieuw tekstblok
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <LaadIndicator formaat="pagina" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {DOCUMENT_SOORTEN.map((soort) => {
                const groep = [...(perSoort.get(soort) ?? [])].sort(sorteer);
                return (
                  <Card key={soort}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                      <div>
                        <CardTitle>{DOCUMENT_SOORT_LABELS[soort]}</CardTitle>
                        <CardDescription>
                          {groep.length === 0
                            ? "Nog geen teksten: nieuwe documenten van deze soort krijgen geen inleiding of afsluiting."
                            : "De standaard komt vanzelf op elk nieuw document."}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openNieuw({ documentSoort: soort })}
                      >
                        <Plus className="size-4" />
                        Tekst
                      </Button>
                    </CardHeader>
                    {groep.length > 0 && (
                      <CardContent>
                        <ul className="divide-y">{groep.map(blokRij)}</ul>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {(perSoort.get(ALLE_SOORTEN) ?? []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Voor alle documenten</CardTitle>
                  <CardDescription>
                    Inleidingen en afsluitingen die u op elke documentsoort kunt kiezen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {[...(perSoort.get(ALLE_SOORTEN) ?? [])].sort(sorteer).map(blokRij)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {(["standaardtekst", "email"] as const).map((categorie) => {
              const groep = overige.filter((b) => b.categorie === categorie).sort(sorteer);
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
                      <ul className="divide-y">{groep.map(blokRij)}</ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {geselecteerd ? "Tekstblok bewerken" : "Nieuw tekstblok"}
            </DialogTitle>
            <DialogDescription>
              Platte tekst zonder opmaak. Begin een regel met “- ” voor een opsomming.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tekstblok-naam">Naam</Label>
                <Input
                  id="tekstblok-naam"
                  value={form.naam}
                  onChange={(e) => setForm((f) => ({ ...f, naam: e.target.value }))}
                  placeholder="Bijv. Offerte aanleg – inleiding"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tekstblok-categorie">Soort tekst</Label>
                <Select
                  value={form.categorie}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, categorie: value as TekstblokCategorie }))
                  }
                >
                  <SelectTrigger id="tekstblok-categorie" className="w-full">
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
            </div>

            {formDocumentTekst && (
              <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="tekstblok-soort">Documentsoort</Label>
                  <Select
                    value={form.documentSoort ?? ALLE_SOORTEN}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        documentSoort:
                          value === ALLE_SOORTEN ? undefined : (value as DocumentSoort),
                        standaard: value === ALLE_SOORTEN ? false : f.standaard,
                      }))
                    }
                  >
                    <SelectTrigger id="tekstblok-soort" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_SOORTEN.map((soort) => (
                        <SelectItem key={soort} value={soort}>
                          {DOCUMENT_SOORT_LABELS[soort]}
                        </SelectItem>
                      ))}
                      <SelectItem value={ALLE_SOORTEN}>Alle documenten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-3 pb-2 text-sm">
                  <Switch
                    checked={form.standaard}
                    disabled={!form.documentSoort}
                    onCheckedChange={(standaard) => setForm((f) => ({ ...f, standaard }))}
                  />
                  Standaard voor deze soort
                </label>
              </div>
            )}

            {formDocumentTekst ? (
              <DocumentTekstEditor
                id="tekstblok-inhoud"
                label="Tekst"
                value={form.inhoud}
                onChange={(inhoud) => setForm((f) => ({ ...f, inhoud }))}
                documentSoort={form.documentSoort}
                rows={10}
                placeholder="Beste {{klant.naam}},"
              />
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="tekstblok-inhoud">Inhoud</Label>
                <Textarea
                  id="tekstblok-inhoud"
                  value={form.inhoud}
                  onChange={(e) => setForm((f) => ({ ...f, inhoud: e.target.value }))}
                  rows={8}
                  className="max-h-[50vh] overflow-y-auto"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>
              Annuleren
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving || formOnbekend.length > 0}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {geselecteerd ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
