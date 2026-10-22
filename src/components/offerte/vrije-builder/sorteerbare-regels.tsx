"use client";

import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { DragHandle } from "@/components/ui/drag-handle";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Regels verslepen in de vrije builder (@dnd-kit). Alleen de greep start een
 * sleep, zodat de invoervelden in de regel gewoon werken. Binnen een
 * hoofdstuk schuiven de buren opzij; naar een ander hoofdstuk slepen kan ook
 * (dat hoofdstuk licht op). Toetsenbord: spatie/Enter op de greep, pijltjes,
 * spatie/Enter om te plaatsen, Escape annuleert.
 *
 * De volgorde zelf rekent `verplaatsRegel` uit; deze laag vertaalt alleen
 * de sleep naar (actieve regel, doelregel, doelhoofdstuk).
 */

type DropData =
  | { soort: "regel"; hoofdstuk: string }
  | { soort: "hoofdstuk"; hoofdstuk: string };

const hoofdstukId = (hoofdstuk: string) => `hoofdstuk:${hoofdstuk}`;

const RUSTIG = "cubic-bezier(0.25, 1, 0.5, 1)";

const MINDER_BEWEGING = "(prefers-reduced-motion: reduce)";

/**
 * prefers-reduced-motion, veilig zonder matchMedia (jsdom, oude browsers):
 * dan gewoon animeren.
 */
function useMinderBeweging(): boolean {
  return useSyncExternalStore(
    (melding) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mq = window.matchMedia(MINDER_BEWEGING);
      mq.addEventListener("change", melding);
      return () => mq.removeEventListener("change", melding);
    },
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(MINDER_BEWEGING).matches,
    () => false
  );
}

/**
 * Pointer boven een regel → die regel. Pointer wel in een hoofdstuk maar
 * tussen regels (kop, knoppenbalk) → dichtstbijzijnde regel van dát
 * hoofdstuk, of het hoofdstuk zelf als het leeg is. Toetsenbord (geen
 * pointer) → dichtstbijzijnde midden.
 */
const botsing: CollisionDetection = (args) => {
  const binnen = pointerWithin(args);
  if (binnen.length === 0) return closestCenter(args);
  const soortVan = (id: UniqueIdentifier) =>
    args.droppableContainers.find((c) => c.id === id)?.data.current as
      | DropData
      | undefined;

  const regelRaak = binnen.find((b) => soortVan(b.id)?.soort === "regel");
  if (regelRaak) return [regelRaak];

  const hoofdstukRaak = binnen.find((b) => soortVan(b.id)?.soort === "hoofdstuk");
  if (hoofdstukRaak) {
    const hoofdstuk = soortVan(hoofdstukRaak.id)!.hoofdstuk;
    const kandidaten = args.droppableContainers.filter((c) => {
      const d = c.data.current as DropData | undefined;
      return d?.soort === "regel" && d.hoofdstuk === hoofdstuk;
    });
    return kandidaten.length > 0
      ? closestCenter({ ...args, droppableContainers: kandidaten })
      : [hoofdstukRaak];
  }
  return binnen;
};

export interface SleepRegel {
  id: string;
  scope: string;
  omschrijving: string;
  totaal: number;
}

