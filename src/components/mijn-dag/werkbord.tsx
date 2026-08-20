"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  BlijftLiggenBalk,
  BlijftLiggenKolom,
} from "@/components/mijn-dag/blijft-liggen";
import { BordKolomWeergave } from "@/components/mijn-dag/bord-kolom";
import { LogboekFab } from "@/components/mijn-dag/logboek-fab";
import { PerspectiefBalk } from "@/components/mijn-dag/perspectief-balk";
import { TaakDrawer } from "@/components/mijn-dag/taak-drawer";
import {
  NIET_TOEGEWEZEN,
  STATUS_CHIP_LABELS,
  deadlineVoorBucket,
  verdeelOp,
  type BlijftLiggenModus,
  type Indeling,
  type Perspectief,
  type StatusChip,
  type WanneerBucket,
} from "@/components/mijn-dag/verdeel-op";
import { STATUS_LABELS, type TaakStatus, type VerrijkteTaak } from "@/components/taken/types";

/**
 * Het werkbord "Mijn dag" (inventaris §B).
 *
 * Eén Convex-abonnement (`klantTaken.mijnDag`) levert alles: de taken van de
 * organisatie, de toewijsbare mensen en de klantnamen. Het bord filtert en
 * stapelt daar zelf op — dat scheelt een query per knop en houdt het schuiven
 * tussen perspectieven onmiddellijk.
 *
 * **Bordstand staat in de URL.** Perspectief, indeling, statuschip en de
 * blijft-liggen-modus zijn queryparameters, dus een herlaadde pagina komt
 * terug zoals je hem achterliet en "kijk hier eens naar" is een link.
 *
 * **Het bord scrollt binnen zijn eigen container.** Harde regel 1 van dit
 * project gaat over de pagina: die mag nooit zijwaarts. Een kanban zonder
 * horizontale beweging bestaat niet, dus de beweging zit in de bordstrook zelf
 * en houdt daar op.
 */

// ─── Bordstand in de URL ─────────────────────────────────────────────────────

const PERSPECTIEVEN: Perspectief[] = ["mij", "uitgezet", "alles"];
const INDELINGEN: Indeling[] = ["wanneer", "wie", "status", "klant"];
const CHIPS: StatusChip[] = ["alles", "todo", "bezig", "check"];
const MODI: BlijftLiggenModus[] = ["kolom", "balk", "uit"];

function lees<T extends string>(
  waarde: string | null,
  toegestaan: T[],
  standaard: T
): T {
  return toegestaan.includes((waarde ?? "") as T) ? (waarde as T) : standaard;
}

