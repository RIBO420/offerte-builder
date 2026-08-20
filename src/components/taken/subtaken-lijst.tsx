"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { VerrijkteTaak } from "./types";

/**
 * Subtaken met een voortgangsbalk (inventaris §A6).
 *
 * De balk is er voor de taken die "half af" zijn — precies het soort werk dat
 * blijft liggen zonder dat iemand het merkt. "3/5" zegt hoeveel, de balk zegt
 * hoe ver: samen zie je in een halve seconde of hier nog een middag in zit.
 *
 * De lijst schrijft in zijn geheel terug via `klantTaken.update`; het veld is
 * één array, dus een subtaak afvinken is een patch van dezelfde array met één
 * omgezette vlag. Optimistische UI laten we hier weg — Convex' subscriptie is
 * sneller dan de animatie.
 */
export function SubtakenLijst({ taak }: { taak: VerrijkteTaak }) {
  const update = useMutation(api.klantTaken.update);
  const [nieuw, setNieuw] = useState("");
  const [bezig, setBezig] = useState(false);

  const subtaken = taak.subtaken ?? [];
  const klaar = taak.subtakenKlaar;
  const totaal = taak.subtakenTotaal;
  const percentage = totaal === 0 ? 0 : Math.round((klaar / totaal) * 100);

  const schrijf = async (volgende: { titel: string; klaar: boolean }[]) => {
    setBezig(true);
    try {
      await update({ taakId: taak._id, subtaken: volgende });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken subtaken"
      );
    } finally {
      setBezig(false);
    }
  };

  const toggle = (index: number) =>
    schrijf(
      subtaken.map((subtaak, i) =>
        i === index ? { ...subtaak, klaar: !subtaak.klaar } : subtaak
      )
    );

  const voegToe = async () => {
    const titel = nieuw.trim();
    if (!titel) return;
    setNieuw("");
    await schrijf([...subtaken, { titel, klaar: false }]);
  };

  return (
    <div className="grid gap-1.5">
      {totaal > 0 && (
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totaal}
            aria-valuenow={klaar}
            aria-label={`${klaar} van ${totaal} subtaken klaar`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {klaar}/{totaal}
          </span>
        </div>
      )}

      <ul className="grid gap-0.5">
        {subtaken.map((subtaak, index) => (
          <li key={`${index}-${subtaak.titel}`} className="flex items-center gap-2">
            <TaakCheckbox
              checked={subtaak.klaar}
              disabled={bezig}
              onCheckedChange={() => toggle(index)}
              aria-label={
                subtaak.klaar
                  ? `Subtaak ${subtaak.titel} heropenen`
                  : `Subtaak ${subtaak.titel} afvinken`
              }
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs leading-5",
                subtaak.klaar &&
                  "text-muted-foreground line-through decoration-muted-foreground/50"
              )}
              title={subtaak.titel}
            >
              {subtaak.titel}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={nieuw}
          onChange={(e) => setNieuw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void voegToe();
            }
          }}
          onBlur={() => void voegToe()}
          aria-label="Subtaak toevoegen"
          placeholder="Subtaak toevoegen"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