export function RegelSleepContext({
  regels,
  onVerplaats,
  children,
}: {
  regels: SleepRegel[];
  onVerplaats: (actieveId: string, overId: string | null, doelHoofdstuk: string) => void;
  children: ReactNode;
}) {
  const [actiefId, setActiefId] = useState<string | null>(null);
  const reduceMotion = useMinderBeweging();
  const sensors = useSensors(
    // Kleine afstand: tikken op de greep (touch/tablet) start nog geen sleep
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const naam = (id: UniqueIdentifier) => {
    const regel = regels.find((r) => r.id === String(id));
    return regel?.omschrijving.trim() ? `"${regel.omschrijving.trim()}"` : "regel zonder omschrijving";
  };
  const plek = (data: DropData | undefined, id: UniqueIdentifier) =>
    data?.soort === "regel"
      ? `bij ${naam(id)} in ${data.hoofdstuk}`
      : `achteraan in ${data?.hoofdstuk ?? "het hoofdstuk"}`;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${naam(active.id)} opgepakt.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${naam(active.id)} ${plek(over.data.current as DropData | undefined, over.id)}.`
        : `${naam(active.id)} is niet boven een plek.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${naam(active.id)} geplaatst ${plek(over.data.current as DropData | undefined, over.id)}.`
        : `${naam(active.id)} teruggezet.`,
    onDragCancel: ({ active }) => `Verslepen geannuleerd, ${naam(active.id)} staat weer op zijn plek.`,
  };

  const onDragStart = (e: DragStartEvent) => setActiefId(String(e.active.id));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiefId(null);
    const data = over?.data.current as DropData | undefined;
    if (!over || !data) return;
    onVerplaats(
      String(active.id),
      data.soort === "regel" ? String(over.id) : null,
      data.hoofdstuk
    );
  };

  const actief = actiefId ? regels.find((r) => r.id === actiefId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={botsing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiefId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Druk op spatie of Enter om de regel op te pakken. Verplaats hem met de pijltjestoetsen, ook naar een ander hoofdstuk. Druk opnieuw op spatie of Enter om hem neer te zetten, of op Escape om te annuleren.",
        },
      }}
    >
      {children}
      <DragOverlay
        modifiers={[restrictToVerticalAxis]}
        dropAnimation={reduceMotion ? null : { duration: 180, easing: RUSTIG }}
      >
        {actief ? (
          <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2.5 shadow-lg">
            <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {actief.omschrijving.trim() || "Regel zonder omschrijving"}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {formatCurrency(actief.totaal)}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Eén hoofdstuk als sorteerbare lijst én als neerzetplek (ook als het leeg is). */
export function SorteerbaarHoofdstuk({
  hoofdstuk,
  regelIds,
  children,
}: {
  hoofdstuk: string;
  regelIds: string[];
  children: ReactNode;
}) {
  const { setNodeRef, active, over } = useDroppable({
    id: hoofdstukId(hoofdstuk),
    data: { soort: "hoofdstuk", hoofdstuk } satisfies DropData,
  });
  // Oplichten zodra een regel uit een ánder hoofdstuk hier terecht zou komen
  // (boven een van zijn regels of boven het hoofdstuk zelf)
  const actiefUitAnder =
    active !== null &&
    (active.data.current as DropData | undefined)?.hoofdstuk !== hoofdstuk;
  const doelHier =
    (over?.data.current as DropData | undefined)?.hoofdstuk === hoofdstuk;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl transition-shadow duration-150 motion-reduce:transition-none",
        actiefUitAnder && doelHier && "ring-2 ring-ring/50"
      )}
    >
      <SortableContext items={regelIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

/**
 * Sorteerbare regel. `children` krijgt de greep aangereikt om zelf in de
 * eerste regel te plaatsen (vóór de omschrijving).
 */
export function SorteerbareRegel({
  id,
  hoofdstuk,
  naam,
  className,
  children,
}: {
  id: string;
  hoofdstuk: string;
  naam: string;
  className?: string;
  children: (greep: ReactNode) => ReactNode;
}) {
  const reduceMotion = useMinderBeweging();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { soort: "regel", hoofdstuk } satisfies DropData,
    transition: reduceMotion ? null : { duration: 200, easing: RUSTIG },
  });

  const greep = (
    <DragHandle
      ref={setActivatorNodeRef}
      listeners={listeners}
      attributes={attributes}
      isDragging={isDragging}
      aria-label={`Versleep regel ${naam.trim() || "zonder omschrijving"}`}
      className="-ml-2 shrink-0 touch-none"
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
      }}
      className={cn(className, isDragging && "relative z-10 opacity-40")}
      data-testid="vrije-regel"
    >
      {children(greep)}
    </div>
  );
}