export function Werkbord() {
  const router = useRouter();
  const zoekParams = useSearchParams();
  const { user } = useCurrentUser();
  const data = useQuery(api.klantTaken.mijnDag, {});

  const update = useMutation(api.klantTaken.update);
  const setStatus = useMutation(api.klantTaken.setStatus);
  const wijsToe = useMutation(api.klantTaken.wijsToe);

  const [geopend, setGeopend] = useState<Id<"klantTaken"> | null>(null);

  const perspectief = lees(zoekParams.get("wie"), PERSPECTIEVEN, "mij");
  const indeling = lees(zoekParams.get("verdeel"), INDELINGEN, "wanneer");
  const statusChip = lees(zoekParams.get("status"), CHIPS, "alles");
  const blijftLiggenModus = lees(zoekParams.get("liggen"), MODI, "kolom");

  const wijzig = useCallback(
    (patch: {
      perspectief?: Perspectief;
      indeling?: Indeling;
      statusChip?: StatusChip;
      blijftLiggenModus?: BlijftLiggenModus;
    }) => {
      const params = new URLSearchParams(zoekParams.toString());
      const zet = (sleutel: string, waarde: string | undefined) => {
        if (waarde !== undefined) params.set(sleutel, waarde);
      };
      zet("wie", patch.perspectief);
      zet("verdeel", patch.indeling);
      zet("status", patch.statusChip);
      zet("liggen", patch.blijftLiggenModus);
      router.replace(`/mijn-dag?${params.toString()}`, { scroll: false });
    },
    [router, zoekParams]
  );

  const taken = useMemo(() => data?.taken ?? [], [data]);
  const personen = useMemo(() => data?.personen ?? [], [data]);

  const { kolommen, blijftLiggen, zichtbaar } = useMemo(
    () =>
      verdeelOp<VerrijkteTaak>({
        taken,
        ikId: user?._id,
        personen,
        indeling,
        perspectief,
        statusChip,
        blijftLiggenModus,
      }),
    [
      taken,
      user?._id,
      personen,
      indeling,
      perspectief,
      statusChip,
      blijftLiggenModus,
    ]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  /**
   * Wat een drop betekent, hangt aan de indeling (§B2). Elke variant is een
   * echte mutatie — het bord is de bediening, niet een plaatje van de stand.
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taakId = String(active.id) as Id<"klantTaken">;
    const doel = String(over.id);
    const huidig = kolommen.find((kolom) =>
      kolom.items.some((taak) => taak._id === taakId)
    );
    if (!huidig || huidig.key === doel) return;

    try {
      if (indeling === "wanneer") {
        const deadline = deadlineVoorBucket(doel as WanneerBucket);
        await update({ taakId, deadline: deadline ?? "" });
        const kolom = kolommen.find((k) => k.key === doel);
        showSuccessToast(
          deadline ? `Ingepland: ${kolom?.titel.toLowerCase()}` : "Datum gewist"
        );
      } else if (indeling === "wie") {
        const makerId =
          doel === NIET_TOEGEWEZEN ? null : (doel as Id<"users">);
        await wijsToe({ taakId, makerId });
        const naam = personen.find((p) => p._id.toString() === doel)?.naam;
        showSuccessToast(
          naam ? `Overgedragen aan ${naam}` : "Taak vrijgegeven"
        );
      } else if (indeling === "status") {
        const status = doel as TaakStatus;
        await setStatus({ taakId, status });
        showSuccessToast(`Status: ${STATUS_LABELS[status]}`);
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Verplaatsen is niet gelukt"
      );
    }
  };

  const taak = useMemo(
    () => taken.find((t) => t._id === geopend) ?? null,
    [taken, geopend]
  );

  if (data === undefined) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-full max-w-xl" />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-[17.5rem] shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="@container/bord grid min-w-0 gap-3">
      <PerspectiefBalk
        perspectief={perspectief}
        indeling={indeling}
        statusChip={statusChip}
        blijftLiggenModus={blijftLiggenModus}
        aantalLiggen={blijftLiggen.length}
        onWijzig={wijzig}
      />

      {blijftLiggenModus === "balk" && (
        <BlijftLiggenBalk
          items={blijftLiggen}
          onOpen={(t) => setGeopend(t._id)}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        {/* De enige horizontale beweging op dit scherm zit hier, binnen de
            bordstrook — de pagina zelf blijft staan (harde regel 1). */}
        <div className="min-w-0 overflow-x-auto pb-2">
          <div className="flex min-h-[16rem] items-stretch gap-3">
            {blijftLiggenModus === "kolom" && (
              <BlijftLiggenKolom
                items={blijftLiggen}
                onOpen={(t) => setGeopend(t._id)}
              />
            )}
            {kolommen.map((kolom) => (
              <BordKolomWeergave
                key={kolom.key}
                kolom={kolom}
                ikId={user?._id?.toString()}
                toonStatus={indeling !== "status"}
                onOpen={(t) => setGeopend(t._id)}
              />
            ))}
          </div>
        </div>
      </DndContext>

      {zichtbaar === 0 && blijftLiggen.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Niets te doen in deze weergave
          {statusChip !== "alles" &&
            ` (filter: ${STATUS_CHIP_LABELS[statusChip].toLowerCase()})`}
          . Taken maak je aan bij de klant of vanuit de dagstaat.
        </p>
      )}

      <TaakDrawer
        taak={taak}
        personen={personen}
        onSluit={() => setGeopend(null)}
      />

      <LogboekFab />
    </div>
  );
}
