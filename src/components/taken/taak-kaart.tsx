"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ChevronDown, Trash2 } from "lucide-react";
import { TaakCheckbox } from "@/components/taken/taak-checkbox";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PersoonAvatar } from "./persoon-avatar";
import { SubtakenLijst } from "./subtaken-lijst";
import {
  TaakPrioriteitKnoppen,
  TaakStatusKnoppen,
} from "./taak-status-knoppen";
import { TaakTags } from "./taak-tags";
import type { TaakStatus, ToewijsbaarPersoon, VerrijkteTaak } from "./types";
import { WieDoetWat } from "./wie-doet-wat";

/**
 * De taakkaart — één component voor het klantdossier én het werkbord.
 *
 * **Ingeklapt** (inventaris §A6) is het één regel die je scant: afvinkhokje,
 * titel, de tags die iets zeggen, en rechts de twee schijfjes — maker groen,
 * checker amber. Het hokje is een directe klaar-toggle: het meeste werk gaat
 * "todo → klaar" en dat mag geen twee klikken kosten.
 *
 * **Open** komt het gesprek erbij: toelichting, subtaken met voortgangsbalk,
 * wie het maakt en wie het checkt, de vier statusknoppen en de prioriteit. Dat
 * is bewust géén apart bewerkscherm: een taak die je alleen in een dialoog kunt
 * bijstellen, stel je niet bij.
 *
 * `variant="drawer"` is dezelfde kaart zónder eigen open/dicht-knop, voor het
 * zijpaneel van het werkbord: daar ís de kaart het paneel.
 */
export function TaakKaart({
  taak,
  personen,
  variant = "dossier",
  onOpenKlant,
  className,
}: {
  taak: VerrijkteTaak;
  personen: ToewijsbaarPersoon[];
  variant?: "dossier" | "drawer";
  /** Klantnaam als knop tonen (werkbord); weglaten = geen klantregel. */
  onOpenKlant?: (klantId: Id<"klanten">) => void;
  className?: string;
}) {
  const setStatus = useMutation(api.klantTaken.setStatus);
  const removeTaak = useMutation(api.klantTaken.remove);
  const [uitgeklapt, setUitgeklapt] = useState(false);
  const [bezig, setBezig] = useState(false);

  const isDrawer = variant === "drawer";
  const open = isDrawer || uitgeklapt;
  const status = taak.status as TaakStatus;
  const isKlaar = status === "klaar";

  const toggleKlaar = async () => {
    setBezig(true);
    try {
      await setStatus({ taakId: taak._id, status: isKlaar ? "todo" : "klaar" });
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij bijwerken taak"
      );
    } finally {
      setBezig(false);
    }
  };

  const verwijderen = async () => {
    try {
      await removeTaak({ taakId: taak._id });
      showSuccessToast("Taak verwijderd");
    } catch (error) {
      showErrorToast(
        error instanceof Error ? error.message : "Fout bij verwijderen taak"
      );
    }
  };

  return (
    <article
      data-status={status}
      data-open={open}
      className={cn(
        "@container/taak grid gap-2 px-3 py-2 transition-colors",
        !isDrawer && "hover:bg-muted/40",
        // Klaar = gedimd, maar het groene vinkje blijft vol van kleur staan:
        // dat is het bewijs dat het gedaan is.
        isKlaar && "opacity-70",
        className
      )}
    >
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5">
        <TaakCheckbox
          wrapperClassName="mt-0.5"
          checked={isKlaar}
          disabled={bezig}
          onCheckedChange={() => void toggleKlaar()}
          aria-label={
            isKlaar
              ? `Taak ${taak.titel} heropenen`
              : `Taak ${taak.titel} afronden`
          }
        />

        <div className="min-w-0">
          {onOpenKlant && (
            <button
              type="button"
              onClick={() => onOpenKlant(taak.klantId)}
              className="max-w-full truncate rounded text-[11px] leading-4 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {taak.klantNaam}
            </button>
          )}

          {isDrawer ? (
            <h2
              className={cn(
                "break-words text-sm font-medium leading-snug",
                isKlaar &&
                  "text-muted-foreground line-through decoration-muted-foreground/50"
              )}
            >
              {taak.titel}
            </h2>
          ) : (
            <button
              type="button"
              aria-expanded={uitgeklapt}
              onClick={() => setUitgeklapt((vorig) => !vorig)}
              className="flex w-full min-w-0 items-start gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm leading-snug",
                  taak.prioriteit === "hoog" && !isKlaar && "font-medium",
                  isKlaar &&
                    "text-muted-foreground line-through decoration-muted-foreground/50"
                )}
                title={taak.titel}
              >
                {taak.titel}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                  uitgeklapt && "rotate-180"
                )}
              />
              <span className="sr-only">
                {uitgeklapt ? "Taak sluiten" : "Taak openen"}
              </span>
            </button>
          )}

          <TaakTags taak={taak} className="mt-1" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <PersoonAvatar persoon={taak.maker} rol="maker" toonLeeg={open} />
          <PersoonAvatar persoon={taak.checker} rol="checker" toonLeeg={open} />
        </div>
      </div>

      {open && (
        <div className="grid gap-3 pl-[1.75rem]">
          {taak.omschrijving && (
            <p className="whitespace-pre-wrap break-words text-xs leading-snug text-muted-foreground">
              {taak.omschrijving}
            </p>
          )}

          <SubtakenLijst taak={taak} />

          <WieDoetWat taak={taak} personen={personen} />

          <div className="grid gap-1.5">
            <TaakStatusKnoppen taak={taak} />
            <TaakPrioriteitKnoppen taak={taak} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] leading-4 text-muted-foreground">
              {taak.uitzetter
                ? `Uitgezet door ${taak.uitzetter.naam}`
                : "Uitzetter onbekend"}
              {taak.stilDagen >= 2 && !isKlaar && ` · ${taak.stilDagen}d stil`}
            </span>
            <button
              type="button"
              onClick={() => void verwijderen()}
              aria-label={`Taak ${taak.titel} verwijderen`}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] leading-4 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Verwijderen
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
