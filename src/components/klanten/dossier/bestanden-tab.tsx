"use client";

/**
 * Bestanden — foto's en documenten van deze klant (prototype v13 §A7).
 *
 * Twee panelen, twee soorten materiaal:
 *
 * 1. **Foto's** in een raster met een labelbadge (Voor / Tijdens / Na /
 *    Schets). Het label is de reden dat dit raster bestaat: "de tuin vóór" en
 *    "de tuin na" is het verhaal dat kantoor aan de volgende klant laat zien.
 *    Op mobiel opent de uploadknop rechtstreeks de camera
 *    (`accept="image/*" capture="environment"`), want die foto's worden in de
 *    tuin gemaakt, niet achter een bureau.
 * 2. **Documenten** als rijen. Verzonden offertes en facturen komen hier
 *    AUTOMATISCH in (`convex/lib/klantBestandenArchief.ts`) en dragen het
 *    merkje "automatisch toegevoegd". Zo'n rij heeft geen eigen bestand: hij
 *    verwijst naar de offerte- of factuurpagina, en dat is precies wat je wilt
 *    als je vraagt "waar staat de offerte die we vorig jaar stuurden?".
 *
 * Verwijderen vraagt altijd een bevestiging: een foto van "voor" is niet
 * opnieuw te maken.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  FileText,
  Images,
  Loader2,
  Paperclip,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { FotoViewer } from "@/components/ui/foto-viewer";
import { SectiePaneel } from "@/components/ui/sectie-paneel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/** Waardenlijst uit inventaris §E; "na" hoort erbij (toelichting v13). */
const FOTO_LABELS = ["voor", "tijdens", "na", "schets"] as const;
type FotoLabel = (typeof FOTO_LABELS)[number];

const LABEL_TEKST: Record<FotoLabel, string> = {
  voor: "Voor",
  tijdens: "Tijdens",
  na: "Na",
  schets: "Schets",
};

/**
 * Kleur per label op onze tokens (§C): "voor" is de nulstand (neutraal),
 * "tijdens" loopt (amber), "na" is af (groen), "schets" is papier (kleibruin).
 */
const LABEL_TOON: Record<FotoLabel, string> = {
  voor: "bg-status-concept text-status-concept-text",
  tijdens: "bg-status-in-uitvoering text-status-in-uitvoering-text",
  na: "bg-status-afgerond text-status-afgerond-text",
  schets: "bg-status-herinnering text-status-herinnering-text",
};

const BRON_TEKST: Record<string, string> = {
  upload: "handmatig toegevoegd",
  offerte: "automatisch toegevoegd",
  factuur: "automatisch toegevoegd",
  klant: "door klant gestuurd",
};

function datumKort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Bestand = NonNullable<
  ReturnType<typeof useQuery<typeof api.klantBestanden.list>>
>["fotos"][number];

/** De regel onder een foto / achter een document: wat, wanneer, van wie. */
function metaRegel(bestand: Bestand): string {
  const delen = [bestand.nummer, datumKort(bestand.timestamp)];
  const bron = BRON_TEKST[bestand.bron];
  if (bron && bestand.bron !== "upload") delen.push(bron);
  if (bestand.geuploadDoorNaam) delen.push(bestand.geuploadDoorNaam);
  return delen.filter(Boolean).join(" · ");
}

/**
 * Waar een documentrij heen wijst. Een geüpload bestand heeft een eigen URL;
 * een automatisch gearchiveerde offerte/factuur zonder PDF verwijst naar de
 * plek waar het document zelf leeft.
 */
function documentDoel(bestand: Bestand): { href: string; extern: boolean } | null {
  if (bestand.url) return { href: bestand.url, extern: true };
  if (bestand.offerteId) {
    return { href: `/offertes/${bestand.offerteId}`, extern: false };
  }
  if (bestand.factuurId && bestand.nummer) {
    // Facturen hebben geen detailroute op id; de factuurlijst zoekt op nummer
    // (zelfde patroon als het debiteurenoverzicht).
    return {
      href: `/facturen?zoek=${encodeURIComponent(bestand.nummer)}`,
      extern: false,
    };
  }
  return null;
}

