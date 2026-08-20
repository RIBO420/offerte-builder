"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import {
  PRIORITEIT_LABELS,
  PRIORITEIT_VOLGORDE,
  STATUS_KNOP_LABELS,
  STATUS_TOON,
  STATUS_VOLGORDE,
  voornaamVan,
  type TaakPrioriteit,
  type TaakStatus,
  type VerrijkteTaak,
} from "./types";

const KNOP =
  "inline-flex min-h-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50";
const KNOP_UIT =
  "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground";

/**
 * De vier statusknoppen van een taakkaart (inventaris §A6).
 *
 * De derde knop is het hele punt van taakmodel v2: **"Klaar, moet gecheckt
 * door [voornaam]"**. "Wacht op check" is een echte status en geen labeltje
 * (harde eis 7), en de knop zegt in gewone taal wat er gebeurt als je hem
 * indrukt — inclusief bij wie het dan komt te liggen. Staat er nog geen
 * checker, dan heet hij "Klaar, moet gecheckt" en herinnert een melding je
 * eraan dat er nog iemand bij hoort: de taak schuift wél door, want het werk
 * ís klaar, maar zonder naam blijft hij liggen.
 */
export function TaakStatusKnoppen({
  taak,
  className,
}: {
  taak: VerrijkteTaak;
  className?: string;
}) {
  const setStatus = useMutation(api.klantTaken.setStatus);
  const [bezig, setBezig] = useState(false);

  const huidige = taak.status as TaakStatus;
  const checkerVoornaam = taak.checker ? voornaamVan(taak.checker.naam) : null;

  const kies = async (status: TaakStatus) => {
    if (status === huidige) return;
    setBezig(true);
    try {
      await setStatus({ taakId: taak._id, status });
      if (status === "check") {
        if (checkerVoornaam) {
          showSuccessToast(`Klaargezet voor ${checkerVoornaam}`);
        } else {
          showWarningToast("Klaargezet — kies nog wie het checkt", {
            description:
              "Zonder checker weet niemand dat deze taak op hem of haar wacht.",
          });
        }
      }
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken status"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Status van de taak"
    >
      {STATUS_VOLGORDE.map((status) => {
        const actief = status === huidige;
        const label =
          status === "check" && checkerVoornaam
            ? `Klaar, moet gecheckt door ${checkerVoornaam}`
            : STATUS_KNOP_LABELS[status];
        return (
          <button
            key={status}
            type="button"
            aria-pressed={actief}
            disabled={bezig}
            onClick={() => void kies(status)}
            className={cn(KNOP, actief ? STATUS_TOON[status] : KNOP_UIT)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Prioriteit als drie knoppen naast de status, niet als keuzelijst: het is een
 * driewegschakelaar die je in één klik wilt kunnen omzetten.
 */
export function TaakPrioriteitKnoppen({
  taak,
  className,
}: {
  taak: VerrijkteTaak;
  className?: string;
}) {
  const update = useMutation(api.klantTaken.update);
  const [bezig, setBezig] = useState(false);

  const kies = async (prioriteit: TaakPrioriteit) => {
    if (prioriteit === taak.prioriteit) return;
    setBezig(true);
    try {
      await update({ taakId: taak._id, prioriteit });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken prioriteit"
      );
    } finally {
      setBezig(false);
    }
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Prioriteit van de taak"
    >
      {PRIORITEIT_VOLGORDE.map((prioriteit) => {
        const actief = prioriteit === taak.prioriteit;
        return (
          <button
            key={prioriteit}
            type="button"
            aria-pressed={actief}
            disabled={bezig}
            onClick={() => void kies(prioriteit)}
            className={cn(
              KNOP,
              actief
                ? prioriteit === "hoog"
                  ? "border-status-vervallen-border bg-status-vervallen text-status-vervallen-text"
                  : "border-primary/40 bg-primary/10 text-foreground"
                : KNOP_UIT
            )}
          >
            {PRIORITEIT_LABELS[prioriteit]}
          </button>
        );
      })}
    </div>
  );
}
