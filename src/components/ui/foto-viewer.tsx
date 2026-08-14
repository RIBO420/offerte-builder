"use client";

import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ViewerFoto = {
  url: string;
  /** Beschrijving voor schermlezers; valt terug op een generieke tekst. */
  alt?: string;
};

/**
 * Fotoviewer voor bijlagen. Bewust op `Dialog` gebouwd en niet op een eigen
 * overlay: die regelt focus-trap, Escape, portal en `aria-modal` al, en dat
 * zijn precies de dingen die je bij een zelfgebouwde lightbox vergeet.
 *
 * Gestuurd van buitenaf via `index`: `null` is dicht, een getal opent die foto.
 * Zo kan de aanroeper een miniatuur direct op de juiste foto laten openen
 * zonder de viewer per miniatuur te monteren.
 */
export function FotoViewer({
  fotos,
  index,
  onIndexChange,
  titel = "Foto",
}: {
  fotos: ViewerFoto[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Kop voor schermlezers; de viewer toont zelf geen zichtbare titel. */
  titel?: string;
}) {
  const open = index !== null && index >= 0 && index < fotos.length;

  /**
   * Focus zelf terugzetten op de miniatuur waar je vandaan kwam. Radix doet dat
   * normaal, maar alleen als zijn `Content` netjes zijn eigen sluit-cyclus
   * doorloopt; hier verdwijnt de inhoud meteen zodra `index` null wordt en dan
   * beland je op <body>. Zonder dit ben je na het sluiten je plek in de
   * tijdlijn kwijt en moet je met Tab terug naar beneden.
   */
  const herkomstRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      herkomstRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    const herkomst = herkomstRef.current;
    herkomstRef.current = null;
    // Alleen terugzetten als de focus is weggevallen: klikt iemand vanuit de
    // viewer meteen ergens anders heen, dan mag dat blijven staan.
    if (herkomst?.isConnected && document.activeElement === document.body) {
      herkomst.focus();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nieuw) => {
        if (!nieuw) onIndexChange(null);
      }}
    >
      {open && (
        <ViewerInhoud
          fotos={fotos}
          index={index}
          onIndexChange={onIndexChange}
          titel={titel}
        />
      )}
    </Dialog>
  );
}

function ViewerInhoud({
  fotos,
  index,
  onIndexChange,
  titel,
}: {
  fotos: ViewerFoto[];
  index: number;
  onIndexChange: (index: number | null) => void;
  titel: string;
}) {
  const meerdere = fotos.length > 1;
  const foto = fotos[index];

  const ga = useCallback(
    (stap: number) => {
      // Rondlopen: bij drie foto's is "volgende" op de laatste weer de eerste.
      onIndexChange((index + stap + fotos.length) % fotos.length);
    },
    [index, fotos.length, onIndexChange]
  );

  useEffect(() => {
    if (!meerdere) return;
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        ga(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        ga(1);
      }
    };
    // Op document, niet op de content: Radix houdt de focus in de dialog, maar
    // die kan op de sluitknop of een pijlknop staan.
    document.addEventListener("keydown", opToets);
    return () => document.removeEventListener("keydown", opToets);
  }, [meerdere, ga]);

  return (
    // Vaste maximumbreedte, foto gecentreerd. `w-fit` lijkt logischer maar
    // botst met de `w-full` uit de basisklassen van DialogContent: welke wint
    // hangt af van de volgorde in de gegenereerde stylesheet, en in de praktijk
    // kromp de foto daardoor juist (600px → 274px op een smal scherm).
    <DialogContent className="max-w-[min(56rem,calc(100vw-2rem))] gap-3 p-3 sm:max-w-[min(56rem,calc(100vw-4rem))]">
      <DialogTitle className="sr-only">
        {foto.alt ?? titel}
        {meerdere ? ` (${index + 1} van ${fotos.length})` : ""}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {meerdere
          ? "Gebruik de pijltjestoetsen om door de foto's te bladeren."
          : "Druk op Escape om te sluiten."}
      </DialogDescription>

      <div className="relative flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto.url}
          alt={foto.alt ?? titel}
          className="max-h-[75vh] w-auto max-w-full rounded object-contain"
        />

        {meerdere && (
          <>
            <PijlKnop richting="vorige" onClick={() => ga(-1)} />
            <PijlKnop richting="volgende" onClick={() => ga(1)} />
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-xs tabular-nums text-muted-foreground">
          {meerdere ? `${index + 1} van ${fotos.length}` : " "}
        </span>
        <a
          href={foto.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Download className="size-3.5" />
          Openen
        </a>
      </div>
    </DialogContent>
  );
}

function PijlKnop({
  richting,
  onClick,
}: {
  richting: "vorige" | "volgende";
  onClick: () => void;
}) {
  const isVorige = richting === "vorige";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isVorige ? "Vorige foto" : "Volgende foto"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        isVorige ? "left-2" : "right-2"
      )}
    >
      {isVorige ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </button>
  );
}
