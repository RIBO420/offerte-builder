"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { PersoonAvatar } from "@/components/taken/persoon-avatar";
import { TaakTags } from "@/components/taken/taak-tags";
import type { VerrijkteTaak } from "@/components/taken/types";
import { cn } from "@/lib/utils";

const PIL =
  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none";

/**
 * Het kaartje op het werkbord (inventaris §B4).
 *
 * Een bordkaartje is géén taakkaart: het moet in één oogopslag te scannen zijn
 * in een kolom van vijftien. Daarom staat de klant erboven als pill (op een
 * bord dat over alle klanten heen gaat is dát het eerste dat je zoekt), daarna
 * de titel, en pas dan de meta-regel.
 *
 * De meta-regel deelt de kit-tags (status, prio, deadline, subtaken, 💬) met
 * het dossier en voegt de twee dingen toe die alleen op een bord bestaan:
 * hoe lang er niets is gebeurd, en of jij dit werk hebt uitgezet.
 *
 * Afwijking van de letterlijke §B4-lijst: er staat géén losse pil "Te laat"
 * naast de deadline. De deadlinepil zégt het al — rood met "3 dagen te laat" —
 * en twee pillen met hetzelfde woord maken de regel alleen drukker.
 */
export function BordKaart({
  taak,
  ikId,
  toonStatus,
  sleepbaar,
  onOpen,
}: {
  taak: VerrijkteTaak;
  ikId: string | undefined;
  /** In de Status-indeling is de kolom de status; de pil is dan ruis. */
  toonStatus: boolean;
  sleepbaar: boolean;
  onOpen: (taak: VerrijkteTaak) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: taak._id, disabled: !sleepbaar });

  const isKlaar = taak.status === "klaar";
  const doorMijUitgezet =
    ikId !== undefined &&
    taak.uitgezetDoorId?.toString() === ikId &&
    taak.makerId?.toString() !== ikId;

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-status={taak.status}
      className={cn(
        "grid gap-1 rounded-lg border bg-card px-2.5 py-2 text-left shadow-xs transition-colors",
        sleepbaar && "cursor-grab active:cursor-grabbing",
        isDragging && "z-20 opacity-80 shadow-md",
        isKlaar && "opacity-70"
      )}
      {...listeners}
      {...attributes}
    >
      <button
        type="button"
        // Slepen en klikken delen dezelfde muisknop: na een sleep mag de
        // drawer niet alsnog openspringen.
        onClick={() => {
          if (!isDragging) onOpen(taak);
        }}
        className="grid gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <span className="truncate text-[11px] leading-4 text-muted-foreground">
          {taak.klantNaam}
        </span>
        <span
          className={cn(
            "line-clamp-2 break-words text-[13px] font-medium leading-snug",
            isKlaar &&
              "text-muted-foreground line-through decoration-muted-foreground/50"
          )}
        >
          {taak.titel}
        </span>
      </button>

      <span className="flex flex-wrap items-center gap-1">
        <TaakTags taak={taak} toonStatus={toonStatus} />

        {taak.stilDagen >= 2 && !isKlaar && (
          <span
            className={cn(
              PIL,
              "border-status-verzonden-border bg-status-verzonden text-status-verzonden-text"
            )}
            title={`${taak.stilDagen} dagen geen beweging op deze taak`}
          >
            <span className="tabular-nums">{taak.stilDagen}d</span> stil
          </span>
        )}

        {doorMijUitgezet && (
          <span
            className={cn(
              PIL,
              "border-status-voorcalculatie-border bg-status-voorcalculatie text-status-voorcalculatie-text"
            )}
          >
            door jou uitgezet
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-1">
          <PersoonAvatar persoon={taak.maker} rol="maker" />
          <PersoonAvatar persoon={taak.checker} rol="checker" />
        </span>
      </span>
    </article>
  );
}
