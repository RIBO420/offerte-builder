"use client";

import { useDroppable } from "@dnd-kit/core";
import { BordKaart } from "@/components/mijn-dag/bord-kaart";
import type { BordKolom as Kolom } from "@/components/mijn-dag/verdeel-op";
import type { VerrijkteTaak } from "@/components/taken/types";
import { cn } from "@/lib/utils";

/**
 * Eén kolom van het werkbord.
 *
 * De kop blijft staan terwijl je de kolom doorscrolt (`sticky top-0`): bij
 * dertig kaartjes moet je nooit terug naar boven om te zien waar je bent. De
 * regel onder de titel zegt wat slepen hierheen betekent — dat is de enige
 * plek waar die betekenis staat, en hij hoort bij de kolom, niet in een
 * handleiding.
 */
export function BordKolomWeergave({
  kolom,
  ikId,
  toonStatus,
  onOpen,
}: {
  kolom: Kolom<VerrijkteTaak>;
  ikId: string | undefined;
  toonStatus: boolean;
  onOpen: (taak: VerrijkteTaak) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: kolom.key,
    disabled: !kolom.sleepbaar,
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={kolom.titel}
      className={cn(
        "flex w-[18.5rem] shrink-0 flex-col rounded-xl border bg-muted/50 transition-colors",
        isOver && kolom.sleepbaar && "border-primary bg-accent/50"
      )}
    >
      <header className="sticky top-0 z-10 flex items-center gap-2.5 rounded-t-xl border-b bg-muted/80 px-3 py-2.5 backdrop-blur">
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-card text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {kolom.merk}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {kolom.titel}
          </span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">
            {kolom.onder}
          </span>
        </span>
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
            kolom.items.length > 0
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground"
          )}
        >
          {kolom.items.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {kolom.items.length === 0 ? (
          <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-6 text-center text-xs text-muted-foreground">
            Niets open
          </p>
        ) : (
          kolom.items.map((taak) => (
            <BordKaart
              key={taak._id}
              taak={taak}
              ikId={ikId}
              toonStatus={toonStatus}
              sleepbaar={kolom.sleepbaar}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </section>
  );
}
