"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Camera, Upload, Trash2, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { showErrorToast } from "@/lib/toast-utils";
import { LaadIndicator } from "@/components/ui/laad-indicator";

interface QCFoto {
  url: string;
  beschrijving?: string;
  type: "voor" | "na";
  createdAt: number;
}

interface QCFotoUploadProps {
  kwaliteitsControleId: Id<"kwaliteitsControles">;
  fotos: QCFoto[];
  onFotoAdded?: () => void;
  onFotoRemoved?: () => void;
  disabled?: boolean;
}

const TYPE_LABEL: Record<QCFoto["type"], string> = { voor: "Vóór", na: "Na" };

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leesAlsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Bestand lezen mislukt"));
    reader.readAsDataURL(file);
  });
}

export function QCFotoUpload({
  kwaliteitsControleId,
  fotos = [],
  onFotoAdded,
  onFotoRemoved,
  disabled = false,
}: QCFotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"voor" | "na">("voor");
  const [beschrijving, setBeschrijving] = useState("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<QCFoto | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const beschrijvingId = `qc-foto-beschrijving-${kwaliteitsControleId}`;

  const addFoto = useMutation(api.kwaliteitsControles.addFoto);
  const removeFoto = useMutation(api.kwaliteitsControles.removeFoto);

  const groepen: { type: QCFoto["type"]; fotos: QCFoto[] }[] = [
    { type: "voor", fotos: fotos.filter((f) => f.type === "voor") },
    { type: "na", fotos: fotos.filter((f) => f.type === "na") },
  ];

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showErrorToast("Alleen afbeeldingen zijn toegestaan");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showErrorToast("Bestand is te groot (max. 10 MB)");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      // De foto gaat als data-URL mee; een opslagdienst is (nog) niet gekoppeld.
      const dataUrl = await leesAlsDataUrl(file);
      await addFoto({
        id: kwaliteitsControleId,
        url: dataUrl,
        type: uploadType,
        beschrijving: beschrijving.trim() || undefined,
      });
      setShowUploadDialog(false);
      setBeschrijving("");
      onFotoAdded?.();
    } catch (error) {
      logger.error("Uploaden kwaliteitsfoto mislukt", error, {
        module: "project/qc-foto",
        kwaliteitsControleId,
        uploadType,
      });
      showErrorToast("Er is een fout opgetreden bij het uploaden");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (url: string) => {
    if (!confirm("Weet je zeker dat je deze foto wilt verwijderen?")) return;

    setDeletingUrl(url);
    try {
      await removeFoto({ id: kwaliteitsControleId, fotoUrl: url });
      onFotoRemoved?.();
    } catch (error) {
      logger.error("Verwijderen kwaliteitsfoto mislukt", error, {
        module: "project/qc-foto",
        kwaliteitsControleId,
      });
      // De foto blijft gewoon staan na een mislukte verwijdering; zonder melding
      // lijkt het alsof de knop niets doet.
      showErrorToast("Foto kon niet worden verwijderd");
    } finally {
      setDeletingUrl(null);
    }
  };

  const openUploadDialog = (type: "voor" | "na") => {
    setUploadType(type);
    setBeschrijving("");
    setShowUploadDialog(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 @lg/sectie:grid-cols-2">
        {groepen.map((groep) => (
          <div key={groep.type} className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{TYPE_LABEL[groep.type]}</span>
                {" · "}
                {groep.fotos.length} foto{groep.fotos.length !== 1 && "'s"}
              </p>
              {!disabled && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => openUploadDialog(groep.type)}
                >
                  <Camera aria-hidden="true" />
                  Foto {TYPE_LABEL[groep.type].toLowerCase()} toevoegen
                </Button>
              )}
            </div>
            {groep.fotos.length > 0 ? (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                {groep.fotos.map((foto, index) => (
                  <li key={`${groep.type}-${foto.createdAt}-${index}`}>
                    <FotoThumbnail
                      foto={foto}
                      onPreview={() => setPreviewFoto(foto)}
                      onDelete={() => handleDelete(foto.url)}
                      isDeleting={deletingUrl === foto.url}
                      disabled={disabled}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                Nog geen foto&apos;s
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Upload dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Foto {TYPE_LABEL[uploadType].toLowerCase()} toevoegen</DialogTitle>
            <DialogDescription>
              Een foto van de werkzaamheden {uploadType === "voor" ? "voordat" : "nadat"} ze zijn
              uitgevoerd.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={beschrijvingId}>Beschrijving (optioneel)</Label>
              <Input
                id={beschrijvingId}
                placeholder="Bijv. overzicht tuin, detail bestrating…"
                value={beschrijving}
                onChange={(e) => setBeschrijving(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait"
            >
              {isUploading ? (
                <span className="text-center">
                  <LaadIndicator formaat="sectie" />
                  <span className="mt-2 block text-sm text-muted-foreground">Uploaden…</span>
                </span>
              ) : (
                <span className="text-center">
                  <Upload aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
                  <span className="mt-2 block text-sm font-medium">Kies een foto</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    JPG, PNG of GIF (max. 10 MB)
                  </span>
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Annuleren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewFoto} onOpenChange={() => setPreviewFoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2">
              {previewFoto && (
                <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {TYPE_LABEL[previewFoto.type]}
                </span>
              )}
              <span className="min-w-0 break-words">{previewFoto?.beschrijving || "Foto"}</span>
            </DialogTitle>
            {previewFoto && (
              <DialogDescription className="tabular-nums">
                Toegevoegd op {formatTimestamp(previewFoto.createdAt)}
              </DialogDescription>
            )}
          </DialogHeader>

          {previewFoto && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              <Image
                src={previewFoto.url}
                alt={previewFoto.beschrijving || "Foto kwaliteitscontrole"}
                fill
                unoptimized
                priority={false}
                className="object-contain"
              />
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FotoThumbnailProps {
  foto: QCFoto;
  onPreview: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  disabled: boolean;
}

function FotoThumbnail({ foto, onPreview, onDelete, isDeleting, disabled }: FotoThumbnailProps) {
  const naam = foto.beschrijving || `${TYPE_LABEL[foto.type].toLowerCase()}foto`;
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
      {/* De hele tegel opent de foto: werkt met toetsenbord en touch, niet
          alleen met een muis die over de tegel zweeft. */}
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Foto bekijken: ${naam}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Image
          src={foto.url}
          alt=""
          fill
          unoptimized
          priority={false}
          className="object-cover"
        />
      </button>

      {!disabled && (
        <Button
          variant="outline"
          size="icon-xs"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Foto verwijderen: ${naam}`}
          className="absolute top-1 right-1 min-h-0 bg-background/90 text-muted-foreground hover:text-destructive"
        >
          {isDeleting ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
        </Button>
      )}

      {foto.beschrijving && (
        <p className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-background/85 px-1.5 py-0.5 text-[11px] text-foreground">
          {foto.beschrijving}
        </p>
      )}
    </div>
  );
}
