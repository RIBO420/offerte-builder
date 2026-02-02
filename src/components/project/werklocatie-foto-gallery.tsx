"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ImageIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";

interface Foto {
  url: string;
  beschrijving?: string;
  type?: "voor" | "tijdens" | "na";
  createdAt: number;
}

interface WerklocatieFotoGalleryProps {
  werklocatieId: Id<"werklocaties">;
  fotos: Foto[];
}

export function WerklocatieFotoGallery({
  werklocatieId,
  fotos,
}: WerklocatieFotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "voor" | "tijdens" | "na">("all");
  const [deleteConfirmUrl, setDeleteConfirmUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const removeFoto = useMutation(api.werklocaties.removeFoto);

  // Filter photos based on selected tab
  const filteredFotos =
    filter === "all" ? fotos : fotos.filter((f) => f.type === filter);

  // Get counts per type
  const counts = {
    all: fotos.length,
    voor: fotos.filter((f) => f.type === "voor").length,
    tijdens: fotos.filter((f) => f.type === "tijdens").length,
    na: fotos.filter((f) => f.type === "na").length,
  };

  // Navigation in lightbox
  const handlePrevious = () => {
    if (selectedIndex === null || filteredFotos.length === 0) return;
    setSelectedIndex(
      selectedIndex === 0 ? filteredFotos.length - 1 : selectedIndex - 1
    );
  };

  const handleNext = () => {
    if (selectedIndex === null || filteredFotos.length === 0) return;
    setSelectedIndex(
      selectedIndex === filteredFotos.length - 1 ? 0 : selectedIndex + 1
    );
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedIndex === null) return;
    if (e.key === "ArrowLeft") handlePrevious();
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "Escape") setSelectedIndex(null);
  };

  // Delete photo
  const handleDelete = async () => {
    if (!deleteConfirmUrl) return;

    setIsDeleting(true);
    try {
      await removeFoto({
        id: werklocatieId,
        fotoUrl: deleteConfirmUrl,
      });
      toast.success("Foto verwijderd");
      setDeleteConfirmUrl(null);
      // Reset selected index if it was showing the deleted photo
      if (selectedIndex !== null) {
        const deletedIndex = filteredFotos.findIndex(
          (f) => f.url === deleteConfirmUrl
        );
        if (deletedIndex === selectedIndex) {
          setSelectedIndex(null);
        } else if (deletedIndex < selectedIndex) {
          setSelectedIndex(selectedIndex - 1);
        }
      }
    } catch (error) {
      console.error("Error deleting foto:", error);
      toast.error("Er ging iets mis bij het verwijderen");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Download photo
  const handleDownload = (url: string, filename?: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "foto.jpg";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (fotos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Geen foto&apos;s</p>
          <p className="text-sm text-muted-foreground">
            Er zijn nog geen foto&apos;s toegevoegd aan deze werklocatie.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Filter tabs */}
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as typeof filter)}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            Alle ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="voor" className="text-xs sm:text-sm">
            Voor ({counts.voor})
          </TabsTrigger>
          <TabsTrigger value="tijdens" className="text-xs sm:text-sm">
            Tijdens ({counts.tijdens})
          </TabsTrigger>
          <TabsTrigger value="na" className="text-xs sm:text-sm">
            Na ({counts.na})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {filteredFotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Geen foto&apos;s in deze categorie
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filteredFotos.map((foto, index) => (
                <div
                  key={foto.url}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                >
                  <img
                    src={foto.url}
                    alt={foto.beschrijving || `Foto ${index + 1}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />

                  {/* Overlay with actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => setSelectedIndex(index)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => handleDownload(foto.url)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => setDeleteConfirmUrl(foto.url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Type badge */}
                  {foto.type && (
                    <Badge
                      variant="secondary"
                      className="absolute bottom-2 left-2 text-xs"
                    >
                      {foto.type === "voor" && "Voor"}
                      {foto.type === "tijdens" && "Tijdens"}
                      {foto.type === "na" && "Na"}
                    </Badge>
                  )}

                  {/* Date */}
                  <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                    {formatDate(foto.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {selectedIndex !== null && filteredFotos[selectedIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setSelectedIndex(null)}
        >
          {/* Close button */}
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setSelectedIndex(null)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Previous button */}
          {filteredFotos.length > 1 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-4 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* Image */}
          <div
            className="relative max-h-[80vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filteredFotos[selectedIndex].url}
              alt={
                filteredFotos[selectedIndex].beschrijving ||
                `Foto ${selectedIndex + 1}`
              }
              className="max-h-[80vh] max-w-[90vw] object-contain"
            />

            {/* Info bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-black/60 px-4 py-2 text-white">
              <div className="flex items-center gap-2">
                {filteredFotos[selectedIndex].type && (
                  <Badge variant="secondary">
                    {filteredFotos[selectedIndex].type === "voor" && "Voor"}
                    {filteredFotos[selectedIndex].type === "tijdens" && "Tijdens"}
                    {filteredFotos[selectedIndex].type === "na" && "Na"}
                  </Badge>
                )}
                <span className="text-sm">
                  {filteredFotos[selectedIndex].beschrijving ||
                    formatDate(filteredFotos[selectedIndex].createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white/70">
                  {selectedIndex + 1} / {filteredFotos.length}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={() =>
                    handleDownload(filteredFotos[selectedIndex].url)
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  onClick={() =>
                    setDeleteConfirmUrl(filteredFotos[selectedIndex].url)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Next button */}
          {filteredFotos.length > 1 && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-4 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteConfirmUrl}
        onOpenChange={(open) => !open && setDeleteConfirmUrl(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Foto verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze foto wilt verwijderen? Dit kan niet
              ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