export function BestandenTab({ klantId }: { klantId: Id<"klanten"> }) {
  const bestanden = useQuery(api.klantBestanden.list, { klantId });
  const genereerUploadUrl = useMutation(api.klantBestanden.genereerUploadUrl);
  const registreer = useMutation(api.klantBestanden.registreer);
  const verwijder = useMutation(api.klantBestanden.verwijder);

  const [label, setLabel] = useState<FotoLabel>("voor");
  const [bezig, setBezig] = useState<null | "foto" | "document">(null);
  const [teVerwijderen, setTeVerwijderen] = useState<Bestand | null>(null);
  const [bekijkFoto, setBekijkFoto] = useState<number | null>(null);

  const fotoInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);

  const fotos = bestanden?.fotos ?? [];
  const documenten = bestanden?.documenten ?? [];

  /**
   * Upload → registreer, per bestand. Eén mislukking stopt de rest niet: wie
   * vijf foto's tegelijk kiest wil er vier binnen hebben in plaats van nul.
   */
  const verwerk = async (
    lijst: FileList | null,
    soort: "foto" | "document"
  ) => {
    if (!lijst || lijst.length === 0) return;
    setBezig(soort);
    let gelukt = 0;
    try {
      for (const bestand of Array.from(lijst)) {
        try {
          const uploadUrl = await genereerUploadUrl();
          const reactie = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": bestand.type || "application/octet-stream" },
            body: bestand,
          });
          if (!reactie.ok) throw new Error(`Upload gaf ${reactie.status}`);
          const { storageId } = (await reactie.json()) as {
            storageId: Id<"_storage">;
          };
          await registreer({
            klantId,
            soort,
            label: soort === "foto" ? label : undefined,
            titel: bestand.name || (soort === "foto" ? "Foto" : "Document"),
            storageId,
          });
          gelukt += 1;
        } catch (fout) {
          console.error("klantBestanden: uploaden mislukt", fout);
        }
      }
      if (gelukt === 0) {
        showErrorToast("Uploaden mislukt. Probeer het opnieuw.");
      } else {
        showSuccessToast(
          gelukt === 1
            ? `${soort === "foto" ? "Foto" : "Document"} toegevoegd`
            : `${gelukt} bestanden toegevoegd`
        );
      }
    } finally {
      setBezig(null);
      if (fotoInput.current) fotoInput.current.value = "";
      if (documentInput.current) documentInput.current.value = "";
    }
  };

  const bevestigVerwijderen = async () => {
    if (!teVerwijderen) return;
    try {
      await verwijder({ bestandId: teVerwijderen._id });
      showSuccessToast("Bestand verwijderd");
    } catch (fout) {
      showErrorToast(
        fout instanceof Error ? fout.message : "Verwijderen mislukt"
      );
    } finally {
      setTeVerwijderen(null);
    }
  };

  const laadt = bestanden === undefined;

  return (
    <div className="space-y-4">
      {/* ── Foto's ───────────────────────────────────────────────────────── */}
      <SectiePaneel
        titel="Foto's"
        icoon={<Images />}
        kopbalk
        telling={fotos.length}
        uitleg="Foto's van deze tuin, met een label voor het moment: voor, tijdens, na of een schets. Op een telefoon opent de knop meteen de camera."
        legeRegel={
          !laadt && fotos.length === 0
            ? {
                tekst: "Nog geen foto's.",
                hint: "Kies een label en voeg de eerste toe.",
              }
            : undefined
        }
        acties={
          <>
            <input
              ref={fotoInput}
              type="file"
              accept="image/*"
              // Op mobiel opent dit de camera aan de achterkant — precies wat
              // je wilt als je in de tuin staat (§A7).
              capture="environment"
              multiple
              className="sr-only"
              aria-label="Foto kiezen"
              onChange={(e) => void verwerk(e.target.files, "foto")}
            />
            <Button
              size="xs"
              variant="outline"
              disabled={bezig !== null}
              onClick={() => fotoInput.current?.click()}
            >
              {bezig === "foto" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-3.5" aria-hidden />
              )}
              Foto toevoegen
            </Button>
          </>
        }
      >
        {/* Labelkeuze staat vóór de knop: het label hoort bij de foto die je
            gaat kiezen, niet bij een dialoog achteraf. */}
        <div
          role="radiogroup"
          aria-label="Label voor de volgende foto"
          className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
        >
          <span className="text-[11px] text-muted-foreground">Label:</span>
          {FOTO_LABELS.map((waarde) => (
            <button
              key={waarde}
              type="button"
              role="radio"
              aria-checked={label === waarde}
              tabIndex={label === waarde ? 0 : -1}
              onClick={() => setLabel(waarde)}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                label === waarde
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              {LABEL_TEKST[waarde]}
            </button>
          ))}
        </div>

        {laadt ? (
          <div className="grid grid-cols-2 gap-2 p-3 @[30rem]/sectie:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-md" />
            ))}
          </div>
        ) : fotos.length === 0 ? null : (
          <ul className="grid grid-cols-2 gap-2 p-3 @[30rem]/sectie:grid-cols-3 @[46rem]/sectie:grid-cols-4">
            {fotos.map((foto, index) => (
              <li key={foto._id} className="group/foto min-w-0">
                <div className="relative overflow-hidden rounded-md border bg-muted">
                  <button
                    type="button"
                    onClick={() => setBekijkFoto(index)}
                    className="block w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`${foto.titel} groot bekijken`}
                  >
                    {foto.url ? (
                      <img
                        src={foto.url}
                        alt={foto.titel}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <span className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
                        <Paperclip className="size-5" aria-hidden />
                      </span>
                    )}
                  </button>
                  {foto.label && (
                    <span
                      className={cn(
                        "pointer-events-none absolute top-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        LABEL_TOON[foto.label]
                      )}
                    >
                      {LABEL_TEKST[foto.label]}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setTeVerwijderen(foto)}
                    aria-label={`${foto.titel} verwijderen`}
                    // Altijd bereikbaar met Tab, zichtbaar bij aanwijzen —
                    // een knop die alleen op hover bestaat is voor
                    // toetsenbordgebruikers onvindbaar.
                    className="absolute top-1.5 right-1.5 rounded-full bg-card/90 p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover/foto:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
                <p className="mt-1 truncate text-xs font-medium" title={foto.titel}>
                  {foto.titel}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {metaRegel(foto)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectiePaneel>

      {/* ── Documenten ───────────────────────────────────────────────────── */}
      <SectiePaneel
        titel="Documenten"
        icoon={<FileText />}
        kopbalk
        telling={documenten.length}
        uitleg="Offertes en facturen komen hier automatisch in zodra ze verstuurd zijn. Daarnaast kun je zelf een pdf of afbeelding toevoegen, bijvoorbeeld een tekening of een keuringsrapport."
        legeRegel={
          !laadt && documenten.length === 0
            ? {
                tekst: "Nog geen documenten.",
                hint: "Verzonden offertes en facturen verschijnen hier vanzelf.",
              }
            : undefined
        }
        acties={
          <>
            <input
              ref={documentInput}
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="sr-only"
              aria-label="Document kiezen"
              onChange={(e) => void verwerk(e.target.files, "document")}
            />
            <Button
              size="xs"
              variant="outline"
              disabled={bezig !== null}
              onClick={() => documentInput.current?.click()}
            >
              {bezig === "document" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-3.5" aria-hidden />
              )}
              Document toevoegen
            </Button>
          </>
        }
      >
        {laadt ? (
          <div className="space-y-2 px-3 py-2.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : documenten.length === 0 ? null : (
          <ul className="divide-y">
            {documenten.map((document) => {
              const doel = documentDoel(document);
              const icoon =
                document.bron === "factuur" ? <Receipt /> : <FileText />;
              const inhoud = (
                <>
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-3.5">
                    {icoon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm leading-snug font-medium">
                      {document.titel}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">
                      {metaRegel(document)}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={document._id} className="flex items-start gap-1 pr-2">
                  {doel ? (
                    <Link
                      href={doel.href}
                      {...(doel.extern
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      {inhoud}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2">
                      {inhoud}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setTeVerwijderen(document)}
                    aria-label={`${document.titel} verwijderen`}
                    className="mt-2 shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectiePaneel>

      <FotoViewer
        fotos={fotos
          .filter((foto) => foto.url)
          .map((foto) => ({ url: foto.url as string, alt: foto.titel }))}
        index={bekijkFoto}
        onIndexChange={setBekijkFoto}
        titel="Foto bij deze klant"
      />

      {/* Verwijderen is onomkeerbaar — een foto van "voor" maak je niet over. */}
      <AlertDialog
        open={teVerwijderen !== null}
        onOpenChange={(open) => !open && setTeVerwijderen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestand verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {teVerwijderen?.titel} wordt definitief verwijderd uit dit
              dossier. Dit kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void bevestigVerwijderen()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
