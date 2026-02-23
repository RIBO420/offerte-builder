"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import {
  Camera,
  Info,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useFotoUpload, useFotoUrls } from "@/hooks/use-foto-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface ConfiguratorFotoUploadProps {
  /** Callback die wordt aangeroepen wanneer de lijst met storageIds verandert */
  onFotosChange: (storageIds: string[]) => void;
  /** Maximaal aantal toe te staan foto's (standaard: 5) */
  maxFotos?: number;
  /** Schakel het component in of uit */
  disabled?: boolean;
}

// ============================================
// Constanten
// ============================================

const MAX_BESTAND_GROOTTE_MB = 10;
const TIPS = [
  "Maak foto's bij daglicht",
  "Fotografeer de volledige tuin vanuit meerdere hoeken",
  "Maak close-ups van probleemgebieden",
  "Voeg een foto toe van de toegang/poort",
] as const;

// ============================================
// Thumbnail subcomponent
// ============================================

interface FotoThumbnailProps {
  storageId: Id<"_storage">;
  urls: Map<string, string>;
  onVerwijder: (storageId: Id<"_storage">) => void;
  disabled: boolean;
}

function FotoThumbnail({
  storageId,
  urls,
  onVerwijder,
  disabled,
}: FotoThumbnailProps) {
  const url = urls.get(storageId);

  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
      {url ? (
        <img
          src={url}
          alt="Geüploade tuinfoto"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Verwijder-knop */}
      {!disabled && (
        <button
          type="button"
          onClick={() => onVerwijder(storageId)}
          className={cn(
            "absolute top-1.5 right-1.5 p-1 rounded-full",
            "bg-black/60 text-white opacity-0 group-hover:opacity-100",
            "transition-opacity focus-visible:opacity-100 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-white"
          )}
          aria-label="Foto verwijderen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================
// Voortgangsbalk subcomponent
// ============================================

interface VoortgangsIndicatorProps {
  bestandsnaam: string;
  voortgang: number;
  status: "wachtend" | "bezig" | "voltooid" | "fout";
  fout?: string;
  onVerwijder: () => void;
}

function VoortgangsIndicator({
  bestandsnaam,
  voortgang,
  status,
  fout,
  onVerwijder,
}: VoortgangsIndicatorProps) {
  if (status === "voltooid") return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {bestandsnaam}
        </p>
        {status === "fout" ? (
          <p className="text-xs text-destructive mt-0.5">{fout}</p>
        ) : (
          <div className="mt-1.5">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${voortgang}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "wachtend" ? "Wachten..." : `${voortgang}% geüpload`}
            </p>
          </div>
        )}
      </div>

      {status === "fout" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
          onClick={onVerwijder}
          aria-label="Verwijder mislukte upload"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {status === "bezig" && (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

// ============================================
// Hoofd component
// ============================================

/**
 * Drop zone component voor het uploaden van foto's bij een configurator aanvraag.
 * Ondersteunt drag & drop en klikken om bestanden te selecteren.
 * Maximaal 5 foto's, elk maximaal 10 MB.
 */
export function ConfiguratorFotoUpload({
  onFotosChange,
  maxFotos = 5,
  disabled = false,
}: ConfiguratorFotoUploadProps) {
  const invoerRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const removeFotoFromAanvraag = useMutation(
    api.fotoStorage.deleteFile
  );

  const {
    uploadFotos,
    verwijderFotoUitLijst,
    voortgangen,
    storageIds,
    isBezig,
    fout: uploadFout,
  } = useFotoUpload();

  const { urls } = useFotoUrls(storageIds);

  // Hoeveel slots zijn er nog beschikbaar
  const aantalGeuploaded = storageIds.length;
  const aantalBeschikbaar = maxFotos - aantalGeuploaded;
  const isVol = aantalBeschikbaar <= 0;

  // ============================================
  // Handlers
  // ============================================

  const handleBestanden = useCallback(
    async (bestanden: FileList | null) => {
      if (!bestanden || bestanden.length === 0 || disabled || isVol) return;

      const bestandenArray = Array.from(bestanden).slice(0, aantalBeschikbaar);
      const resultaten = await uploadFotos(bestandenArray, maxFotos);

      if (resultaten.length > 0) {
        const nieuweStorageIds = [
          ...storageIds,
          ...resultaten.map((r) => r.storageId),
        ];
        onFotosChange(nieuweStorageIds.map(String));
      }
    },
    [
      disabled,
      isVol,
      aantalBeschikbaar,
      uploadFotos,
      maxFotos,
      storageIds,
      onFotosChange,
    ]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void handleBestanden(e.target.files);
      // Reset de input zodat hetzelfde bestand opnieuw geselecteerd kan worden
      if (invoerRef.current) {
        invoerRef.current.value = "";
      }
    },
    [handleBestanden]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!disabled && !isVol) {
        setIsDragOver(true);
      }
    },
    [disabled, isVol]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      void handleBestanden(e.dataTransfer.files);
    },
    [handleBestanden]
  );

  const handleKlikken = useCallback(() => {
    if (!disabled && !isVol && !isBezig) {
      invoerRef.current?.click();
    }
  }, [disabled, isVol, isBezig]);

  const handleVerwijderFoto = useCallback(
    async (storageId: Id<"_storage">) => {
      try {
        await removeFotoFromAanvraag({ storageId });
      } catch {
        // Als het verwijderen mislukt, verwijder alleen lokaal
      }
      // Verwijder lokaal uit de voortgangslijst
      const voortgang = voortgangen.find((v) => v.storageId === storageId);
      if (voortgang) {
        verwijderFotoUitLijst(voortgang.bestandsnaam);
      }
      const bijgewerkt = storageIds.filter((id) => id !== storageId);
      onFotosChange(bijgewerkt.map(String));
    },
    [
      removeFotoFromAanvraag,
      voortgangen,
      verwijderFotoUitLijst,
      storageIds,
      onFotosChange,
    ]
  );

  // ============================================
  // Render
  // ============================================

  const actieveUploads = voortgangen.filter(
    (v) => v.status === "bezig" || v.status === "wachtend" || v.status === "fout"
  );

  return (
    <div className="space-y-4">
      {/* Instructie-tekst */}
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Upload foto&apos;s van uw huidige tuin
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Maximaal {maxFotos} foto&apos;s, elk tot {MAX_BESTAND_GROOTTE_MB} MB.
          Alleen afbeeldingen toegestaan.
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled || isVol || isBezig ? -1 : 0}
        aria-label="Klik of sleep foto's hierheen om te uploaden"
        aria-disabled={disabled || isVol || isBezig}
        onClick={handleKlikken}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleKlikken();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-3",
          "rounded-xl border-2 border-dashed p-8 text-center",
          "transition-colors duration-200",
          // Interactieve statussen
          !disabled && !isVol && !isBezig
            ? "cursor-pointer hover:border-primary/60 hover:bg-primary/5"
            : "cursor-not-allowed opacity-60",
          // Drag-over staat
          isDragOver
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/30 bg-muted/20",
          // Focus
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        )}
      >
        <input
          ref={invoerRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled || isVol || isBezig}
          tabIndex={-1}
          aria-hidden="true"
        />

        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            isDragOver ? "bg-primary/20" : "bg-muted"
          )}
        >
          {isBezig ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <UploadCloud
              className={cn(
                "h-6 w-6",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )}
            />
          )}
        </div>

        <div className="space-y-1">
          {isVol ? (
            <p className="text-sm font-medium text-muted-foreground">
              Maximum aantal foto&apos;s bereikt ({maxFotos}/{maxFotos})
            </p>
          ) : isBezig ? (
            <p className="text-sm font-medium text-foreground">
              Foto&apos;s worden geüpload…
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                <span className="text-primary">Klik om foto&apos;s te kiezen</span>{" "}
                of sleep ze hierheen
              </p>
              <p className="text-xs text-muted-foreground">
                {aantalBeschikbaar === maxFotos
                  ? `Tot ${maxFotos} foto's`
                  : `Nog ${aantalBeschikbaar} foto${aantalBeschikbaar === 1 ? "" : "'s"} toe te voegen`}
              </p>
            </>
          )}
        </div>

        {/* Knop als alternatief voor klikken op de gehele zone */}
        {!isVol && !isBezig && !disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          >
            <Camera className="mr-2 h-4 w-4" />
            Foto&apos;s kiezen
          </Button>
        )}
      </div>

      {/* Foutmelding */}
      {uploadFout && (
        <p className="text-sm text-destructive" role="alert">
          {uploadFout}
        </p>
      )}

      {/* Upload voortgang voor actieve/mislukte uploads */}
      {actieveUploads.length > 0 && (
        <div className="space-y-2">
          {actieveUploads.map((voortgang) => (
            <VoortgangsIndicator
              key={voortgang.bestandsnaam}
              bestandsnaam={voortgang.bestandsnaam}
              voortgang={voortgang.voortgang}
              status={voortgang.status}
              fout={voortgang.fout}
              onVerwijder={() =>
                verwijderFotoUitLijst(voortgang.bestandsnaam)
              }
            />
          ))}
        </div>
      )}

      {/* Thumbnail grid voor geüploade foto's */}
      {storageIds.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {storageIds.map((storageId) => (
            <FotoThumbnail
              key={storageId}
              storageId={storageId}
              urls={urls}
              onVerwijder={handleVerwijderFoto}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Tips info-card */}
      <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Tips voor goede tuinfoto&apos;s
              </p>
              <ul className="space-y-1">
                {TIPS.map((tip) => (
                  <li
                    key={tip}
                    className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"
                      aria-hidden="true"
                    />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
