"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Loader2,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const addFoto = useMutation(api.kwaliteitsControles.addFoto);
  const removeFoto = useMutation(api.kwaliteitsControles.removeFoto);

  // Group photos by type
  const voorFotos = fotos.filter((f) => f.type === "voor");
  const naFotos = fotos.filter((f) => f.type === "na");

  // Handle file selection
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Alleen afbeeldingen zijn toegestaan");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("Bestand is te groot (max 10MB)");
        return;
      }

      setIsUploading(true);
      try {
        // Convert file to base64 data URL
        // In a production environment, you would upload to a storage service
        // and get a URL back. For now, we use a data URL as placeholder.
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;

          // Add the photo to the QC check
          await addFoto({
            id: kwaliteitsControleId,
            url: dataUrl,
            type: uploadType,
            beschrijving: beschrijving || undefined,
          });

          setShowUploadDialog(false);
          setBeschrijving("");
          onFotoAdded?.();
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Fout bij uploaden foto:", error);
        alert("Er is een fout opgetreden bij het uploaden");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [kwaliteitsControleId, uploadType, beschrijving, addFoto, onFotoAdded],
  );

  // Handle photo deletion
  const handleDelete = async (url: string) => {
    if (!confirm("Weet je zeker dat je deze foto wilt verwijderen?")) return;

    setDeletingUrl(url);
    try {
      await removeFoto({
        id: kwaliteitsControleId,
        fotoUrl: url,
      });
      onFotoRemoved?.();
    } catch (error) {
      console.error("Fout bij verwijderen foto:", error);
    } finally {
      setDeletingUrl(null);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("nl-NL", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Open upload dialog for specific type
  const openUploadDialog = (type: "voor" | "na") => {
    setUploadType(type);
    setBeschrijving("");
    setShowUploadDialog(true);
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      {!disabled && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUploadDialog("voor")}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Foto VOOR
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUploadDialog("na")}
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Foto NA
          </Button>
        </div>
      )}

      {/* Photo galleries */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* VOOR photos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              VOOR
            </Badge>
            <span className="text-sm text-muted-foreground">
              {voorFotos.length} foto{voorFotos.length !== 1 && "'s"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {voorFotos.map((foto, index) => (
              <FotoThumbnail
                key={`voor-${index}`}
                foto={foto}
                onPreview={() => setPreviewFoto(foto)}
                onDelete={() => handleDelete(foto.url)}
                isDeleting={deletingUrl === foto.url}
                disabled={disabled}
              />
            ))}
            {voorFotos.length === 0 && (
              <div className="col-span-2 flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <div className="text-center text-sm">
                  <ImageIcon className="mx-auto h-6 w-6 mb-1 opacity-50" />
                  {"Geen foto's"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NA photos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
            >
              NA
            </Badge>
            <span className="text-sm text-muted-foreground">
              {naFotos.length} foto{naFotos.length !== 1 && "'s"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {naFotos.map((foto, index) => (
              <FotoThumbnail
                key={`na-${index}`}
                foto={foto}
                onPreview={() => setPreviewFoto(foto)}
                onDelete={() => handleDelete(foto.url)}
                isDeleting={deletingUrl === foto.url}
                disabled={disabled}
              />
            ))}
            {naFotos.length === 0 && (
              <div className="col-span-2 flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <div className="text-center text-sm">
                  <ImageIcon className="mx-auto h-6 w-6 mb-1 opacity-50" />
                  {"Geen foto's"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Foto uploaden ({uploadType === "voor" ? "VOOR" : "NA"})
            </DialogTitle>
            <DialogDescription>
              Upload een foto van de werkzaamheden{" "}
              {uploadType === "voor" ? "voordat" : "nadat"} ze zijn uitgevoerd.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="beschrijving">Beschrijving (optioneel)</Label>
              <Input
                id="beschrijving"
                placeholder="Bijv. Overzicht tuin, Detail bestrating..."
                value={beschrijving}
                onChange={(e) => setBeschrijving(e.target.value)}
              />
            </div>

            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Uploaden...
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    Klik om een foto te selecteren
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG of GIF (max 10MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUploadDialog(false)}
            >
              Annuleren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewFoto} onOpenChange={() => setPreviewFoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge
                variant={previewFoto?.type === "voor" ? "outline" : "default"}
                className={cn(
                  previewFoto?.type === "voor" &&
                    "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                  previewFoto?.type === "na" && "bg-green-600",
                )}
              >
                {previewFoto?.type === "voor" ? "VOOR" : "NA"}
              </Badge>
              {previewFoto?.beschrijving || "Foto"}
            </DialogTitle>
            {previewFoto && (
              <DialogDescription>
                Geupload op {formatTimestamp(previewFoto.createdAt)}
              </DialogDescription>
            )}
          </DialogHeader>

          {previewFoto && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewFoto.url}
                alt={previewFoto.beschrijving || "Foto"}
                className="h-full w-full object-contain"
              />
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Thumbnail component for individual photos
interface FotoThumbnailProps {
  foto: QCFoto;
  onPreview: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  disabled: boolean;
}

function FotoThumbnail({
  foto,
  onPreview,
  onDelete,
  isDeleting,
  disabled,
}: FotoThumbnailProps) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={foto.beschrijving || "Foto"}
        className="h-full w-full object-cover"
      />

      {/* Overlay with actions */}
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={onPreview}
          aria-label="Bekijk foto"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        {!disabled && (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label="Verwijder foto"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Description tooltip */}
      {foto.beschrijving && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="truncate text-xs text-white">{foto.beschrijving}</p>
        </div>
      )}
    </div>
  );
}
